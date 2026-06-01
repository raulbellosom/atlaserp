FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable
# Copy workspace manifests and lockfile for deterministic install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY prisma.config.ts prisma.config.ts
# Copy all workspace package.json files so pnpm resolves the full dependency graph
COPY apps/api/package.json apps/api/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages packages
COPY prisma prisma
COPY modules modules
COPY apps apps
ENV DIRECT_URL=postgresql://postgres:postgres@localhost:5432/postgres
RUN pnpm install --frozen-lockfile
RUN pnpm prisma:generate
COPY infra/docker/api-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 4010
CMD ["/entrypoint.sh"]
