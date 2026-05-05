FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
# Copy all workspace package.json files so pnpm resolves the full dependency graph
COPY apps/api/package.json apps/api/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages packages
COPY prisma prisma
RUN pnpm install --filter @atlas/api...
RUN pnpm prisma:generate
COPY apps apps
EXPOSE 4010
CMD ["pnpm", "--filter", "@atlas/api", "start"]
