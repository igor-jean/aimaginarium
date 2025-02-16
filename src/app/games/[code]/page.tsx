"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { GameChat } from "@/components/games/GameChat";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useImageGeneration } from "@/hooks/useImageGeneration";

interface Game {
  id: number;
  name: string;
  code: string;
  status:
    | "waiting"
    | "masterWriting"
    | "generating"
    | "playersWriting"
    | "comparing"
    | "scoring"
    | "finished";
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
  const [revealedPrompts, setRevealedPrompts] = useState<
    { text: string; username: string; id: number }[]
  >([]);
  const [winningPromptId, setWinningPromptId] = useState<number | null>(null);
  const [hasSubmittedPrompt, setHasSubmittedPrompt] = useState(false);
  const params = useParams();
  const { user } = useAuth();
  const supabase = createClientComponentClient();
  const { generateImage: generateImageApi } = useImageGeneration();

  // ===============================================
  // SECTION 1: GESTION DE L'AJOUT DES PARTICIPANTS
  // ===============================================
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

        // Charger les participants existants
        await loadParticipants(transformedGame.id);

        // Rejoindre automatiquement la partie si l'utilisateur n'est pas déjà participant
        if (user) {
          // Vérifier si l'utilisateur est déjà participant
          const { data: existingParticipant, error: existingError } =
            await supabase
              .from("game_participants")
              .select("*")
              .eq("game_id", transformedGame.id)
              .eq("user_id", user.id)
              .maybeSingle();

          if (existingError) throw existingError;

          // Si l'utilisateur n'est pas participant, l'ajouter à la partie
          if (!existingParticipant) {
            const { error: joinError } = await supabase
              .from("game_participants")
              .insert([
                {
                  game_id: transformedGame.id,
                  user_id: user.id,
                },
              ]);

            if (joinError && joinError.code !== "23505") {
              throw joinError;
            }
          }

          // Recharger la liste des participants après l'ajout
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
    console.log("Chargement des participants pour le jeu:", gameId);

    const { data, error } = await supabase
      .from("game_participants")
      .select(
        `
        *,
        user:users(username)
      `
      )
      .eq("game_id", gameId);

    if (error) {
      console.error("Erreur lors du chargement des participants:", error);
      throw error;
    }

    const transformedData = data.map((participant) => ({
      ...participant,
      userId: participant.user_id,
      isReady: participant.is_ready,
      isCurrentMaster: participant.is_current_master,
    }));

    console.log("Participants chargés avec succès:", transformedData);
    setParticipants(transformedData);
    return transformedData;
  };

  // ================================================
  // SECTION 2: GESTION DU STATUT PRÊT/PAS PRÊT
  // ================================================
  const toggleReady = async () => {
    if (!game || !user) {
      console.error("Pas de jeu ou d'utilisateur");
      return;
    }

    // Trouver le participant actuel
    const participant = participants.find((p) => p.userId === user.id);
    if (!participant) {
      console.error("Participant non trouvé");
      return;
    }

    try {
      // Mettre à jour le statut prêt/pas prêt du participant
      const { data, error } = await supabase
        .from("game_participants")
        .update({
          is_ready: !participant.isReady,
        })
        .eq("game_id", game.id)
        .eq("user_id", user.id)
        .select();

      if (error) throw error;

      // Recharger les participants pour mettre à jour l'interface
      await loadParticipants(game.id);
    } catch (err) {
      console.error("Erreur lors de la mise à jour du statut:", err);
    }
  };

  // ================================================
  // SECTION 3: GESTION DU DÉMARRAGE DE LA PARTIE
  // ================================================
  const startGame = async () => {
    if (!game || !user) return;
    if (game.creatorId !== user.id) return;
    if (participants.length < 2) return;
    if (!participants.every((p) => p.isReady)) return;

    try {
      // Sélection aléatoire du maître
      const randomParticipant =
        participants[Math.floor(Math.random() * participants.length)];

      // Mise à jour du jeu
      const { error } = await supabase
        .from("games")
        .update({
          status: "masterWriting",
          master_id: randomParticipant.userId,
          current_round: 1,
          round_started_at: new Date().toISOString(),
          master_prompt: null,
          master_image_url: null,
        })
        .eq("id", game.id)
        .eq("status", "waiting");

      if (error) throw error;
    } catch (error) {
      console.error("Erreur lors du démarrage de la partie:", error);
    }
  };

