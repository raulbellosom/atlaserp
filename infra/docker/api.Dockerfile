FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages packages
COPY prisma prisma
RUN pnpm install
RUN pnpm prisma:generate
COPY apps apps
EXPOSE 4010
CMD ["pnpm", "--filter", "@atlas/api", "start"]
