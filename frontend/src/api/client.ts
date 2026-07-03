import { useAuthStore } from "../store/auth.js";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const isFormData = options.body instanceof FormData;
  const hasBody = options.body !== undefined && !isFormData;

  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (response.status === 401 && retry && path !== "/auth/refresh") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, options, false);
    }
    useAuthStore.getState().clear();
    throw new ApiError(401, "unauthorized");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(response.status, body.error ?? response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Le refresh token est à usage unique (rotation à chaque appel) : deux appels /auth/refresh
 * concurrents (onglet en veille qui se réveille, reconnexion WebSocket, timer de fond...)
 * feraient échouer le perdant et casseraient la session. On déduplique donc les appels
 * concurrents pour qu'ils partagent le même résultat.
 */
export function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = request<{ accessToken: string }>("/auth/refresh", { method: "POST" }, false)
      .then((data) => {
        useAuthStore.getState().setAccessToken(data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  upload: <T>(path: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return request<T>(path, { method: "POST", body: formData });
  },
};

export function authenticatedMediaUrl(path: string): string {
  const token = useAuthStore.getState().accessToken;
  return `/api${path}?token=${token ?? ""}`;
}
