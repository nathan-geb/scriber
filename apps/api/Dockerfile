FROM node:20-alpine

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for all workspaces
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install

# Copy source files
COPY apps/api/ apps/api/
COPY packages/core/ packages/core/

# Generate Prisma client and build
RUN cd apps/api && npx prisma generate
RUN cd apps/api && pnpm run build

EXPOSE 3000

# Run from /app so node_modules resolution works
CMD ["node", "apps/api/dist/src/main.js"]