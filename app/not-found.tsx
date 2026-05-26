import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="max-w-md rounded-3xl border border-line bg-card p-8 text-center shadow-soft">
        <p className="text-2xl font-semibold text-ink">Page not found</p>
        <p className="mt-3 text-sm text-muted">The page you are looking for does not exist.</p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-white transition hover:bg-teal-700"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
