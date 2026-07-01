-- AlterTable
ALTER TABLE "User" ADD COLUMN     "syncQueue" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
