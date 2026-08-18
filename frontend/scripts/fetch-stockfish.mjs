// Télécharge le build Stockfish WASM mono-thread ("lite-single" : pas de SharedArrayBuffer donc
// pas besoin d'en-têtes COOP/COEP sur Caddy) utilisé pour le jeu en direct côté navigateur.
// Servi comme asset statique (frontend/public/), jamais importé via le bundler : le paquet npm
// "stockfish" complet pèse ~250 Mo (plusieurs variantes) alors qu'on n'a besoin que de ces deux
// fichiers (~7 Mo) — on les récupère directement depuis le miroir unpkg du paquet npm plutôt que
// d'installer la dépendance complète dans node_modules.
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const STOCKFISH_VERSION = "18.0.8";
const FILES = ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];
const BASE_URL = `https://unpkg.com/stockfish@${STOCKFISH_VERSION}/bin/`;

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "stockfish");
mkdirSync(outDir, { recursive: true });

for (const file of FILES) {
  const outPath = path.join(outDir, file);
  if (existsSync(outPath)) {
    console.log(`[stockfish] ${file} déjà présent, on saute.`);
    continue;
  }
  console.log(`[stockfish] Téléchargement de ${file}...`);
  const response = await fetch(`${BASE_URL}${file}`);
  if (!response.ok || !response.body) {
    throw new Error(`Échec du téléchargement de ${file} : HTTP ${response.status}`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(outPath));
}
console.log("[stockfish] Prêt.");
