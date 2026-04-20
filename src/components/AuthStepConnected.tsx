"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader, Lock, Building2, KeyRound } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useReconciliationStore } from "@/store/reconciliation-api";
import AppBrand from "./AppBrand";

export default function AuthStep() {
  const { authStatus, login, register, loading, currentOrganization } =
    useReconciliationStore();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [showResetFlow, setShowResetFlow] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [issuedResetToken, setIssuedResetToken] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const resetTokenParam = params.get("reset_token");
    const resetEmailParam = params.get("reset_email");
    const resetMode = params.get("mode") === "reset";

    if (!resetMode && !resetTokenParam) {
      return;
    }

    setMode("login");
    setShowResetFlow(true);
    if (resetTokenParam) {
      setResetToken(resetTokenParam);
    }
    if (resetEmailParam) {
      setResetEmail(resetEmailParam);
      setEmail(resetEmailParam);
    }
    setResetMessage("Reset link loaded from your email. Choose a new password to continue.");
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    try {
      if (mode === "login") {
        await login(email, password);
        return;
      }

      await register({
        name,
        email,
        password,
        organizationName,
        organizationSlug: organizationSlug || undefined,
      });
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : "Authentication failed"
      );
    }
  };

  const handleRequestPasswordReset = async () => {
    setResetLoading(true);
    setResetMessage(null);
    setIssuedResetToken(null);

    try {
      const response = await apiClient.requestPasswordReset({ email: resetEmail });
      if (!response.success) {
        throw new Error(response.error || "Could not request password reset");
      }
      setResetMessage(
        response.data?.message || "If that email exists, a reset token has been issued."
      );
      if (response.data?.reset_token) {
        setIssuedResetToken(response.data.reset_token);
        setResetToken(response.data.reset_token);
      }
    } catch (error) {
      setResetMessage(
        error instanceof Error ? error.message : "Could not request password reset"
      );
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmPasswordReset = async () => {
    setResetLoading(true);
    setResetMessage(null);

    try {
      const response = await apiClient.confirmPasswordReset({
        token: resetToken,
        new_password: resetPassword,
      });
      if (!response.success) {
        throw new Error(response.error || "Could not reset password");
      }
      setResetMessage(response.data?.message || "Password reset completed successfully.");
      setShowResetFlow(false);
      setMode("login");
      setEmail(resetEmail);
      setPassword("");
    } catch (error) {
      setResetMessage(
        error instanceof Error ? error.message : "Could not reset password"
      );
    } finally {
      setResetLoading(false);
    }
  };

  if (authStatus === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          <Loader className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-3 text-sm text-slate-600">Restoring your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 p-6">
      <div className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-sm">
          <div className="flex items-center justify-center">
            <AppBrand
              subtitle="Control, Confidence, Decisions."
              logoClassName="h-20"
              className="text-center"
            />
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900">
            AI assisted reconciliation
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Sign in to your workspace or create a new organization admin account.
            Every upload, match, report, and job run will now stay scoped to your
            tenant automatically.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <FeatureCard
              title="Isolated data"
              description="Every API request is now checked against your org."
            />
            <FeatureCard
              title="Queued jobs"
              description="Large extraction and matching work runs through Redis workers."
            />
            <FeatureCard
              title="Operational insight"
              description="Structured logs and metrics make failures much easier to trace."
            />
          </div>
          {currentOrganization ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Signed in to {currentOrganization.name}.
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Workspace Sign-In
          </p>
          <div className="mb-6 flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${
                mode === "login"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${
                mode === "register"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              Create Workspace
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" ? (
              <>
                <Field
                  label="Your name"
                  value={name}
                  onChange={setName}
                  placeholder="Kwame Mensah"
                />
                <Field
                  label="Organization name"
                  value={organizationName}
                  onChange={setOrganizationName}
                  placeholder="Ezi Recon"
                />
                <Field
                  label="Organization slug"
                  value={organizationSlug}
                  onChange={setOrganizationSlug}
                  placeholder="ezirecon"
                />
              </>
            ) : null}

            <Field
              label="Email"
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
              type="email"
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Minimum 8 characters"
              type="password"
            />

            {localError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {localError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                loading
                  ? "cursor-not-allowed bg-slate-300 text-slate-600"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Please wait...
                </>
              ) : mode === "login" ? (
                <>
                  <Lock className="h-4 w-4" />
                  Sign In
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4" />
                  Create Workspace
                </>
              )}
            </button>
          </form>

          {mode === "login" ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Password reset
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Request a reset email, or use a token directly if your environment is still in local fallback mode.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowResetFlow((value) => !value);
                    setResetMessage(null);
                  }}
                  className="text-sm font-semibold text-blue-700 hover:text-blue-800"
                >
                  {showResetFlow ? "Hide" : "Forgot password?"}
                </button>
              </div>

              {showResetFlow ? (
                <div className="mt-4 space-y-3">
                  <Field
                    label="Reset email"
                    value={resetEmail}
                    onChange={setResetEmail}
                    placeholder="you@company.com"
                    type="email"
                  />
                  <button
                    type="button"
                    onClick={handleRequestPasswordReset}
                    disabled={!resetEmail || resetLoading}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                      !resetEmail || resetLoading
                        ? "cursor-not-allowed bg-slate-300 text-slate-600"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {resetLoading ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Requesting token...
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4" />
                        Request reset token
                      </>
                    )}
                  </button>

                  <Field
                    label="Reset token"
                    value={resetToken}
                    onChange={setResetToken}
                    placeholder="Paste the reset token"
                  />
                  <Field
                    label="New password"
                    value={resetPassword}
                    onChange={setResetPassword}
                    placeholder="Minimum 8 characters"
                    type="password"
                  />
                  <button
                    type="button"
                    onClick={handleConfirmPasswordReset}
                    disabled={!resetToken || !resetPassword || resetLoading}
                    className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                      !resetToken || !resetPassword || resetLoading
                        ? "cursor-not-allowed bg-slate-300 text-slate-600"
                        : "bg-slate-900 text-white hover:bg-slate-800"
                    }`}
                  >
                    {resetLoading ? (
                      <>
                        <Loader className="h-4 w-4 animate-spin" />
                        Resetting password...
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" />
                        Confirm password reset
                      </>
                    )}
                  </button>

                  {resetMessage ? (
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                      {resetMessage}
                    </div>
                  ) : null}

                  {issuedResetToken ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                      Local development helper: the reset token is shown here because email delivery is not wired yet.
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
        required={type !== "text" || label !== "Organization slug"}
      />
    </label>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
