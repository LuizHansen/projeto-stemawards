import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getOrCreateAchievementGuide } from "@/lib/guides/generate";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ achievementId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { achievementId } = await params;

  try {
    const guide = await getOrCreateAchievementGuide(achievementId);
    return NextResponse.json({ guide });
  } catch (error) {
    console.error("Failed to build guide", error);
    return NextResponse.json({ error: "Failed to build guide" }, { status: 500 });
  }
}
