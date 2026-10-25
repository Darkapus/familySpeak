# FamilySpeak

Messagerie privée façon WhatsApp, pour une famille uniquement (parent + enfants). PWA
auto-hébergée, pas d'inscription ouverte : seul un parent peut créer des comptes.

## Déploiement en cours (IMPORTANT)

- **URL en production** : https://visperine.duckdns.org — déployée sur un **VPS Linux** du
  réseau local (`visperine@192.168.68.59`, Ubuntu, hostname `visperine`), **pas** dans Docker
  Desktop sur le PC Windows. Le PC Windows n'est que le poste de dev : on y édite le code, la
  prod tourne ailleurs. Le contexte docker `vps` (`ssh://visperine@192.168.68.59`) y donne accès.
- Le port **443** de la box est redirigé vers l'IP locale du VPS (déjà configuré).
- Le clone déployé est `/home/visperine/familySpeak` sur le VPS (même repo GitHub
  `Darkapus/familySpeak`, avec son propre `.env` et son dossier `data/`). La stack y est lancée
  via `docker compose` à la racine de ce clone.
- **Ne PAS lancer `docker --context vps compose up` depuis le PC Windows** : les bind mounts
  relatifs (`./data/db`) sont résolus côté Windows (`F:\familySpeak\data\db`) et le
  conteneur n'est pas recréé (erreur `invalid volume specification`). Toujours exécuter
  compose **sur le VPS** (voir ci-dessous).
- Comptes réels de la famille déjà créés : `visperine` (parent, "papa"), `louise`, `gabriel`,
  `samuel` (enfants). **Ne jamais modifier/supprimer ces comptes ou leurs conversations en
  testant** — toujours créer un compte de test jetable (voir section Tests ci-dessous) et le
  nettoyer après usage.

### Commandes de déploiement courantes

Procédure de déploiement depuis le PC Windows (deux étapes) :

```bash
# 1. Envoyer le code sur le VPS. Méthode préférée : git (le propriétaire a autorisé Claude à
#    commit + push sur `main` pour déployer), puis `git pull` sur le VPS :
#      git push && ssh visperine@192.168.68.59 'cd familySpeak && git pull'
#    Alternative sans push : copie directe des fichiers modifiés (laisse le clone VPS "sale") :
cd F:/familySpeak
tar cf - $(git status --short | awk '{print $2}') | ssh visperine@192.168.68.59 'cd familySpeak && tar xf -'

# 2. Rebuild + redéploiement, exécutés SUR le VPS
ssh visperine@192.168.68.59 'cd familySpeak && docker compose up -d --build'
```

Autres commandes courantes (toutes via ssh, dans `~/familySpeak` sur le VPS) :

```bash
ssh visperine@192.168.68.59 'cd familySpeak && docker compose ps'
ssh visperine@192.168.68.59 'cd familySpeak && docker compose logs backend --tail 50'
ssh visperine@192.168.68.59 'cd familySpeak && docker compose logs caddy --tail 50'
ssh visperine@192.168.68.59 'cd familySpeak && docker compose exec backend node dist/scripts/create-admin.js <user> <pass> <displayName>'
```

Le build du Caddy (`xcaddy`) télécharge beaucoup de modules Go et peut échouer ponctuellement
sur un problème réseau : relancer simplement la commande (les couches réussies sont en cache).

Le `.env` contient les secrets réels (JWT_SECRET, clés VAPID, DOMAIN=visperine.duckdns.org,
DUCKDNS_API_TOKEN). Il existe déjà **sur le VPS** (`~/familySpeak/.env`) et n'est pas versionné
(`.gitignore`). Voir `.env.example` pour la liste des variables.

Healthcheck : `ssh visperine@192.168.68.59 'docker inspect --format="{{.State.Health.Status}}" familyspeak-backend-1'`
doit renvoyer `healthy` après un déploiement (peut prendre ~10-30s).

### Domaine secondaire www.baschet.fr

