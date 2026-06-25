import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const type = searchParams.get("type");

  let exchangeError = null;
  if (code) {
    const supabase = createClient(await cookies());
    ({ error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code));
  }

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=link_expired`);
  }

  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/login/reset-password`);
  }

  return NextResponse.redirect(origin);
}
