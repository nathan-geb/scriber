FROM node:20-alpine

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for all workspaces
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install

# Copy source files
COPY apps/web/ apps/web/
COPY packages/core/ packages/core/

# Build the web app
RUN cd apps/web && pnpm run build

# Copy static files that standalone doesn't include
RUN cp -r /app/apps/web/.next/static /app/apps/web/.next/standalone/apps/web/.next/static
RUN cp -r /app/apps/web/public /app/apps/web/.next/standalone/apps/web/public || true

EXPOSE 3000

# Next.js standalone output is structured as apps/web/.next/standalone/apps/web/server.js
WORKDIR /app/apps/web/.next/standalone
CMD ["node", "apps/web/server.js"]