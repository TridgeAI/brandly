
// lib/automation-utils.ts
import Parser from "rss-parser";
import { fetchWebsiteContent } from "./web";
import { safeFetch } from "./net/safe-fetch";

const rssParser = new Parser();

export async function fetchRssFeed(url: string): Promise<any[] | null> {
  try {
    const res = await safeFetch(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: "application/rss+xml,application/xml,text/xml,*/*" } });
    if (!res.ok) return null;
    const feed = await rssParser.parseString((await res.text()).slice(0, 2_000_000));
    return feed.items;
  } catch (error) {
    console.error(`Error fetching RSS feed from ${url}:`, error);
    return null;
  }
}

export async function fetchProductPageContent(url: string): Promise<string | null> {
  // For simplicity, this just fetches the content. Real product update detection
  // would involve more sophisticated scraping and diffing.
  return fetchWebsiteContent(url);
}
