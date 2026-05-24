import {StrictMode, useState, useEffect, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {ClerkProvider, useUser, SignIn} from '@clerk/clerk-react';
import App from './App.tsx';
import './index.css';

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
const AUTH_ENABLED = !!CLERK_PUBLISHABLE_KEY;

function ClerkLoginPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isLoaded) setTimedOut(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, [isLoaded]);

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
    if (timedOut) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-4">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mx-auto">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="text-xl font-bold text-white">Clerk Not Responding</h1>
            <p className="text-sm text-slate-400">The auth service didn't load. Check that:</p>
            <ul className="text-xs text-slate-500 text-left space-y-1">
              <li>1. <code className="text-indigo-400">VITE_CLERK_PUBLISHABLE_KEY</code> is correct</li>
              <li>2. Your app URL is whitelisted in <strong className="text-white">Clerk Dashboard → Application URLs</strong></li>
              <li>3. Clerk service is online</li>
            </ul>
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-500 cursor-pointer"
            >Retry</button>
            <p className="text-xs text-slate-600">Or set <code className="text-amber-400">AUTH_ENABLED=false</code> to skip auth</p>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading authentication...</p>
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

  return <App />;
}

function Root() {
  if (AUTH_ENABLED) {
    return (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
        <ClerkLoginPage />
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
