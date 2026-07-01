import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { startSync, processSyncBatch } from "@/lib/sync";

// Each request only syncs one small batch, so it stays well under the
// serverless timeout (60s on Vercel Hobby). The client calls repeatedly
// until the sync reports done.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let start = false;
  try {
    const body = await request.json();
    start = body?.start === true;
  } catch {
    start = false;
  }

  try {
    if (start) {
      await startSync(session.userId, session.steamId);
    }
    const result = await processSyncBatch(session.userId, session.steamId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sync failed", error);
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
