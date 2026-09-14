"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "agrisense_tokens";

function readIsAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Tiny client-side auth hook. Not a source of truth for security (the API
 * still checks the JWT on every request) — this is purely for showing the
 * right buttons/nav links without a flash of the wrong UI.
 */
export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    setIsAuthenticated(readIsAuthed());

    // Keep in sync if login/logout happens in another tab, or if
    // api-client clears tokens after a failed refresh.
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY || e.key === null) {
        setIsAuthenticated(readIsAuthed());
      }
    }
    function onFocus() {
      setIsAuthenticated(readIsAuthed());
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return { isAuthenticated, refresh: () => setIsAuthenticated(readIsAuthed()) };
}