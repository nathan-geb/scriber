FROM node:20-alpine

WORKDIR /app

# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files for all workspaces
COPY apps/api/package.json apps/api/
COPY packages/core/package.json packages/core/

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source files
COPY apps/api/ apps/api/
COPY packages/core/ packages/core/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build the API
WORKDIR /app/apps/api
RUN pnpm run build

EXPOSE 3000

CMD ["node", "dist/main"]