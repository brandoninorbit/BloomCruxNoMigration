"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createDeck, listFolders } from "@/lib/repo";

export default function NewDeckPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listFolders()
      .then(f => setFolders(f))
      .catch(() => setFolders([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const deck = await createDeck({ title, description, folderId });
      router.push(`/decks/${deck.id}/edit`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create deck");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create New Deck</h1>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="deck-title">Title<span className="text-red-500">*</span></label>
            <input
              id="deck-title"
              type="text"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="deck-description">Description</label>
            <textarea
              id="deck-description"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="deck-folder">Folder</label>
            <select
              id="deck-folder"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
              value={folderId ?? ""}
              onChange={e => setFolderId(e.target.value || null)}
              disabled={loading}
            >
              <option value="">None</option>
              {folders.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
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
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:bg-blue-700 transition-colors"
              disabled={loading}
            >
              Create Deck
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
