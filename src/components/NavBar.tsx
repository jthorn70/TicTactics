"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabaseClient";

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <Button size="sm" variant="ghost" onClick={() => setDark(!dark)}>
      {dark ? "Light Mode" : "Dark Mode"}
    </Button>
  );
}

export default function NavBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close menu on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Session awareness
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.session?.user?.email ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((_evt, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const initials = useMemo(() => {
    if (!email) return "🙂";
    const base = email.split("@")[0];
    const parts = base.split(/[._-]/).filter(Boolean);
    if (parts.length === 0) return base.slice(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }, [email]);

  const logout = async () => {
    await supabase.auth.signOut();
    setMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-10 -mx-4 mb-4 border-b border-line bg-paper/80 backdrop-blur">
      <div className="mx-auto max-w-screen-sm px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="tracking-wide text-xl font-semibold">
            TicTactics
          </Link>
          <nav className="hidden sm:flex items-center gap-3 text-sm">
            <Link
              href="/play"
              className="rounded-md px-2.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
            >
              Play
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-md px-2.5 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
            >
              Leaderboard
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {!email ? (
            <Link href="/login">
              <Button size="sm">Log in</Button>
            </Link>
          ) : (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="h-8 w-8 rounded-full border border-line bg-white dark:bg-white/10 text-xs font-semibold"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={email}
              >
                {initials}
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-44 rounded-lg border border-line bg-white dark:bg-[#111827] shadow-lg p-2 text-sm"
                >
                  <div className="px-2 py-1 text-muted truncate">{email}</div>
                  <Link
                    href="/play"
                    className="block rounded-md px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
                    onClick={() => setMenuOpen(false)}
                  >
                    Play
                  </Link>
                  <Link
                    href="/leaderboard"
                    className="block rounded-md px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
                    onClick={() => setMenuOpen(false)}
                  >
                    Leaderboard
                  </Link>
                  <button
                    onClick={logout}
                    className="mt-1 w-full text-left rounded-md px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
