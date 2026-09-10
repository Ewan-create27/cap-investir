FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --chown=node:node public ./public
COPY --chown=node:node server/api.js ./server/api.js
COPY --chown=node:node standalone ./standalone
COPY --chown=node:node drizzle/0000_tricky_pretty_boy.sql ./drizzle/0000_tricky_pretty_boy.sql
COPY --chown=node:node package.json ./package.json
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups
USER node
ENV PORT=3000 DATABASE_PATH=/app/data/cap.sqlite
EXPOSE 3000
CMD ["node", "standalone/server.js"]
