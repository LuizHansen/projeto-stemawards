import { prisma } from "@/lib/prisma";
import { getUserFamilyGroup } from "@/lib/family";
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

async function withProgress(onDone: () => Promise<void>, fn: () => Promise<void>, label: string) {
  try {
    await fn();
  } catch (error) {
    console.error(`Failed to sync ${label}`, error);
  } finally {
    await onDone();
  }
}

/**
 * Fetches and persists achievement state for a game/userGame pair. Shared
 * between owned-game syncing and family-shared-game probing, since the
 * Steam endpoints and upsert logic are identical either way.
 */
async function syncAchievements(
  steamId: string,
  appId: number,
  gameId: string,
  userGameId: string,
): Promise<{ total: number; unlocked: number }> {
  const [schema, playerAchievements, globalPercentages] = await Promise.all([
    getGameSchema(appId),
    getPlayerAchievements(steamId, appId),
    getGlobalAchievementPercentages(appId),
  ]);

  const percentByName = new Map(globalPercentages.map((p) => [p.name, p.percent]));
  const achievedByName = new Map(playerAchievements.map((a) => [a.apiname, a]));

  const unlockedFlags = await mapWithConcurrency(schema, ACHIEVEMENT_CONCURRENCY, async (def) => {
    const achievement = await prisma.achievement.upsert({
      where: { gameId_apiName: { gameId, apiName: def.name } },
      create: {
        gameId,
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
        userGameId_achievementId: { userGameId, achievementId: achievement.id },
      },
      create: {
        userGameId,
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

  return { total: schema.length, unlocked: unlockedFlags.filter(Boolean).length };
}

async function syncOwnedGame(userId: string, steamId: string, ownedGame: SteamOwnedGame) {
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

  const userGame = await prisma.userGame.upsert({
    where: { userId_gameId: { userId, gameId: game.id } },
    create: { userId, gameId: game.id, playtimeMinutes: ownedGame.playtime_forever, lastPlayedAt },
    update: { playtimeMinutes: ownedGame.playtime_forever, lastPlayedAt, syncedAt: new Date() },
  });

  const { total, unlocked } = await syncAchievements(steamId, ownedGame.appid, game.id, userGame.id);

  await prisma.userGame.update({
    where: { id: userGame.id },
    data: { achievementsTotal: total, achievementsUnlocked: unlocked },
  });
}

/**
 * Achievement unlock state is tied to the Steam account, not to game
 * ownership - so a game borrowed via Family Sharing (which never shows up
 * in this account's GetOwnedGames) can still have real progress fetchable
 * through GetPlayerAchievements. Probe family-owned games this user
 * doesn't own directly and record their progress if Steam returns any.
 */
async function probeFamilySharedGame(userId: string, steamId: string, appId: number, gameName: string) {
  const playerAchievements = await getPlayerAchievements(steamId, appId);
  if (playerAchievements.length === 0) return;

  const game = await prisma.game.upsert({
    where: { appId },
    create: {
      appId,
      name: gameName,
      headerUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`,
    },
    update: {},
  });

  const userGame = await prisma.userGame.upsert({
    where: { userId_gameId: { userId, gameId: game.id } },
    create: { userId, gameId: game.id, playtimeMinutes: 0 },
    update: { syncedAt: new Date() },
  });

  const { total, unlocked } = await syncAchievements(steamId, appId, game.id, userGame.id);

  await prisma.userGame.update({
    where: { id: userGame.id },
    data: { achievementsTotal: total, achievementsUnlocked: unlocked },
  });
}

export async function syncUserLibrary(userId: string, steamId: string) {
  try {
    const ownedGames = await getOwnedGames(steamId);
    const ownedAppIds = new Set(ownedGames.map((g) => g.appid));

    const familyGroup = await getUserFamilyGroup(userId);
    const sharedCandidates = familyGroup
      ? await prisma.userGame.findMany({
          where: {
            user: { familyMemberships: { some: { familyGroupId: familyGroup.id } } },
            userId: { not: userId },
          },
          include: { game: true },
          distinct: ["gameId"],
        })
      : [];
    const unownedSharedGames = sharedCandidates.filter((ug) => !ownedAppIds.has(ug.game.appId));

    const total = ownedGames.length + unownedSharedGames.length;

    await prisma.user.update({
      where: { id: userId },
      data: { syncStartedAt: new Date(), syncTotal: total, syncProcessed: 0, syncError: null },
    });

    const incrementProcessed = async () => {
      await prisma.user.update({
        where: { id: userId },
        data: { syncProcessed: { increment: 1 } },
      });
    };

    await mapWithConcurrency(ownedGames, GAME_CONCURRENCY, (ownedGame) =>
      withProgress(
        incrementProcessed,
        () => syncOwnedGame(userId, steamId, ownedGame),
        `${ownedGame.appid} (${ownedGame.name})`,
      ),
    );

    await mapWithConcurrency(unownedSharedGames, GAME_CONCURRENCY, (ug) =>
      withProgress(
        incrementProcessed,
        () => probeFamilySharedGame(userId, steamId, ug.game.appId, ug.game.name),
        `${ug.game.appId} (${ug.game.name}, shared)`,
      ),
    );

    return { gamesSynced: ownedGames.length, sharedGamesProbed: unownedSharedGames.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await prisma.user.update({ where: { id: userId }, data: { syncError: message } });
    throw error;
  }
}
