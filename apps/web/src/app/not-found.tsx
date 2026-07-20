import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2">This page could not be found.</p>
        <Link className="btn-primary inline-flex mt-6 px-5 py-2" href="/">
          Back home
        </Link>
      </div>
    </main>
  );
}
