import { env } from "../../config/env.js";

const REQUEST_TIMEOUT_MS = 60_000;

interface HermesChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface HermesChatCompletionResult {
  choices?: Array<{ message?: { content?: string } }>;
}

const POSITION_CHAT_SYSTEM_PROMPT =
  "Tu es un coach d'échecs pour un enfant qui utilise FamilySpeak. On te donne la position " +
  "actuelle (FEN) et une question de l'enfant à ce sujet. Réponds en français, simplement, sur " +
  "un ton encourageant. Guide sa réflexion (pose des questions, explique les idées) plutôt que " +
  "de donner directement le meilleur coup — le but est qu'il apprenne à trouver les idées par " +
  "lui-même. Reste concis (5 phrases maximum).";

/** Copie volontaire du pattern d'appel HTTP de hermes/autoReply.ts, non-streaming (v1 : réponse
 * en un bloc, pas de SSE/WS nécessaire pour un simple Q&R ponctuel). */
export async function askAboutPosition(input: {
  fen: string;
  question: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  if (!env.hermesEnabled) {
    return "Le coach IA n'est pas activé pour le moment.";
  }

  const messages: HermesChatMessage[] = [
    { role: "system", content: POSITION_CHAT_SYSTEM_PROMPT },
    { role: "system", content: `Position actuelle (FEN) : ${input.fen}` },
    ...input.history,
    { role: "user", content: input.question },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.hermesApiUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.hermesApiKey}`,
        "X-Hermes-Session-Key": "familyspeak-chess-chat",
        "X-Hermes-Session-Id": "familyspeak-chess-chat",
      },
      body: JSON.stringify({ model: env.hermesModel, messages, stream: false }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`Hermes a répondu ${response.status}: ${await response.text()}`);
      return "Je n'ai pas réussi à réfléchir à ta question, réessaie dans un instant.";
    }
    const data = (await response.json()) as HermesChatCompletionResult;
    return data.choices?.[0]?.message?.content?.trim() || "Je n'ai pas de réponse à te proposer pour l'instant.";
  } catch (err) {
    console.error("Échec de l'appel Hermes (chat position échecs):", err);
    return "Je n'ai pas réussi à réfléchir à ta question, réessaie dans un instant.";
  } finally {
    clearTimeout(timeout);
  }
}
