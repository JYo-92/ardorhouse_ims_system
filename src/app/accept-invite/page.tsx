"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [msg, setMsg] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sb = createClient();
    (async () => {
      try {
        const code = new URL(window.location.href).searchParams.get("code");
        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
        }
        const { data } = await sb.auth.getSession();
        if (data.session) setStatus("ready");
        else {
          setStatus("error");
          setMsg("This invite link is invalid or has expired. Ask your admin to send a new one.");
        }
      } catch (e) {
        setStatus("error");
        setMsg((e as Error).message);
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (password.length < 8) { setMsg("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setMsg("Passwords don't match."); return; }
    setSaving(true);
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);
    if (error) { setMsg(error.message); return; }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[500] bg-[#1a1a2e] flex items-center justify-center p-5">
      <div className="w-full max-w-[380px] text-center">
        <div className="text-3xl font-bold text-[#e2b87e] tracking-wide mb-1">Ardor House</div>
        <div className="text-[.7rem] text-white/40 uppercase tracking-[2px] mb-9">Staging Operations</div>

        {status === "loading" && <p className="text-white/60 text-sm">Checking your invite…</p>}

        {status === "error" && <p className="text-[#f87171] text-sm">{msg}</p>}

        {status === "ready" && (
          <form onSubmit={handleSubmit}>
            <p className="text-white/70 text-sm mb-5">Welcome! Set a password to finish setting up your account.</p>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full py-3 px-4 border border-white/15 rounded-lg bg-white/[.07] text-white text-sm mb-3 focus:outline-none focus:border-[#e2b87e] placeholder:text-white/35"
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full py-3 px-4 border border-white/15 rounded-lg bg-white/[.07] text-white text-sm mb-3 focus:outline-none focus:border-[#e2b87e] placeholder:text-white/35"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 rounded-lg bg-[#e2b87e] text-[#1a1a2e] text-sm font-bold cursor-pointer hover:bg-[#d4a56a] disabled:opacity-50"
            >
              {saving ? "Setting up…" : "Set Password & Continue"}
            </button>
            {msg && <div className="text-[#f87171] text-sm mt-3">{msg}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
