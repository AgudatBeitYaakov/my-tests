"use client";

import { formatGradeLabel } from "@/lib/academicYears/labels";
import { GRADE_LEVELS, type GradeLevel } from "@/lib/academicYears/types";

type Props = {
  value: GradeLevel[];
  onChange: (levels: GradeLevel[]) => void;
  disabled?: boolean;
  legend?: string;
  hint?: string;
};

export function GradeLevelCheckboxes({
  value,
  onChange,
  disabled,
  legend = "שכבות * (אפשר כמה)",
  hint,
}: Props) {
  function toggle(level: GradeLevel) {
    if (value.includes(level)) {
      onChange(value.filter((g) => g !== level));
    } else {
      onChange([...value, level]);
    }
  }

  return (
    <fieldset className="block" disabled={disabled}>
      <legend className="text-sm font-medium text-zinc-700">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-3">
        {GRADE_LEVELS.map((level) => {
          const checked = value.includes(level);
          return (
            <label
              key={level}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                checked ? "border-zinc-900 bg-zinc-50" : "border-zinc-200"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(level)}
              />
              {formatGradeLabel(level)}
            </label>
          );
        })}
      </div>
      {hint ? <p className="mt-2 text-xs text-zinc-600">{hint}</p> : null}
    </fieldset>
  );
}
