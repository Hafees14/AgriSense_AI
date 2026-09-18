const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

function getTokens(): TokenPair | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("agrisense_tokens");
  return raw ? (JSON.parse(raw) as TokenPair) : null;
}

// The native `storage` event only fires in OTHER tabs, never the tab that
// made the change — so anything reacting to auth state in this same tab
// (the Navbar, useAuth, useCurrentUser) needs a same-tab signal too. This
// is the one place tokens are ever written or cleared, so it's the one
// place that needs to broadcast the change.
export const AUTH_CHANGE_EVENT = "agrisense:auth-change";

function broadcastAuthChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

function setTokens(tokens: TokenPair) {
  window.localStorage.setItem("agrisense_tokens", JSON.stringify(tokens));
  broadcastAuthChange();
}

function clearTokens() {
  window.localStorage.removeItem("agrisense_tokens");
  broadcastAuthChange();
}

async function refreshTokens(): Promise<TokenPair | null> {
  const current = getTokens();
  if (!current) return null;

  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const tokens = (await res.json()) as TokenPair;
  setTokens(tokens);
  return tokens;
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const tokens = getTokens();

  const doFetch = (accessToken?: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        ...(rest.body && !(rest.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
        ...(auth && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
    });

  let res = await doFetch(tokens?.access_token);

  if (res.status === 401 && auth) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      res = await doFetch(refreshed.access_token);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed with status ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type LocationSource = "manual" | "gps" | "geocoded";

export interface FarmPayload {
  name: string;
  latitude?: number;
  longitude?: number;
  location_source?: LocationSource;
  address?: string;
  land_size_ha?: number;
  region?: string;
  farm_type?: string;
  main_crops?: string;
}

export interface Farm extends FarmPayload {
  id: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export const api = {
  auth: {
    register: (payload: { name: string; email: string; password: string; phone?: string; role?: string; language?: string; officer_code?: string }) =>
      request("/auth/register", { method: "POST", body: JSON.stringify(payload), auth: false }),
    login: async (email: string, password: string) => {
      const tokens = await request<TokenPair>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        auth: false,
      });
      setTokens(tokens);
      return tokens;
    },
    logout: () => clearTokens(),
    me: () => request("/auth/me"),
    updateLanguage: (language: "en" | "si" | "ta") =>
      request("/auth/me/language", { method: "PATCH", body: JSON.stringify({ language }) }),
  },

  farms: {
    list: () => request<Farm[]>("/farms"),
    create: (payload: FarmPayload) => request<Farm>("/farms", { method: "POST", body: JSON.stringify(payload) }),
    get: (farmId: string) => request<Farm>(`/farms/${farmId}`),
    update: (farmId: string, payload: Partial<FarmPayload>) =>
      request<Farm>(`/farms/${farmId}`, { method: "PATCH", body: JSON.stringify(payload) }),
    uploadImage: (farmId: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return request<Farm>(`/farms/${farmId}/image`, { method: "POST", body: formData });
    },
  },

  diagnoses: {
    identifyPlant: (file: File, coords?: GeolocationCoords) =>
      uploadDiagnosis("/identify-plant", file, coordsToFields(coords)),
    detectDisease: (file: File, fieldId?: string, progressGroupId?: string, coords?: GeolocationCoords) =>
      uploadDiagnosis("/detect-disease", file, {
        field_id: fieldId,
        progress_group_id: progressGroupId,
        ...coordsToFields(coords),
      }),
    detectPest: (file: File, fieldId?: string, coords?: GeolocationCoords) =>
      uploadDiagnosis("/detect-pest", file, { field_id: fieldId, ...coordsToFields(coords) }),
    history: (params?: { type?: string; field_id?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return request(`/history${qs ? `?${qs}` : ""}`);
    },
    progressSeries: (progressGroupId: string) => request(`/history/progress/${progressGroupId}`),
  },

  chat: {
    send: (message: string, sessionId?: string) =>
      request("/chat", { method: "POST", body: JSON.stringify({ message, session_id: sessionId }) }),
    history: (sessionId: string) => request(`/chat/history?session_id=${sessionId}`),
  },

  weather: {
    get: (farmId: string) => request(`/weather?farm_id=${farmId}`),
  },

  recommendations: {
    list: (farmId: string, refresh = false) => request(`/recommendations?farm_id=${farmId}&refresh=${refresh}`),
  },

  notifications: {
    list: (unreadOnly = false) => request(`/notifications?unread_only=${unreadOnly}`),
    markRead: (id: string) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  },

  outbreaks: {
    list: (params: Record<string, string>) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/outbreaks${qs ? `?${qs}` : ""}`);
    },
  },

  reviews: {
    queue: () => request("/reviews/queue"),
    summary: (days = 30) => request(`/reviews/summary?days=${days}`),
    submit: (diagnosisId: string, expertNotes?: string) =>
      request(`/reviews/${diagnosisId}`, { method: "PATCH", body: JSON.stringify({ expert_notes: expertNotes ?? null }) }),
  },

  contact: {
    send: (payload: { name: string; email: string; subject: string; message: string }) =>
      request("/contact", { method: "POST", body: JSON.stringify(payload), auth: false }),
  },
};

export interface GeolocationCoords {
  latitude: number;
  longitude: number;
}

function coordsToFields(coords?: GeolocationCoords): Record<string, string | undefined> {
  if (!coords) return {};
  return { latitude: String(coords.latitude), longitude: String(coords.longitude) };
}

async function uploadDiagnosis(path: string, file: File, extraFields: Record<string, string | undefined> = {}) {
  const formData = new FormData();
  formData.append("file", file);
  for (const [key, value] of Object.entries(extraFields)) {
    if (value !== undefined) formData.append(key, value);
  }
  return request(path, { method: "POST", body: formData });
}