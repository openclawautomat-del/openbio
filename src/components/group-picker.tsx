"use client";

import { useTransition } from "react";
import { setLinkGroupAction } from "@/app/actions/phase2";

export function GroupPicker({ linkId, value, groups }: { linkId: number; value: number | null; groups: { id: number; name: string }[] }) {
  const [pending, start] = useTransition();
  return (
    <select
      className="input"
      aria-label="Group"
      defaultValue={value ?? ""}
      disabled={pending}
      onChange={(e) => start(async () => { await setLinkGroupAction(linkId, e.target.value ? Number(e.target.value) : null); })}
    >
      <option value="">No group</option>
      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
    </select>
  );
}
