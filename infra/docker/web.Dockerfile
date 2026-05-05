FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml ./
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages packages
COPY apps/desktop apps/desktop
RUN pnpm install

# Vite bakes these at build-time — must be passed as build args, not runtime env
ARG VITE_ATLAS_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_ATLAS_API_URL=$VITE_ATLAS_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN pnpm --filter @atlas/desktop build:web

FROM nginx:alpine
COPY --from=build /app/apps/desktop/dist /usr/share/nginx/html
COPY infra/nginx/spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
