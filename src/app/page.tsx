import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Render basic home; session-only flows are handled client-side.

  // Logged-in users see the home page content.
  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <h1 className="text-5xl font-bold mb-4 text-center">BloomCrux</h1>
      <p className="text-lg mb-8 text-center max-w-xl text-gray-700">
        This page will be finished soon, go to decks!
      </p>
      <div className="flex gap-4">
        <Link
          href="/decks"
          className="bg-blue-600 text-white px-6 py-3 rounded shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 -left-1 -left-2 -inset-2 border-none"
        >
          Go to Decks
        </Link>
        
      </div>
    </main>
  );
}
