"use client";

import { MessageSquare } from "lucide-react";
import { useCallback, useState } from "react";

type Entity = "students" | "exams" | "makeups";

export function NotesButton({ entity, id, label = "הערות" }: { entity: Entity; id: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/notes/${entity}/${id}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setNotes((j as { notes?: string }).notes ?? "");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [entity, id]);

  async function openModal() {
    setOpen(true);
    await load();
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/notes/${entity}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setOpen(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openModal()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-50"
      >
        <MessageSquare className="size-4 opacity-70" />
        {label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-900">הערות</h3>
            {loading ? (
              <p className="mt-3 text-sm text-zinc-500">טוען…</p>
            ) : (
              <textarea
                className="mt-3 min-h-[140px] w-full rounded-lg border border-zinc-200 p-3 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm" onClick={() => setOpen(false)}>
                ביטול
              </button>
              <button
                type="button"
                disabled={saving || loading}
                className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => void save()}
              >
                {saving ? "שומר…" : "שמירה"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
