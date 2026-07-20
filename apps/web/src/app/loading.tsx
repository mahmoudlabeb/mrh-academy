export default function Loading() {
  return (
    <main
      className="min-h-screen flex items-center justify-center"
      aria-label="Loading"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
    </main>
  );
}
