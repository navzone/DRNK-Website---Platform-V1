export default function Loading() {
  return (
    <div className="mt-10 space-y-4" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-12 w-2/3" />
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-24 w-full" />
      <div className="skeleton h-24 w-full" />
    </div>
  );
}
