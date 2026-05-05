# Shared dependencies layer
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Dev stage: source is mounted by docker/podman compose.
# Keep this stage light by avoiding a full source COPY.
FROM deps AS dev
WORKDIR /app
CMD ["npm", "run", "dev"]

# Build stage (used for production artifacts)
FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
# Install tsx globally or locally to run the server
RUN npm install tsx
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/src/lib/engine.ts ./src/lib/engine.ts
COPY --from=builder /app/src/lib/types.ts ./src/lib/types.ts

EXPOSE 3000
CMD ["npm", "run", "start"]
