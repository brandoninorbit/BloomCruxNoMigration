"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createFolder } from "@/lib/repo";

export default function NewFolderPage() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Folder name is required.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createFolder(name);
      router.push("/decks");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create folder");
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
            />
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
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
