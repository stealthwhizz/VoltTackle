"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AuthUser } from "@volt-tackle/shared";
import { api, getToken, setToken, clearToken, ApiError } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({ user: null, logout: () => {} });

export function useAuth() {
  return useContext(AuthContext);
}

const DEMO_ACCOUNTS = [
  { label: "On-call Engineer", email: "oncall.engineer@volttackle.dev" },
  { label: "Senior Engineer", email: "senior.engineer@volttackle.dev" },
  { label: "Admin", email: "admin@volttackle.dev" },
];

export function LoginGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("senior.engineer@volttackle.dev");
  const [password, setPassword] = useState("volttackle-demo");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .me()
      .then((res) => setUser(res.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      setToken(res.token);
      setUser(res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  if (loading) {
    return <div className="py-20 text-center text-slate-500">Loading…</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-lg font-semibold text-slate-100">Sign in to Volt Tackle</h1>
        <p className="mt-1 text-sm text-slate-400">Use a seeded demo account to review incidents.</p>
        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-volt focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-volt focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-volt px-4 py-2 text-sm font-semibold text-night-950 transition hover:bg-volt-bright volt-glow-sm disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="mt-6 border-t border-slate-800 pt-4">
          <p className="text-xs text-slate-500">Quick fill (password: volttackle-demo):</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                onClick={() => setEmail(acc.email)}
                className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:border-volt/50"
              >
                {acc.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}
