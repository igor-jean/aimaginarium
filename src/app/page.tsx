import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            AImaginarum
          </h1>
          <p className="text-xl mb-8 text-gray-300">
            Un jeu créatif où l'imagination rencontre l'intelligence
            artificielle
          </p>

          <div className="space-y-4 sm:space-y-0 sm:space-x-4 flex flex-col sm:flex-row justify-center">
            <Link
              href="/games/new"
              className="inline-block px-8 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Créer une partie
            </Link>

            <Link
              href="/games"
              className="inline-block px-8 py-3 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors"
            >
              Rejoindre une partie
            </Link>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">🎨 Créez</h3>
            <p className="text-gray-400">
              Devenez le maître de l'image et défiez les autres joueurs avec vos
              créations générées par IA
            </p>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">🎯 Reproduisez</h3>
            <p className="text-gray-400">
              Tentez de reproduire l'image du maître en utilisant votre
              créativité et votre imagination
            </p>
          </div>

          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-semibold mb-4">🏆 Gagnez</h3>
            <p className="text-gray-400">
              Marquez des points en créant les images les plus proches de
              l'original et devenez le nouveau maître
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
