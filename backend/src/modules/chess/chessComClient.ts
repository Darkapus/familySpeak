import { env } from "../../config/env.js";

const USER_AGENT = "FamilySpeak-family-chess-trainer/1.0 (self-hosted family app)";

export class ChessComUserNotFoundError extends Error {
  constructor(username: string) {
    super(`Utilisateur chess.com introuvable : ${username}`);
  }
}

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  end_time: number;
  white: { username: string };
  black: { username: string };
}

async function chessComFetch<T>(path: string): Promise<T | null> {
  const response = await fetch(`${env.chessComApiBaseUrl}${path}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`chess.com a répondu ${response.status} pour ${path}`);
  }
  return (await response.json()) as T;
}

/** Liste les mois "YYYY/MM" pour lesquels des parties existent, dans l'ordre chronologique. */
export async function fetchArchiveMonths(username: string): Promise<string[]> {
  const data = await chessComFetch<{ archives: string[] }>(`/player/${encodeURIComponent(username)}/games/archives`);
  if (data === null) throw new ChessComUserNotFoundError(username);
  return data.archives.map((url) => {
    const match = /\/games\/(\d{4})\/(\d{2})$/.exec(url);
    if (!match) throw new Error(`URL d'archive chess.com inattendue: ${url}`);
    return `${match[1]}/${match[2]}`;
  });
}

export async function fetchGamesForMonth(username: string, yearMonth: string): Promise<ChessComGame[]> {
  const data = await chessComFetch<{ games: ChessComGame[] }>(
    `/player/${encodeURIComponent(username)}/games/${yearMonth}`,
  );
  return data?.games ?? [];
}

/** Récupère l'historique complet d'un joueur, mois par mois (séquentiel : usage familial ponctuel,
 * pas besoin de paralléliser et ça évite de solliciter l'API chess.com trop agressivement). */
export async function fetchAllGames(username: string): Promise<ChessComGame[]> {
  const months = await fetchArchiveMonths(username);
  const games: ChessComGame[] = [];
  for (const yearMonth of months) {
    games.push(...(await fetchGamesForMonth(username, yearMonth)));
  }
  return games;
}
