FROM node:24.3.0-alpine3.21 AS base

RUN corepack enable && apk add --no-cache dumb-init

# ---
FROM base AS deps

WORKDIR /app
COPY ./pnpm-lock.yaml ./package.json ./pnpm-workspace.yaml ./tsconfig.json ./
COPY ./packages ./packages
COPY ./patches ./patches
COPY ./public ./public
COPY ./src ./src
COPY ./drizzle.config.ts ./vite.config.ts ./vitest.config.ts ./biome.json ./components.json ./

ENV PNPM_HOME=/root/.local/share/pnpm
ENV CI=true
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store/v3 pnpm i --frozen-lockfile

# ---
FROM deps AS builder

WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store/v3 pnpm build

# Push database schema to create the database file
RUN pnpm db push

# ---
FROM base AS runtime
ARG ENTRYPOINT=main

WORKDIR /app

# Copy only necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/app.db ./app.db
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/pnpm-lock.yaml .

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3006

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["pnpm", "start"]
