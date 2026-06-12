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

export async function getGameScores(
  supabase: SupabaseClient,
  gameId: string,
): Promise<ScoreRow[]> {
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(10);

  if (error) {
    console.error(error);
    return [];
  }

  return mapScoreRows(data ?? []);
}

export async function saveGameScore(
  supabase: SupabaseClient,
  gameId: string,
  playerName: string,
  score: number,
): Promise<void> {
  const { error } = await supabase
    .from("scores")
    .insert({ game_id: gameId, player_name: playerName, score });

  if (error) {
    console.error(error);
  }
}

export async function getRealGameIds(
  supabase: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await supabase.from("games").select("id");

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? []).map((row) => row.id as string);
}
