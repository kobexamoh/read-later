import { createClient } from "@/lib/supabase/server";
import { enrichLink } from "@/lib/gemini";

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
      // Fetch the page to get title and snippet
      const { title, snippet } = await fetchPageContent(link.url);

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
 * Fetch a page and extract its title + first ~500 chars of text content.
 * Handles timeouts and failures gracefully.
 */
async function fetchPageContent(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ReadLaterBot/1.0; +https://readlater.app)",
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { title: null, snippet: null };
    }

    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    // Extract text snippet: strip tags, grab first 500 chars
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 500);

    return { title, snippet: textContent };
  } catch {
    return { title: null, snippet: null };
  }
}
