"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const SPLASH_EVENT = "avenue:show-splash";
const SPLASH_DURATION_MS = 1200;
const EXIT_DURATION_MS = 350;

export const SPLASH_ROUTE_DELAY_MS = 850;

export function showAppSplash() {
  window.dispatchEvent(new Event(SPLASH_EVENT));
}

export function AppLaunchSplash() {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const timers = useRef<number[]>([]);

  const playSplash = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    setIsLeaving(false);
    setIsVisible(true);

    timers.current = [
      window.setTimeout(() => setIsLeaving(true), SPLASH_DURATION_MS),
      window.setTimeout(() => setIsVisible(false), SPLASH_DURATION_MS + EXIT_DURATION_MS),
    ];
  }, []);

  useEffect(() => {
    window.addEventListener(SPLASH_EVENT, playSplash);
    playSplash();

    return () => {
      window.removeEventListener(SPLASH_EVENT, playSplash);
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, [playSplash]);

  if (!isVisible) return null;

  return (
    <div
      className={`app-launch-splash${isLeaving ? " app-launch-splash--leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Opening Avenue Joaillerie"
    >
      <div className="app-launch-logo-wrap">
        <Image
          src="/app-logo.png"
          alt="Avenue Joaillerie"
          width={220}
          height={220}
          priority
          className="app-launch-logo"
        />
        <div className="app-launch-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
