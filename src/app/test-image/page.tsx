"use client";

import { useImageGeneration } from "@/hooks/useImageGeneration";
import { useState } from "react";

export default function TestImagePage() {
  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const { generateImage, loading, error } = useImageGeneration();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const imageUrl = await generateImage(prompt);
      setGeneratedImage(imageUrl);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white py-12">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">Test de Génération d'Images</h1>

        <form onSubmit={handleSubmit} className="space-y-4 mb-8">
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium mb-2">
              Description de l'image
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              rows={4}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !prompt}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Génération en cours..." : "Générer l'image"}
          </button>
        </form>

        {error && <div className="text-red-500 mb-4">Erreur: {error}</div>}

        {generatedImage && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Image générée :</h2>
            <img
              src={generatedImage}
              alt="Generated"
              className="w-full max-w-2xl mx-auto rounded-lg shadow-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
}
