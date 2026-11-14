"use client";

import { useState, useTransition } from "react";
import { resendVerificationAction } from "@/app/actions/auth";

export function ResendButton() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      {msg && <div className={`notice ${msg.ok ? "good" : "bad"}`} role="status">{msg.text}</div>}
      <button
        className="btn"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await resendVerificationAction();
          setMsg({ ok: !!r.ok, text: r.message ?? r.errors?.form ?? "Something went wrong." });
        })}
      >
        {pending ? "Sending..." : "Resend confirmation email"}
      </button>
    </div>
  );
}
