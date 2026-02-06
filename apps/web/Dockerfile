FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY apps/web/ apps/web/
COPY packages/core/ packages/core/

RUN pnpm run build -F web

EXPOSE 3000

CMD ["node", "apps/web/.next/standalone/server.js"]