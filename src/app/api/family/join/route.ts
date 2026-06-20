import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { joinFamilyGroup } from "@/lib/family";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const inviteCode = typeof body.inviteCode === "string" ? body.inviteCode.trim() : "";
  if (!inviteCode) {
    return NextResponse.json({ error: "Código de convite é obrigatório" }, { status: 400 });
  }

  try {
    const familyGroup = await joinFamilyGroup(session.userId, inviteCode);
    return NextResponse.json({ familyGroup });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao entrar no grupo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
