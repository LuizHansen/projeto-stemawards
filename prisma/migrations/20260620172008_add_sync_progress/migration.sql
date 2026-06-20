-- AlterTable
ALTER TABLE "User" ADD COLUMN     "syncError" TEXT,
ADD COLUMN     "syncProcessed" INTEGER,
ADD COLUMN     "syncStartedAt" TIMESTAMP(3),
ADD COLUMN     "syncTotal" INTEGER;
