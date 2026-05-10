"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const [interests, setInterests] = useState("");
  const [mode, setMode] = useState("relaxed");
  const [reviewDay, setReviewDay] = useState("saturday");

  useEffect(() => {
    async function loadPreferences() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setInterests(data.interests_text || "");
        setMode(data.mode || "relaxed");
        setReviewDay(data.review_day || "saturday");
      }
      setLoading(false);
    }

    loadPreferences();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Not authenticated.");
        return;
      }

      const { error: upsertError } = await supabase
        .from("user_preferences")
        .upsert(
          {
            user_id: user.id,
            interests_text: interests,
            mode,
            review_day: reviewDay,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        setError(upsertError.message);
      } else {
        setSaved(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-stone-400">Loading preferences...</p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Tell the tool what you care about. It&apos;ll use this to shape your
          digest.
        </p>
      </div>

      {/* Interests */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          What do you want to read about?
        </label>
        <textarea
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="e.g. AI policy, politics, pop culture, front-end development, design systems"
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-stone-300 bg-white text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-stone-700 dark:bg-stone-900"
        />
        <p className="text-xs text-stone-400">
          Free text. Be as specific or broad as you want.
        </p>
      </div>

      {/* Mode */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">Digest mode</label>
        <div className="flex gap-3">
          <button
            onClick={() => setMode("strict")}
            className={`flex-1 px-4 py-3 rounded-lg border text-sm text-left transition-colors ${
              mode === "strict"
                ? "border-stone-900 bg-stone-900 text-stone-50 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
                : "border-stone-300 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
            }`}
          >
            <span className="font-medium block">Strict</span>
            <span
              className={`text-xs ${mode === "strict" ? "text-stone-300 dark:text-stone-600" : "text-stone-400"}`}
            >
              Only show links matching your interests.
            </span>
          </button>
          <button
            onClick={() => setMode("relaxed")}
            className={`flex-1 px-4 py-3 rounded-lg border text-sm text-left transition-colors ${
              mode === "relaxed"
                ? "border-stone-900 bg-stone-900 text-stone-50 dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
                : "border-stone-300 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
            }`}
          >
            <span className="font-medium block">Relaxed</span>
            <span
              className={`text-xs ${mode === "relaxed" ? "text-stone-300 dark:text-stone-600" : "text-stone-400"}`}
            >
              Show everything, grouped by topic.
            </span>
          </button>
        </div>
      </div>

      {/* Review day */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">
          Preferred review day
        </label>
        <select
          value={reviewDay}
          onChange={(e) => setReviewDay(e.target.value)}
          className="h-10 px-3 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-stone-700 dark:bg-stone-900"
        >
          {DAYS.map((day) => (
            <option key={day} value={day}>
              {day.charAt(0).toUpperCase() + day.slice(1)}
            </option>
          ))}
        </select>
        <p className="text-xs text-stone-400">
          When you want to sit down and read. Just a reminder for now.
        </p>
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-5 rounded-lg bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
        {saved && (
          <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>
        )}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </div>
  );
}
