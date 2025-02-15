"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Game {
  id: number;
  name: string;
  code: string;
  isPublic: boolean;
  status: string;
  masterId: number;
}

export default function GamesPage() {
  const [publicGames, setPublicGames] = useState<Game[]>([]);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchPublicGames();
  }, []);

  const fetchPublicGames = async () => {
    try {
      const response = await fetch("/api/games");
      if (!response.ok) {
        throw new Error("Erreur lors de la récupération des parties");
      }
      const data = await response.json();
      setPublicGames(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;

    try {
      const response = await fetch(`/api/games?code=${code}`);
      if (!response.ok) {
        throw new Error("Partie non trouvée");
      }
      const game = await response.json();
      router.push(`/games/${game.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-white">Parties disponibles</h1>
          <Link
            href="/games/new"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            Créer une partie
          </Link>
        </div>

        {/* Rejoindre par code */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Rejoindre une partie privée
          </h2>
          <form onSubmit={handleJoinByCode} className="flex gap-4">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Entrez le code de la partie"
              className="flex-1 rounded-md bg-gray-700 border-gray-600 text-white focus:border-purple-500 focus:ring-purple-500"
              maxLength={4}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              Rejoindre
            </button>
          </form>
        </div>

        {/* Liste des parties publiques */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Parties publiques
          </h2>
          {loading ? (
            <div className="text-gray-400">Chargement des parties...</div>
          ) : error ? (
            <div className="text-red-500">{error}</div>
          ) : publicGames.length === 0 ? (
            <div className="text-gray-400">
              Aucune partie publique disponible
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {publicGames.map((game) => (
                <div
                  key={game.id}
                  className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors"
                >
                  <h3 className="text-lg font-medium text-white mb-2">
                    {game.name}
                  </h3>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">Code: {game.code}</span>
                    <Link
                      href={`/games/${game.code}`}
                      className="px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      Rejoindre
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
