/**
 * Fandom wikis expose a public MediaWiki API (api.php) per sub-wiki, but
 * there's no reliable directory lookup we can hit without Cloudflare
 * blocking us (their cross-wiki search endpoint is bot-protected). Instead
 * we guess the wiki subdomain from the game name and probe it directly.
 *
 * Guessing alone is unreliable - some guessed slugs resolve to real but
 * unrelated/empty wikis - so a candidate is only accepted once a search on
 * that wiki actually surfaces the achievement we're looking for.
 */
const STOPWORDS = new Set(["of", "the", "a", "an"]);

function slugCandidates(gameName: string): string[] {
  const cleaned = gameName
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/[:.]/g, "")
    .trim();

  const allWords = cleaned.split(/\s+/).filter(Boolean);
  const noStopwords = allWords.filter((w) => !STOPWORDS.has(w));

  const candidates: string[] = [];

  // Full name (hyphenated and squashed), with and without stopwords.
  candidates.push(allWords.join("-"), allWords.join(""), noStopwords.join("-"), noStopwords.join(""));

  // Progressively shorter prefixes (keeping original words/stopwords), down
  // to a 2-word minimum, to find the franchise wiki - e.g. "callofduty" for
  // "Call of Duty: Black Ops III".
  for (let len = allWords.length - 1; len >= 2; len--) {
    candidates.push(allWords.slice(0, len).join(""));
  }
  for (let len = noStopwords.length - 1; len >= 2; len--) {
    candidates.push(noStopwords.slice(0, len).join(""));
  }

  return Array.from(new Set(candidates)).filter((s) => s.length > 3);
}

async function probeWiki(slug: string): Promise<string | null> {
  try {
    const url = `https://${slug}.fandom.com/api.php?action=query&meta=siteinfo&format=json`;
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.query?.general) return null;
    return new URL(res.url).origin;
  } catch {
    return null;
  }
}

async function searchPageTitle(baseUrl: string, query: string): Promise<string | null> {
  try {
    const url = `${baseUrl}/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query,
    )}&srlimit=1&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.query?.search?.[0]?.title ?? null;
  } catch {
    return null;
  }
}

function stripWikitext(wikitext: string): string {
  return wikitext
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, " ")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/'''?/g, "")
    .replace(/={2,}.*?={2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getPageWikitext(baseUrl: string, title: string): Promise<string | null> {
  try {
    const url = `${baseUrl}/api.php?action=parse&page=${encodeURIComponent(
      title,
    )}&prop=wikitext&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.parse?.wikitext?.["*"] ?? null;
  } catch {
    return null;
  }
}

function isDisambiguationPage(wikitext: string): boolean {
  return /\{\{disambig/i.test(wikitext) || /may refer to:/i.test(wikitext);
}

function gameTokens(gameName: string): string[] {
  return gameName
    .toLowerCase()
    .replace(/[™®©:.]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
}

/**
 * Achievement names are often reused across a franchise's games (e.g.
 * "Welcome to the Club" exists in multiple Call of Duty titles), so the
 * wiki search lands on a disambiguation page instead of the real article.
 * Resolve it by picking the linked page whose title best matches the game
 * we're actually after (e.g. contains "III"/"3" for Black Ops III).
 */
function resolveDisambiguationLink(wikitext: string, gameName: string): string | null {
  const tokens = gameTokens(gameName);
  const linkPattern = /\[\[([^\]|#]+)(?:\|[^\]]*)?\]\]/g;
  let bestTitle: string | null = null;
  let bestScore = 0;

  for (const match of wikitext.matchAll(linkPattern)) {
    const linkTitle = match[1].trim();
    if (/^(File|Image|Category):/i.test(linkTitle)) continue;

    const lowerTitle = linkTitle.toLowerCase();
    const score = tokens.filter((token) => lowerTitle.includes(token)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTitle = linkTitle;
    }
  }

  return bestScore > 0 ? bestTitle : null;
}

function cleanSnippet(text: string): string {
  return text
    .replace(/\|-+/g, " ")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractExcerpt(plain: string, achievementName: string, description?: string | null): string {
  const needle = achievementName.toLowerCase();

  // Wikitable rows are separated by "|-" - if the page is a table (common
  // for achievement lists), isolate just the row mentioning this achievement
  // instead of a fixed character window that bleeds into neighboring rows.
  const rows = plain.split(/\|-+/);
  const matchingRow = rows.find((row) => row.toLowerCase().includes(needle));
  if (matchingRow) {
    const cleaned = cleanSnippet(matchingRow);
    if (cleaned) return cleaned.slice(0, 500);
  }

  const idx = plain.toLowerCase().indexOf(needle);
  if (idx >= 0) {
    const start = Math.max(0, idx - 60);
    return cleanSnippet(plain.slice(start, start + 500));
  }
  if (description) {
    const descIdx = plain.toLowerCase().indexOf(description.toLowerCase().slice(0, 30));
    if (descIdx >= 0) return cleanSnippet(plain.slice(descIdx, descIdx + 500));
  }
  return cleanSnippet(plain.slice(0, 500));
}

export type FandomGuideExcerpt = {
  pageUrl: string;
  excerpt: string;
};

export async function findAchievementExcerpt(
  gameName: string,
  achievementName: string,
  description?: string | null,
): Promise<FandomGuideExcerpt | null> {
  for (const slug of slugCandidates(gameName)) {
    const baseUrl = await probeWiki(slug);
    if (!baseUrl) continue;

    let title =
      (await searchPageTitle(baseUrl, `${achievementName} achievement`)) ??
      (await searchPageTitle(baseUrl, `${gameName} achievements`));
    if (!title) continue;

    let wikitext = await getPageWikitext(baseUrl, title);
    if (!wikitext) continue;

    if (isDisambiguationPage(wikitext)) {
      const resolvedTitle = resolveDisambiguationLink(wikitext, gameName);
      if (!resolvedTitle) continue;

      const resolvedWikitext = await getPageWikitext(baseUrl, resolvedTitle);
      if (!resolvedWikitext) continue;

      title = resolvedTitle;
      wikitext = resolvedWikitext;
    }

    const plain = stripWikitext(wikitext);
    if (!plain.toLowerCase().includes(achievementName.toLowerCase())) continue;

    const excerpt = extractExcerpt(plain, achievementName, description);
    if (!excerpt) continue;

    return {
      pageUrl: `${baseUrl}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      excerpt,
    };
  }

  return null;
}
