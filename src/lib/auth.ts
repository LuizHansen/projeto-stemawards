import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) redirect("/");

  return user;
}
