"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { GameChat } from "@/components/games/GameChat";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface Game {
  id: number;
  name: string;
  code: string;
  status: "waiting" | "masterPrompt" | "playing" | "finished";
  currentRound: number;
  totalRounds: number;
  targetScore: number;
  masterId: string | null;
  creatorId: string;
  masterPrompt?: string | null;
  masterImageUrl?: string | null;
  roundStartedAt?: string | null;
  roundEndedAt?: string | null;
}

interface GameParticipant {
  id: number;
  userId: string;
  isReady: boolean;
  isCurrentMaster: boolean;
  currentPrompt?: string | null;
  imageUrl?: string | null;
  score: number;
  similarity?: number | null;
  user: {
    username: string;
  };
}

export default function GamePage() {
  const [game, setGame] = useState<Game | null>(null);
  const [participants, setParticipants] = useState<GameParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [playerPrompt, setPlayerPrompt] = useState("");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const params = useParams();
  const { user } = useAuth();
  const supabase = createClientComponentClient();

  // Charger les données du jeu et des participants
  useEffect(() => {
    const fetchGameData = async () => {
      try {
        // Charger le jeu
        const { data: gameData, error: gameError } = await supabase
          .from("games")
          .select("*")
          .eq("code", params.code)
          .single();

        if (gameError) throw gameError;
        console.log("Données du jeu chargées:", gameData);

        // Transformer les données pour s'assurer que les propriétés sont correctes
        const transformedGame = {
          ...gameData,
          creatorId: gameData.creator_id,
          masterId: gameData.master_id,
          currentRound: gameData.current_round,
          totalRounds: gameData.total_rounds,
          targetScore: gameData.target_score,
          masterPrompt: gameData.master_prompt,
          masterImageUrl: gameData.master_image_url,
          roundStartedAt: gameData.round_started_at,
          roundEndedAt: gameData.round_ended_at,
        };

        setGame(transformedGame);

        // Charger les participants
        await loadParticipants(transformedGame.id);

        // Rejoindre automatiquement si pas déjà participant
        if (user) {
          const { data: existingParticipant, error: existingError } =
            await supabase
              .from("game_participants")
              .select("*")
              .eq("game_id", transformedGame.id)
              .eq("user_id", user.id)
              .maybeSingle();

          if (existingError) throw existingError;

          if (!existingParticipant) {
            const { error: joinError } = await supabase
              .from("game_participants")
              .insert([
                {
                  game_id: transformedGame.id,
                  user_id: user.id,
                },
              ]);

            // Si l'erreur est une violation de contrainte unique, on l'ignore
            // car cela signifie que le participant existe déjà
            if (joinError && joinError.code !== "23505") {
              throw joinError;
            }
          }

          // Recharger les participants dans tous les cas
          await loadParticipants(transformedGame.id);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Une erreur est survenue"
        );
      } finally {
        setLoading(false);
      }
    };

    if (params.code) {
      fetchGameData();
    }
  }, [params.code, supabase, user]);

  const loadParticipants = async (gameId: number) => {
    const { data, error } = await supabase
      .from("game_participants")
      .select(
        `
        *,
        user:users(username)
      `
      )
      .eq("game_id", gameId);

    if (error) throw error;

    // Transformer les données pour s'assurer que les propriétés sont correctes
    const transformedData = data.map((participant) => ({
      ...participant,
      userId: participant.user_id, // Ajouter cette ligne pour s'assurer que userId est défini
      isReady: participant.is_ready, // Ajouter cette ligne pour la cohérence
      isCurrentMaster: participant.is_current_master,
    }));

    console.log("Participants chargés:", transformedData);
    setParticipants(transformedData);
  };

  // Souscrire aux changements
  useEffect(() => {
    if (!game) return;

    console.log("Configuration de la souscription pour le jeu:", game.id);

    const channel = supabase
      .channel(`game-${game.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${game.id}`,
        },
        async (payload) => {
          console.log("Changement détecté dans la table games:", {
            eventType: payload.eventType,
            oldRecord: payload.old,
            newRecord: payload.new,
          });

          if (!payload.new) {
            console.log("Pas de nouvelles données reçues");
            return;
          }

          // Recharger les données complètes du jeu
          const { data: freshGameData, error: gameError } = await supabase
            .from("games")
            .select("*")
            .eq("id", game.id)
            .single();

          if (gameError) {
            console.error("Erreur lors du rechargement du jeu:", gameError);
            return;
          }

          console.log("Données fraîches du jeu:", freshGameData);

          // Transformer les données du jeu
          const transformedGame = {
            ...freshGameData,
            creatorId: freshGameData.creator_id,
            masterId: freshGameData.master_id,
            currentRound: freshGameData.current_round,
            totalRounds: freshGameData.total_rounds,
            targetScore: freshGameData.target_score,
            masterPrompt: freshGameData.master_prompt,
            masterImageUrl: freshGameData.master_image_url,
            roundStartedAt: freshGameData.round_started_at,
            roundEndedAt: freshGameData.round_ended_at,
          };

          console.log("Mise à jour du state avec:", transformedGame);
          setGame(transformedGame as Game);

          // Recharger aussi les participants
          await loadParticipants(game.id);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_participants",
          filter: `game_id=eq.${game.id}`,
        },
        async (payload) => {
          console.log("Changement détecté dans la table game_participants:", {
            eventType: payload.eventType,
            oldRecord: payload.old,
            newRecord: payload.new,
          });

          // Recharger les données complètes du jeu et des participants
          const [gameResponse, participantsResponse] = await Promise.all([
            supabase.from("games").select("*").eq("id", game.id).single(),
            loadParticipants(game.id),
          ]);

          if (gameResponse.error) {
            console.error(
              "Erreur lors du rechargement du jeu:",
              gameResponse.error
            );
            return;
          }

          const freshGameData = gameResponse.data;
          const transformedGame = {
            ...freshGameData,
            creatorId: freshGameData.creator_id,
            masterId: freshGameData.master_id,
            currentRound: freshGameData.current_round,
            totalRounds: freshGameData.total_rounds,
            targetScore: freshGameData.target_score,
            masterPrompt: freshGameData.master_prompt,
            masterImageUrl: freshGameData.master_image_url,
            roundStartedAt: freshGameData.round_started_at,
            roundEndedAt: freshGameData.round_ended_at,
          };

          setGame(transformedGame as Game);
        }
      );

    // S'abonner et gérer les erreurs
    channel.subscribe(async (status, err) => {
      if (status === "SUBSCRIBED") {
        console.log("Souscription réussie au canal", `game-${game.id}`);
        // Forcer un rechargement initial des données
        const { data: gameData, error: gameError } = await supabase
          .from("games")
          .select("*")
          .eq("id", game.id)
          .single();

        if (!gameError && gameData) {
          console.log("Données initiales du jeu chargées:", gameData);
          const transformedGame = {
            ...gameData,
            creatorId: gameData.creator_id,
            masterId: gameData.master_id,
            currentRound: gameData.current_round,
            totalRounds: gameData.total_rounds,
            targetScore: gameData.target_score,
            masterPrompt: gameData.master_prompt,
            masterImageUrl: gameData.master_image_url,
            roundStartedAt: gameData.round_started_at,
            roundEndedAt: gameData.round_ended_at,
          };
          setGame(transformedGame);
          await loadParticipants(game.id);
        }
      } else if (status === "CHANNEL_ERROR") {
        console.error("Erreur de souscription:", err);
        // Tenter de se reconnecter
        await channel.unsubscribe();
        channel.subscribe();
      }
    });

    return () => {
      console.log("Nettoyage de la souscription pour le jeu:", game.id);
      supabase.removeChannel(channel);
    };
  }, [game?.id, supabase]);

  const toggleReady = async () => {
    if (!game || !user) {
      console.error("Pas de jeu ou d'utilisateur");
      return;
    }

    console.log("Données actuelles:", {
      participants,
      userId: user.id,
      participantsUserIds: participants.map((p) => p.userId),
    });

    const participant = participants.find((p) => p.userId === user.id);
    console.log("Recherche participant:", {
      trouvé: !!participant,
      participantId: participant?.id,
      userId: user.id,
      participantUserId: participant?.userId,
    });

    if (!participant) {
      console.error("Participant non trouvé");
      return;
    }

    console.log("Tentative de mise à jour:", {
      gameId: game.id,
      userId: user.id,
      participantId: participant.id,
      currentIsReady: participant.isReady,
      newIsReady: !participant.isReady,
    });

    try {
      const { data, error } = await supabase
        .from("game_participants")
        .update({
          is_ready: !participant.isReady,
        })
        .eq("game_id", game.id)
        .eq("user_id", user.id)
        .select();

      if (error) {
        console.error("Erreur lors de la mise à jour du statut:", error);
        throw error;
      }

      console.log("Mise à jour réussie:", data);

      // Recharger les participants pour mettre à jour l'interface
      await loadParticipants(game.id);
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut:", err);
    }
  };

  const leaveGame = async () => {
    if (!game || !user) return;

    try {
      const { error } = await supabase
        .from("game_participants")
        .delete()
        .eq("game_id", game.id)
        .eq("user_id", user.id);

      if (error) throw error;

      // Rediriger vers la liste des parties
      window.location.href = "/games";
    } catch (err) {
      console.error("Erreur lors de la sortie de la partie:", err);
    }
  };

  // Fonction pour démarrer la partie quand tout le monde est prêt
  const startGame = async () => {
    if (!game || !user) {
      console.error("Impossible de démarrer la partie:", { game, user });
      return;
    }

    try {
      console.log("Démarrage de la partie...", {
        gameId: game.id,
        participants,
        allReady: participants.every((p) => p.isReady),
      });

      // Vérifier que tous les participants sont prêts
      const allReady = participants.every((p) => p.isReady);
      if (!allReady) {
        console.error("Tous les joueurs ne sont pas prêts");
        return;
      }

      // Sélectionner un maître aléatoire
      const randomParticipant =
        participants[Math.floor(Math.random() * participants.length)];

      console.log("Maître sélectionné:", {
        master: randomParticipant,
        userId: randomParticipant.userId,
      });

      // Mettre à jour le statut du jeu et le maître
      console.log("Mise à jour du statut du jeu...");
      const { data: gameUpdateData, error: updateError } = await supabase
        .from("games")
        .update({
          status: "masterPrompt",
          master_id: randomParticipant.userId,
          current_round: 1,
          round_started_at: new Date().toISOString(),
          master_prompt: null,
          master_image_url: null,
        })
        .eq("id", game.id)
        .select();

      console.log("Résultat de la mise à jour du jeu:", {
        data: gameUpdateData,
        error: updateError,
        newStatus: "masterPrompt",
        newMasterId: randomParticipant.userId,
      });

      if (updateError) {
        console.error("Erreur lors de la mise à jour du jeu:", updateError);
        throw updateError;
      }

      // Réinitialiser les participants
      console.log("Réinitialisation des participants...");
      const { data: resetData, error: resetError } = await supabase
        .from("game_participants")
        .update({
          is_current_master: false,
          current_prompt: null,
          image_url: null,
          similarity: null,
        })
        .eq("game_id", game.id)
        .select();

      console.log("Résultat de la réinitialisation des participants:", {
        data: resetData,
        error: resetError,
      });

      if (resetError) {
        console.error(
          "Erreur lors de la réinitialisation des participants:",
          resetError
        );
        throw resetError;
      }

      // Mettre à jour le statut du maître
      console.log("Définition du nouveau maître...");
      const { data: masterData, error: participantError } = await supabase
        .from("game_participants")
        .update({ is_current_master: true })
        .eq("user_id", randomParticipant.userId)
        .eq("game_id", game.id)
        .select();

      console.log("Résultat de la mise à jour du maître:", {
        data: masterData,
        error: participantError,
      });

      if (participantError) {
        console.error(
          "Erreur lors de la mise à jour du maître:",
          participantError
        );
        throw participantError;
      }

      // Forcer le rechargement des données
      console.log("Rechargement des participants...");
      await loadParticipants(game.id);

      console.log("Partie démarrée avec succès - Statut final:", {
        gameId: game.id,
        newStatus: "masterPrompt",
        masterId: randomParticipant.userId,
      });
    } catch (err) {
      console.error("Erreur détaillée lors du démarrage de la partie:", err);
    }
  };

  // Fonction pour soumettre le prompt du maître
  const submitMasterPrompt = async (prompt: string) => {
    if (!game || !user || game.masterId !== user.id) return;

    try {
      // Mettre à jour le prompt du maître et passer au statut playing
      const { error } = await supabase
        .from("games")
        .update({
          master_prompt: prompt,
          status: "playing",
          round_started_at: new Date().toISOString(), // Réinitialiser le timer
        })
        .eq("id", game.id);

      if (error) throw error;

      // Réinitialiser le prompt local
      setMasterPrompt("");

      // TODO: Appeler l'API de génération d'image
    } catch (err) {
      console.error("Erreur lors de la soumission du prompt:", err);
    }
  };

  // Fonction pour soumettre le prompt d'un joueur
  const submitPlayerPrompt = async (prompt: string) => {
    if (!game || !user || game.masterId === user.id) return;

    try {
      const { error } = await supabase
        .from("game_participants")
        .update({
          current_prompt: prompt,
        })
        .eq("game_id", game.id)
        .eq("user_id", user.id);

      if (error) throw error;
    } catch (err) {
      console.error("Erreur lors de la soumission du prompt:", err);
    }
  };

  // Fonction pour calculer la similarité et mettre à jour les scores
  const calculateSimilarityAndUpdateScores = async () => {
    if (!game || !game.masterPrompt) return;

    try {
      // Pour chaque participant (sauf le maître)
      for (const participant of participants.filter(
        (p) => !p.isCurrentMaster
      )) {
        if (!participant.currentPrompt) continue;

        // TODO: Appeler l'API de calcul de similarité
        const similarity = 0; // À remplacer par l'appel API

        // Mettre à jour la similarité
        const { error } = await supabase
          .from("game_participants")
          .update({
            similarity,
            score: participant.score + (similarity >= 80 ? 1 : 0), // Seuil de similarité à 80%
          })
          .eq("game_id", game.id)
          .eq("user_id", participant.userId);

        if (error) throw error;
      }

      // Si personne n'a trouvé, le maître gagne un point
      const anyoneFound = participants.some(
        (p) => !p.isCurrentMaster && (p.similarity ?? 0) >= 80
      );
      if (!anyoneFound) {
        const { error } = await supabase
          .from("game_participants")
          .update({
            score: participants.find((p) => p.isCurrentMaster)!.score + 1,
          })
          .eq("game_id", game.id)
          .eq("user_id", game.masterId);

        if (error) throw error;
      }
    } catch (err) {
      console.error("Erreur lors du calcul des scores:", err);
    }
  };

  // Fonction pour passer au tour suivant
  const nextRound = async () => {
    if (!game) return;

    try {
      // Vérifier si la partie est terminée
      const maxScore = Math.max(...participants.map((p) => p.score));
      if (
        maxScore >= game.targetScore ||
        game.currentRound >= game.totalRounds
      ) {
        // Terminer la partie
        const { error } = await supabase
          .from("games")
          .update({
            status: "finished",
            ended_at: new Date().toISOString(),
          })
          .eq("id", game.id);

        if (error) throw error;
        return;
      }

      // Sélectionner un nouveau maître (le joueur avec la meilleure similarité)
      const nextMaster = participants
        .filter((p) => !p.isCurrentMaster)
        .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))[0];

      // Mettre à jour le jeu
      const { error: gameError } = await supabase
        .from("games")
        .update({
          current_round: game.currentRound + 1,
          master_id: nextMaster.userId,
          master_prompt: null,
          master_image_url: null,
          round_started_at: new Date().toISOString(),
          round_ended_at: null,
        })
        .eq("id", game.id);

      if (gameError) throw gameError;

      // Mettre à jour les participants
      const { error: participantError } = await supabase
        .from("game_participants")
        .update({
          is_current_master: false,
          current_prompt: null,
          image_url: null,
          similarity: null,
        })
        .eq("game_id", game.id);

      if (participantError) throw participantError;

      // Définir le nouveau maître
      const { error: newMasterError } = await supabase
        .from("game_participants")
        .update({
          is_current_master: true,
        })
        .eq("game_id", game.id)
        .eq("user_id", nextMaster.userId);

      if (newMasterError) throw newMasterError;
    } catch (err) {
      console.error("Erreur lors du passage au tour suivant:", err);
    }
  };

  // Déplacer la déclaration de currentParticipant avant son utilisation
  const currentParticipant = user
    ? participants.find((p) => p.userId === user.id)
    : null;

  // Timer pour les phases de jeu
  useEffect(() => {
    if (!game || !game.roundStartedAt) return;
    if (game.roundEndedAt) return;

    // Si le round est terminé, on ne fait rien
    if (game.roundEndedAt) return;

    // Calculer le temps restant
    const startTime = new Date(game.roundStartedAt).getTime();
    const timeLimit = 30 * 1000; // 30 secondes
    const now = Date.now();
    const elapsed = now - startTime;
    const remaining = Math.max(0, timeLimit - elapsed);

    // Si le temps est écoulé
    if (remaining === 0) {
      if (game.status === "masterPrompt") {
        // Si on est le maître et qu'on n'a pas de prompt, on en met un par défaut
        if (game.masterId === user?.id && !game.masterPrompt) {
          submitMasterPrompt("Le maître n'a pas soumis de prompt à temps");
        }
      } else if (game.status === "playing") {
        // Si on est le maître et qu'on n'a pas de prompt, on en met un par défaut
        if (game.masterId === user?.id && !game.masterPrompt) {
          submitMasterPrompt("Le maître n'a pas soumis de prompt à temps");
        }
        // Si on est joueur et qu'on n'a pas soumis de prompt, on en met un par défaut
        else if (
          game.masterId !== user?.id &&
          !currentParticipant?.currentPrompt
        ) {
          submitPlayerPrompt("Le joueur n'a pas soumis de prompt à temps");
        }
      }
      return;
    }

    // Mettre à jour le timer
    setTimeLeft(Math.ceil(remaining / 1000));

    // Mettre à jour toutes les secondes
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.max(0, timeLimit - elapsed);
      setTimeLeft(Math.ceil(remaining / 1000));

      // Si le temps est écoulé
      if (remaining === 0) {
        clearInterval(timer);
        if (game.status === "masterPrompt") {
          if (game.masterId === user?.id && !game.masterPrompt) {
            submitMasterPrompt("Le maître n'a pas soumis de prompt à temps");
          }
        } else if (game.status === "playing") {
          if (game.masterId === user?.id && !game.masterPrompt) {
            submitMasterPrompt("Le maître n'a pas soumis de prompt à temps");
          } else if (
            game.masterId !== user?.id &&
            !currentParticipant?.currentPrompt
          ) {
            submitPlayerPrompt("Le joueur n'a pas soumis de prompt à temps");
          }
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [
    game?.status,
    game?.roundStartedAt,
    game?.roundEndedAt,
    game?.masterId,
    game?.masterPrompt,
    user?.id,
    currentParticipant?.currentPrompt,
    submitMasterPrompt,
    submitPlayerPrompt,
  ]);

  // Mettre à jour les prompts dans l'interface
  const handleMasterPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setMasterPrompt(e.target.value);
  };

  const handlePlayerPromptChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setPlayerPrompt(e.target.value);
  };

  const handleMasterPromptSubmit = () => {
    if (!masterPrompt.trim()) return;
    submitMasterPrompt(masterPrompt.trim());
  };

  const handlePlayerPromptSubmit = () => {
    if (!playerPrompt.trim()) return;
    submitPlayerPrompt(playerPrompt.trim());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Chargement de la partie...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl text-red-500">
          {error || "Partie non trouvée"}
        </div>
      </div>
    );
  }

  console.log("Debug:", {
    user: user?.id,
    participants: participants.map((p) => ({ id: p.id, userId: p.userId })),
    currentParticipant: currentParticipant?.id,
    gameStatus: game?.status,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="h-screen flex">
        {/* Sidebar gauche avec la liste des participants */}
        <div className="w-64 border-r border-gray-800 p-4 flex flex-col">
          <h2 className="text-xl font-semibold mb-4">Participants</h2>

          {/* Liste des participants */}
          <div className="flex-1 space-y-2 overflow-y-auto">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-700"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {participant.user.username}
                    {participant.isCurrentMaster && " 👑"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-gray-300">
                    {participant.score} pts
                  </div>
                  {game.status === "waiting" && (
                    <div
                      className={`px-3 py-1 rounded-full text-sm ${
                        participant.isReady
                          ? "bg-green-600 text-white"
                          : "bg-gray-600 text-gray-300"
                      }`}
                    >
                      {participant.isReady ? "Prêt" : "Pas prêt"}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Zone des boutons en bas de la sidebar */}
          <div className="mt-4 space-y-2 pt-4 border-t border-gray-700">
            {user && (
              <>
                {game.status === "waiting" && (
                  <button
                    onClick={toggleReady}
                    className={`w-full px-4 py-2 rounded-lg ${
                      currentParticipant?.isReady
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-green-600 hover:bg-green-700"
                    }`}
                  >
                    {currentParticipant?.isReady ? "Annuler" : "Je suis prêt"}
                  </button>
                )}
                <button
                  onClick={leaveGame}
                  className="w-full px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white"
                >
                  Quitter la partie
                </button>
              </>
            )}
          </div>
        </div>

        {/* Zone principale du jeu */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">{game.name}</h1>
            <div className="text-gray-400">Code: {game.code}</div>
            {game.status !== "waiting" && (
              <div className="mt-2 text-gray-300">
                Tour {game.currentRound}/{game.totalRounds} - Score cible :{" "}
                {game.targetScore} points
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg p-6 h-[calc(100%-6rem)]">
            {game.status === "waiting" && (
              <div className="h-full flex flex-col items-center justify-center">
                <h2 className="text-2xl font-semibold mb-4">
                  En attente des joueurs
                </h2>
                <div className="text-gray-400 mb-8">
                  {participants.filter((p) => p.isReady).length}/
                  {participants.length} joueurs prêts
                </div>
                {(() => {
                  const debugInfo = {
                    user: user?.id,
                    creatorId: game.creatorId,
                    isCreator: game.creatorId === user?.id,
                    allReady: participants.every((p) => p.isReady),
                    participants: participants.map((p) => ({
                      id: p.id,
                      userId: p.userId,
                      isReady: p.isReady,
                    })),
                  };
                  console.log("Debug bouton démarrer:", debugInfo);
                  return null;
                })()}
                {user &&
                  participants.every((p) => p.isReady) &&
                  game.creatorId === user.id && (
                    <button
                      onClick={startGame}
                      className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                    >
                      Démarrer la partie
                    </button>
                  )}
              </div>
            )}

            {game.status === "masterPrompt" && (
              <div className="h-full flex flex-col items-center justify-center">
                {game.masterId === user?.id ? (
                  <>
                    <h2 className="text-2xl font-semibold mb-4">
                      Vous êtes le maître de la création !
                    </h2>
                    <p className="text-gray-400 mb-2">
                      Écrivez un prompt qui servira à générer une image
                    </p>
                    {timeLeft !== null && (
                      <div className="text-xl font-bold mb-6">
                        Temps restant : {timeLeft}s
                      </div>
                    )}
                    <div className="w-full max-w-lg space-y-4">
                      <textarea
                        className="w-full h-32 p-3 rounded-lg bg-gray-700 text-white resize-none"
                        placeholder="Décrivez l'image que vous voulez générer..."
                        value={masterPrompt}
                        onChange={handleMasterPromptChange}
                      />
                      <button
                        onClick={handleMasterPromptSubmit}
                        disabled={!masterPrompt.trim()}
                        className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                      >
                        Valider le prompt
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-semibold mb-4">
                      En attente du maître de la création
                    </h2>
                    <p className="text-gray-400 mb-4">
                      Le maître imagine et décrit l'image à créer...
                    </p>
                    {timeLeft !== null && (
                      <div className="text-xl font-bold">
                        Temps restant : {timeLeft}s
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {game.status === "playing" && (
              <div className="h-full flex flex-col">
                {/* Phase du maître */}
                {game.masterId === user?.id && !game.masterPrompt && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <h2 className="text-2xl font-semibold mb-4">
                      Vous êtes le maître !
                    </h2>
                    <p className="text-gray-400 mb-2">
                      Écrivez un prompt qui servira à générer une image
                    </p>
                    {timeLeft !== null && (
                      <div className="text-xl font-bold mb-6">
                        Temps restant : {timeLeft}s
                      </div>
                    )}
                    <div className="w-full max-w-lg space-y-4">
                      <textarea
                        className="w-full h-32 p-3 rounded-lg bg-gray-700 text-white resize-none"
                        placeholder="Décrivez l'image que vous voulez générer..."
                        value={masterPrompt}
                        onChange={handleMasterPromptChange}
                      />
                      <button
                        onClick={handleMasterPromptSubmit}
                        disabled={!masterPrompt.trim()}
                        className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                      >
                        Valider le prompt
                      </button>
                    </div>
                  </div>
                )}

                {/* Affichage de l'image générée */}
                {game.masterImageUrl && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="relative w-full max-w-2xl aspect-square mb-6">
                      <img
                        src={game.masterImageUrl}
                        alt="Image générée"
                        className="absolute inset-0 w-full h-full object-cover rounded-lg"
                      />
                    </div>

                    {/* Phase de réponse des joueurs */}
                    {game.masterId !== user?.id &&
                      !currentParticipant?.currentPrompt && (
                        <div className="w-full max-w-lg">
                          <p className="text-gray-400 mb-2">
                            Devinez le prompt qui a généré cette image
                          </p>
                          {timeLeft !== null && (
                            <div className="text-xl font-bold mb-4">
                              Temps restant : {timeLeft}s
                            </div>
                          )}
                          <div className="space-y-4">
                            <textarea
                              className="w-full h-32 p-3 rounded-lg bg-gray-700 text-white resize-none"
                              placeholder="Écrivez votre proposition..."
                              value={playerPrompt}
                              onChange={handlePlayerPromptChange}
                            />
                            <button
                              onClick={handlePlayerPromptSubmit}
                              disabled={!playerPrompt.trim()}
                              className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                              Valider le prompt
                            </button>
                          </div>
                        </div>
                      )}

                    {/* Phase d'attente */}
                    {currentParticipant?.currentPrompt && (
                      <div className="text-gray-400">
                        En attente des autres joueurs...
                      </div>
                    )}
                  </div>
                )}

                {/* Phase de comparaison */}
                {game.roundEndedAt && (
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <h2 className="text-2xl font-semibold mb-6">
                      Résultats du tour
                    </h2>

                    <div className="w-full max-w-2xl space-y-4 mb-8">
                      <div className="p-4 rounded-lg bg-blue-900">
                        <div className="font-semibold mb-2">
                          Prompt original :
                        </div>
                        <div className="text-gray-300">{game.masterPrompt}</div>
                      </div>

                      {participants
                        .filter((p) => !p.isCurrentMaster && p.currentPrompt)
                        .map((p) => (
                          <div
                            key={p.id}
                            className={`p-4 rounded-lg ${
                              (p.similarity || 0) >= 80
                                ? "bg-green-900"
                                : "bg-gray-700"
                            }`}
                          >
                            <div className="flex justify-between items-center mb-2">
                              <div className="font-semibold">
                                {p.user.username}
                              </div>
                              <div className="text-sm">
                                Similarité : {p.similarity || 0}%
                              </div>
                            </div>
                            <div className="text-gray-300">
                              {p.currentPrompt}
                            </div>
                          </div>
                        ))}
                    </div>

                    {user?.id === game.masterId && (
                      <button
                        onClick={nextRound}
                        className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      >
                        Tour suivant
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {game.status === "finished" && (
              <div className="h-full flex flex-col items-center justify-center">
                <h2 className="text-2xl font-semibold mb-6">
                  Partie terminée !
                </h2>

                <div className="w-full max-w-lg space-y-4 mb-8">
                  {participants
                    .sort((a, b) => b.score - a.score)
                    .map((p, index) => (
                      <div
                        key={p.id}
                        className={`p-4 rounded-lg ${
                          index === 0 ? "bg-yellow-900" : "bg-gray-700"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-semibold">
                            {index + 1}. {p.user.username}
                            {index === 0 && " 👑"}
                          </div>
                          <div>{p.score} points</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat sur le côté droit */}
        <div className="w-96 border-l border-gray-800">
          <GameChat gameId={game.id} />
        </div>
      </div>
    </div>
  );
}
