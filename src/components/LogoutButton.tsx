"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/signout-action";
import { showAppSplash, SPLASH_ROUTE_DELAY_MS } from "@/components/AppLaunchSplash";

export function LogoutButton({ label = "Sign out" }: { label?: string }) {
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    if (pending) return;

    setPending(true);
    showAppSplash();
    await new Promise((resolve) => window.setTimeout(resolve, SPLASH_ROUTE_DELAY_MS));
    await signOutAction();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className="inline-flex items-center gap-2 text-xs text-white/50 hover:text-[var(--gold-soft)] disabled:cursor-wait"
    >
      <LogOut className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
