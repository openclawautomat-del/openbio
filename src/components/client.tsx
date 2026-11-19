"use client";

import { createContext, useContext, useState, useTransition, useActionState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Check, Copy, Menu, Moon, Sun, X } from "lucide-react";

export function CopyButton({ value, label = "Copy", className = "btn btn-sm" }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      {done ? <Check className="icon" /> : <Copy className="icon" />}
      <span aria-live="polite">{done ? "Copied" : label}</span>
    </button>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const a = document.documentElement.getAttribute("data-theme");
    setDark(a ? a === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-icon"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => {
        const next = dark ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
        setDark(!dark);
      }}
    >
      {dark ? <Sun className="icon" /> : <Moon className="icon" />}
    </button>
  );
}

/** Mobile drawer toggle: toggles the .open class on the sidebar. */
export function NavToggle() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.getElementById("side")?.classList.toggle("open", open);
  }, [open]);
  return (
    <button type="button" className="btn btn-ghost btn-icon" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
      {open ? <X className="icon" /> : <Menu className="icon" />}
    </button>
  );
}

export interface FormState { errors?: Record<string, string>; message?: string; ok?: boolean }

const ErrCtx = createContext<Record<string, string>>({});

/** Wraps a server action with pending state and field errors. */
export function ActionForm({
  action, children, submit, pendingLabel, className, resetOnSuccess, submitClass = "btn btn-primary", extra,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submit: string;
  pendingLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  submitClass?: string;
  extra?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form action={formAction} ref={ref} className={className} noValidate>
      {state.errors?.form && <div className="notice bad" role="alert">{state.errors.form}</div>}
      {state.message && <div className={`notice ${state.ok ? "good" : ""}`} role="status">{state.message}</div>}
      <ErrCtx.Provider value={state.errors ?? {}}>{children}</ErrCtx.Provider>
      <div className="row">
        <button className={submitClass} disabled={pending}>{pending ? pendingLabel ?? "Working..." : submit}</button>
        {extra}
      </div>
    </form>
  );
}

export function Field({
  label, name, error, hint, type = "text", defaultValue, required, autoComplete, placeholder, prefix, textarea, maxLength, rows,
}: {
  label: string; name: string; error?: string; hint?: string; type?: string; defaultValue?: string | number | null;
  required?: boolean; autoComplete?: string; placeholder?: string; prefix?: string; textarea?: boolean; maxLength?: number; rows?: number;
}) {
  const ctx = useContext(ErrCtx);
  error = error ?? ctx[name];
  const id = `f-${name}`;
  const common = {
    id, name, required, autoComplete, placeholder, maxLength,
    defaultValue: defaultValue ?? undefined,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-e` : hint ? `${id}-h` : undefined,
    className: "input",
  } as const;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {textarea ? (
        <textarea {...common} rows={rows ?? 3} />
      ) : prefix ? (
        <div className="input-prefix"><span>{prefix}</span><input {...common} type={type} /></div>
      ) : (
        <input {...common} type={type} />
      )}
      {error ? <div className="err" id={`${id}-e`}>{error}</div> : hint ? <div className="hint" id={`${id}-h`}>{hint}</div> : null}
    </div>
  );
}

/** Small button that runs a server action with a confirm step and refreshes via revalidation. */
export function ConfirmButton({ action, label, confirm, className = "btn btn-sm btn-danger", children }: {
  action: () => Promise<unknown>; label: string; confirm: string; className?: string; children?: React.ReactNode;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      aria-label={label}
      title={label}
      onClick={() => {
        if (window.confirm(confirm)) start(async () => { await action(); });
      }}
    >
      {children ?? label}
    </button>
  );
}

export function ActionButton({ action, className = "btn btn-sm", children, label }: {
  action: () => Promise<unknown>; className?: string; children: React.ReactNode; label?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className={className} disabled={pending} aria-label={label} title={label} onClick={() => start(async () => { await action(); })}>
      {children}
    </button>
  );
}

/**
 * Confirmation dialog built on <dialog>: centered panel on desktop, bottom sheet under 640px (see .sheet in globals.css).
 * Focus moves into the dialog and Escape closes it, both provided by showModal().
 */
export function ConfirmDialog({ trigger, title, children, confirmLabel, action, triggerClass = "btn btn-sm", danger }: {
  trigger: React.ReactNode; title: string; children: React.ReactNode; confirmLabel: string;
  action: () => Promise<FormState | void>; triggerClass?: string; danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  return (
    <>
      <button type="button" className={triggerClass} onClick={() => { setErr(""); ref.current?.showModal(); }}>{trigger}</button>
      <dialog ref={ref} className="sheet" aria-labelledby="dlg-title" onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="sheet-body">
          <h2 id="dlg-title">{title}</h2>
          <div className="stack-sm">{children}</div>
          {err && <div className="notice bad" role="alert">{err}</div>}
          <div className="sheet-actions">
            <button type="button" className="btn" onClick={() => ref.current?.close()}>Cancel</button>
            <button
              type="button"
              className={danger ? "btn btn-danger" : "btn btn-primary"}
              disabled={pending}
              onClick={() => start(async () => {
                const r = await action();
                if (r && r.errors) { setErr(Object.values(r.errors)[0] ?? "Something went wrong."); return; }
                ref.current?.close();
              })}
            >{pending ? "Working..." : confirmLabel}</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
