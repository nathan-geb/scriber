FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/

RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

COPY apps/api/ apps/api/
COPY packages/core/ packages/core/

RUN pnpm run build -F api

EXPOSE 3000

CMD ["node", "apps/api/dist/main"]