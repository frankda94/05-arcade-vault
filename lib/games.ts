// ===== games.ts — game catalog backed by Supabase =====

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Game } from "@/lib/data";

interface GameRecord {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
  best: number;
  plays: string;
}

function mapGameRow(row: GameRecord): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat as Game["cat"],
    cover: row.cover,
    color: row.color as Game["color"],
    best: row.best,
    plays: row.plays,
  };
}

export async function getGames(supabase: SupabaseClient): Promise<Game[]> {
  const { data, error } = await supabase
    .from("games")
    .select("id, title, short, long, cat, cover, color, best, plays")
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return [];
  }

  return (data ?? []).map(mapGameRow);
}

export async function getGame(
  supabase: SupabaseClient,
  id: string,
): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("id, title, short, long, cat, cover, color, best, plays")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  if (!data) {
    return null;
  }

  return mapGameRow(data);
}
