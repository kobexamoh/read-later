/**
 * Extracts and deduplicates URLs from pasted text.
 *
 * Supports:
 * - Raw URLs (http:// or https://)
 * - Markdown-style links [Title](URL)
 *
 * Returns an array of { url, title } objects.
 */
export function extractLinks(text) {
  if (!text || typeof text !== "string") return [];

  const results = new Map(); // url -> { url, title }

  // 1. Extract markdown-style links: [Title](URL)
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = mdLinkRegex.exec(text)) !== null) {
    const title = match[1].trim();
    const url = normalizeUrl(match[2]);
    if (url && !results.has(url)) {
      results.set(url, { url, title });
    }
  }

  // 2. Extract raw URLs (that aren't already part of a markdown link)
  // Remove markdown links first to avoid double-counting
  const textWithoutMdLinks = text.replace(mdLinkRegex, "");
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  while ((match = urlRegex.exec(textWithoutMdLinks)) !== null) {
    let url = match[0];
    // Strip trailing punctuation that's likely not part of the URL
    url = url.replace(/[.,;:!?)]+$/, "");
    url = normalizeUrl(url);
    if (url && !results.has(url)) {
      results.set(url, { url, title: null });
    }
  }

  return Array.from(results.values());
}

/**
 * Basic URL normalization: lowercase protocol + host, remove trailing slash.
 */
function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    // Reconstruct with lowercase protocol and host
    let normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    if (parsed.search) normalized += parsed.search;
    if (parsed.hash) normalized += parsed.hash;
    // Remove trailing slash (unless it's just the root)
    if (normalized.endsWith("/") && parsed.pathname !== "/") {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}