En plus de `visperine.duckdns.org`, l'appli est aussi servie nativement (vraie HTTPS, pas de
frame/redirection masquée) sous `www.baschet.fr`. Le domaine est enregistré chez OVH.

- **DNS chez OVH** : `www.baschet.fr` doit être un **CNAME vers `visperine.duckdns.org`**, pas
  un enregistrement A statique. L'IP de la box est dynamique et déjà maintenue à jour par le
  DDNS DuckDNS (client intégré à la box, pas de script sur cette machine) — un CNAME hérite
  automatiquement de cette mise à jour, un A record chez OVH se figerait au prochain
  changement d'IP.
- **Certificat** : défi DNS-01 via le module Caddy `github.com/caddy-dns/ovh` (ajouté dans
  `infra/caddy/Dockerfile`), avec des identifiants API OVH (`OVH_ENDPOINT=ovh-eu`,
  `OVH_APPLICATION_KEY`, `OVH_APPLICATION_SECRET`, `OVH_CONSUMER_KEY` dans `.env`) ayant les
  droits d'édition sur `/domain/zone/baschet.fr/*`. Générés sur https://api.ovh.com/createToken.
- `infra/caddy/Caddyfile` a un bloc `www.baschet.fr` séparé (challenge OVH différent de celui
  de `{$DOMAIN}`), les deux important le même snippet `(app)` pour éviter la duplication du
  reverse proxy/fichiers statiques.
- Le sous-domaine apex `baschet.fr` reste géré par la redirection web OVH (302 vers
  `www.baschet.fr`) — inchangé, pas besoin de le pointer vers ce serveur.

## Stack technique

- **Monorepo pnpm** : `backend/`, `frontend/`, `packages/shared/` (types + contrat WS partagés).
- **Backend** : Fastify + TypeScript, `better-sqlite3` + Drizzle ORM, `ws` natif (pas Socket.io),
  `@fastify/jwt`, `@fastify/multipart`, `@fastify/rate-limit`, `sharp`/`fluent-ffmpeg` (miniatures),
  `web-push` (notifications).
- **Frontend** : React + Vite, `vite-plugin-pwa` (stratégie `injectManifest`, service worker
  custom dans `frontend/src/sw.ts`), TanStack Query, Zustand, Tailwind CSS v4.
- **Déploiement** : Caddy (HTTPS auto via Let's Encrypt + challenge DNS-01 DuckDNS) devant
  Fastify, le tout en docker-compose. `infra/caddy/Dockerfile` build aussi le frontend (multi-stage).

## Comment tester (sans polluer les vraies données ni casser la prod)

### Tester en local sans Docker (dev rapide)
```bash
pnpm --filter @familyspeak/backend dev     # backend sur :3000
pnpm --filter @familyspeak/frontend dev    # frontend Vite sur :5173 (proxy /api et /ws vers :3000)
```

### Tester contre le serveur RÉEL déployé (recommandé pour valider un vrai déploiement)
Le serveur de prod tourne sur le VPS (`192.168.68.59`) ; depuis le réseau local on peut le tester
en HTTPS réel sans passer par internet, en forçant la résolution DNS vers l'IP du VPS (le
certificat Let's Encrypt est valide pour ce nom donc TLS fonctionne normalement). Un simple
`curl https://visperine.duckdns.org/...` fonctionne aussi (testé), mais `--resolve` évite de
dépendre de la box :

```bash
curl -s --resolve visperine.duckdns.org:443:192.168.68.59 https://visperine.duckdns.org/api/...
```

### Tester avec un vrai navigateur (Playwright) — nécessaire pour attraper les bugs JS runtime
`curl` ne peut PAS reproduire les bugs qui ne se manifestent qu'en exécutant le JS (erreurs
React, `Content-Type` ajouté par le vrai client fetch, service worker...). Installer un
navigateur headless dans le scratchpad (pas dans le repo) :

```bash
cd <scratchpad>
npm init -y && npm install playwright-core
npx --yes playwright install chromium
```

