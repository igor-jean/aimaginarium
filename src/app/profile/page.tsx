"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ProfilePage() {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          username: username || undefined,
          avatar_url: avatarUrl || undefined,
        })
        .eq("id", user.id);

      if (updateError) throw updateError;
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        user?.email || "",
        {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        }
      );
      if (error) throw error;
      alert("Un email de réinitialisation a été envoyé");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible."
      )
    ) {
      return;
    }

    try {
      // Supprimer les données utilisateur
      const { error: deleteError } = await supabase
        .from("users")
        .delete()
        .eq("id", user?.id);

      if (deleteError) throw deleteError;

      // Supprimer le compte auth
      const { error: authError } = await supabase.auth.admin.deleteUser(
        user?.id || ""
      );

      if (authError) throw authError;

      // Déconnexion
      await supabase.auth.signOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p>Vous devez être connecté pour accéder à cette page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
          <h1 className="text-2xl font-bold mb-6">Mon Profil</h1>

          <div className="space-y-6">
            {/* Informations de base */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Informations personnelles
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300">
                    Email
                  </label>
                  <p className="mt-1 text-gray-400">{user.email}</p>
                </div>

                {isEditing ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300">
                        Nom d'utilisateur
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300">
                        URL de l'avatar
                      </label>
                      <input
                        type="text"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                        className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white"
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              {isEditing ? (
                <div className="flex space-x-4">
                  <button
                    onClick={handleUpdateProfile}
                    disabled={loading}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md"
                  >
                    {loading ? "Enregistrement..." : "Enregistrer"}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md"
                >
                  Modifier le profil
                </button>
              )}

              <button
                onClick={handleResetPassword}
                className="block w-full text-left text-purple-400 hover:text-purple-300 py-2"
              >
                Réinitialiser le mot de passe
              </button>

              <button
                onClick={handleDeleteAccount}
                className="block w-full text-left text-red-500 hover:text-red-400 py-2"
              >
                Supprimer mon compte
              </button>
            </div>

            {error && <div className="text-red-500 mt-4">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
