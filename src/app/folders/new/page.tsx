"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase/browserClient";

export default function NewFolderPage() {
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = getSupabaseClient();

  const COLORS = [
    { name: "blue", class: "bg-blue-500" },
    { name: "green", class: "bg-green-500" },
    { name: "yellow", class: "bg-yellow-500" },
    { name: "purple", class: "bg-purple-500" },
    { name: "pink", class: "bg-pink-500" },
    { name: "orange", class: "bg-orange-500" },
    { name: "gray", class: "bg-gray-400" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Folder name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: dbError } = await supabase
        .from("folders")
        .insert([{ name, color }]);
      if (dbError) throw dbError;
      router.push("/decks");
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError("Failed to create folder");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Folder</h1>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="folder-name">Folder Name<span className="text-red-500">*</span></label>
            <input
              id="folder-name"
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              disabled={loading}
              placeholder="e.g., Biology 101"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex gap-4 items-center">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${c.class} ${color === c.name ? "ring-2 ring-blue-400" : ""}`}
                  onClick={() => setColor(c.name)}
                  aria-label={c.name}
                  disabled={loading}
                >
                  {color === c.name && <span className="h-4 w-4 rounded-full border-2 border-white bg-white" />}
                </button>
              ))}
            </div>
          </div>
          {error && <div className="text-red-500 text-sm">{error}</div>}
          <div className="flex justify-end gap-4 mt-8">
            <button
              type="button"
              className="text-gray-600 font-medium hover:text-gray-900 transition-colors"
              onClick={() => router.push("/decks")}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-400 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:bg-blue-500 transition-colors"
              disabled={loading}
            >
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
