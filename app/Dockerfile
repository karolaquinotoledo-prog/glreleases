# ── Etapa 1: Constructor y Tests ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./

# Instalamos todas las dependencias (incluye Jest y Supertest)
RUN npm install

COPY . .

# Ejecutamos los tests. Si fallan, el build de Jenkins se detendrá aquí.
RUN npm run test:ci

# ── Etapa 2: Imagen de Producción (Runner) ───────────────────────────
FROM node:20-alpine AS runner

# Seguridad: usuario no-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app

# Solo instalamos dependencias de producción
COPY package*.json ./
RUN npm install --production

# Copiamos solo el código necesario desde el builder
COPY --from=builder /app .

USER appuser
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "server.js"]