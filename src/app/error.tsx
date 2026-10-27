"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="my-16 rounded-xl border border-ember/40 bg-smoke p-8 text-center">
      <p role="alert" className="font-display text-2xl">Something went wrong</p>
      <p className="mx-auto mt-2 max-w-md text-ash">The page didn&apos;t load. Nothing was changed on your account. Try again.</p>
      <button onClick={reset} className="mt-5 rounded-full bg-ember px-5 py-2.5 font-medium hover:bg-ember-hi">Try again</button>
    </div>
  );
}
