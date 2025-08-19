import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";

export default async function HomePage() {
  // Server-side check: if logged out, send users to About page.
    const store = await cookies();
    const cookiesAccessor = (async () => store) as Parameters<typeof createServerComponentClient>[0]["cookies"];
    const supabase = createServerComponentClient({ cookies: cookiesAccessor });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    redirect("/about");
  }

  // Logged-in users see the home page content.
  return (
    <main className="flex flex-col items-center justify-center min-h-[60vh] p-8">
      <h1 className="text-5xl font-bold mb-4 text-center">BloomCrux</h1>
      <p className="text-lg mb-8 text-center max-w-xl text-gray-700">
        The simplest way for students of any major to create, organize, and study flashcard decks. No coding required—just start learning!
      </p>
      <div className="flex gap-4">
        <Link
          href="/decks"
          className="bg-blue-600 text-white px-6 py-3 rounded shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Go to Decks
        </Link>
        <a
          href="https://github.com/brandoninorbit/BloomCruxGit"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-gray-100 text-gray-800 px-6 py-3 rounded shadow hover:bg-gray-200 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          View Code
        </a>
      </div>
    </main>
  );
}
