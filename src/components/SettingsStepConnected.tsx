"use client";

import { ChangeEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Building2,
  KeyRound,
  RefreshCw,
  RotateCcw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { useReconciliationStore } from "@/store/reconciliation-api";

type TeamUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type JobRecord = {
  id: string;
  jobType: string;
  status: string;
  message?: string | null;
  errorMessage?: string | null;
  attemptCount: number;
  maxRetries: number;
  createdAt: string;
};

type AuditRecord = {
  id: string;
  action: string;
  actorName?: string | null;
  actorEmail?: string | null;
  entityType: string;
  createdAt: string;
};


export default function SettingsStep() {
  const {
    currentUser,
    currentOrganization,
    setCurrentOrganization,
    setStep,
    setError,
  } =
    useReconciliationStore();
  const isSuperAdmin = currentUser?.role === "super_admin";
  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const [workspaceForm, setWorkspaceForm] = useState({
    name: currentOrganization?.name || "",
    companyAddress: currentOrganization?.companyAddress || "",
    companyLogoDataUrl: currentOrganization?.companyLogoDataUrl || "",
  });
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceNotice, setWorkspaceNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamForm, setTeamForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "reviewer" as "super_admin" | "admin" | "reviewer",
  });
  const trimmedTeamName = teamForm.name.trim();
  const trimmedTeamEmail = teamForm.email.trim().toLowerCase();
  const teamPasswordTooShort =
    teamForm.password.length > 0 && teamForm.password.length < 8;
  const canSubmitTeamForm = Boolean(
    trimmedTeamName &&
      trimmedTeamEmail &&
      teamForm.password.length >= 8 &&
      !teamLoading
  );

  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobs, setJobs] = useState<JobRecord[]>([]);

  const [auditLoading, setAuditLoading] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditRecord[]>([]);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [passwordNotice, setPasswordNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const visibleJobs = useMemo(() => {
    const unfinished = jobs.filter((job) => job.status !== "completed");
    return (unfinished.length > 0 ? unfinished : jobs).slice(0, 6);
  }, [jobs]);

  const formatTimestamp = (value: string) =>
    new Date(value).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
    });

  const formatAuditAction = (value: string) =>
    value
      .replace(/\./g, " ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase());

  useEffect(() => {
    setWorkspaceForm({
      name: currentOrganization?.name || "",
      companyAddress: currentOrganization?.companyAddress || "",
      companyLogoDataUrl: currentOrganization?.companyLogoDataUrl || "",
    });
  }, [
    currentOrganization?.name,
    currentOrganization?.companyAddress,
    currentOrganization?.companyLogoDataUrl,
  ]);

  const loadUsers = async () => {
    if (!isSuperAdmin) {
      setTeamUsers([]);
      return;
    }
    setTeamLoading(true);
    try {
      const response = await apiClient.listUsers();
      if (!response.success) {
        throw new Error(response.error || "Failed to load team members");
      }
      setTeamUsers(
        (response.data || []).map((user: any) => ({
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        }))
      );
    } catch (error) {
      console.error("Failed to load team members:", error);
    } finally {
      setTeamLoading(false);
    }
  };

  const loadJobs = async () => {
    if (!isAdmin) {
      setJobs([]);
      return;
    }
    setJobsLoading(true);
    try {
      const response = await apiClient.listProcessingJobs({ limit: 12 });
      if (!response.success) {
        throw new Error(response.error || "Failed to load jobs");
      }
      setJobs(
        (response.data || []).map((job: any) => ({
          id: String(job.id),
          jobType: job.job_type,
          status: job.status,
          message: job.message || null,
          errorMessage: job.error_message || null,
          attemptCount: job.attempt_count || 0,
          maxRetries: job.max_retries || 0,
          createdAt: job.created_at,
        }))
      );
    } catch (error) {
      console.error("Failed to load jobs:", error);
    } finally {
      setJobsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    if (!currentUser) {
      setAuditEntries([]);
      return;
    }
    setAuditLoading(true);
    try {
      const response = await apiClient.listAuditLogs({ limit: 12 });
      if (!response.success) {
        throw new Error(response.error || "Failed to load audit logs");
      }
      setAuditEntries(
        (response.data || []).map((entry: any) => ({
          id: String(entry.id),
          action: entry.action,
          actorName: entry.actor_user_name || null,
          actorEmail: entry.actor_user_email || null,
          entityType: entry.entity_type,
          createdAt: entry.created_at,
        }))
      );
    } catch (error) {
      console.error("Failed to load audit logs:", error);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleCreateUser = async () => {
    try {
      setError(null);
      if (!isSuperAdmin) {
        setError("Only super admins can create users.");
        return;
      }
      if (!trimmedTeamName || !trimmedTeamEmail || teamForm.password.length < 8) {
        setError("Name, email, and password (minimum 8 characters) are required.");
        return;
      }

      const response = await apiClient.createUser({
        name: trimmedTeamName,
        email: trimmedTeamEmail,
        password: teamForm.password,
        role: teamForm.role,
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to create user");
      }
      setTeamForm({
        name: "",
        email: "",
        password: "",
        role: "reviewer",
      });
      await loadUsers();
      await loadAuditLogs();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to create user");
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      setError(null);
      if (!isSuperAdmin) {
        setError("Only super admins can retry failed jobs.");
        return;
      }
      const response = await apiClient.retryProcessingJob(jobId);
      if (!response.success) {
        throw new Error(response.error || "Failed to queue retry");
      }
      await loadJobs();
      await loadAuditLogs();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to queue retry");
    }
  };

  const handleChangePassword = async () => {
    setPasswordNotice(null);
    try {
      const response = await apiClient.changePassword({
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to update password");
      }
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setPasswordNotice({
        tone: "success",
        message: response.data?.message || "Password updated successfully",
      });
      await loadAuditLogs();
    } catch (error) {
      setPasswordNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Failed to update password",
      });
    }
  };

  const handleWorkspaceLogoSelected = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read logo file"));
        reader.readAsDataURL(file);
      });
      setWorkspaceForm((prev) => ({ ...prev, companyLogoDataUrl: dataUrl }));
      setWorkspaceNotice(null);
    } catch (error) {
      setWorkspaceNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Failed to read logo file",
      });
    } finally {
      event.target.value = "";
    }
  };

  const handleSaveWorkspaceProfile = async () => {
    if (!isAdmin) return;

    setWorkspaceSaving(true);
    setWorkspaceNotice(null);
    try {
      const response = await apiClient.updateCurrentOrganization({
        name: workspaceForm.name,
        company_address: workspaceForm.companyAddress,
        company_logo_data_url: workspaceForm.companyLogoDataUrl || null,
      });
      if (!response.success) {
        throw new Error(response.error || "Failed to save workspace branding");
      }

      setCurrentOrganization({
        id: String(response.data.id),
        name: response.data.name,
        slug: response.data.slug,
        email: response.data.email,
        companyAddress: response.data.company_address || null,
        companyLogoDataUrl: response.data.company_logo_data_url || null,
      });
      setWorkspaceNotice({
        tone: "success",
        message: "Workspace branding updated.",
      });
      await loadAuditLogs();
    } catch (error) {
      setWorkspaceNotice({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to save workspace branding",
      });
    } finally {
      setWorkspaceSaving(false);
    }
  };

  useEffect(() => {
    loadUsers().catch((error) => console.error("Failed to load users:", error));
    loadJobs().catch((error) => console.error("Failed to load jobs:", error));
    loadAuditLogs().catch((error) =>
      console.error("Failed to load audit logs:", error)
    );
  }, [isAdmin, isSuperAdmin, currentUser?.id]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Settings className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Workspace Settings
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Everything outside the core reconciliation flow lives here now:
              account security, team access, audit, and admin recovery tools.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStep("workspace")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back To Workspace
            </button>
            {isAdmin ? (
              <button
                onClick={() => setStep("ops")}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <ShieldAlert className="h-4 w-4" />
                Advanced Operations
              </button>
            ) : null}
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<Building2 className="h-5 w-5" />}
            label="Branding"
            title={currentOrganization?.name || "Workspace"}
            description={currentOrganization?.companyAddress || currentOrganization?.slug || "No address available"}
          />
          <InfoCard
            icon={<ShieldCheck className="h-5 w-5" />}
            label="Your Role"
            title={currentUser?.role || "user"}
            description={currentUser?.email || "No email available"}
          />
          <InfoCard
            icon={<Settings className="h-5 w-5" />}
            label="Navigation"
            title="Workspace is now separate"
            description="Use the dedicated Workspace tab for accounts and month history. Settings stays focused on branding, audit, security, and admin tools."
          />
        </div>

        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Workspace Branding
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                Company details for every report
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Set the company name, address, and logo once here. Every reconciliation report then reuses these details automatically.
              </p>
            </div>
            {currentOrganization?.companyLogoDataUrl ? (
              <img
                src={currentOrganization.companyLogoDataUrl}
                alt="Workspace logo"
                className="h-16 w-16 rounded-2xl object-contain ring-1 ring-slate-200"
              />
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <input
                value={workspaceForm.name}
                onChange={(event) =>
                  setWorkspaceForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="Company name"
                disabled={!isAdmin}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
              />
              <textarea
                value={workspaceForm.companyAddress}
                onChange={(event) =>
                  setWorkspaceForm((prev) => ({
                    ...prev,
                    companyAddress: event.target.value,
                  }))
                }
                placeholder="Company address"
                rows={3}
                disabled={!isAdmin}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-500"
              />
              {workspaceNotice ? (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    workspaceNotice.tone === "success"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  {workspaceNotice.message}
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Logo</p>
              <p className="mt-1 text-xs text-slate-500">
                PNG or JPG works well. The same logo appears on the printable reconciliation report.
              </p>
              <label className="mt-4 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm text-slate-600 hover:bg-slate-100">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleWorkspaceLogoSelected}
                  disabled={!isAdmin}
                  className="hidden"
                />
                <span>{workspaceForm.companyLogoDataUrl ? "Replace logo" : "Upload logo"}</span>
              </label>
              {workspaceForm.companyLogoDataUrl ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                  <img
                    src={workspaceForm.companyLogoDataUrl}
                    alt="Workspace logo preview"
                    className="mx-auto h-24 w-full object-contain"
                  />
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() =>
                        setWorkspaceForm((prev) => ({
                          ...prev,
                          companyLogoDataUrl: "",
                        }))
                      }
                      className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Remove logo
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={handleSaveWorkspaceProfile}
              disabled={!isAdmin || workspaceSaving || !workspaceForm.name.trim()}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                !isAdmin || workspaceSaving || !workspaceForm.name.trim()
                  ? "cursor-not-allowed bg-slate-300 text-slate-600"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {workspaceSaving ? "Saving..." : "Save workspace branding"}
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Account Security
                </p>
                <h2 className="text-xl font-semibold text-slate-900">
                  Change your password
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Keep your workspace access tight with a fresh password whenever you need it.
                </p>
              </div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                <KeyRound className="h-5 w-5 text-slate-700" />
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <input
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    currentPassword: event.target.value,
                  }))
                }
                placeholder="Current password"
                type="password"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <input
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({
                    ...prev,
                    newPassword: event.target.value,
                  }))
                }
                placeholder="New password"
                type="password"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
              <button
                onClick={handleChangePassword}
                disabled={!passwordForm.currentPassword || !passwordForm.newPassword}
                className={`w-full rounded-xl px-4 py-2 text-sm font-semibold ${
                  !passwordForm.currentPassword || !passwordForm.newPassword
                    ? "cursor-not-allowed bg-slate-300 text-slate-600"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                Update password
              </button>
              {passwordNotice ? (
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${
                    passwordNotice.tone === "success"
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border border-rose-200 bg-rose-50 text-rose-800"
                  }`}
                >
                  {passwordNotice.message}
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Audit Trail
                </p>
                <h2 className="text-xl font-semibold text-slate-900">
                  Recent user actions
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Track who changed passwords, created users, queued jobs, or took reconciliation actions.
                </p>
              </div>
              <button
                onClick={() => loadAuditLogs()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh audit
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {auditLoading ? (
                <EmptyStateCard message="Loading audit trail..." />
              ) : auditEntries.length === 0 ? (
                <EmptyStateCard message="No audit events recorded yet." dashed />
              ) : (
                auditEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatAuditAction(entry.action)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {entry.actorName || entry.actorEmail || "System"} • {entry.entityType}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400">
                      {formatTimestamp(entry.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {isSuperAdmin ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Team Access
                  </p>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Super admins, admins, and reviewers
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Super admins can manage users and retry failed jobs. Admins can upload, run reconciliation, and close months. Reviewers can inspect workspaces in read-only mode and download reports.
                  </p>
                </div>
                <button
                  onClick={() => loadUsers()}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Refresh team
                </button>
              </div>

              <div className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-3">
                  {teamLoading ? (
                    <EmptyStateCard message="Loading team members..." />
                  ) : teamUsers.length === 0 ? (
                    <EmptyStateCard
                      message="No extra users yet. Add a reviewer, admin, or another super admin below."
                      dashed
                    />
                  ) : (
                    teamUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            user.role === "super_admin"
                              ? "bg-rose-100 text-rose-700"
                              : user.role === "admin"
                              ? "bg-slate-900 text-white"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {user.role}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-600" />
                    <p className="text-sm font-semibold text-slate-900">Add team member</p>
                  </div>
                  <div className="mt-4 space-y-3">
                    <input
                      value={teamForm.name}
                      onChange={(event) =>
                        setTeamForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                      placeholder="Full name"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                    <input
                      value={teamForm.email}
                      onChange={(event) =>
                        setTeamForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      placeholder="Email"
                      type="email"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                    <input
                      value={teamForm.password}
                      onChange={(event) =>
                        setTeamForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      placeholder="Temporary password (min 8 chars)"
                      type="password"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                    <p
                      className={`text-xs ${
                        teamPasswordTooShort ? "text-rose-600" : "text-slate-500"
                      }`}
                    >
                      Password must be at least 8 characters.
                    </p>
                    <select
                      value={teamForm.role}
                      onChange={(event) =>
                        setTeamForm((prev) => ({
                          ...prev,
                          role: event.target.value as "super_admin" | "admin" | "reviewer",
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={handleCreateUser}
                      disabled={!canSubmitTeamForm}
                      className={`w-full rounded-xl px-4 py-2 text-sm font-semibold ${
                        !canSubmitTeamForm
                          ? "cursor-not-allowed bg-slate-300 text-slate-600"
                          : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                    >
                      Create user
                    </button>
                  </div>
                </div>
              </div>
            </div>
        ) : null}

        {isAdmin ? (
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Job Recovery
                  </p>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Failed and queued jobs
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {isSuperAdmin
                      ? "Retry dead-lettered or failed jobs here, or jump into the advanced dashboard for deeper operations work."
                      : "You can inspect job history here. Retrying failed jobs is reserved for super admins."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => loadJobs()}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh jobs
                  </button>
                  <button
                    onClick={() => setStep("ops")}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Open dashboard
                  </button>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {jobsLoading ? (
                  <EmptyStateCard message="Loading background jobs..." />
                ) : visibleJobs.length === 0 ? (
                  <EmptyStateCard message="No recent jobs yet." dashed />
                ) : (
                  visibleJobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {job.jobType === "reconciliation" ? "Reconciliation" : "Extraction"}
                            </p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                job.status === "completed"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : job.status === "dead_lettered"
                                  ? "bg-rose-100 text-rose-700"
                                  : job.status === "failed"
                                  ? "bg-amber-100 text-amber-700"
                                  : job.status === "running"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {job.status.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {job.message || "No job message"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Attempts: {job.attemptCount}/{job.maxRetries || 0} •{" "}
                            {formatTimestamp(job.createdAt)}
                          </p>
                          {job.errorMessage ? (
                            <p className="mt-2 text-xs text-rose-600">{job.errorMessage}</p>
                          ) : null}
                        </div>
                        {job.status === "failed" || job.status === "dead_lettered" ? (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            disabled={!isSuperAdmin}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
                              isSuperAdmin
                                ? "bg-slate-900 text-white hover:bg-slate-800"
                                : "cursor-not-allowed bg-slate-200 text-slate-500"
                            }`}
                          >
                            <RotateCcw className="h-4 w-4" />
                            Retry
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  title,
  description,
}: {
  icon: ReactNode;
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="inline-flex rounded-2xl bg-slate-100 p-2 text-slate-700">
        {icon}
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function EmptyStateCard({
  message,
  dashed = false,
}: {
  message: string;
  dashed?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-slate-50 p-6 text-sm text-slate-500 ${
        dashed
          ? "border border-dashed border-slate-300"
          : "border border-slate-200"
      }`}
    >
      {message}
    </div>
  );
}
