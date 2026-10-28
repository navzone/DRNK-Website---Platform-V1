/**
 * Downloads the stock photos the site uses into public/photos so they are served from the site's own address.
 * Runs during the Vercel build. It never fails the build: anything that cannot be downloaded is listed in
 * public/photos/manifest.json and the pages fall back to the original Unsplash address, then to a tinted tile.
 *
 * PHOTO_BASE overrides the source host (used by tests). SKIP_PHOTO_FETCH=1 skips the download.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { allPhotoFiles } from "../src/content/photos";
import { localPhotoPath, remotePhotoUrl, UNSPLASH } from "../src/content/photo-url";

const OUT = path.join(process.cwd(), "public");
const base = process.env.PHOTO_BASE || UNSPLASH;

async function exists(file: string) {
  try { return (await stat(file)).size > 500; } catch { return false; }
}

async function download(id: string, w: number): Promise<string | null> {
  const file = path.join(OUT, localPhotoPath(id, w));
  if (await exists(file)) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(remotePhotoUrl(id, w, base), { signal: AbortSignal.timeout(20_000), redirect: "follow" });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) throw new Error(`HTTP ${res.status} ${type}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length < 500) throw new Error("response too small to be a photo");
      await writeFile(file, bytes);
      return null;
    } catch (e) {
      if (attempt === 1) return `${id}-${w}: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return null;
}

async function main() {
  if (process.env.SKIP_PHOTO_FETCH === "1") { console.log("photos: skipped (SKIP_PHOTO_FETCH=1)"); return; }
  const files = allPhotoFiles();
  await mkdir(path.join(OUT, "photos"), { recursive: true });
  const failed: string[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < files.length) {
      const f = files[next++]!;
      const err = await download(f.id, f.w);
      if (err) failed.push(err);
    }
  }));
  const manifest = { generatedAt: new Date().toISOString(), total: files.length, downloaded: files.length - failed.length, failed: failed.sort() };
  await writeFile(path.join(OUT, "photos", "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`photos: ${manifest.downloaded}/${manifest.total} available in public/photos${failed.length ? `, ${failed.length} failed (see /photos/manifest.json)` : ""}`);
  for (const f of failed.slice(0, 10)) console.log(`  - ${f}`);
}

main().catch((e) => { console.log("photos: download step failed, pages will use fallbacks:", e instanceof Error ? e.message : e); });
