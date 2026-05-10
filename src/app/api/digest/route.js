import { createClient } from "@/lib/supabase/server";
import { mapInterestsToTopics } from "@/lib/gemini";

const TOPIC_DISPLAY_NAMES = {
  politics: "Politics",
  pop_culture: "Pop Culture",
  tech: "Tech",
  career: "Career & Work",
  long_read: "Long Reads",
  brain_rot: "Brain Rot",
  other: "Other",
};

export async function POST() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get user preferences
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .single();

  const mode = prefs?.mode || "relaxed";

  // Derive topic labels from interests if not already stored
  let userTopics = prefs?.derived_topics || [];
  if (
    mode === "strict" &&
    userTopics.length === 0 &&
    prefs?.interests_text?.trim()
  ) {
    userTopics = await mapInterestsToTopics(prefs.interests_text);

    // Persist derived topics for future use
    await supabase
      .from("user_preferences")
      .update({ derived_topics: userTopics })
      .eq("user_id", user.id);
  }

  // Get the last digest date to scope the query
  const { data: lastDigest } = await supabase
    .from("digests")
    .select("generated_at")
    .eq("user_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();

  // Get enriched links since last digest (or all enriched links)
  let query = supabase
    .from("links")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "enriched")
    .order("created_at", { ascending: true });

  if (lastDigest?.generated_at) {
    query = query.gt("created_at", lastDigest.generated_at);
  }

  const { data: links, error: linksError } = await query;

  if (linksError) {
    return Response.json({ error: linksError.message }, { status: 500 });
  }

  if (!links || links.length === 0) {
    return Response.json({
      message: "No enriched links to digest. Enrich your links first.",
      digest: null,
    });
  }

  // Apply filtering
  let includedLinks = links;
  let filteredCount = 0;

  if (mode === "strict" && userTopics.length > 0) {
    includedLinks = links.filter((link) =>
      (link.topics || []).some((t) => userTopics.includes(t))
    );
    filteredCount = links.length - includedLinks.length;
  }

  // Group by primary topic
  const grouped = {};
  for (const link of includedLinks) {
    const primaryTopic = (link.topics && link.topics[0]) || "other";
    if (!grouped[primaryTopic]) {
      grouped[primaryTopic] = [];
    }
    grouped[primaryTopic].push(link);
  }

  // Build markdown
  const today = new Date().toISOString().split("T")[0];
  let markdown = `# Weekly Reading Digest — ${today}\n\n`;

  if (mode === "strict" && filteredCount > 0) {
    markdown += `> Strict mode: ${filteredCount} link${filteredCount === 1 ? "" : "s"} filtered out (didn't match your interests).\n\n`;
  }

  // Order topics consistently
  const topicOrder = [
    "politics",
    "pop_culture",
    "tech",
    "career",
    "long_read",
    "brain_rot",
    "other",
  ];

  for (const topic of topicOrder) {
    if (!grouped[topic]) continue;
    const displayName = TOPIC_DISPLAY_NAMES[topic] || topic;
    markdown += `## ${displayName}\n\n`;

    for (const link of grouped[topic]) {
      const desc = link.description ? ` — ${link.description}` : "";
      markdown += `- **${link.title || "Untitled"}**${desc} [Read](${link.url})\n`;
    }
    markdown += "\n";
  }

  // Save the digest
  const { data: digest, error: digestError } = await supabase
    .from("digests")
    .insert({
      user_id: user.id,
      markdown,
      total_links: links.length,
      included_links: includedLinks.length,
      filtered_links: filteredCount,
      mode,
    })
    .select()
    .single();

  if (digestError) {
    return Response.json({ error: digestError.message }, { status: 500 });
  }

  // Save digest_links join records
  const digestLinkRows = [];
  let orderIndex = 0;
  for (const topic of topicOrder) {
    if (!grouped[topic]) continue;
    for (const link of grouped[topic]) {
      digestLinkRows.push({
        digest_id: digest.id,
        link_id: link.id,
        section_topic: topic,
        order_index: orderIndex++,
      });
    }
  }

  if (digestLinkRows.length > 0) {
    await supabase.from("digest_links").insert(digestLinkRows);
  }

  // Build structured articles for inline reading
  const articles = [];
  for (const topic of topicOrder) {
    if (!grouped[topic]) continue;
    for (const link of grouped[topic]) {
      articles.push({
        id: link.id,
        title: link.title || "Untitled",
        description: link.description || "",
        url: link.url,
        topic: TOPIC_DISPLAY_NAMES[topic] || topic,
        topicKey: topic,
        content: link.content || null,
      });
    }
  }

  return Response.json({
    digest: {
      id: digest.id,
      markdown,
      articles,
      total_links: links.length,
      included_links: includedLinks.length,
      filtered_links: filteredCount,
      mode,
      generated_at: digest.generated_at,
    },
  });
}
