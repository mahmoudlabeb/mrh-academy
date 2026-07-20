"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen flex items-center justify-center p-6 text-center">
          <div>
            <h1>Application error</h1>
            <button onClick={() => reset()}>Reload</button>
          </div>
        </main>
      </body>
    </html>
  );
}
