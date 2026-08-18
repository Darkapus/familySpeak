import { CHESS_WEAKNESS_LABELS, type WeaknessCategory } from "@familyspeak/shared";
import { env } from "../../config/env.js";
import { broadcastToUsers } from "../../ws/registry.js";
import {
  getMostRecentLessonGeneratedAt,
  getWeaknessOccurrenceCount,
  insertLesson,
  listWorstMovesForCategory,
} from "./repository.js";

const REQUEST_TIMEOUT_MS = 60_000;
// Sans ce délai, ré-analyser un gros lot de parties (import, rejeu) fait franchir le seuil
// d'occurrences plusieurs dizaines de fois d'affilée pour la même catégorie, et déclenche donc
// autant d'appels Hermes quasi simultanés — au détriment des requêtes interactives (chat de
// position) qui se retrouvent à attendre derrière et finissent par expirer.
const LESSON_COOLDOWN_MS = 6 * 60 * 60 * 1000;

interface HermesChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface HermesChatCompletionResult {
  choices?: Array<{ message?: { content?: string } }>;
}

const LESSON_SYSTEM_PROMPT =
  "Tu es un coach d'échecs pédagogue pour un enfant qui utilise FamilySpeak. On te donne 2-3 " +
  "exemples de coups où l'enfant a commis le même type d'erreur récurrente. Ta tâche : rédiger " +
  "une courte leçon en français, simple et encourageante (pas de jargon inutile), qui explique " +
  "le problème général et donne un ou deux conseils concrets pour progresser. Format : markdown, " +
  "titre court en gras suivi de 3 à 5 phrases maximum. Ne parle jamais de toi-même ni de tes " +
  "propres capacités techniques, va droit à la leçon.";

// Copie volontaire du pattern d'appel HTTP de hermes/autoReply.ts (fetch OpenAI-compatible,
// timeout 60s, ne throw jamais) sans toucher au fichier original — cf. plan d'implémentation.
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
      body: JSON.stringify({ model: env.hermesModel, messages: history, stream: false }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`Hermes a répondu ${response.status}: ${await response.text()}`);
      return null;
    }
    const data = (await response.json()) as HermesChatCompletionResult;
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error("Échec de l'appel Hermes (leçon échecs):", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Génère (et diffuse) une leçon si suffisamment d'exemples existent pour cette catégorie.
 * Non critique (contrairement à l'analyse Stockfish) : appelé en fire-and-forget, jamais via la
 * queue de jobs — un échec ici ne doit jamais faire échouer l'analyse qui l'a déclenché. */
export async function maybeGenerateLessonForCategory(userId: string, category: WeaknessCategory): Promise<void> {
  if (!env.hermesEnabled) return;
  // Auto-suffisant plutôt que déclenché sur un franchissement exact d'un multiple du seuil
  // (l'ancienne logique, côté appelant) : un recalcul en masse du profil (recomputeWeaknessProfile,
  // après un nettoyage d'import) fait bondir le compteur d'un coup, sans jamais "franchir" un
  // multiple un par un, et ne déclenchait donc plus jamais aucune leçon.
  const occurrences = getWeaknessOccurrenceCount(userId, category);
  if (occurrences < env.chessLessonMinOccurrences) return;
  const lastGeneratedAt = getMostRecentLessonGeneratedAt(userId, category);
  if (lastGeneratedAt && Date.now() - lastGeneratedAt < LESSON_COOLDOWN_MS) return;
  const examples = listWorstMovesForCategory(userId, category, 3);
  if (examples.length === 0) return;

  const examplesText = examples
    .map(
      (m, i) =>
        `Exemple ${i + 1} : position FEN "${m.fenBefore}", l'enfant a joué ${m.moveSan} au lieu de ` +
        `${m.bestMoveSan} (perte estimée : ${m.centipawnLoss} centipions).`,
    )
    .join("\n");

  const content = await requestHermesReply(
    [
      { role: "system", content: LESSON_SYSTEM_PROMPT },
      { role: "user", content: `Catégorie d'erreur : ${CHESS_WEAKNESS_LABELS[category]}.\n\n${examplesText}` },
    ],
    `familyspeak-chess-lesson-${userId}`,
  );
  if (!content) return;

  const titleLine = content.split("\n").find((line) => line.trim().length > 0) ?? CHESS_WEAKNESS_LABELS[category];
  const lesson = insertLesson({
    userId,
    category,
    title: titleLine.replace(/[*#]/g, "").trim().slice(0, 120),
    contentMarkdown: content,
    exampleGameId: examples[0]!.gameId,
    examplePly: examples[0]!.ply,
  });

  broadcastToUsers([userId], { type: "chess:lesson-ready", payload: { userId, lessonId: lesson.id, category } });
}
