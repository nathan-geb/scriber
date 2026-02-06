-- CreateEnum
CREATE TYPE "MomentType" AS ENUM ('DECISION', 'ACTION_ITEM', 'QUESTION', 'KEY_POINT', 'DISAGREEMENT', 'CUSTOM');

-- AlterEnum
ALTER TYPE "MeetingStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "avgSpeakerConfidence" DOUBLE PRECISION,
ADD COLUMN     "inaudibleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastProcessedAt" TIMESTAMP(3),
ADD COLUMN     "qualityScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Speaker" ADD COLUMN     "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nameConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE "TranscriptSegment" ADD COLUMN     "languagesUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "originalText" TEXT;

-- CreateTable
CREATE TABLE "MinutesTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "format" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinutesTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeyMoment" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "timestamp" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "type" "MomentType" NOT NULL DEFAULT 'CUSTOM',
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KeyMoment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptCorrection" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "correctedText" TEXT NOT NULL,
    "correctedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentEdit" (
    "id" TEXT NOT NULL,
    "segmentId" TEXT NOT NULL,
    "previousText" TEXT NOT NULL,
    "newText" TEXT NOT NULL,
    "editedBy" TEXT NOT NULL,
    "editReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentEdit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinutesTemplate_userId_idx" ON "MinutesTemplate"("userId");

-- CreateIndex
CREATE INDEX "KeyMoment_meetingId_idx" ON "KeyMoment"("meetingId");

-- CreateIndex
CREATE INDEX "TranscriptCorrection_segmentId_idx" ON "TranscriptCorrection"("segmentId");

-- CreateIndex
CREATE INDEX "SegmentEdit_segmentId_idx" ON "SegmentEdit"("segmentId");

-- CreateIndex
CREATE INDEX "Meeting_userId_createdAt_idx" ON "Meeting"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "TranscriptSegment_meetingId_startTime_idx" ON "TranscriptSegment"("meetingId", "startTime");

-- AddForeignKey
ALTER TABLE "MinutesTemplate" ADD CONSTRAINT "MinutesTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeyMoment" ADD CONSTRAINT "KeyMoment_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptCorrection" ADD CONSTRAINT "TranscriptCorrection_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "TranscriptSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentEdit" ADD CONSTRAINT "SegmentEdit_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "TranscriptSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
