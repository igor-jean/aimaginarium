import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { gameId, userId, round, prompt } = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    // Vérifier si un prompt existe déjà pour ce joueur dans ce round
    const { data: existingPrompt } = await supabase
      .from("player_prompts")
      .select()
      .eq("game_id", gameId)
      .eq("user_id", userId)
      .eq("round", round)
      .single();

    if (existingPrompt) {
      // Mettre à jour le prompt existant
      const { data, error } = await supabase
        .from("player_prompts")
        .update({ prompt })
        .eq("game_id", gameId)
        .eq("user_id", userId)
        .eq("round", round)
        .select();

      if (error) throw error;
      return NextResponse.json(data);
    } else {
      // Créer un nouveau prompt
      const { data, error } = await supabase
        .from("player_prompts")
        .insert([
          {
            game_id: gameId,
            user_id: userId,
            round,
            prompt,
          },
        ])
        .select();

      if (error) throw error;
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du prompt:", error);
    return NextResponse.json(
      { error: "Erreur lors de la sauvegarde du prompt" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const round = searchParams.get("round");

    if (!gameId || !round) {
      return NextResponse.json(
        { error: "gameId et round sont requis" },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });

    const { data, error } = await supabase
      .from("player_prompts")
      .select(
        `
        *,
        user:users(username)
      `
      )
      .eq("game_id", gameId)
      .eq("round", round);

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur lors de la récupération des prompts:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des prompts" },
      { status: 500 }
    );
  }
}
