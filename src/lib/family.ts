import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function getUserFamilyGroup(userId: string) {
  const membership = await prisma.familyMember.findFirst({
    where: { userId },
    include: { familyGroup: true },
  });
  return membership?.familyGroup ?? null;
}

export async function createFamilyGroup(userId: string, name: string) {
  const existing = await getUserFamilyGroup(userId);
  if (existing) throw new Error("Você já faz parte de um grupo familiar");

  const familyGroup = await prisma.familyGroup.create({
    data: {
      name,
      ownerId: userId,
      inviteCode: generateInviteCode(),
      members: { create: { userId } },
    },
  });

  return familyGroup;
}

export async function joinFamilyGroup(userId: string, inviteCode: string) {
  const existing = await getUserFamilyGroup(userId);
  if (existing) throw new Error("Você já faz parte de um grupo familiar");

  const familyGroup = await prisma.familyGroup.findUnique({
    where: { inviteCode: inviteCode.trim().toUpperCase() },
  });
  if (!familyGroup) throw new Error("Código de convite inválido");

  await prisma.familyMember.create({
    data: { familyGroupId: familyGroup.id, userId },
  });

  return familyGroup;
}

export async function leaveFamilyGroup(userId: string) {
  const membership = await prisma.familyMember.findFirst({ where: { userId } });
  if (!membership) return;
  await prisma.familyMember.delete({ where: { id: membership.id } });
}

export type FamilyLibraryGame = {
  gameId: string;
  appId: number;
  name: string;
  headerUrl: string | null;
  owners: {
    userId: string;
    username: string;
    avatarUrl: string | null;
    achievementsUnlocked: number;
    achievementsTotal: number;
  }[];
};

export async function getFamilyOverview(userId: string) {
  const familyGroup = await getUserFamilyGroup(userId);
  if (!familyGroup) return null;

  const members = await prisma.familyMember.findMany({
    where: { familyGroupId: familyGroup.id },
    include: {
      user: {
        include: {
          games: { include: { game: true } },
        },
      },
    },
  });

  const gamesByAppId = new Map<number, FamilyLibraryGame>();

  for (const member of members) {
    for (const userGame of member.user.games) {
      const existing = gamesByAppId.get(userGame.game.appId);
      const owner = {
        userId: member.user.id,
        username: member.user.username,
        avatarUrl: member.user.avatarUrl,
        achievementsUnlocked: userGame.achievementsUnlocked,
        achievementsTotal: userGame.achievementsTotal,
      };

      if (existing) {
        existing.owners.push(owner);
      } else {
        gamesByAppId.set(userGame.game.appId, {
          gameId: userGame.game.id,
          appId: userGame.game.appId,
          name: userGame.game.name,
          headerUrl: userGame.game.headerUrl,
          owners: [owner],
        });
      }
    }
  }

  const games = Array.from(gamesByAppId.values()).sort((a, b) => a.name.localeCompare(b.name));

  const memberStats = members
    .map((m) => {
      const gamesOwned = m.user.games.length;
      const achievementsTotal = m.user.games.reduce((sum, ug) => sum + ug.achievementsTotal, 0);
      const achievementsUnlocked = m.user.games.reduce(
        (sum, ug) => sum + ug.achievementsUnlocked,
        0,
      );
      const percent = achievementsTotal > 0 ? (achievementsUnlocked / achievementsTotal) * 100 : 0;
      const totalPlaytimeMinutes = m.user.games.reduce((sum, ug) => sum + ug.playtimeMinutes, 0);
      // "Platinado" = every achievement in a game with achievements unlocked.
      const perfectGames = m.user.games.filter(
        (ug) => ug.achievementsTotal > 0 && ug.achievementsUnlocked === ug.achievementsTotal,
      ).length;

      return {
        userId: m.user.id,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        gamesOwned,
        achievementsTotal,
        achievementsUnlocked,
        percent,
        totalPlaytimeMinutes,
        perfectGames,
      };
    })
    .sort((a, b) => b.percent - a.percent);

  return {
    familyGroup,
    members: members.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
      avatarUrl: m.user.avatarUrl,
    })),
    memberStats,
    games,
  };
}