Script type (adapter le chemin de sortie des screenshots) :
```js
import { chromium } from "playwright-core";
const browser = await chromium.launch({
  headless: true,
  args: ["--host-resolver-rules=MAP visperine.duckdns.org 192.168.68.59"],
});
const page = await (await browser.newContext()).newPage();
page.on("pageerror", (err) => console.log("[pageerror]", err.message));
page.on("response", (res) => { if (res.url().includes("/api/")) console.log(res.status(), res.url()); });
await page.goto("https://visperine.duckdns.org/", { waitUntil: "networkidle" });
// ... interactions (page.fill, page.click), puis page.screenshot({ path: "x.png" })
await browser.close();
```
Utiliser un `viewport` mobile (`{ width: 390, height: 844 }`) pour tester le rendu téléphone.

### Compte de test jetable + nettoyage
```bash
ssh visperine@192.168.68.59 'cd familySpeak && docker compose exec backend node dist/scripts/create-admin.js debugtest "motdepassedebug123" "DebugTest"'
```
Après les tests, supprimer proprement (respecter l'ordre à cause des clés étrangères :
attachments/message_receipts → messages → conversation_members → conversations →
refresh_tokens/push_subscriptions → users) :
```js
// sur le VPS : docker compose exec backend node -e "...."  (via ssh visperine@192.168.68.59)
const user = db.prepare("SELECT id FROM users WHERE username='debugtest'").get();
const convs = new Set([
  ...db.prepare('SELECT conversation_id FROM conversation_members WHERE user_id = ?').all(user.id).map(r=>r.conversation_id),
  ...db.prepare('SELECT id FROM conversations WHERE created_by = ?').all(user.id).map(r=>r.id),
]);
for (const cid of convs) {
  const msgs = db.prepare('SELECT id FROM messages WHERE conversation_id = ?').all(cid);
  for (const m of msgs) {
    db.prepare('DELETE FROM attachments WHERE message_id = ?').run(m.id);
    db.prepare('DELETE FROM message_receipts WHERE message_id = ?').run(m.id);
  }
  db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(cid);
  db.prepare('DELETE FROM conversation_members WHERE conversation_id = ?').run(cid);
  db.prepare('DELETE FROM conversations WHERE id = ?').run(cid);
}
db.prepare('DELETE FROM ortho_attempts WHERE user_id = ?').run(user.id);
db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(user.id);
db.prepare('DELETE FROM push_subscriptions WHERE user_id = ?').run(user.id);
db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
```

## Modules annexes

