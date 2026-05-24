// Auth helpers for TransMux v5.0
// Wraps Clerk for frontend auth operations

export function isAuthEnabled(): boolean {
  return !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
}

export function getAuthToken(): string | null {
  try {
    // Clerk stores session token in localStorage under __clerk_db
    const clerkDb = JSON.parse(localStorage.getItem("__clerk_db") || "{}");
    return clerkDb?.session?.lastActiveToken || null;
  } catch {
    return null;
  }
}

export function getClerkPublishableKey(): string {
  return import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
}
