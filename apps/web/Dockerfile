FROM node:20-alpine

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for all workspaces
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source files
COPY apps/web/ apps/web/
COPY packages/core/ packages/core/

# Build the web app
WORKDIR /app/apps/web
RUN pnpm run build

EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]