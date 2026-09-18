"use client";

import { useEffect, useState } from "react";
import { AUTH_CHANGE_EVENT } from "@/lib/api-client";

const STORAGE_KEY = "agrisense_tokens";
export { STORAGE_KEY as AUTH_STORAGE_KEY };

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

    // Same-tab login/logout (the common case) is caught by the custom
    // AUTH_CHANGE_EVENT that api-client dispatches on every token write —
    // this is the real fix for the "Navbar shows the wrong state" bug.
    // `storage` (other tabs) and `focus` (belt-and-suspenders, e.g. a
    // stale tab regaining focus) are kept as extra safety nets.
    function onAuthChange() {
      setIsAuthenticated(readIsAuthed());
    }
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY || e.key === null) {
        setIsAuthenticated(readIsAuthed());
      }
    }
    window.addEventListener(AUTH_CHANGE_EVENT, onAuthChange);
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onAuthChange);
    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, onAuthChange);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onAuthChange);
    };
  }, []);

  return { isAuthenticated, refresh: () => setIsAuthenticated(readIsAuthed()) };
}