"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2">Please try again.</p>
        <button className="btn-primary mt-6 px-5 py-2" onClick={() => reset()}>
          Try again
        </button>
      </div>
    </main>
  );
}
