FROM node:22-alpine AS build
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY extensions/nta-bulk-pricing-discount/package.json ./extensions/nta-bulk-pricing-discount/package.json
RUN pnpm install --frozen-lockfile

COPY . .
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=${DATABASE_URL}
RUN pnpm prisma generate && pnpm run build

FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl && corepack enable
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY extensions/nta-bulk-pricing-discount/package.json ./extensions/nta-bulk-pricing-discount/package.json
RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/prisma ./prisma
RUN pnpm prisma generate
COPY --from=build /app/build ./build

EXPOSE 3000
CMD ["pnpm", "run", "docker-start"]
