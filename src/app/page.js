import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/paste");
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Read Later</h1>
          <p className="text-stone-500 dark:text-stone-400 text-lg leading-relaxed">
            Paste your links. Get a categorized digest. Read with intention.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <Link
            href="/login"
            className="cursor-pointer inline-flex items-center justify-center h-11 px-6 rounded-lg bg-stone-900 text-stone-50 text-sm font-medium hover:bg-stone-800 transition-colors dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-200"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="cursor-pointer inline-flex items-center justify-center h-11 px-6 rounded-lg border border-stone-300 text-sm font-medium hover:bg-stone-100 transition-colors dark:border-stone-700 dark:hover:bg-stone-900"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
