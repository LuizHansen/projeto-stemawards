import { prisma } from "@/lib/prisma";
import {
  getOwnedGames,
  getGameSchema,
  getPlayerAchievements,
  getGlobalAchievementPercentages,
} from "@/lib/steam-api";

export async function syncUserLibrary(userId: string, steamId: string) {
  const ownedGames = await getOwnedGames(steamId);

  for (const ownedGame of ownedGames) {
    const game = await prisma.game.upsert({
      where: { appId: ownedGame.appid },
      create: {
        appId: ownedGame.appid,
        name: ownedGame.name,
        iconUrl: ownedGame.img_icon_url
          ? `https://media.steampowered.com/steamcommunity/public/images/apps/${ownedGame.appid}/${ownedGame.img_icon_url}.jpg`
          : null,
        headerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${ownedGame.appid}/header.jpg`,
      },
      update: { name: ownedGame.name },
    });

    const [schema, playerAchievements, globalPercentages] = await Promise.all([
      getGameSchema(ownedGame.appid),
      getPlayerAchievements(steamId, ownedGame.appid),
      getGlobalAchievementPercentages(ownedGame.appid),
    ]);

    const percentByName = new Map(globalPercentages.map((p) => [p.name, p.percent]));
    const achievedByName = new Map(playerAchievements.map((a) => [a.apiname, a]));

    let unlockedCount = 0;

    const userGame = await prisma.userGame.upsert({
      where: { userId_gameId: { userId, gameId: game.id } },
      create: {
        userId,
        gameId: game.id,
        playtimeMinutes: ownedGame.playtime_forever,
        lastPlayedAt: ownedGame.rtime_last_played
          ? new Date(ownedGame.rtime_last_played * 1000)
          : null,
        achievementsTotal: schema.length,
      },
      update: {
        playtimeMinutes: ownedGame.playtime_forever,
        lastPlayedAt: ownedGame.rtime_last_played
          ? new Date(ownedGame.rtime_last_played * 1000)
          : null,
        achievementsTotal: schema.length,
        syncedAt: new Date(),
      },
    });

    for (const def of schema) {
      const achievement = await prisma.achievement.upsert({
        where: { gameId_apiName: { gameId: game.id, apiName: def.name } },
        create: {
          gameId: game.id,
          apiName: def.name,
          displayName: def.displayName,
          description: def.description,
          iconUrl: def.icon,
          iconGrayUrl: def.icongray,
          globalPercent: percentByName.get(def.name) ?? null,
        },
        update: {
          displayName: def.displayName,
          description: def.description,
          iconUrl: def.icon,
          iconGrayUrl: def.icongray,
          globalPercent: percentByName.get(def.name) ?? null,
        },
      });

      const playerAchievement = achievedByName.get(def.name);
      const unlocked = playerAchievement?.achieved === 1;
      if (unlocked) unlockedCount += 1;

      await prisma.userAchievement.upsert({
        where: {
          userGameId_achievementId: {
            userGameId: userGame.id,
            achievementId: achievement.id,
          },
        },
        create: {
          userGameId: userGame.id,
          achievementId: achievement.id,
          unlocked,
          unlockedAt:
            unlocked && playerAchievement?.unlocktime
              ? new Date(playerAchievement.unlocktime * 1000)
              : null,
        },
        update: {
          unlocked,
          unlockedAt:
            unlocked && playerAchievement?.unlocktime
              ? new Date(playerAchievement.unlocktime * 1000)
              : null,
        },
      });
    }

    await prisma.userGame.update({
      where: { id: userGame.id },
      data: { achievementsUnlocked: unlockedCount },
    });
  }

  return { gamesSynced: ownedGames.length };
}
