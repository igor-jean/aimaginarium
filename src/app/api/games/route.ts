import { NextResponse } from "next/server";
import { db } from "@/lib/drizzle/db";
import { games } from "@/lib/drizzle/schema";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Vérifier l'authentification
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { name, code, isPublic } = await req.json();

    console.log("Données reçues:", {
      name,
      code,
      isPublic,
      userId: session.user.id,
    });

    // Vérifier si le code existe déjà
    const existingGame = await db
      .select()
      .from(games)
      .where(eq(games.code, code));

    console.log("Vérification du code existant:", existingGame);

    if (existingGame.length > 0) {
      return NextResponse.json(
        { error: "Ce code de partie existe déjà" },
        { status: 400 }
      );
    }

    // Créer la partie
    const [newGame] = await db
      .insert(games)
      .values({
        name,
        masterId: session.user.id,
        creatorId: session.user.id,
        code,
        isPublic,
        status: "waiting",
      })
      .returning();

    console.log("Nouvelle partie créée:", {
      ...newGame,
      userId: session.user.id,
      creatorSet: newGame.creatorId === session.user.id,
    });

    return NextResponse.json(newGame);
  } catch (error) {
    console.error("Erreur détaillée:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la création de la partie",
      },
      { status: 500 }
    );
  }
}

// Route pour récupérer les parties publiques
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");

    if (code) {
      // Rechercher une partie spécifique par code
      const game = await db.select().from(games).where(eq(games.code, code));

      if (game.length === 0) {
        return NextResponse.json(
          { error: "Partie non trouvée" },
          { status: 404 }
        );
      }

      return NextResponse.json(game[0]);
    }

    // Récupérer toutes les parties publiques en attente
    const publicGames = await db
      .select()
      .from(games)
      .where(and(eq(games.isPublic, true), eq(games.status, "waiting")));

    return NextResponse.json(publicGames);
  } catch (error) {
    console.error("Error fetching games:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des parties" },
      { status: 500 }
    );
  }
}
