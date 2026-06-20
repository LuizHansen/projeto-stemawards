import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateGameRoadmap } from "@/lib/roadmap/generate";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { appId } = await params;
  const forceRegenerate = request.nextUrl.searchParams.get("refresh") === "true";

  const game = await prisma.game.findUnique({ where: { appId: Number(appId) } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  try {
    const roadmap = await getOrCreateGameRoadmap(game.id, forceRegenerate);
    return NextResponse.json({ roadmap });
  } catch (error) {
    console.error("Failed to build roadmap", error);
    const message = error instanceof Error ? error.message : "Failed to build roadmap";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
