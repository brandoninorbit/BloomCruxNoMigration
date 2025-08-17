"use client";
import Link from "next/link";

export default function DecksPage() {
  // Mock data extracted from inline arrays
  const mockDecks = [
    { tag: "Biology", title: "Intro to Biology", locked: false },
    { tag: "Spanish", title: "Spanish Vocabulary", locked: false },
    { tag: "History", title: "World History", locked: true },
    { tag: "Chemistry", title: "Organic Chemistry", locked: false },
  ];

  const mockFolders = [
    { name: "Science", sets: 12, bg: "bg-blue-100", text: "text-blue-500" },
    { name: "Languages", sets: 8, bg: "bg-green-100", text: "text-green-500" },
    { name: "Humanities", sets: 15, bg: "bg-yellow-100", text: "text-yellow-500" },
  ];
  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Soft background accents */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 opacity-50"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='grad' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%23ffffff;stop-opacity:0.1' /%3E%3Cstop offset='100%25' style='stop-color:%23f9f9f9;stop-opacity:0.1' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect x='0' y='0' width='100%25' height='100%25' fill='url(%23grad)'/%3E%3C/svg%3E\"), url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Cpath d='M0 50 Q 25 25, 50 50 T 100 50' stroke='%23f0f2f4' stroke-width='1' fill='none'/%3E%3Cpath d='M0 60 Q 25 35, 50 60 T 100 60' stroke='%23f0f2f4' stroke-width='1' fill='none'/%3E%3Cpath d='M0 70 Q 25 45, 50 70 T 100 70' stroke='%23f0f2f4' stroke-width='1' fill='none'/%3E%3C/svg%3E\")",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 right-0 -z-10 w-1/2 h-1/2 bg-gradient-to-tr from-cyan-50 to-blue-100 opacity-20 blur-3xl"
      />
      <div className="max-w-4xl mx-auto">
        {/* Greeting */}
        <h2 className="text-3xl font-bold text-[#111418] mb-2">
          Welcome back, Sarah
        </h2>
        <p className="text-[#637488] mb-6">Let&apos;s get learning.</p>

        {/* Search (disabled/coming soon) */}
        <div className="relative mb-2">
          <input
            type="search"
            placeholder="Search your decks... (Coming Soon)"
            disabled
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1f8fff] focus:border-transparent transition-shadow shadow-sm"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg
              width="20"
              height="20"
              viewBox="0 0 256 256"
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              aria-hidden
            >
              <path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z" />
            </svg>
          </div>
        </div>
        <p className="text-xs text-[#637488] italic px-2">
          Tip: Consistent review is the key to long-term memory.
        </p>

        {/* Decks */}
        <section className="mt-12">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-semibold text-[#111418]">Decks</h3>
            <div className="flex items-center gap-4">
              <Link
                href="#"
                className="bg-[#f0f2f4] text-[#111418] font-bold py-2 px-4 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1f8fff] focus:ring-opacity-50 transition-colors"
              >
                New Set
              </Link>
              <Link
                href="/decks/folders/new"
                className="bg-[#1f8fff] text-white font-bold py-2 px-4 rounded-md hover:bg-[#2481f9] focus:outline-none focus:ring-2 focus:ring-[#1f8fff] focus:ring-opacity-50 transition-colors"
              >
                New Folder
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {mockDecks.map((d) => (
              <div key={d.title} className="group [perspective:1000px]">
                <div className="relative w-full aspect-[3/4] bg-white rounded-xl shadow-md transition-all duration-500 group-hover:shadow-xl group-hover:-translate-y-2 [transform-style:preserve-3d] group-hover:[transform:rotateY(3deg)]">
                  <div className="absolute inset-0 bg-gray-100 rounded-xl flex items-center justify-center">
                    {d.locked && (
                      <div className="absolute top-2 right-2 p-1.5 bg-[#ffc107]/20 text-[#ffc107] rounded-full">
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                    )}
                    <p className="text-lg font-medium text-[#637488]">
                      {d.tag}
                    </p>
                  </div>
                  <div className="absolute bottom-4 left-4 text-sm font-medium text-[#111418]">
                    {d.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Folders */}
        <section className="mt-12">
          <h3 className="text-2xl font-semibold text-[#111418] mb-4">
            Folders
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {mockFolders.map((f) => (
              <Link
                key={f.name}
                href="#"
                className="bg-white rounded-xl shadow-md p-5 flex items-center gap-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
>
                <div
                  className={`w-12 h-12 flex-shrink-0 rounded-lg ${f.bg} ${f.text} flex items-center justify-center`}
                >
                  <svg
                    className="h-6 w-6"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[#111418]">{f.name}</p>
                  <p className="text-sm text-[#637488]">{f.sets} sets</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
