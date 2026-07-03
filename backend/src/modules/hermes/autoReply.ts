import type { ConversationDTO, MessageDTO } from "@familyspeak/shared";
import { env } from "../../config/env.js";
import { findUserByUsername } from "../users/repository.js";
import { createTextMessage, listMessages, listMessagesInRange, updateMessageContent } from "../messages/repository.js";
import { getSummary, upsertSummary } from "./summaryRepository.js";
import { getProfile, upsertProfile } from "./profileRepository.js";
import { notifyOfflineMembers } from "../push/notify.js";
import { broadcastToUsers } from "../../ws/registry.js";

const REQUEST_TIMEOUT_MS = 60_000;

// Ces deux prompts sont des tâches d'EXTRACTION, pas des tours de conversation : Hermes garde
// toujours sa propre identité/mémoire de fond (voir CLAUDE.md), donc sans ce cadrage explicite il
// répond parfois "en personnage" (ex: "Naera", ses propres actions/outils) au lieu d'analyser le
// texte fourni. Le format de sortie est volontairement rigide pour pouvoir être validé ensuite
// (voir looksLikeRoleplayLeak / isBulletList) et rejeté s'il dérape.
const IGNORE_META_RULE =
  "Si les messages parlent de l'IA elle-même, de Hermes, de son fonctionnement interne, de ses " +
  "réglages, de son architecture ou de ses capacités techniques, ignore ce contenu : il ne concerne " +
  "pas l'utilisateur et ne doit jamais apparaître dans le résultat.";

const COMPACT_SYSTEM_PROMPT =
  "Tu es un outil d'extraction de résumé, pas un assistant conversationnel. On te fournit un extrait " +
  "de conversation entre un UTILISATEUR HUMAIN et une IA sur FamilySpeak, une appli de messagerie " +
  "familiale. Ta seule tâche : produire un résumé factuel et concis (5 phrases maximum) des " +
  "informations importantes à retenir sur cet utilisateur (préférences, dates, événements, " +
  "décisions), en fusionnant avec le résumé précédent fourni ci-dessous.\n\n" +
  `${IGNORE_META_RULE}\n\n` +
  "Règles strictes : ne parle jamais à la première personne de toi-même, de tes propres outils, " +
  "souvenirs ou actions ; ignore toute information qui ne concerne pas directement cet utilisateur ; " +
  "réponds uniquement par le résumé mis à jour, sans préambule ni formule de politesse.";

const PROFILE_SYSTEM_PROMPT =
  "Tu es un outil d'extraction de profil, pas un assistant conversationnel. On te fournit un extrait " +
  "de conversation entre un UTILISATEUR HUMAIN et une IA sur FamilySpeak, une appli de messagerie " +
  "familiale. Ta seule tâche : extraire des informations sur CET UTILISATEUR HUMAIN pour un profil " +
  "réutilisable plus tard (centres d'intérêt, préférences, personnalité, informations factuelles " +
  "utiles, état d'esprit récent), en fusionnant avec le profil existant fourni ci-dessous : conserve " +
  "ce qui reste valable, retire ce qui est devenu obsolète, ajoute les nouvelles informations " +
  "pertinentes.\n\n" +
  `${IGNORE_META_RULE}\n\n` +
  "Règles strictes : ne parle jamais à la première personne de toi-même, de tes propres outils, " +
  "souvenirs ou actions ; n'invente rien qui n'a pas été mentionné explicitement ; réponds " +
  "UNIQUEMENT par une liste à puces (chaque ligne commence par '-'), sans aucun texte avant ou après. " +
  "Si aucune information exploitable sur l'utilisateur n'apparaît, renvoie le profil existant tel quel.";

interface HermesChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface HermesChatCompletionResult {
  choices?: Array<{ message?: { content?: string } }>;
}

