"use client";

import { useActionState } from "react";
import { createApiKeyAction } from "@/app/actions/app";
import { CopyButton } from "@/components/client";

/** Creates a key and shows the secret exactly once, right where the user is looking. */
export function ApiKeyForm() {
  const [state, action, pending] = useActionState(createApiKeyAction, {});
  const secret = state.message?.startsWith("KEY:") ? state.message.slice(4) : null;
  return (
    <form action={action} noValidate>
      {state.errors?.form && <div className="notice bad" role="alert">{state.errors.form}</div>}
      {secret && (
        <div className="notice good" role="status">
          <p style={{ margin: "0 0 8px" }}>Copy this key now. It is not stored in a readable form and will not be shown again.</p>
          <div className="row">
            <code className="num" style={{ wordBreak: "break-all" }}>{secret}</code>
            <CopyButton value={secret} />
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor="f-keyname">Key name</label>
        <input id="f-keyname" name="name" className="input" maxLength={80} placeholder="Zapier, backup script..." aria-invalid={state.errors?.name ? true : undefined} />
        {state.errors?.name ? <div className="err">{state.errors.name}</div> : null}
      </div>
      <button className="btn btn-primary" disabled={pending}>{pending ? "Creating..." : "Create key"}</button>
    </form>
  );
}
