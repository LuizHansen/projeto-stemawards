import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createFamilyGroup, getFamilyOverview, leaveFamilyGroup } from "@/lib/family";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const overview = await getFamilyOverview(session.userId);
  return NextResponse.json({ overview });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Nome do grupo é obrigatório" }, { status: 400 });

  try {
    const familyGroup = await createFamilyGroup(session.userId, name);
    return NextResponse.json({ familyGroup });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao criar grupo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await leaveFamilyGroup(session.userId);
  return NextResponse.json({ success: true });
}
