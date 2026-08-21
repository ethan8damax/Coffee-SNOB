import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Ported from screens/journal-data.jsx in the Claude Design project.
// "nobody-roasts-for-the-second-cup" is excluded — it's hand-authored in full already.
const STUBS = [
  { slug: "the-case-for-a-bad-chair", title: "The case for a bad chair", category: "Rooms", author: "Theo Reyes", date: "2026-08-12", readMinutes: 7, photoAlt: "Wooden stool at a tiled counter, no cushion", dek: "Four rooms we keep going back to, none of them comfortable. On cafés designed for forty minutes rather than four hours." },
  { slug: "three-days-in-porto", title: "Three days in Porto, one good espresso", category: "Field notes", author: "Inês Lopes", date: "2026-08-09", readMinutes: 6, photoAlt: "Porto café interior, marble counter and standing customers", dek: "More cafés per head than almost anywhere in Europe, and a bar culture that resists everything specialty coffee wants from it." },
  { slug: "stop-grinding-finer", title: "Stop grinding finer", category: "Brewing", author: "Yael Sassoon", date: "2026-08-05", readMinutes: 5, photoAlt: "Ground coffee in a dosing cup, overhead", dek: "Your filter is bitter and it is not the grinder's fault. A short argument for changing one variable at a time." },
  { slug: "the-kettle-question-settled", title: "The kettle question, settled", category: "Gear", author: "Theo Reyes", date: "2026-08-02", readMinutes: 11, photoAlt: "Six kettles lined up on a bench, flat lay", dek: "Six pouring kettles through eight weeks of service. Two are worth the money and only one is worth the counter space." },
  { slug: "what-a-co-ferment-actually-costs", title: "What a co-ferment actually costs", category: "Roasters", author: "Mara Kessler", date: "2026-07-28", readMinutes: 12, photoAlt: "Fermentation tanks on a Colombian finca", dek: "Producers are being asked to gamble a harvest on a flavour trend. We followed the money from a Colombian finca to a Berlin menu." },
  { slug: "standing-room-only", title: "Standing room only", category: "Rooms", author: "Inês Lopes", date: "2026-07-24", readMinutes: 5, photoAlt: "Narrow Paris standing bar seen from the doorway", dek: "Paris kept the counter and lost the couch. Notes on the standing bar as the most honest format in coffee." },
];

const DIR = new URL("../apps/web/content/journal/", import.meta.url).pathname;

for (const stub of STUBS) {
  const path = join(DIR, `${stub.slug}.mdx`);
  if (existsSync(path)) continue;
  const frontmatter = [
    "---",
    `title: "${stub.title}"`,
    `category: "${stub.category}"`,
    `author: "${stub.author}"`,
    `date: "${stub.date}"`,
    `readMinutes: ${stub.readMinutes}`,
    `photoAlt: "${stub.photoAlt}"`,
    `dek: "${stub.dek}"`,
    "---",
    "",
    `${stub.dek}`,
    "",
    "_Full piece not yet written._",
    "",
  ].join("\n");
  writeFileSync(path, frontmatter);
  console.log(`wrote ${path}`);
}
