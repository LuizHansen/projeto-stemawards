-- CreateTable
CREATE TABLE "GameRoadmap" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "stages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameRoadmap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameRoadmap_gameId_key" ON "GameRoadmap"("gameId");

-- AddForeignKey
ALTER TABLE "GameRoadmap" ADD CONSTRAINT "GameRoadmap_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
