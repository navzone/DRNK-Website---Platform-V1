/** Short commit id of the running deployment (set by Vercel). Undefined locally. Not shown on production. */
export function buildId(): string | undefined {
  if (process.env.APP_ENV === "production") return undefined;
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
}
