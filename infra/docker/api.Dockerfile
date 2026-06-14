FROM node:22-alpine
WORKDIR /app
RUN corepack enable
# Copy workspace manifests for deterministic install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY prisma.config.ts prisma.config.ts
COPY apps/api/package.json apps/api/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages packages
COPY prisma prisma
COPY modules modules
ENV DIRECT_URL=postgresql://postgres:postgres@localhost:5432/postgres
# Single RUN: install (full) → generate Prisma client → prune devDeps.
# Chaining in one instruction means the final layer only contains the
# production state — devDependencies never make it into the image layers.
RUN pnpm install --frozen-lockfile && \
    pnpm prisma:generate && \
    pnpm prune --prod
# Copy API source after install so that source-only changes don't bust the install cache.
COPY apps/api apps/api
COPY apps/desktop/public/module-logos apps/desktop/public/module-logos
COPY infra/docker/api-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 4010
CMD ["/entrypoint.sh"]
