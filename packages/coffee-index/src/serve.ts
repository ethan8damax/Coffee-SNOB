import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { join, normalize, resolve } from "node:path";

// Local stand-in for the R2 bucket: serves a build folder with the same
// headers the real host sends, so the app can run against a real build.
// pnpm --filter @coffeesnob/coffee-index serve out/<version>
const root = resolve(process.argv[2] ?? "out");
const port = Number(process.env.PORT ?? 8787);

createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname));
  const file = join(root, path);
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  if (file.endsWith(".json")) res.setHeader("Content-Type", "application/json");
  if (/[/\\]v[/\\].+[/\\](tiles|tiles-fine|search)[/\\][^/\\]+\.json$/.test(file)) res.setHeader("Content-Encoding", "gzip");
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
