"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface Message {
  id: number;
  content: string;
  user_id: string;
  game_id: number;
  created_at: string;
  user: {
    username: string;
  };
}

interface GameChatProps {
  gameId: number;
}

export function GameChat({ gameId }: GameChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClientComponentClient();

  // Charger les messages existants
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data: messagesData, error: messagesError } = await supabase
          .from("messages")
          .select("*")
          .eq("game_id", gameId)
          .order("created_at", { ascending: true });

        if (messagesError) throw messagesError;

        // Récupérer les informations des utilisateurs
        const userIds = [
          ...new Set(messagesData?.map((msg) => msg.user_id) || []),
        ];
        const { data: usersData } = await supabase
          .from("users")
          .select("id, username")
          .in("id", userIds);

        // Créer un map des utilisateurs pour un accès rapide
        const usersMap = new Map(
          usersData?.map((user) => [user.id, user]) || []
        );

        // Combiner les messages avec les informations des utilisateurs
        const messagesWithUsers =
          messagesData?.map((msg) => ({
            ...msg,
            user: {
              username:
                usersMap.get(msg.user_id)?.username || "Utilisateur inconnu",
            },
          })) || [];

        setMessages(messagesWithUsers);
      } catch (error) {
        console.error("Erreur lors du chargement des messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Souscrire aux nouveaux messages
    const channel = supabase
      .channel(`game-${gameId}-chat`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `game_id=eq.${gameId}`,
        },
        async (payload) => {
          // Récupérer le message
          const { data: messageData } = await supabase
            .from("messages")
            .select("*")
            .eq("id", payload.new.id)
            .single();

          if (messageData) {
            // Récupérer l'information de l'utilisateur
            const { data: userData } = await supabase
              .from("users")
              .select("username")
              .eq("id", messageData.user_id)
              .single();

            const newMessage = {
              ...messageData,
              user: { username: userData?.username || "Utilisateur inconnu" },
            };
            setMessages((current) => [...current, newMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, supabase]);

  // Scroll automatique vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    try {
      const { error } = await supabase.from("messages").insert([
        {
          game_id: gameId,
          user_id: user.id,
          content: newMessage.trim(),
        },
      ]);

      if (error) throw error;
      setNewMessage("");
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-800">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold">Chat de la partie</h2>
      </div>

      {/* Zone des messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center text-gray-400">Chargement...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-400">
            Aucun message. Soyez le premier à écrire !
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`${
                message.user_id === user?.id
                  ? "ml-auto bg-purple-600"
                  : "mr-auto bg-gray-700"
              } max-w-[80%] rounded-lg p-3`}
            >
              <div className="text-sm font-medium text-gray-300 mb-1">
                {message.user_id === user?.id ? "Vous" : message.user?.username}
              </div>
              <div className="mt-1">{message.content}</div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Formulaire d'envoi */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Votre message..."
            className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Envoyer
          </button>
        </div>
      </form>
    </div>
  );
}
