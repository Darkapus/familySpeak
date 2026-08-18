FROM node:22-alpine AS base
RUN apk add --no-cache ffmpeg
RUN corepack enable

# Stockfish n'a pas de paquet apk stable sur Alpine (seulement edge/testing, incompatible avec
# cette image basée sur une version stable) : on le compile depuis les sources officielles dans
# un stage à part, jeté ensuite. Un binaire précompilé officiel ne conviendrait pas non plus (ils
# ciblent glibc, pas musl) — compiler ici garantit un binaire natif compatible avec ce container.
FROM alpine:3.21 AS chess-engine-builder
RUN apk add --no-cache build-base git
RUN git clone --depth 1 --branch sf_18 https://github.com/official-stockfish/Stockfish.git /stockfish
RUN make -C /stockfish/src -j"$(nproc)" build ARCH=x86-64

FROM base AS deps
WORKDIR /workspace
COPY pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY backend/package.json backend/package.json
COPY pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared packages/shared
COPY backend backend
COPY tsconfig.base.json tsconfig.base.json
RUN pnpm --filter @familyspeak/shared build
# En dev, main/types pointent vers src/index.ts : tsx et vite transpilent du TS à la volée donc
# ça fonctionne tel quel. En prod, seul dist/ est copié dans l'image finale (pas de transpileur au
# runtime) : on réécrit ces champs ici, dans le package.json copié dans l'image, sans toucher au
# fichier du dépôt (qui doit rester pointé vers src/ pour le dev).
RUN cd packages/shared && pnpm pkg set main=./dist/index.js types=./dist/index.d.ts
RUN pnpm --filter @familyspeak/backend build

FROM base AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /workspace/node_modules /app/node_modules
COPY --from=deps /workspace/backend/node_modules /app/backend/node_modules
COPY --from=deps /workspace/packages/shared/node_modules /app/packages/shared/node_modules
COPY --from=build /workspace/packages/shared/dist /app/packages/shared/dist
COPY --from=build /workspace/packages/shared/package.json /app/packages/shared/package.json
COPY --from=build /workspace/backend/dist /app/backend/dist
COPY --from=build /workspace/backend/drizzle /app/backend/drizzle
COPY --from=build /workspace/backend/package.json /app/backend/package.json
COPY --from=chess-engine-builder /stockfish/src/stockfish /usr/local/bin/stockfish
RUN chown -R node:node /app
USER node

WORKDIR /app/backend
EXPOSE 3000
CMD ["node", "dist/index.js"]
