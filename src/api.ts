/// <reference types="vite/client" />
const BASE = import.meta.env.VITE_API_URL || "";

function url(path: string): string {
  return `${BASE}${path}`;
}

function getAuthToken(): string | null {
  // Clerk v5 stores session JWT in the __session cookie
  try {
    const m = document.cookie.match(/(?:^|;\s*)__session=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch {}
  return null;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = { ...(init?.headers as any) || {} };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url(path), { ...init, headers });
}

export function apiUrl(path: string): string {
  return url(path);
}
