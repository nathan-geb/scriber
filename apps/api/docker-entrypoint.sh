#!/bin/sh
set -e

echo "Running Prisma migrations..."
cd /app/apps/api
npx prisma migrate deploy --schema prisma/schema.prisma

echo "Running database seed (plans + admin)..."
node prisma/seed.js || echo "Seed completed (may have already run)"

echo "Starting API server..."
cd /app
exec node apps/api/dist/src/main.js

