import fs from "fs";
const p =
  "C:/Users/לבורנטית/.cursor/projects/c-Users-Desktop-t/agent-transcripts/83b19ba5-8083-4872-8afe-e5234094d607/83b19ba5-8083-4872-8afe-e5234094d607.jsonl";
const out =
  "C:/Users/לבורנטית/Desktop/טויבי דויטשר/קודים/t/src/app/(app)/students/[id]/StudentDetailClient.tsx";
const lines = fs.readFileSync(p, "utf8").split("\n");
for (const line of lines) {
  if (!line.includes("StudentDetailClient.tsx")) continue;
  try {
    const j = JSON.parse(line);
    for (const c of j.message?.content ?? []) {
      const contents = c.input?.contents;
      if (contents && contents.includes("export function StudentDetailClient")) {
        fs.writeFileSync(out, contents);
        console.log("restored", contents.length);
        process.exit(0);
      }
    }
  } catch {
    /* skip */
  }
}
console.log("not found");
