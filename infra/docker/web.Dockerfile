# check=skip=SecretsUsedInArgOrEnv
# Build stage always runs on the host platform (amd64) — Vite output is
# platform-agnostic static files so there is no need to emulate arm64 here.
# Only the final nginx stage produces the platform-specific image layer.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
# Copy workspace manifests and lockfile for deterministic install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages packages
COPY apps/desktop apps/desktop
COPY modules modules
RUN pnpm install --frozen-lockfile

# VITE_ args are only needed for local dev builds — the distributed image
# leaves them empty. At runtime, web-entrypoint.sh injects real values via
# SUPABASE_URL / SUPABASE_ANON_KEY / ATLAS_API_URL container env vars.
ARG VITE_ATLAS_API_URL=""
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_BASE_PATH=/app/
ENV VITE_ATLAS_API_URL=$VITE_ATLAS_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN pnpm --filter @atlas/desktop build:web

FROM nginx:alpine
COPY --from=build /app/apps/desktop/dist /usr/share/nginx/html
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
COPY infra/nginx/web-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
