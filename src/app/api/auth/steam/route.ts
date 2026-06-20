import { NextResponse } from "next/server";
import { getSteamAuthUrl } from "@/lib/steam-auth";

export async function GET() {
  try {
    const authUrl = await getSteamAuthUrl();
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Failed to start Steam login", error);
    return NextResponse.json({ error: "Failed to start Steam login" }, { status: 500 });
  }
}