// Filet de sécurité contre les dérapages "en personnage" (voir prompts ci-dessus) : si le texte
// renvoyé ressemble à une réponse de chat plutôt qu'à une extraction, on le rejette et on garde
// l'ancienne valeur plutôt que de polluer le profil/résumé avec du contenu hors sujet.
function looksLikeRoleplayLeak(text: string): boolean {
  return /\bnaera\b|\bje suis\b|\bmon r[ôo]le\b|\bj'ai\b/i.test(text);
}

function isBulletList(text: string): boolean {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.length > 0 && lines.every((l) => /^[-•*]\s/.test(l));
}

// Isole la mémoire long terme de Hermes par canal : chaque conversation familiale (donc chaque
// utilisateur humain, une seule conversation 1:1 avec le bot par personne) a sa propre clé, tout
// comme l'extraction de profil. Sans ça, tout FamilySpeak partagerait la même mémoire Hermes que
// l'usage personnel du propriétaire de la machine ET entre les différents enfants de la famille.
function conversationSessionKey(conversationId: string): string {
  return `familyspeak-conv-${conversationId}`;
}

function profileSessionKey(humanUserId: string): string {
  return `familyspeak-profile-${humanUserId}`;
}

function previewFor(message: MessageDTO): string {
  if (message.type === "image") return "[Photo]";
  if (message.type === "video") return "[Vidéo]";
  return message.content ?? "";
}

// Répond automatiquement à la place de HERMES_BOT_USERNAME (visperine) dans ses conversations
// 1:1, en relayant l'historique récent (+ un résumé compact du reste) à l'agent Hermes. Ne doit
// jamais faire planter l'appelant (mêmes règles que ws/handlers.ts) : toute erreur reste dans
// generateAndPostReply.
export function triggerHermesAutoReply(conversation: ConversationDTO, message: MessageDTO): void {
  if (!env.hermesEnabled) return;
  if (conversation.type !== "direct" || conversation.members.length !== 2) return;
  if (message.type !== "text" || !message.content) return;

  const botUser = findUserByUsername(env.hermesBotUsername);
  if (!botUser || message.senderId === botUser.id) return;
  if (!conversation.members.some((m) => m.id === botUser.id)) return;

  void generateAndPostReply(conversation, botUser.id, message.senderId);
}

