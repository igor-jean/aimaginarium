"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

export function CreateGameForm() {
  const [name, setName] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [totalRounds, setTotalRounds] = useState(5);
  const [targetScore, setTargetScore] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Vous devez être connecté pour créer une partie");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const gameCode = generateGameCode();
      console.log("Tentative de création de partie:", {
        name,
        code: gameCode,
        isPublic,
        totalRounds,
        targetScore,
      });

      const response = await fetch("/api/games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          code: gameCode,
          isPublic,
          totalRounds,
          targetScore,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Erreur lors de la création de la partie"
        );
      }

      console.log("Partie créée avec succès:", data);
      router.push(`/games/${data.code}`);
    } catch (err) {
      console.error("Erreur lors de la création:", err);
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="text-red-500">
        Vous devez être connecté pour créer une partie
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-300"
        >
          Nom de la partie
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500"
          placeholder="Ex: La partie du siècle"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="totalRounds"
            className="block text-sm font-medium text-gray-300"
          >
            Nombre de tours
          </label>
          <input
            id="totalRounds"
            type="number"
            min="1"
            max="20"
            value={totalRounds}
            onChange={(e) => setTotalRounds(parseInt(e.target.value))}
            className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500"
          />
        </div>

        <div>
          <label
            htmlFor="targetScore"
            className="block text-sm font-medium text-gray-300"
          >
            Score à atteindre
          </label>
          <input
            id="targetScore"
            type="number"
            min="1"
            max="20"
            value={targetScore}
            onChange={(e) => setTargetScore(parseInt(e.target.value))}
            className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white shadow-sm focus:border-purple-500 focus:ring-purple-500"
          />
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <label className="flex items-center space-x-3 text-sm font-medium text-gray-300">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(e) => setIsPublic(e.target.checked)}
            className="rounded bg-gray-700 border-gray-600 text-purple-600 focus:ring-purple-500"
          />
          <span>Partie publique</span>
        </label>
      </div>

      {!isPublic && (
        <div className="text-sm text-gray-400">
          Un code unique sera généré pour partager la partie en privé
        </div>
      )}

      {error && <div className="text-red-500 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Création..." : "Créer la partie"}
      </button>
    </form>
  );
}
