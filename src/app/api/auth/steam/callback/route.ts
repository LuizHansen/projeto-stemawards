import { NextRequest, NextResponse } from "next/server";
import { verifySteamCallback } from "@/lib/steam-auth";
import { getPlayerSummary } from "@/lib/steam-api";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    const steamId = await verifySteamCallback(request.url);
    const profile = await getPlayerSummary(steamId);

    const user = await prisma.user.upsert({
      where: { steamId },
      create: {
        steamId,
        username: profile.personaname,
        avatarUrl: profile.avatarfull,
        profileUrl: profile.profileurl,
      },
      update: {
        username: profile.personaname,
        avatarUrl: profile.avatarfull,
        profileUrl: profile.profileurl,
      },
    });

    await createSession({ userId: user.id, steamId: user.steamId });

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("Steam login failed", error);
    return NextResponse.redirect(new URL("/?error=steam_login_failed", request.url));
  }
}
