import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Landing point for invite / password-reset email links (token_hash flow).
 * Verifies the one-time token on the SERVER and sets the session cookie, then
 * sends the user to the right page to set their password. This works on any
 * device or browser (unlike the old PKCE code flow, which broke on invites and
 * cross-device resets).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") || "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  // Bad or expired link → send to login with a gentle hint.
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
