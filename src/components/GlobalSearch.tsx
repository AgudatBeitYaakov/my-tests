"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Result = { type: string; id: string; label: string; href: string };

export function GlobalSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((j) => setResults((j as { results?: Result[] }).results ?? []))
        .catch(() => setResults([]));
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        placeholder="חיפוש תלמידות, מורות, מבחנים…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full rounded-xl border border-zinc-200 bg-white py-2 pe-3 ps-9 text-sm outline-none focus:border-sky-400 dark:border-zinc-600 dark:bg-zinc-900"
      />
      {open && results.length ? (
        <ul className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {results.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <Link
                href={r.href}
                className="block px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-white/5"
                onClick={() => setOpen(false)}
              >
                <span className="text-xs text-zinc-500">{r.type}</span>
                <div className="font-medium text-zinc-900 dark:text-zinc-100">{r.label}</div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
