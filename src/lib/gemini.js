import { GoogleGenerativeAI } from "@google/generative-ai";

const TOPIC_LABELS = [
  "politics",
  "pop_culture",
  "music",
  "tech",
  "career",
  "science",
  "local",
  "long_read",
  "brain_rot",
  "other",
];

const TOPIC_DESCRIPTIONS = `
- politics: government, elections, policy, political opinion, geopolitics
- pop_culture: movies, TV, celebrities, sports, gaming, memes, social media trends
- music: bands, artists, albums, gear, interviews with musicians, music industry
- tech: software, hardware, programming, AI, startups, product launches
- career: job advice, professional development, workplace, freelancing, entrepreneurship
- science: research, studies, psychology, biology, physics, innovation, academia
- local: local news, community profiles, city-specific content, regional stories
- long_read: in-depth essays, investigations, longform journalism (use alongside another topic)
- brain_rot: low-value entertainment, doomscrolling fodder, gossip, clickbait
- other: doesn't clearly fit any of the above
`.trim();

let genAI = null;

function getClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

/**
 * Enrich a single link: generate a description and assign topic labels.
 * Combines both into one API call to stay within free tier limits.
 *
 * @param {string} title - Page title (may be null)
 * @param {string} url - The URL
 * @param {string} snippet - First ~500 chars of page text (may be empty)
 * @returns {{ description: string, topics: string[] }}
 */
export async function enrichLink(title, url, snippet) {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are a reading assistant. Given the following web page info, return a JSON object with:
1. "description": A concise 1–2 sentence summary of what this page is about. Be factual, not clickbaity.
2. "topics": An array of one or more topic labels from this list: ${JSON.stringify(TOPIC_LABELS)}

Topic definitions:
${TOPIC_DESCRIPTIONS}

Rules:
- Always pick the most specific matching topic(s). Avoid "other" if any topic fits.
- A link can have multiple topics (e.g. ["politics", "long_read"]).
- Use "other" ONLY when the content truly doesn't match any defined category.

Page info:
- Title: ${title || "(unknown)"}
- URL: ${url}
- Content snippet: ${snippet || "(not available)"}

Return ONLY valid JSON, no markdown fences, no explanation. Example:
{"description": "An analysis of...", "topics": ["politics", "long_read"]}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Parse the JSON response — strip markdown fences if present
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    const filteredTopics = (parsed.topics || []).filter((t) =>
      TOPIC_LABELS.includes(t)
    );

    return {
      description: parsed.description || "",
      topics: filteredTopics.length > 0 ? filteredTopics : ["other"],
    };
  } catch (err) {
    console.error("Gemini enrichment failed:", err.message);
    return {
      description: "",
      topics: ["other"],
    };
  }
}

/**
 * Map user interests text to topic labels using Gemini.
 *
 * @param {string} interestsText - Free-text description of user interests
 * @returns {string[]} Array of matching topic labels
 */
export async function mapInterestsToTopics(interestsText) {
  if (!interestsText?.trim()) return [];

  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Given this description of a person's reading interests:
"${interestsText}"

Return a JSON array of matching topic labels from this list: ${JSON.stringify(TOPIC_LABELS)}

Only include topics that clearly match the stated interests. Return ONLY a valid JSON array, nothing else.
Example: ["politics", "tech"]`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed.filter((t) => TOPIC_LABELS.includes(t));
  } catch (err) {
    console.error("Gemini interests mapping failed:", err.message);
    return [];
  }
}
