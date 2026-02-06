-- CreateTable
CREATE TABLE "MinutesVersion" (
    "id" TEXT NOT NULL,
    "minutesId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinutesVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinutesVersion_minutesId_version_idx" ON "MinutesVersion"("minutesId", "version");

-- CreateIndex
CREATE INDEX "ShareLink_meetingId_idx" ON "ShareLink"("meetingId");

-- AddForeignKey
ALTER TABLE "MinutesVersion" ADD CONSTRAINT "MinutesVersion_minutesId_fkey" FOREIGN KEY ("minutesId") REFERENCES "Minutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
