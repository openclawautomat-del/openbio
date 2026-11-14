"use client";

import { useTransition } from "react";
import { shareLinkWithTeamAction } from "@/app/actions/phase2";

export function ShareLink({ linkId, teamId, shared }: { linkId: number; teamId: number; shared: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => { await shareLinkWithTeamAction(linkId, shared ? null : teamId); })}>
      {shared ? "Stop sharing" : "Share"}
    </button>
  );
}
