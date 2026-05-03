FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages packages
COPY prisma prisma
RUN pnpm install
RUN pnpm prisma:generate
COPY apps apps
CMD ["pnpm", "--filter", "@atlas/worker", "start"]
