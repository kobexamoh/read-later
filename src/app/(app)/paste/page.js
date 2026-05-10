"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { extractLinks } from "@/lib/url-parser";

export default function PastePage() {
  const [text, setText] = useState("");
  const [extracted, setExtracted] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  function handlePreview() {
    const links = extractLinks(text);
    setExtracted(links);
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    if (!extracted || extracted.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Not authenticated.");
        setSaving(false);
        return;
      }

      // Insert all links as pending
      const rows = extracted.map((link) => ({
        user_id: user.id,
        url: link.url,
        title: link.title,
        status: "pending",
        source: "paste",
      }));

      const { error: insertError } = await supabase
        .from("links")
        .insert(rows);

      if (insertError) {
        setError(insertError.message);
      } else {
        setSaved(true);
        setText("");
        setExtracted(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Paste links</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Dump your URLs here — raw links, markdown links, or just a messy pile
          from Notes. We&apos;ll sort it out.
        </p>
      </div>

      <div className="space-y-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Paste URLs here, one per line or mixed in with text.\n\nExamples:\nhttps://example.com/article\n[Article Title](https://example.com/article)\nhttps://another.com/post https://third.com/read`}
          rows={10}
          className="w-full px-4 py-3 rounded-lg border border-stone-300 bg-white text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-stone-700 dark:bg-stone-900 font-[family-name:var(--font-geist-mono)]"
        />

        <div className="flex gap-3">
          <button
            onClick={handlePreview}
            disabled={!text.trim()}
            className="h-10 px-5 rounded-lg bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-30 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
          >
            Extract links
          </button>
          {extracted && extracted.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-10 px-5 rounded-lg border border-stone-300 text-sm font-medium hover:bg-stone-100 transition-colors disabled:opacity-50 dark:border-stone-700 dark:hover:bg-stone-800"
            >
              {saving
                ? "Saving..."
                : `Save ${extracted.length} link${extracted.length === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {saved && (
        <p className="text-sm text-green-700 dark:text-green-400">
          Links saved. They&apos;ll be enriched when you generate your next
          digest.
        </p>
      )}

      {extracted && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-stone-500 dark:text-stone-400">
            {extracted.length} link{extracted.length === 1 ? "" : "s"} found
          </h2>
          {extracted.length === 0 ? (
            <p className="text-sm text-stone-400">
              No URLs detected. Try pasting some links.
            </p>
          ) : (
            <ul className="space-y-2">
              {extracted.map((link, i) => (
                <li
                  key={i}
                  className="px-4 py-3 rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
                >
                  {link.title && (
                    <p className="text-sm font-medium">{link.title}</p>
                  )}
                  <p className="text-xs text-stone-500 dark:text-stone-400 break-all font-[family-name:var(--font-geist-mono)]">
                    {link.url}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
