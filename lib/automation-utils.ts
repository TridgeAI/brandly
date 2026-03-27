
// lib/automation-utils.ts
import Parser from "rss-parser";
import { fetchWebsiteContent } from "./web";

const rssParser = new Parser();

export async function fetchRssFeed(url: string): Promise<any[] | null> {
  try {
    const feed = await rssParser.parseURL(url);
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
