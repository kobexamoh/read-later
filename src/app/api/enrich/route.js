import { createClient } from "@/lib/supabase/server";
import { enrichLink } from "@/lib/gemini";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all pending links for this user
  const { data: pendingLinks, error: fetchError } = await supabase
    .from("links")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (fetchError) {
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (!pendingLinks || pendingLinks.length === 0) {
    return Response.json({ message: "No pending links to enrich.", enriched: 0 });
  }

  let enrichedCount = 0;
  let failedCount = 0;

  for (const link of pendingLinks) {
    try {
      // Fetch the page and extract article content
      const { title, snippet, content } = await fetchPageContent(link.url);

      // Call Gemini for description + topics
      const { description, topics } = await enrichLink(
        title || link.title,
        link.url,
        snippet
      );

      // Update the link record
      await supabase
        .from("links")
        .update({
          title: title || link.title || link.url,
          description,
          topics,
          content: content || null,
          status: "enriched",
        })
        .eq("id", link.id);

      enrichedCount++;
    } catch (err) {
      console.error(`Failed to enrich ${link.url}:`, err.message);

      await supabase
        .from("links")
        .update({ status: "failed" })
        .eq("id", link.id);

      failedCount++;
    }
  }

  return Response.json({
    enriched: enrichedCount,
    failed: failedCount,
    total: pendingLinks.length,
  });
}

/**
 * Fetch a page and extract title, snippet, and full article content.
 * Uses Mozilla Readability for clean article extraction.
 */
async function fetchPageContent(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ReadLaterBot/1.0; +https://readlater.app)",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { title: null, snippet: null, content: null };
    }

    const html = await res.text();

    // Use Readability to extract the article
    const { document } = parseHTML(html);
    const reader = new Readability(document);
    const article = reader.parse();

    const title = article?.title || extractTitle(html);
    const content = article?.textContent?.trim() || null;
    const snippet = content ? content.slice(0, 500) : extractSnippet(html);

    return { title, snippet, content };
  } catch {
    return { title: null, snippet: null, content: null };
  }
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : null;
}

function extractSnippet(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}
