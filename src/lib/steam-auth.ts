import { RelyingParty } from "openid";

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid";

function baseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

function buildRelyingParty(): RelyingParty {
  const returnUrl = `${baseUrl()}/api/auth/steam/callback`;
  const realm = baseUrl();
  return new RelyingParty(returnUrl, realm, true, false, []);
}

export function getSteamAuthUrl(): Promise<string> {
  return new Promise((resolve, reject) => {
    const relyingParty = buildRelyingParty();
    relyingParty.authenticate(STEAM_OPENID_ENDPOINT, false, (error, authUrl) => {
      if (error || !authUrl) {
        reject(error ?? new Error("Failed to build Steam auth URL"));
        return;
      }
      resolve(authUrl);
    });
  });
}

const STEAM_ID_REGEX = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/;

export function verifySteamCallback(requestUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const relyingParty = buildRelyingParty();
    relyingParty.verifyAssertion(requestUrl, (error, result) => {
      if (error || !result?.authenticated || !result.claimedIdentifier) {
        reject(error ?? new Error("Steam authentication failed"));
        return;
      }

      const match = STEAM_ID_REGEX.exec(result.claimedIdentifier);
      if (!match) {
        reject(new Error("Unable to parse SteamID from claimed identifier"));
        return;
      }

      resolve(match[1]);
    });
  });
}