async function generateAndPostReply(conversation: ConversationDTO, botUserId: string, humanUserId: string): Promise<void> {
  const memberIds = conversation.members.map((m) => m.id);
  let message: MessageDTO | null = null;
  let fullText = "";

  // Résumé et profil sont "best effort" : on utilise la version déjà en base pour cette réponse
  // (éventuellement un peu datée) et on lance leur mise à jour en tâche de fond, sans jamais
  // attendre dessus. Un Hermes lent ou en timeout sur cette étape ne doit jamais empêcher de
  // répondre au message reçu (c'est exactement ce qui s'est produit avant ce correctif : un
  // timeout dans maybeUpdateUserProfile faisait échouer tout generateAndPostReply avant même
  // d'avoir tenté de générer la réponse).
  const summary = getSummary(conversation.id)?.summary ?? null;
  const profile = getProfile(humanUserId)?.profile ?? null;
  void compactOlderHistoryIfNeeded(conversation.id, botUserId).catch((err) =>
    console.error("Échec de la compaction Hermes (tâche de fond, sans impact sur la réponse):", err),
  );
  void maybeUpdateUserProfile(conversation.id, humanUserId, botUserId).catch((err) =>
    console.error("Échec de la mise à jour du profil Hermes (tâche de fond, sans impact sur la réponse):", err),
  );

  // "visperine écrit..." (même mécanisme que la saisie humaine) pendant que Hermes réfléchit,
  // avant que le premier fragment n'arrive et ne fasse apparaître la bulle de message.
  broadcastToUsers(memberIds, {
    type: "typing:update",
    payload: { conversationId: conversation.id, userId: botUserId, isTyping: true },
  });

  try {
    const { messages: recentWindow } = listMessages(conversation.id, { limit: env.hermesHistoryLimit });
    const recentHistory: HermesChatMessage[] = recentWindow
      .filter((m) => m.type !== "system")
      .map((m) => ({ role: m.senderId === botUserId ? "assistant" : "user", content: previewFor(m) }));

    const persona: HermesChatMessage = { role: "system", content: env.hermesPersona };
    const profileContext: HermesChatMessage[] = profile
      ? [{ role: "system", content: `Profil connu de la personne avec qui tu parles : ${profile}` }]
      : [];
    const summaryContext: HermesChatMessage[] = summary
      ? [{ role: "system", content: `Résumé des échanges précédents avec cet interlocuteur : ${summary}` }]
      : [];

    // Le premier fragment reçu crée le message (et le diffuse) ; les suivants sont diffusés en
    // delta pour un rendu progressif côté client, sans attendre la fin de la génération.
    await requestHermesReplyStreaming(
      [persona, ...profileContext, ...summaryContext, ...recentHistory],
      conversationSessionKey(conversation.id),
      (delta) => {
        fullText += delta;
        if (!message) {
          broadcastToUsers(memberIds, {
            type: "typing:update",
            payload: { conversationId: conversation.id, userId: botUserId, isTyping: false },
          });
          message = createTextMessage({ conversationId: conversation.id, senderId: botUserId, content: delta });
          broadcastToUsers(memberIds, { type: "message:new", payload: { message } });
        } else {
          broadcastToUsers(memberIds, {
            type: "message:delta",
            payload: { messageId: message.id, conversationId: conversation.id, delta, done: false },
          });
        }
      },
    );
  } catch (err) {
    console.error("Échec de la réponse automatique Hermes:", err);
  } finally {
    broadcastToUsers(memberIds, {
      type: "typing:update",
      payload: { conversationId: conversation.id, userId: botUserId, isTyping: false },
    });

    if (message) {
      const finalMessage: MessageDTO = message;
      updateMessageContent(finalMessage.id, fullText);
      broadcastToUsers(memberIds, {
        type: "message:delta",
        payload: { messageId: finalMessage.id, conversationId: conversation.id, delta: "", done: true },
      });
      notifyOfflineMembers(conversation, { ...finalMessage, content: fullText });
    } else {
      // Rien n'a été généré (erreur, timeout, flux vide) : mieux vaut le dire que laisser un
      // silence total, qui ressemble à un bug plutôt qu'à un problème ponctuel côté IA.
      const errorMessage = createTextMessage({
        conversationId: conversation.id,
        senderId: botUserId,
        content: "⚠️ Je n'ai pas réussi à répondre (problème technique). Réessaie dans un instant.",
      });
      broadcastToUsers(memberIds, { type: "message:new", payload: { message: errorMessage } });
      notifyOfflineMembers(conversation, errorMessage);
    }
  }
}

