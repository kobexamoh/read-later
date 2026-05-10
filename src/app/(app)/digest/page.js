"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Markdown from "react-markdown";

export default function DigestPage() {
  const [generating, setGenerating] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [currentDigest, setCurrentDigest] = useState(null);
  const [pastDigests, setPastDigests] = useState([]);
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
  }

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
          className="shrink-0 h-10 px-5 rounded-lg bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
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

      {/* Current digest */}
      {currentDigest?.markdown && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-stone-400">
              <span>
                {currentDigest.included_links} link
                {currentDigest.included_links === 1 ? "" : "s"}
              </span>
              {currentDigest.filtered_links > 0 && (
                <span>
                  {currentDigest.filtered_links} filtered
                </span>
              )}
              <span className="capitalize">{currentDigest.mode} mode</span>
            </div>
            <button
              onClick={handleCopy}
              className="text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
            >
              {copied ? "Copied" : "Copy markdown"}
            </button>
          </div>

          <article className="prose prose-stone dark:prose-invert prose-sm max-w-none px-6 py-5 rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
            <Markdown>{currentDigest.markdown}</Markdown>
          </article>
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
                  className="w-full text-left px-4 py-3 rounded-lg border border-stone-200 hover:bg-stone-100 transition-colors dark:border-stone-800 dark:hover:bg-stone-800"
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