- **Orthographe** (`/orthographe`, bouton ✏️ sur l'accueil) : jeu de phrases à trous pour un enfant
  de CM2 (accords : pluriel s/x, féminin, verbes -e/-es/-ent, a/à est/et sont/son ont/on,
  participe passé être/avoir). 5 catégories dans `packages/shared/src/orthographe.ts`. Les 60
  exercices (avec astuce) sont écrits à la main dans `frontend/src/pages/Orthographe/exercises.ts` :
  ajouter une ligne dans le tableau de la bonne catégorie suffit (id auto `pl1`, `fe1`, `ve1`,
  `ho1`, `pa1`… selon la position : **ne pas réordonner/supprimer** de lignes existantes, ça
  fausserait l'historique `ortho_attempts.item_id`, ajouter à la fin). Le backend (`/api/orthographe`)
  ne stocke que les tentatives ; `pickSession.ts` pondère le tirage vers les phrases ratées et les
  catégories faibles. Un parent peut voir les stats d'un enfant (`?userId=`).

## Pièges déjà rencontrés (ne pas reproduire)

1. **Ne jamais envoyer `Content-Type: application/json` sur une requête POST sans corps**
   (ex: `/api/auth/refresh`). Fastify tente de parser un JSON vide et renvoie 400 avant
   d'exécuter la route. `api/client.ts` ne met ce header que si `options.body` est défini.
2. **Sélecteur Zustand qui retourne un littéral `?? {}`/`?? []`** : ça crée un nouvel objet à
   chaque appel, Zustand compare par référence (`Object.is`), donc re-render infini (React
   error #185). Toujours utiliser une constante module-level comme fallback stable.
3. **Rotation du refresh token = usage unique** : deux appels concurrents à `/api/auth/refresh`
   (timer de fond, retour d'onglet, reconnexion WS...) font échouer le perdant. Le backend ne
   doit PAS effacer le cookie sur un échec transitoire (seul un vrai logout le fait), et le
   frontend déduplique les appels concurrents (`refreshAccessToken` dans `api/client.ts`,
   utilisé partout — jamais appeler `/auth/refresh` ailleurs sans passer par cette fonction).
4. **Un handler WebSocket qui throw fait planter tout le process Node** (donc déconnecte toute
   la famille). `ws/handlers.ts` enveloppe tout traitement d'événement client dans un try/catch.
   Ne jamais retirer cette protection, et vérifier l'existence des entités référencées (ex:
   `findMessageById` avant `markMessageRead`) plutôt que de compter sur les contraintes SQL.
5. **Ordre des événements WS pour la réconciliation optimiste** : le serveur envoie `message:ack`
   AVANT de diffuser `message:new` (y compris à l'expéditeur), sinon le client affiche le
   message deux fois (son entrée optimiste + la diffusion, avant que l'ack ne les fusionne).
6. **Ne jamais envoyer d'accusé de lecture pour un message optimiste** (id temporaire côté
   client, pas encore en base) — provoque une violation de clé étrangère côté serveur.
7. **Règles des Hooks React** : tous les hooks (useState/useEffect/useQuery...) doivent être
   appelés avant tout `return` conditionnel dans un composant. Une erreur ici a déjà causé un
   bug difficile à diagnostiquer.
8. **Layout mobile avec `h-[100dvh]` + flexbox imbriqué** : chaque niveau flexbox qui contient
   une zone scrollable a besoin de `min-h-0` (colonne) explicite, sinon le contenu déborde le
   parent au lieu de scroller dans la zone prévue, et la page entière devient scrollable dans
   tous les sens. `html, body, #root { height: 100%; overflow: hidden }` dans `index.css` est
   nécessaire pour contenir le tout.
9. Le service worker PWA ne doit **jamais** mettre en cache les réponses `/api/*` dynamiques
   (auth, messages) — seuls les médias immuables (`/api/attachments/*`) et le shell applicatif
   statique sont mis en cache (`frontend/src/sw.ts`).

## TODO / prochaines itérations

- **Pagination des messages au scroll** : actuellement `listMessages` charge tout d'un coup
  (limite 50 par défaut côté API, mais le frontend ne charge qu'une seule page et ne redemande
  jamais la suite). À terme, charger les messages plus anciens au scroll vers le haut (l'API
  supporte déjà `?before=<timestamp>` et renvoie `nextBefore`), sinon la mémoire du navigateur
  va grossir indéfiniment sur les conversations à fort historique.
- **Empaqueter en appli installable "native"** sur téléphone (au-delà du PWA "Ajouter à l'écran
  d'accueil") : envisager un TWA (Trusted Web Activity, via Bubblewrap) pour Android et/ou
  Capacitor pour un binaire iOS/Android à partir du frontend existant.
- **Appels audio/vidéo** (phase 2 du projet initial, jamais commencée) : nécessiterait WebRTC +
  un serveur TURN/STUN.
- Envisager le chiffrement/permissions plus fins si le périmètre s'étend au-delà d'une famille
  restreinte (actuellement TLS en transit seulement, messages en clair en base — choix assumé
  pour permettre une supervision parentale).

## Repo

Dépôt git (branche `main`, remote GitHub `Darkapus/familySpeak`). Le clone sur le VPS est celui
qui est réellement déployé : le garder aligné avec le PC (push/pull ou copie directe, voir
« Procédure de déploiement »).
