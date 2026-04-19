import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Auto-create profile row on first login
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("supabase_auth_id", user.id)
          .maybeSingle();

        if (!existing) {
          if (user.email === "ternakduit99@gmail.com") {
            // Priority 5 - Auth Fix: Link specifically for Harry's email
            const HARRY_USER_ID = "ffc77f5e-6f5c-433b-901b-c80cc3d75545";
            await supabase.from("profiles").update({
              supabase_auth_id: user.id
            }).eq("id", HARRY_USER_ID);
          } else {
            // Normal user: Create new profile from 0
            await supabase.from("profiles").insert({
              supabase_auth_id: user.id,
              display_name: user.email?.split("@")[0] ?? "Learner",
            });
          }
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
