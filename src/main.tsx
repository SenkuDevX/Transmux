import {StrictMode, useState, useEffect, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {ClerkProvider, SignedIn, SignedOut, SignIn, useUser} from '@clerk/clerk-react';
import App from './App.tsx';
import './index.css';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
const AUTH_ENABLED = !!CLERK_PUBLISHABLE_KEY;

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();

  // Sync auth state with extension
  useEffect(() => {
    if (isLoaded) {
      try {
        window.postMessage({
          type: "TRANSMUX_AUTH_STATE",
          authState: isSignedIn ? "authenticated" : "anonymous",
          user: isSignedIn ? { id: user?.id, email: user?.primaryEmailAddress?.toString(), name: user?.fullName } : null,
        }, "*");
      } catch {}
    }
  }, [isLoaded, isSignedIn, user]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
              <span className="text-2xl font-bold text-white">T</span>
            </div>
            <h1 className="text-2xl font-bold text-white">TransMux</h1>
            <p className="text-sm text-slate-400">Sign in to access the platform</p>
          </div>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "bg-transparent shadow-none",
                  headerTitle: "text-white text-lg",
                  headerSubtitle: "text-slate-400",
                  socialButtonsBlockButton: "bg-white/10 border border-white/20 text-white hover:bg-white/20",
                  formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500",
                  formFieldLabel: "text-slate-300",
                  formFieldInput: "bg-white/10 border-white/20 text-white",
                  footerActionText: "text-slate-400",
                  footerActionLink: "text-indigo-400 hover:text-indigo-300",
                  dividerLine: "bg-white/20",
                  dividerText: "text-slate-400",
                }
              }}
              routing="virtual"
              signUpUrl="/sign-up"
            />
          </div>
          <p className="text-xs text-slate-500 text-center">
            Requires the TransMux browser extension for full experience
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function Root() {
  if (AUTH_ENABLED) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        <AuthGate>
          <App />
        </AuthGate>
      </ClerkProvider>
    );
  }
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
