import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getEmbedding(text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text,
  });
  return response.data[0].embedding;
}

function cosineSimilarity(a: number[], b: number[]) {
  const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

export async function POST(request: Request) {
  try {
    const { masterPrompt, playerPrompts } = await request.json();

    // Vérifier si nous avons des prompts à comparer
    if (!playerPrompts || playerPrompts.length === 0) {
      return NextResponse.json(
        { error: "Aucun prompt à comparer" },
        { status: 400 }
      );
    }

    // Obtenir l'embedding du prompt maître
    const masterEmbedding = await getEmbedding(masterPrompt);

    // Obtenir les embeddings des prompts des joueurs et calculer les similarités
    const similarities = await Promise.all(
      playerPrompts.map(async (prompt: string, index: number) => {
        const embedding = await getEmbedding(prompt);
        const similarity = cosineSimilarity(masterEmbedding, embedding);
        return { index, similarity };
      })
    );

    // Trouver le prompt le plus similaire
    if (similarities.length === 0) {
      return NextResponse.json(
        { error: "Aucun prompt à comparer" },
        { status: 400 }
      );
    }

    const winner = similarities.reduce((prev, current) =>
      current.similarity > prev.similarity ? current : prev
    );

    return NextResponse.json({ winnerId: winner.index });
  } catch (error) {
    console.error("Erreur détaillée:", error);
    return NextResponse.json(
      { error: "Erreur lors de la comparaison" },
      { status: 500 }
    );
  }
}
