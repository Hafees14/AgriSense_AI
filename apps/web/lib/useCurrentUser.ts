"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: string;
  language_pref: string;
}

// Thin wrapper around GET /auth/me for UI decisions only (which nav links
// to show, which page variant to render). The API still enforces every
// role restriction server-side — this is purely so a farmer account
// doesn't even see a "Review queue" link that would 403 if clicked.
export function useCurrentUser() {
  const { isAuthenticated } = useAuth();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setUser(null);
      return;
    }
    api
      .auth.me()
      .then((res) => setUser(res as CurrentUser))
      .catch(() => setUser(null));
  }, [isAuthenticated]);

  return user;
}