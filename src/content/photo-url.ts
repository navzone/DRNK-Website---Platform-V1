/**
 * Photos are downloaded into /public/photos at build time (scripts/fetch-photos.ts) and served from the site itself.
 * If a local file is missing, components fall back to the original Unsplash address, then to a tinted tile.
 */
export const UNSPLASH = "https://images.unsplash.com";

export const localPhotoPath = (id: string, w: number) => `/photos/${id}-${w}.jpg`;
export const remotePhotoUrl = (id: string, w: number, base = UNSPLASH) => `${base}/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Original Unsplash address for a local /photos/<id>-<w>.jpg path, or undefined for anything else. */
export function remoteFallback(src: string): string | undefined {
  const m = /^\/photos\/([0-9]+-[0-9a-f]+)-(\d+)\.jpg$/.exec(src);
  return m ? remotePhotoUrl(m[1]!, Number(m[2])) : undefined;
}
