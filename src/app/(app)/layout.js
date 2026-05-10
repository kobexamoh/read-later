import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logout } from "@/app/actions";

export default async function AppLayout({ children }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <>
      <header className="border-b border-stone-200 dark:border-stone-800">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link
              href="/paste"
              className="text-sm font-semibold tracking-tight"
            >
              Read Later
            </Link>
            <Link
              href="/paste"
              className="text-sm text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors"
            >
              Paste
            </Link>
            <Link
              href="/digest"
              className="text-sm text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors"
            >
              Digest
            </Link>
            <Link
              href="/settings"
              className="text-sm text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 transition-colors"
            >
              Settings
            </Link>
          </nav>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 transition-colors"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-8">{children}</div>
      </main>
    </>
  );
}
