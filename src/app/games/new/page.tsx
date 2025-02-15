"use client";

import { CreateGameForm } from "@/components/games/CreateGameForm";

export default function NewGamePage() {
  return (
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          <h1 className="text-2xl font-bold text-white mb-6">
            Créer une nouvelle partie
          </h1>
          <CreateGameForm />
        </div>
      </div>
    </div>
  );
}
