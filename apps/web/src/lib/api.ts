import type {
  IncidentDto,
  IncidentDetailDto,
  PostmortemDto,
  AuthUser,
} from "@volt-tackle/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const TOKEN_KEY = "volt_tackle_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface ListIncidentsResponse {
  incidents: IncidentDto[];
  total: number;
  limit: number;
  offset: number;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: AuthUser }>("/api/auth/me"),

  listIncidents: (params?: { status?: string; category?: string }) => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.category) search.set("category", params.category);
    const qs = search.toString();
    return request<ListIncidentsResponse>(`/api/incidents${qs ? `?${qs}` : ""}`);
  },

  getIncident: (id: string) => request<IncidentDetailDto>(`/api/incidents/${id}`),

  getPostmortem: (id: string) => request<PostmortemDto>(`/api/incidents/${id}/postmortem`),

  approve: (id: string, recommendationId: string, reason?: string) =>
    request<IncidentDetailDto>(`/api/incidents/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ recommendationId, reason }),
    }),

  escalate: (id: string, recommendationId: string, reason?: string) =>
    request<IncidentDetailDto>(`/api/incidents/${id}/escalate`, {
      method: "POST",
      body: JSON.stringify({ recommendationId, reason }),
    }),

  block: (id: string, recommendationId: string, reason?: string) =>
    request<IncidentDetailDto>(`/api/incidents/${id}/block`, {
      method: "POST",
      body: JSON.stringify({ recommendationId, reason }),
    }),

  sendTestAlert: (payload: Record<string, unknown>) =>
    request<{ accepted: boolean; incidentId?: string }>("/api/webhooks/alerts", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  analyzeRepo: (repoUrl: string, context?: string) =>
    request<{ accepted: boolean; incidentId: string; service: string }>("/api/repo-analysis", {
      method: "POST",
      body: JSON.stringify({ repoUrl, context }),
    }),
};

export { API_BASE_URL };
