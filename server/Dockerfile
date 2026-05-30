# AidVocate API — production image
FROM node:22-slim
WORKDIR /app

# Install production deps against the lockfile for reproducible builds.
# (mysql2 is pure JS, so no native build toolchain is required.)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

# Run as the built-in non-root user.
USER node

CMD ["node", "src/index.js"]
