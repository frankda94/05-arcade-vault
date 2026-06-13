import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getGame } from "@/lib/games";
import { createClient } from "@/utils/supabase/server";
import GamePlayer from "@/app/components/GamePlayer";

export default async function GamePlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createClient(await cookies());
  const game = await getGame(supabase, id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