  // Souscrire aux changements
  useEffect(() => {
    if (!game) return;

    // Créer un seul canal pour toutes les souscriptions
    const channel = supabase
      .channel(`game-${game.id}-realtime`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "games",
          filter: `id=eq.${game.id}`,
        },
        async (payload: { new: any }) => {
          const newGame = payload.new;
          if (!newGame) return;

          // Transformer les données du jeu
          const transformedGame = {
            id: newGame.id,
            name: newGame.name,
            code: newGame.code,
            status: newGame.status,
            creatorId: newGame.creator_id,
            masterId: newGame.master_id,
            currentRound: newGame.current_round,
            totalRounds: newGame.total_rounds,
            targetScore: newGame.target_score,
            masterPrompt: newGame.master_prompt,
            masterImageUrl: newGame.master_image_url,
            roundStartedAt: newGame.round_started_at,
            roundEndedAt: newGame.round_ended_at,
          };

          setGame(transformedGame as Game);
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
        async () => {
          // Recharger uniquement les participants
          await loadParticipants(game.id);
        }
      );

    // S'abonner et gérer les erreurs
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Charger les données initiales une seule fois
        Promise.all([
          (async () => {
            const { data: gameData, error: gameError } = await supabase
              .from("games")
              .select("*")
              .eq("id", game.id)
              .single();

            if (!gameError && gameData) {
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
            }
          })(),
          loadParticipants(game.id),
        ]);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [game?.id, supabase]);

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

  // Timer pour les phases de jeu
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (
      (game?.status === "masterWriting" && game.masterId === user?.id) ||
      (game?.status === "playersWriting" && game.masterId !== user?.id)
    ) {
      setTimeLeft(30);
      timer = setInterval(() => {
        setTimeLeft((prevTime) => {
          if (prevTime === null) return null;
          if (prevTime <= 1) {
            clearInterval(timer);
            // Si le temps est écoulé
            if (game.status === "masterWriting" && !game.masterPrompt) {
              handleTimeUp();
            } else if (game.status === "playersWriting") {
              handlePlayersTimeUp();
            }
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
      // Réinitialiser le timer quand le statut change
      setTimeLeft(null);
    };
  }, [game?.status, game?.masterId, user?.id]);

  const handleTimeUp = async () => {
    if (!game || !user) return;

    // Sélectionner un nouveau maître aléatoirement
    const eligibleParticipants = participants.filter(
      (p) => p.userId !== game.masterId
    );
    const newMaster =
      eligibleParticipants[
        Math.floor(Math.random() * eligibleParticipants.length)
      ];

    await supabase
      .from("games")
      .update({
        master_id: newMaster.userId,
        master_prompt: null,
        master_image_url: null,
        round_started_at: new Date().toISOString(),
      })
      .eq("id", game.id);
  };

  // Nouvelle fonction pour gérer la fin du temps des joueurs
  const handlePlayersTimeUp = async () => {
    if (!game || !user) return;

    try {
      // Récupérer la liste des joueurs qui n'ont pas encore répondu
      const { data: submittedPrompts, error } = await supabase
        .from("player_prompts")
        .select("user_id")
        .eq("game_id", game.id)
        .eq("round", game.currentRound);

      if (error) {
        console.error("Erreur lors de la vérification des prompts:", error);
        return;
      }

      const nonMasterParticipants = participants.filter(
        (p) => p.userId !== game.masterId
      );

      // Pour chaque joueur qui n'a pas répondu, soumettre "Pas de réponse"
      for (const player of nonMasterParticipants) {
        if (
          !submittedPrompts?.some((prompt) => prompt.user_id === player.userId)
        ) {
          await fetch("/api/player-prompts", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              gameId: game.id,
              userId: player.userId,
              round: game.currentRound,
              prompt: "Pas de réponse",
            }),
          });
        }
      }

      // Passer à la phase de comparaison
      await startComparisonPhase();
    } catch (error) {
      console.error("Erreur lors de la gestion de la fin du temps:", error);
    }
  };

  // Fonction pour démarrer la phase de comparaison
  const startComparisonPhase = async () => {
    if (!game) return;

    try {
      // Récupérer tous les prompts des joueurs pour ce round
      const response = await fetch(
        `/api/player-prompts?gameId=${game.id}&round=${game.currentRound}`
      );

      if (!response.ok) {
        throw new Error("Erreur lors de la récupération des prompts");
      }

      const allPrompts = await response.json();
      console.log("Prompts collectés:", allPrompts);

      // Filtrer les prompts pour exclure celui du maître
      const playerPrompts = allPrompts.filter(
        (p: any) => p.user_id !== game.masterId
      );

      if (playerPrompts.length === 0) {
        throw new Error("Aucun prompt de joueur trouvé");
      }

      // Comparer les prompts
      const compareResponse = await fetch("/api/compare-prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          masterPrompt: game.masterPrompt,
          playerPrompts: playerPrompts.map((p: any) => p.prompt),
        }),
      });

