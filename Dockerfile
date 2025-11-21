# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy only package files first (for better layer caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy workspace packages
COPY packages ./packages

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build the application
RUN pnpm build

# Push database schema to create the database file
RUN pnpm db push

# Production stage
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy from builder: node_modules, dist, and app.db
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/app.db ./app.db
COPY --from=builder /app/package.json .
COPY --from=builder /app/pnpm-lock.yaml .

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

USER nodejs

# Expose the port your app runs on
EXPOSE 3006

# Use dumb-init to handle signals properly
ENTRYPOINT ["/sbin/dumb-init", "--"]

# Start the application
CMD ["pnpm", "start"]
