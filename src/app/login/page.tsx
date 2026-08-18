"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gem } from "lucide-react";
import { loginAction } from "@/lib/login-action";
import { showAppSplash, SPLASH_ROUTE_DELAY_MS } from "@/components/AppLaunchSplash";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const result = await loginAction(fd);
    if (result?.error) {
      setPending(false);
      setError(result.error);
      return;
    }

    showAppSplash();
    await new Promise((resolve) => window.setTimeout(resolve, SPLASH_ROUTE_DELAY_MS));
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--ink)]">
            <Gem className="h-6 w-6" />
          </div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-[var(--ink)]">
            Avenue JOAILLERIE
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Staff sign in</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Username</label>
            <input
              name="username"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none ring-[var(--gold)]/30 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none ring-[var(--gold)]/30 focus:ring-2"
            />
          </div>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-[var(--gold-deep)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--gold)] disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[var(--muted)]">
          Default after seed: <span className="font-medium">admin / admin123</span>
        </p>
      </div>
    </div>
  );
}
