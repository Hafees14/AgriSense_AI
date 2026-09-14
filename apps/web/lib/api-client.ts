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

function setTokens(tokens: TokenPair) {
  window.localStorage.setItem("agrisense_tokens", JSON.stringify(tokens));
}

function clearTokens() {
  window.localStorage.removeItem("agrisense_tokens");
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

export const api = {
  auth: {
    register: (payload: { name: string; email: string; password: string; phone?: string; role?: string }) =>
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
  },

  farms: {
    list: () => request("/farms"),
    create: (payload: { name: string; latitude?: number; longitude?: number; land_size_ha?: number; region?: string }) =>
      request("/farms", { method: "POST", body: JSON.stringify(payload) }),
    get: (farmId: string) => request(`/farms/${farmId}`),
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