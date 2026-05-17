"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "הדפסה" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:bg-zinc-50"
    >
      <Printer className="size-4 opacity-70" />
      {label}
    </button>
  );
}
