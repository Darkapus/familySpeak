FROM caddy:2-builder AS caddy-builder
RUN xcaddy build --with github.com/caddy-dns/duckdns

FROM node:22-alpine AS frontend-builder
RUN corepack enable
WORKDIR /workspace
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY frontend frontend
COPY tsconfig.base.json tsconfig.base.json
RUN pnpm --filter @familyspeak/shared build
RUN pnpm --filter @familyspeak/frontend build

FROM caddy:2-alpine
COPY --from=caddy-builder /usr/bin/caddy /usr/bin/caddy
COPY --from=frontend-builder /workspace/frontend/dist /srv/frontend
COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
