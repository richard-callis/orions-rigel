# Runs `next start` against a full production node_modules (rather than
# Next's `output: "standalone"` trace) on purpose: `prisma` is a runtime
# dependency here (Prisma 7 + driver adapters, no native engine binary to
# worry about), and this same image doubles as the migration runner —
# `docker run <image> npx prisma migrate deploy` — so the Prisma CLI needs
# to be present, which standalone's dependency tracing would prune away.

FROM node:22-alpine AS base
WORKDIR /app

# ---- all dependencies (incl. devDependencies, needed to build) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- production-only dependencies (what ships in the final image) ----
FROM base AS deps-prod
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Client generation only reads prisma/schema.prisma — no live DB needed.
RUN npx prisma generate
RUN npm run build

# ---- runtime ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/src/generated ./src/generated
# Plain JS, not resolved through Next's build/bundling — the weekly
# challenge grader spawns this as a worker_threads Worker, which needs a
# real file on disk. See grade-sql-challenge.ts.
COPY --from=builder /app/src/lib/grade-sql-worker.mjs ./src/lib/grade-sql-worker.mjs
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/package.json ./package.json

RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# Liveness/readiness: GET /api/health and /api/health/ready (see README).
CMD ["npx", "next", "start"]
