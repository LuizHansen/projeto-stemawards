import { prisma } from "@/lib/prisma";
import {
  getOwnedGames,
  getGameSchema,
  getPlayerAchievements,
  getGlobalAchievementPercentages,
  type SteamOwnedGame,
} from "@/lib/steam-api";

const GAME_CONCURRENCY = 6;
const ACHIEVEMENT_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function syncGame(userId: string, steamId: string, ownedGame: SteamOwnedGame) {
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

  const lastPlayedAt = ownedGame.rtime_last_played
    ? new Date(ownedGame.rtime_last_played * 1000)
    : null;

  // Most library entries (soundtracks, SDKs, tools, etc.) have no
  // achievements at all - skip the three extra Steam API calls for them.
  if (!ownedGame.has_community_visible_stats) {
    await prisma.userGame.upsert({
      where: { userId_gameId: { userId, gameId: game.id } },
      create: {
        userId,
        gameId: game.id,
        playtimeMinutes: ownedGame.playtime_forever,
        lastPlayedAt,
        achievementsTotal: 0,
      },
      update: {
        playtimeMinutes: ownedGame.playtime_forever,
        lastPlayedAt,
        achievementsTotal: 0,
        syncedAt: new Date(),
      },
    });
    return;
  }

  const [schema, playerAchievements, globalPercentages] = await Promise.all([
    getGameSchema(ownedGame.appid),
    getPlayerAchievements(steamId, ownedGame.appid),
    getGlobalAchievementPercentages(ownedGame.appid),
  ]);

  const percentByName = new Map(globalPercentages.map((p) => [p.name, p.percent]));
  const achievedByName = new Map(playerAchievements.map((a) => [a.apiname, a]));

  const userGame = await prisma.userGame.upsert({
    where: { userId_gameId: { userId, gameId: game.id } },
    create: {
      userId,
      gameId: game.id,
      playtimeMinutes: ownedGame.playtime_forever,
      lastPlayedAt,
      achievementsTotal: schema.length,
    },
    update: {
      playtimeMinutes: ownedGame.playtime_forever,
      lastPlayedAt,
      achievementsTotal: schema.length,
      syncedAt: new Date(),
    },
  });

  const unlockedFlags = await mapWithConcurrency(schema, ACHIEVEMENT_CONCURRENCY, async (def) => {
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

    return unlocked;
  });

  await prisma.userGame.update({
    where: { id: userGame.id },
    data: { achievementsUnlocked: unlockedFlags.filter(Boolean).length },
  });
}

export async function syncUserLibrary(userId: string, steamId: string) {
  const ownedGames = await getOwnedGames(steamId);

  await mapWithConcurrency(ownedGames, GAME_CONCURRENCY, (ownedGame) =>
    syncGame(userId, steamId, ownedGame),
  );

  return { gamesSynced: ownedGames.length };
}
