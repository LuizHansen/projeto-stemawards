import { prisma } from "@/lib/prisma";
import { getUserFamilyGroup } from "@/lib/family";
import {
  getOwnedGames,
  getGameSchema,
  getPlayerAchievements,
  getGlobalAchievementPercentages,
  getAppHeaderImage,
  type SteamOwnedGame,
} from "@/lib/steam-api";

const GAME_CONCURRENCY = 6;

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

/**
 * Resolves the real header image URL for a game, only calling the (rate
 * limited) Steam Store API when this game hasn't been synced before -
 * existing games already have a header URL and re-checking it on every
 * sync would needlessly burn through the Store API's stricter rate limit.
 */
async function resolveHeaderUrl(appId: number): Promise<string> {
  const existing = await prisma.game.findUnique({ where: { appId }, select: { headerUrl: true } });
  if (existing?.headerUrl) return existing.headerUrl;

  const realUrl = await getAppHeaderImage(appId);
  return realUrl ?? `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

/**
 * Fetches and persists achievement state for a game/userGame pair. Shared
 * between owned-game syncing and family-shared-game probing.
 *
 * Uses bulk reads + createMany instead of per-achievement upserts: a game
 * with 600 achievements previously meant ~1200 round trips to Postgres,
 * which alone could blow the serverless function timeout. This keeps it to
 * a handful of queries per game — only *new* rows are inserted, and only
 * changed unlock states are updated, since achievement definitions are
 * static between syncs.
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

  if (schema.length === 0) return { total: 0, unlocked: 0 };

  const percentByName = new Map(globalPercentages.map((p) => [p.name, p.percent]));
  const achievedByName = new Map(playerAchievements.map((a) => [a.apiname, a]));

  // 1. Ensure Achievement rows exist (insert only the missing ones).
  const existingAchievements = await prisma.achievement.findMany({
    where: { gameId },
    select: { id: true, apiName: true },
  });
  const existingApiNames = new Set(existingAchievements.map((a) => a.apiName));
  const missing = schema.filter((def) => !existingApiNames.has(def.name));

  if (missing.length > 0) {
    await prisma.achievement.createMany({
      data: missing.map((def) => ({
        gameId,
        apiName: def.name,
        displayName: def.displayName,
        description: def.description ?? null,
        iconUrl: def.icon,
        iconGrayUrl: def.icongray,
        globalPercent: percentByName.get(def.name) ?? null,
      })),
      skipDuplicates: true,
    });
  }

  const allAchievements =
    missing.length > 0
      ? await prisma.achievement.findMany({ where: { gameId }, select: { id: true, apiName: true } })
      : existingAchievements;
  const achievementIdByName = new Map(allAchievements.map((a) => [a.apiName, a.id]));

  // 2. Diff the user's unlock state against what's stored.
  const existingUserAchievements = await prisma.userAchievement.findMany({
    where: { userGameId },
    select: { id: true, achievementId: true, unlocked: true },
  });
  const uaByAchievementId = new Map(existingUserAchievements.map((ua) => [ua.achievementId, ua]));

  const toCreate: { userGameId: string; achievementId: string; unlocked: boolean; unlockedAt: Date | null }[] = [];
  const newlyUnlocked: { id: string; unlockedAt: Date | null }[] = [];
  const newlyLocked: string[] = [];
  let unlockedCount = 0;

  for (const def of schema) {
    const achievementId = achievementIdByName.get(def.name);
    if (!achievementId) continue;

    const playerAchievement = achievedByName.get(def.name);
    const unlocked = playerAchievement?.achieved === 1;
    if (unlocked) unlockedCount += 1;
    const unlockedAt =
      unlocked && playerAchievement?.unlocktime
        ? new Date(playerAchievement.unlocktime * 1000)
        : null;

    const existing = uaByAchievementId.get(achievementId);
    if (!existing) {
      toCreate.push({ userGameId, achievementId, unlocked, unlockedAt });
    } else if (existing.unlocked !== unlocked) {
      if (unlocked) newlyUnlocked.push({ id: existing.id, unlockedAt });
      else newlyLocked.push(existing.id);
    }
  }

  if (toCreate.length > 0) {
    await prisma.userAchievement.createMany({ data: toCreate, skipDuplicates: true });
  }
  // Newly unlocked rows need their own unlockedAt, so update individually -
  // but this is only the handful that changed since the last sync.
  for (const { id, unlockedAt } of newlyUnlocked) {
    await prisma.userAchievement.update({
      where: { id },
      data: { unlocked: true, unlockedAt },
    });
  }
  if (newlyLocked.length > 0) {
    await prisma.userAchievement.updateMany({
      where: { id: { in: newlyLocked } },
      data: { unlocked: false, unlockedAt: null },
    });
  }

  return { total: schema.length, unlocked: unlockedCount };
}

async function syncOwnedGame(userId: string, steamId: string, ownedGame: SteamOwnedGame) {
  const headerUrl = await resolveHeaderUrl(ownedGame.appid);

  const game = await prisma.game.upsert({
    where: { appId: ownedGame.appid },
    create: {
      appId: ownedGame.appid,
      name: ownedGame.name,
      iconUrl: ownedGame.img_icon_url
        ? `https://media.steampowered.com/steamcommunity/public/images/apps/${ownedGame.appid}/${ownedGame.img_icon_url}.jpg`
        : null,
      headerUrl,
    },
    update: { name: ownedGame.name, headerUrl },
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

  const headerUrl = await resolveHeaderUrl(appId);

  const game = await prisma.game.upsert({
    where: { appId },
    create: { appId, name: gameName, headerUrl },
    update: { headerUrl },
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

const BATCH_SIZE = 5;

/**
 * Builds the full list of appIds to sync (owned + family-shared the user
 * doesn't own directly) and stores it as a queue on the user. Syncing then
 * happens in small re-entrant batches (processSyncBatch), so no single
 * request has to finish the whole library within the serverless timeout.
 */
export async function startSync(userId: string, steamId: string): Promise<{ total: number }> {
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
  const sharedAppIds = sharedCandidates
    .map((ug) => ug.game.appId)
    .filter((appId) => !ownedAppIds.has(appId));

  const queue = [...ownedGames.map((g) => g.appid), ...sharedAppIds];

  await prisma.user.update({
    where: { id: userId },
    data: {
      syncQueue: queue,
      syncTotal: queue.length,
      syncProcessed: 0,
      syncStartedAt: new Date(),
      syncError: null,
    },
  });

  return { total: queue.length };
}

/**
 * Processes the next chunk of the user's sync queue. Returns progress so the
 * client can loop until `done`. Each call is bounded by BATCH_SIZE games,
 * keeping it comfortably under the serverless function timeout even for
 * huge libraries.
 */
export async function processSyncBatch(
  userId: string,
  steamId: string,
): Promise<{ done: boolean; processed: number; total: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { syncQueue: true, syncTotal: true },
  });
  if (!user) throw new Error("User not found");

  const queue = user.syncQueue ?? [];
  const total = user.syncTotal ?? queue.length;

  if (queue.length === 0) {
    return { done: true, processed: total, total };
  }

  const batch = queue.slice(0, BATCH_SIZE);
  const rest = queue.slice(BATCH_SIZE);

  try {
    const ownedGames = await getOwnedGames(steamId);
    const ownedByAppId = new Map(ownedGames.map((g) => [g.appid, g]));

    await mapWithConcurrency(batch, GAME_CONCURRENCY, async (appId) => {
      try {
        const owned = ownedByAppId.get(appId);
        if (owned) {
          await syncOwnedGame(userId, steamId, owned);
        } else {
          const game = await prisma.game.findUnique({
            where: { appId },
            select: { name: true },
          });
          await probeFamilySharedGame(userId, steamId, appId, game?.name ?? `App ${appId}`);
        }
      } catch (error) {
        console.error(`Failed to sync app ${appId}`, error);
      }
    });

    const processed = total - rest.length;
    await prisma.user.update({
      where: { id: userId },
      data: { syncQueue: rest, syncProcessed: processed },
    });

    return { done: rest.length === 0, processed, total };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    await prisma.user.update({ where: { id: userId }, data: { syncError: message } });
    throw error;
  }
}
