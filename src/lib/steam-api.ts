const STEAM_API_BASE = "https://api.steampowered.com";

function apiKey() {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new Error("STEAM_API_KEY is not configured");
  return key;
}

export type SteamPlayerSummary = {
  steamid: string;
  personaname: string;
  avatarfull: string;
  profileurl: string;
};

export async function getPlayerSummary(steamId: string): Promise<SteamPlayerSummary> {
  const url = `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey()}&steamids=${steamId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GetPlayerSummaries failed: ${res.status}`);
  const data = await res.json();
  const player = data.response?.players?.[0];
  if (!player) throw new Error("Steam player not found");
  return player;
}

export type SteamOwnedGame = {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  rtime_last_played?: number;
};

export async function getOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
  const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${apiKey()}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GetOwnedGames failed: ${res.status}`);
  const data = await res.json();
  return data.response?.games ?? [];
}

export type SteamAchievementSchema = {
  name: string;
  displayName: string;
  description?: string;
  icon: string;
  icongray: string;
};

export async function getGameSchema(appId: number): Promise<SteamAchievementSchema[]> {
  const url = `${STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/?key=${apiKey()}&appid=${appId}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.game?.availableGameStats?.achievements ?? [];
}

export type SteamPlayerAchievement = {
  apiname: string;
  achieved: 0 | 1;
  unlocktime: number;
};

export async function getPlayerAchievements(
  steamId: string,
  appId: number,
): Promise<SteamPlayerAchievement[]> {
  const url = `${STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v1/?key=${apiKey()}&steamid=${steamId}&appid=${appId}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.playerstats?.success) return [];
  return data.playerstats?.achievements ?? [];
}

export type SteamGlobalPercentage = {
  name: string;
  percent: number;
};

export async function getGlobalAchievementPercentages(
  appId: number,
): Promise<SteamGlobalPercentage[]> {
  const url = `${STEAM_API_BASE}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appId}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  const achievements: { name: string; percent: string | number }[] =
    data.achievementpercentages?.achievements ?? [];
  return achievements.map((a) => ({ name: a.name, percent: Number(a.percent) }));
}