// Replie dans un résumé compact les messages qui viennent de sortir de la fenêtre récente
// (HERMES_HISTORY_LIMIT), par lots de HERMES_COMPACT_BATCH_SIZE, pour garder une cohérence sur
// toute la conversation sans faire grossir indéfiniment le nombre de messages envoyés à Hermes.
async function compactOlderHistoryIfNeeded(conversationId: string, botUserId: string): Promise<string | null> {
  const { messages: recentWindow, nextBefore } = listMessages(conversationId, { limit: env.hermesHistoryLimit });
  const existing = getSummary(conversationId);
  if (nextBefore === null || recentWindow.length === 0) return existing?.summary ?? null;

  const windowStart = recentWindow[0]!.createdAt;
  const cursor = existing?.summarizedUpToCreatedAt ?? 0;
  const toCompact = listMessagesInRange(conversationId, { after: cursor, beforeExclusive: windowStart }).filter(
    (m) => m.type !== "system",
  );
  if (toCompact.length < env.hermesCompactBatchSize) return existing?.summary ?? null;

  const transcript = toCompact
    .map((m) => `${m.senderId === botUserId ? "IA" : "Utilisateur"}: ${previewFor(m)}`)
    .join("\n");
  const userPrompt = `Résumé précédent : ${existing?.summary ?? "Aucun."}\n\nNouveaux messages à intégrer :\n${transcript}`;

  const newSummary = await requestHermesReply(
    [
      { role: "system", content: COMPACT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    conversationSessionKey(conversationId),
  );
  if (!newSummary || looksLikeRoleplayLeak(newSummary)) {
    if (newSummary) console.error("Résumé Hermes rejeté (dérapage détecté), conservation de l'ancien:", newSummary);
    return existing?.summary ?? null;
  }

  const summarizedUpTo = toCompact[toCompact.length - 1]!.createdAt;
  upsertSummary(conversationId, newSummary, summarizedUpTo);
  return newSummary;
}

// Met à jour le profil de l'utilisateur humain (pas visperine) par lots de
// HERMES_PROFILE_UPDATE_BATCH_SIZE nouveaux messages, indépendamment de la fenêtre de la
// conversation : contrairement au résumé, ce profil vit au niveau de l'utilisateur (pas de la
// conversation) et est affiché dans l'appli (clic sur l'avatar).
async function maybeUpdateUserProfile(conversationId: string, humanUserId: string, botUserId: string): Promise<string | null> {
  const existing = getProfile(humanUserId);
  const cursor = existing?.lastMessageConsideredCreatedAt ?? 0;
  const newMessages = listMessagesInRange(conversationId, { after: cursor }).filter((m) => m.type !== "system");
  if (newMessages.length < env.hermesProfileUpdateBatchSize) return existing?.profile ?? null;

  const transcript = newMessages
    .map((m) => `${m.senderId === botUserId ? "IA" : "Utilisateur"}: ${previewFor(m)}`)
    .join("\n");
  const userPrompt = `Profil actuel : ${existing?.profile ?? "Aucun."}\n\nNouveaux messages à prendre en compte :\n${transcript}`;

  const newProfile = await requestHermesReply(
    [
      { role: "system", content: PROFILE_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    profileSessionKey(humanUserId),
  );
  if (!newProfile || looksLikeRoleplayLeak(newProfile) || !isBulletList(newProfile)) {
    if (newProfile) console.error("Profil Hermes rejeté (dérapage détecté), conservation de l'ancien:", newProfile);
    return existing?.profile ?? null;
  }

  upsertProfile(humanUserId, newProfile, newMessages[newMessages.length - 1]!.createdAt);
  return newProfile;
}

// Flux SSE compatible OpenAI (voir /v1/chat/completions avec stream:true) : chaque ligne
// "data: {...}" porte un choices[0].delta.content, jusqu'à la fin du flux. Le timeout est
// réarmé à chaque fragment reçu (timeout d'inactivité), pas une limite sur la durée totale.
async function requestHermesReplyStreaming(
  history: HermesChatMessage[],
  sessionKey: string,
  onDelta: (delta: string) => void,
): Promise<void> {
  const controller = new AbortController();
  let timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const resetTimeout = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  };

  try {
    const response = await fetch(`${env.hermesApiUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.hermesApiKey}`,
        "X-Hermes-Session-Key": sessionKey,
        "X-Hermes-Session-Id": sessionKey,
      },
      body: JSON.stringify({
        model: env.hermesModel,
        messages: history,
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      console.error(`Hermes a répondu ${response.status}: ${await response.text().catch(() => "")}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetTimeout();
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        for (const line of rawEvent.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]" || !data) continue;
          try {
            const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) onDelta(delta);
          } catch {
            // fragment SSE malformé/coupé : ignoré, le flux continue
          }
        }
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function requestHermesReply(history: HermesChatMessage[], sessionKey: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.hermesApiUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.hermesApiKey}`,
        "X-Hermes-Session-Key": sessionKey,
        "X-Hermes-Session-Id": sessionKey,
      },
      body: JSON.stringify({
        model: env.hermesModel,
        messages: history,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(`Hermes a répondu ${response.status}: ${await response.text()}`);
      return null;
    }

    const data = (await response.json()) as HermesChatCompletionResult;
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } finally {
    clearTimeout(timeout);
  }
}
