# ── Stage 1: Builder ─────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --production

# ── Stage 2: Runner (imagen inmutable) ───────────────────────────────
FROM node:20-alpine AS runner

# Usuario no-root por seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copiar sólo lo necesario
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=appuser:appgroup . .

USER appuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
