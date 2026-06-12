// ===== leaderboard.ts — real scores backed by Supabase =====

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScoreRow } from "@/lib/data";

interface ScoreRecord {
  player_name: string;
  score: number;
  created_at: string;
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

export function mapScoreRows(rows: ScoreRecord[]): ScoreRow[] {
  return rows.map((row, i) => ({
    rank: i + 1,
    name: row.player_name,
    score: row.score,
    date: formatDate(row.created_at),
  }));
}

export async function getAsteroidesScores(
  supabase: SupabaseClient,
): Promise<ScoreRow[]> {
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", "asteroides")
    .order("score", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return [];
  }

  return mapScoreRows(data ?? []);
}

export async function saveAsteroidesScore(
  supabase: SupabaseClient,
  playerName: string,
  score: number,
): Promise<void> {
  const { error } = await supabase
    .from("scores")
    .insert({ game_id: "asteroides", player_name: playerName, score });

  if (error) {
    console.error(error);
  }
}
