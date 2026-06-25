"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function Auth() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [displayName, setDisplayName] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(
    searchParams.get("error") === "link_expired"
      ? "El enlace ya expiró o fue usado. Solicita uno nuevo."
      : "",
  );
  const [loading, setLoading] = useState(false);
  const [signedUp, setSignedUp] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();

    if (tab === "in") {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      });
      setLoading(false);

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push("/");
      router.refresh();
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password: pass,
      options: { data: { display_name: displayName } },
    });
    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setSignedUp(true);
  };

  const oauthSignIn = async (provider: "google" | "github") => {
    setError("");
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  };

  const forgotPassword = async () => {
    setError("");
    if (!email) {
      setError("Introduce tu correo electrónico para recuperar la contraseña.");
      return;
    }

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/auth/callback?type=recovery` },
    );

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setResetSent(true);
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => {
              setTab("in");
              setError("");
              setSignedUp(false);
              setResetSent(false);
            }}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => {
              setTab("up");
              setError("");
              setSignedUp(false);
              setResetSent(false);
            }}
          >
            CREAR CUENTA
          </button>
        </div>

        {tab === "up" && signedUp ? (
          <div
            className="mono"
            style={{ fontSize: 13, textAlign: "center", padding: "12px 0" }}
          >
            Revisa tu correo para confirmar tu cuenta.
          </div>
        ) : tab === "in" && resetSent ? (
          <div
            className="mono"
            style={{ fontSize: 13, textAlign: "center", padding: "12px 0" }}
          >
            Te enviamos un correo para recuperar tu contraseña.
          </div>
        ) : (
          <form onSubmit={submit}>
            {tab === "in" ? (
              <div className="field">
                <label>Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jugador@vault.gg"
                />
              </div>
            ) : (
              <>
                <div className="field">
                  <label>Usuario</label>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="px_kai"
                  />
                </div>
                <div className="field slide-in">
                  <label>Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jugador@vault.gg"
                  />
                </div>
              </>
            )}
            <div className="field">
              <label>Contraseña</label>
              <input
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {tab === "in" && (
              <button
                type="button"
                className="mono"
                onClick={forgotPassword}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-faint)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  marginTop: 8,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}

            {error && (
              <div
                className="mono"
                style={{
                  color: "var(--danger, #ff5566)",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {error}
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              disabled={loading}
              style={{ width: "100%", marginTop: 8 }}
            >
              {tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
            </button>
          </form>
        )}

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => router.push("/")}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            onClick={() => oauthSignIn("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => oauthSignIn("github")}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
