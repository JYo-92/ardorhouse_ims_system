"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const router = useRouter();

  const handleForgot = async () => {
    setError("");
    setNotice("");
    if (!email) {
      setError("Enter your email above first, then tap “Forgot password”.");
      return;
    }
    setSending(true);
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSending(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setNotice(`If an account exists for ${email}, a reset link is on its way — check your email.`);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }
    // Access is controlled by invitation + roles (accounts are created only via
    // the admin invite flow), so any invited email — including personal ones —
    // may sign in. Non-invited emails simply have no account.
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-[500] bg-[#1a1a2e] flex items-center justify-center p-5">
      <form onSubmit={handleLogin} className="w-full max-w-[380px] text-center">
        <div className="text-3xl font-bold text-[#e2b87e] tracking-wide mb-1">
          Ardor House
        </div>
        <div className="text-[.7rem] text-white/40 uppercase tracking-[2px] mb-9">
          Staging Operations
        </div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full py-3 px-4 border border-white/15 rounded-lg bg-white/[.07] text-white text-sm font-inherit mb-3 transition-colors focus:outline-none focus:border-[#e2b87e] focus:bg-white/10 placeholder:text-white/35"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="w-full py-3 px-4 border border-white/15 rounded-lg bg-white/[.07] text-white text-sm font-inherit mb-3 transition-colors focus:outline-none focus:border-[#e2b87e] focus:bg-white/10 placeholder:text-white/35"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 border-none rounded-lg bg-[#e2b87e] text-[#1a1a2e] text-sm font-bold cursor-pointer font-inherit transition-colors mt-1 hover:bg-[#d4a56a] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>

        <button
          type="button"
          onClick={handleForgot}
          disabled={sending}
          className="block mx-auto mt-4 text-white/50 text-xs bg-transparent border-none cursor-pointer hover:text-white/80 disabled:opacity-50"
        >
          {sending ? "Sending reset link…" : "Forgot password?"}
        </button>

        {error && (
          <div className="text-[#f87171] text-sm mt-3">{error}</div>
        )}
        {notice && (
          <div className="text-[#86efac] text-sm mt-3">{notice}</div>
        )}

        <div className="mt-8 text-[.65rem] text-white/20">
          &copy; 2026 Ardor House &middot; Internal Use Only
        </div>
      </form>
    </div>
  );
}