      if (!compareResponse.ok) {
        throw new Error("Erreur lors de la comparaison des prompts");
      }

      const { winnerId } = await compareResponse.json();

      // Mettre à jour le statut du jeu vers la phase de comparaison
      const { error: updateError } = await supabase
        .from("games")
        .update({
          status: "comparing",
        })
        .eq("id", game.id);

      if (updateError) throw updateError;

      // Préparer les prompts pour la révélation
      const promptsToReveal = playerPrompts.map((p: any) => ({
        id: p.id,
        text: p.prompt,
        username: p.user.username,
      }));

      // Déclencher l'animation de révélation
      await revealPromptsWithAnimation(
        promptsToReveal,
        game.masterPrompt || "",
        participants.find((p) => p.userId === game.masterId)?.user.username ||
          "",
        winnerId
      );
    } catch (error) {
      console.error(
        "Erreur lors du démarrage de la phase de comparaison:",
        error
      );
    }
  };

  // Fonction pour soumettre le prompt du maître
  const submitMasterPrompt = async (prompt: string) => {
    if (!game || !user || game.masterId !== user.id) return;

    try {
      const { error } = await supabase
        .from("games")
        .update({
          master_prompt: prompt,
          status: "generating",
          round_started_at: new Date().toISOString(),
        })
        .eq("id", game.id);

      if (error) throw error;

      // Réinitialiser le prompt local
      setMasterPrompt("");

      // Générer l'image (à implémenter)
      await generateImage(prompt);
    } catch (error) {
      console.error("Erreur lors de la soumission du prompt:", error);
    }
  };

  // Fonction pour générer l'image
  const generateImage = async (prompt: string) => {
    if (!game) return;

    try {
      // Appeler l'API de génération d'image
      const imageUrl = await generateImageApi(prompt);

      // Une fois l'image générée, mettre à jour le jeu avec l'URL de l'image
      const { error } = await supabase
        .from("games")
        .update({
          status: "playersWriting",
          master_image_url: imageUrl,
          round_started_at: new Date().toISOString(),
        })
        .eq("id", game.id);

      if (error) throw error;
    } catch (error) {
      console.error("Erreur lors de la génération de l'image:", error);
    }
  };

  // Fonction pour vérifier si tous les joueurs ont répondu
  const checkAllPlayersSubmitted = async () => {
    if (!game) return false;

    const { data: submittedPrompts, error } = await supabase
      .from("player_prompts")
      .select("user_id")
      .eq("game_id", game.id)
      .eq("round", game.currentRound);

    if (error) {
      console.error("Erreur lors de la vérification des prompts:", error);
      return false;
    }

    const nonMasterParticipants = participants.filter(
      (p) => p.userId !== game.masterId
    );

    const allSubmitted = nonMasterParticipants.every((participant) =>
      submittedPrompts?.some((prompt) => prompt.user_id === participant.userId)
    );

    if (allSubmitted) {
      await startComparisonPhase();
    }

    return allSubmitted;
  };

  // Modifier la fonction submitPlayerPrompt
  const submitPlayerPrompt = async (prompt: string) => {
    if (!game || !user) return;

    try {
      // Sauvegarder le prompt dans la nouvelle table playerPrompts
      const response = await fetch("/api/player-prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          gameId: game.id,
          userId: user.id,
          round: game.currentRound,
          prompt: prompt,
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la sauvegarde du prompt");
      }

      setHasSubmittedPrompt(true);
      setPlayerPrompt("");

      // Vérifier si tous les joueurs ont soumis leur prompt
      await checkAllPlayersSubmitted();
    } catch (error) {
      console.error("Erreur lors de la soumission du prompt:", error);
    }
  };

  // Déplacer la déclaration de currentParticipant avant son utilisation
  const currentParticipant = user
    ? participants.find((p) => p.userId === user.id)
    : null;

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

  // Remplacer le code de débogage dans le rendu par une version plus simple
  const canStartGame =
    user &&
    game?.creatorId === user.id &&
    participants.length >= 2 &&
    participants.every((p) => p.isReady);

  // Animation de révélation des prompts
  const revealPromptsWithAnimation = async (
    prompts: { id: number; text: string; username: string }[],
    masterPrompt: string,
    masterUsername: string,
    winningPromptId?: number | null
  ) => {
    // Réinitialiser l'état
    setRevealedPrompts([]);
    setWinningPromptId(null);

    try {
      // Révéler les prompts des joueurs un par un
      for (const prompt of prompts) {
        setRevealedPrompts((prev) => [...prev, prompt]);
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      // Définir le gagnant
      if (typeof winningPromptId === "number") {
        setWinningPromptId(winningPromptId);
      }

      // Révéler le prompt maître après un délai
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setRevealedPrompts((prev) => [
        ...prev,
        { text: masterPrompt, username: `${masterUsername} (Maître)`, id: -1 },
      ]);
    } catch (error) {
      console.error("Erreur lors de l'animation des prompts:", error);
    }
  };

  // Rendu conditionnel en fonction du statut du jeu
  const renderGamePhase = () => {
    if (!game || !user) return null;

    const currentParticipant = participants.find((p) => p.userId === user.id);
    const isMaster = game.masterId === user.id;
    const canStartGame =
      game.creatorId === user.id &&
      participants.length >= 2 &&
      participants.every((p) => p.isReady);

    switch (game.status) {
      case "waiting":
        return (
          <div className="text-center">
            <h2 className="text-2xl mb-4">En attente des joueurs</h2>
            {canStartGame && (
              <button
                onClick={startGame}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Démarrer la partie
              </button>
            )}
            {!canStartGame && game.creatorId === user.id && (
              <p className="text-gray-400 mt-2">
                En attente que tous les joueurs soient prêts...
              </p>
            )}
          </div>
        );

      case "masterWriting":
        return (
          <div className="text-center">
            <div className="mb-4">
              {isMaster ? (
                <>
                  <h2 className="text-2xl mb-2">
                    👑 Vous êtes le Maître de la Création 👑
                  </h2>
                  <p className="text-xl mb-4">
                    Temps restant: {timeLeft} secondes
                  </p>
                  <textarea
                    value={masterPrompt}
                    onChange={handleMasterPromptChange}
                    className="w-full p-2 rounded mb-2 bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                    placeholder="Écrivez votre prompt ici..."
                    disabled={timeLeft === 0}
                  />
                  <button
                    onClick={handleMasterPromptSubmit}
                    className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                    disabled={!masterPrompt.trim() || timeLeft === 0}
                  >
                    Soumettre le prompt
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl mb-2">
                    👑{" "}
                    {
                      participants.find((p) => p.userId === game.masterId)?.user
                        .username
                    }{" "}
                    est le Maître de la Création 👑
                  </h2>
                  <p>En attente du prompt... ({timeLeft} secondes)</p>
                </>
              )}
            </div>
          </div>
        );

      case "generating":
        return (
          <div className="text-center">
            <h2 className="text-2xl mb-4">Génération de l'image en cours...</h2>
            <div className="animate-pulse flex space-x-4 justify-center">
              <div className="rounded-full bg-slate-700 h-10 w-10"></div>
              <div className="rounded-full bg-slate-700 h-10 w-10"></div>
              <div className="rounded-full bg-slate-700 h-10 w-10"></div>
            </div>
          </div>
        );

      case "playersWriting":
        return (
          <div className="text-center">
            <div className="mb-8">
              <h2 className="text-2xl mb-4">Devinez le prompt !</h2>
              {game.masterImageUrl && (
                <div className="max-w-lg mx-auto mb-4">
                  <img
                    src={game.masterImageUrl}
                    alt="Image générée"
                    className="w-full rounded-lg shadow-lg"
                  />
                </div>
              )}
              {!isMaster && (
                <>
                  {!hasSubmittedPrompt ? (
                    <div className="max-w-lg mx-auto">
                      <p className="text-xl mb-4">
                        Temps restant: {timeLeft || 30} secondes
                      </p>
                      <textarea
                        value={playerPrompt}
                        onChange={handlePlayerPromptChange}
                        className="w-full p-2 rounded mb-2 bg-gray-700 text-white border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                        placeholder="Quel était le prompt selon vous ?"
                        disabled={timeLeft === 0}
                      />
                      <button
                        onClick={handlePlayerPromptSubmit}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                        disabled={!playerPrompt.trim() || timeLeft === 0}
                      >
                        Soumettre votre réponse
                      </button>
                    </div>
                  ) : (
                    <div className="text-green-500 font-bold text-xl">
                      Votre réponse a été enregistrée !
                      <p className="text-gray-400 mt-2 text-base">
                        En attente des autres joueurs...
                      </p>
                    </div>
                  )}
                </>
              )}
              {isMaster && (
                <div className="text-xl text-purple-500">
                  Les autres joueurs essaient de deviner votre prompt...
                </div>
              )}
            </div>
          </div>
        );

      case "comparing":
        return (
          <div className="text-center">
            <h2 className="text-2xl mb-8">
              {isMaster ? "Résultats des joueurs" : "Comparaison des prompts"}
            </h2>
            <div className="space-y-4 max-w-2xl mx-auto">
              {game.masterImageUrl && (
                <div className="mb-6">
                  <img
                    src={game.masterImageUrl}
                    alt="Image générée"
                    className="w-1/2 mx-auto rounded-lg shadow-lg"
                  />
                </div>
              )}

              {/* Prompts révélés */}
              <div className="space-y-3">
                {revealedPrompts.map((prompt) => {
                  const isMasterPrompt = prompt.id === -1;
                  const isWinningPrompt = prompt.id === winningPromptId;

                  return (
                    <div
                      key={prompt.id}
                      className={`p-4 rounded-lg transition-all duration-300 ${
                        isMasterPrompt
                          ? "bg-yellow-500 text-black" // Prompt maître en doré
                          : isWinningPrompt
                          ? "bg-green-600 text-white" // Prompt gagnant en vert avec texte blanc
                          : "bg-gray-700 text-white" // Autres prompts en gris avec texte blanc
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={`${isMasterPrompt ? "font-bold" : ""}`}
                        >
                          {prompt.text}
                        </span>
                        <span
                          className={`text-sm ${
                            isMasterPrompt
                              ? "text-black font-bold"
                              : "text-gray-300"
                          }`}
                        >
                          {isMasterPrompt ? "👑 " : ""}
                          {prompt.username}
                          {isWinningPrompt && " 🏆"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );

      case "scoring":
        return (
          <div className="h-full flex flex-col items-center justify-center">
            <h2 className="text-2xl font-semibold mb-4">
              Mise à jour des scores...
            </h2>
          </div>
        );

      case "finished":
        return (
          <div className="h-full flex flex-col items-center justify-center">
            <h2 className="text-2xl font-semibold mb-4">Partie terminée !</h2>
          </div>
        );

      default:
        return null;
    }
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
                    {game.masterId === participant.userId && " 👑"}
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
            {renderGamePhase()}
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
