import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { syncUserLibrary } from "@/lib/sync";

// Large libraries (100+ games) take longer than the default function
// timeout to sync - use the highest duration the Vercel plan allows.
export const maxDuration = 300;

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await syncUserLibrary(session.userId, session.steamId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Sync failed", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
