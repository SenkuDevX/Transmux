/// <reference types="vite/client" />
const BASE = import.meta.env.VITE_API_URL || "";

function url(path: string): string {
  return `${BASE}${path}`;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(url(path), init);
}

export function apiUrl(path: string): string {
  return url(path);
}
