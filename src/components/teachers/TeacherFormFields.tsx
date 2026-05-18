type Props = {
  defaults?: {
    first_name?: string;
    last_name?: string;
    tz?: string | null;
    email?: string | null;
    notes?: string | null;
  };
};

export function TeacherFormFields({ defaults }: Props) {
  return (
    <>
      <label className="block">
        <div className="text-sm font-medium">שם פרטי *</div>
        <input
          name="first_name"
          required
          defaultValue={defaults?.first_name ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </label>
      <label className="block">
        <div className="text-sm font-medium">שם משפחה *</div>
        <input
          name="last_name"
          required
          defaultValue={defaults?.last_name ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </label>
      <label className="block">
        <div className="text-sm font-medium">ת״ז</div>
        <input
          name="tz"
          inputMode="numeric"
          pattern="\d{0,9}"
          defaultValue={defaults?.tz ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          placeholder="עד 9 ספרות"
        />
      </label>
      <label className="block">
        <div className="text-sm font-medium">מייל</div>
        <input
          name="email"
          type="email"
          defaultValue={defaults?.email ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </label>
      <label className="block md:col-span-2">
        <div className="text-sm font-medium">הערות</div>
        <textarea
          name="notes"
          rows={3}
          defaultValue={defaults?.notes ?? ""}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
        />
      </label>
    </>
  );
}
