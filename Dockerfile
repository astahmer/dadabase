FROM node:24.3.0-alpine3.21 AS base

RUN corepack enable

# ---
FROM base AS deps

WORKDIR /app
COPY ./pnpm-lock.yaml package.json pnpm-workspace.yaml tsconfig.json ./
COPY ./packages/effect-pglite ./packages/effect-pglite

ENV PNPM_HOME=/root/.local/share/pnpm
ENV CI=true
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store/v3 pnpm i --frozen-lockfile

# ---
FROM deps AS builder

WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store/v3 pnpm build

# ---
FROM base AS runtime
ARG ENTRYPOINT=main

WORKDIR /app

# Copy built files
COPY --from=builder /app/dist ./dist

# Start the application
CMD ["pnpm", "start"]

EXPOSE 3006
