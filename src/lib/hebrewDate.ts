const DAY_LETTERS = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "י״א", "י״ב", "י״ג", "י״ד", "ט״ו", "ט״ז", "י״ז", "י״ח", "י״ט", "כ", "כ״א", "כ״ב", "כ״ג", "כ״ד", "כ״ה", "כ״ו", "כ״ז", "כ״ח", "כ״ט", "ל"];

const MONTH_NAMES = [
  "",
  "ניסן",
  "אייר",
  "סיוון",
  "תמוז",
  "אב",
  "אלול",
  "תשרי",
  "חשוון",
  "כסלו",
  "טבת",
  "שבט",
  "אדר",
  "אדר ב",
];

function hebrewYearLetters(y: number): string {
  const thousands = Math.floor(y / 1000);
  const rest = y % 1000;
  const hundreds = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];
  const tens = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
  const ones = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
  let h = rest;
  const hIdx = Math.floor(h / 100);
  h %= 100;
  const tIdx = Math.floor(h / 10);
  const oIdx = h % 10;
  const core = `${hundreds[hIdx] ?? ""}${tens[tIdx] ?? ""}${ones[oIdx] ?? ""}`;
  const prefix = thousands > 5 ? "ה" : "";
  return `${prefix}${core}`;
}

/** תאריך עברי בפורמט מסורתי: ג׳ בשבט תשפ״ו */
export function formatHebrewDateTraditional(d: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-hebrew", {
      day: "numeric",
      month: "numeric",
      year: "numeric",
    }).formatToParts(d);

    const day = Number(parts.find((p) => p.type === "day")?.value ?? 0);
    const month = Number(parts.find((p) => p.type === "month")?.value ?? 0);
    const year = Number(parts.find((p) => p.type === "year")?.value ?? 0);

    if (!day || !month || !year) return "";

    const dayStr = DAY_LETTERS[day] ?? String(day);
    const monthStr = MONTH_NAMES[month] ?? "";
    const yearStr = hebrewYearLetters(year);
    return `${dayStr} ב${monthStr} ${yearStr}`.trim();
  } catch {
    return "";
  }
}
