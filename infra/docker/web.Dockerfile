FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages packages
COPY apps/desktop apps/desktop
RUN pnpm install
RUN pnpm --filter @atlas/desktop build:web

FROM nginx:alpine
COPY --from=build /app/apps/desktop/dist /usr/share/nginx/html
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
