import React, { useState } from "react";
import { getSupabaseClient } from "~/lib/supabaseClient";

interface SupabaseAuthProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export const SupabaseAuth: React.FC<SupabaseAuthProps> = ({
  supabaseUrl,
  supabaseAnonKey,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authState, setAuthState] = useState<"idle" | "loading" | "signedIn" | "signedOut" | "needsConfirmation" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const supabase = getSupabaseClient(supabaseUrl, supabaseAnonKey);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthState("loading");
    setError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      setAuthState("error");
      setError(error.message);
    } else if (data.user && !data.user.confirmed_at) {
      setAuthState("needsConfirmation");
      setUser(data.user);
    } else if (data.user) {
      setAuthState("signedIn");
      setUser(data.user);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthState("loading");
    setError(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setAuthState("error");
      setError(error.message);
    } else if (data.user) {
      setAuthState("signedIn");
      setUser(data.user);
    }
  };

  const handleSignOut = async () => {
    setAuthState("loading");
    setError(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setAuthState("error");
      setError(error.message);
    } else {
      setAuthState("signedOut");
      setUser(null);
    }
  };

  const handleResendConfirmation = async () => {
    setAuthState("loading");
    setError(null);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    } as any);
    if (error) {
      setAuthState("error");
      setError(error.message);
    } else {
      setAuthState("needsConfirmation");
    }
  };

  return (
    <div className="supabase-auth">
      {authState === "signedIn" && user ? (
        <div>
          <p>Signed in as {user.email}</p>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      ) : (
        <form onSubmit={authState === "needsConfirmation" ? undefined : handleSignIn}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={handleSignUp} disabled={authState === "loading"}>
              Sign Up
            </button>
            <button type="submit" disabled={authState === "loading"}>
              Sign In
            </button>
          </div>
        </form>
      )}
      {authState === "needsConfirmation" && (
        <div>
          <p>
            Please check your email to confirm your account. After confirming, you can sign in.
          </p>
          <button onClick={handleResendConfirmation} disabled={authState === "loading"}>
            Resend Confirmation Email
          </button>
        </div>
      )}
      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
};

export default SupabaseAuth;
