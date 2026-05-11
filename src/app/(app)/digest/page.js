"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function DigestPage() {
  const [generating, setGenerating] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [currentDigest, setCurrentDigest] = useState(null);
  const [pastDigests, setPastDigests] = useState([]);
  const [expandedArticle, setExpandedArticle] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    loadDigests();
  }, []);

  async function loadDigests() {
    const supabase = createClient();
    const { data } = await supabase
      .from("digests")
      .select("id, generated_at, total_links, included_links, filtered_links, mode, markdown")
      .order("generated_at", { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      setCurrentDigest(data[0]);
      setPastDigests(data.slice(1));
    }
  }

  async function handleEnrichAndGenerate() {
    setError(null);
    setStatus(null);

    // Step 1: Enrich pending links
    setEnriching(true);
    try {
      const enrichRes = await fetch("/api/enrich", { method: "POST" });
      const enrichData = await enrichRes.json();

      if (enrichData.error) {
        setError(enrichData.error);
        setEnriching(false);
        return;
      }

      if (enrichData.enriched > 0) {
        setStatus(
          `Enriched ${enrichData.enriched} link${enrichData.enriched === 1 ? "" : "s"}.${enrichData.failed > 0 ? ` ${enrichData.failed} failed.` : ""}`
        );
      }

      // Surface any warnings (e.g. Gemini quota exceeded)
      if (enrichData.warnings && enrichData.warnings.length > 0) {
        setError(enrichData.warnings[0]);
      }
    } catch (err) {
      setError(err.message);
      setEnriching(false);
      return;
    }
    setEnriching(false);

    // Step 2: Generate digest
    setGenerating(true);
    try {
      const digestRes = await fetch("/api/digest", { method: "POST" });
      const digestData = await digestRes.json();

      if (digestData.error) {
        setError(digestData.error);
      } else if (digestData.digest) {
        setCurrentDigest(digestData.digest);
        setExpandedArticle(null);
        setStatus(
          (prev) =>
            `${prev ? prev + " " : ""}Digest generated: ${digestData.digest.included_links} link${digestData.digest.included_links === 1 ? "" : "s"} included.`
        );
        loadDigests();
      } else {
        setStatus(digestData.message || "No links to digest.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!currentDigest?.markdown) return;
    await navigator.clipboard.writeText(currentDigest.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function selectDigest(digest) {
    setCurrentDigest(digest);
    setExpandedArticle(null);
  }

  function toggleArticle(articleId) {
    setExpandedArticle((prev) => (prev === articleId ? null : articleId));
  }

  // Group articles by topic for the structured view
  const groupedArticles = {};
  if (currentDigest?.articles) {
    for (const article of currentDigest.articles) {
      const topic = article.topic;
      if (!groupedArticles[topic]) {
        groupedArticles[topic] = [];
      }
      groupedArticles[topic].push(article);
    }
  }

  const hasArticles =
    currentDigest?.articles && currentDigest.articles.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Weekly Digest
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Enrich your saved links, then generate a categorized reading digest.
          </p>
        </div>

        <button
          onClick={handleEnrichAndGenerate}
          disabled={enriching || generating}
          className="cursor-pointer shrink-0 h-10 px-5 rounded-lg bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
        >
          {enriching
            ? "Enriching..."
            : generating
              ? "Generating..."
              : "Generate digest"}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {status && (
        <p className="text-sm text-stone-500 dark:text-stone-400">{status}</p>
      )}

      {/* Digest view */}
      {currentDigest && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-stone-400">
              <span>
                {currentDigest.included_links} link
                {currentDigest.included_links === 1 ? "" : "s"}
              </span>
              {currentDigest.filtered_links > 0 && (
                <span>{currentDigest.filtered_links} filtered</span>
              )}
              <span className="capitalize">{currentDigest.mode} mode</span>
            </div>
            <button
              onClick={handleCopy}
              className="cursor-pointer text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
            >
              {copied ? "Copied" : "Copy markdown"}
            </button>
          </div>

          {/* Structured article view (for freshly generated digests with articles) */}
          {hasArticles ? (
            <div className="space-y-6">
              {Object.entries(groupedArticles).map(([topic, articles]) => (
                <section key={topic}>
                  <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wide mb-3">
                    {topic}
                  </h2>
                  <ul className="space-y-2">
                    {articles.map((article) => (
                      <li
                        key={article.id}
                        className="rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 overflow-hidden"
                      >
                        {/* Article header — always visible */}
                        <button
                          onClick={() => toggleArticle(article.id)}
                          className="cursor-pointer w-full text-left px-5 py-4 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-snug">
                                {article.title}
                              </p>
                              {article.description && (
                                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                                  {article.description}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 text-stone-300 dark:text-stone-600 text-xs mt-0.5">
                              {expandedArticle === article.id ? "▲" : "▼"}
                            </span>
                          </div>
                        </button>

                        {/* Expanded article content */}
                        {expandedArticle === article.id && (
                          <div className="border-t border-stone-200 dark:border-stone-800">
                            {article.content ? (
                              <div className="px-5 py-5 text-sm leading-relaxed text-stone-700 dark:text-stone-300 max-h-[70vh] overflow-y-auto whitespace-pre-line">
                                {article.content}
                              </div>
                            ) : (
                              <div className="px-5 py-4 text-sm text-stone-400">
                                Article content couldn&apos;t be extracted.
                              </div>
                            )}
                            <div className="px-5 py-3 border-t border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-900">
                              <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors break-all font-[family-name:var(--font-geist-mono)]"
                              >
                                {article.url} ↗
                              </a>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : currentDigest.markdown ? (
            /* Fallback: markdown view for older digests loaded from DB */
            <article className="prose prose-stone dark:prose-invert prose-sm max-w-none px-6 py-5 rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
              <ArticleMarkdown markdown={currentDigest.markdown} />
            </article>
          ) : null}
        </div>
      )}

      {!currentDigest && !generating && !enriching && (
        <p className="text-sm text-stone-400 py-8 text-center">
          No digest yet. Paste some links, then come back and generate.
        </p>
      )}

      {/* Past digests */}
      {pastDigests.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
          <h2 className="text-sm font-medium text-stone-500 dark:text-stone-400">
            Past digests
          </h2>
          <ul className="space-y-2">
            {pastDigests.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => selectDigest(d)}
                  className="cursor-pointer w-full text-left px-4 py-3 rounded-lg border border-stone-200 hover:bg-stone-100 transition-colors dark:border-stone-800 dark:hover:bg-stone-800"
                >
                  <p className="text-sm font-medium">
                    {new Date(d.generated_at).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    {d.included_links} link{d.included_links === 1 ? "" : "s"}{" "}
                    · {d.mode} mode
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Lazy-loaded markdown renderer for older digests */
function ArticleMarkdown({ markdown }) {
  const [Md, setMd] = useState(null);

  useEffect(() => {
    import("react-markdown").then((mod) => setMd(() => mod.default));
  }, []);

  if (!Md) return <p className="text-sm text-stone-400">Loading...</p>;
  return <Md>{markdown}</Md>;
}
