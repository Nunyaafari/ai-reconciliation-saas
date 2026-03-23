"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Upload,
  File,
  AlertCircle,
  Loader,
  CheckCircle2,
  Clock3,
  Info,
  History,
  RefreshCw,
  RotateCcw,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import { useReconciliationStore } from "@/store/reconciliation-api";
import { apiClient } from "@/lib/api";
import clsx from "clsx";

export default function UploadStep() {
  const {
    uploadFile,
    loading,
    error,
    setError,
    reset,
    bankSessionId,
    bookSessionId,
    bankFile,
    bookFile,
    bankTransactions,
    bookTransactions,
    currentMappingSource,
    setStep,
    currentUser,
    currentOrganization,
    logout,
  } = useReconciliationStore();
  const [fileErrors, setFileErrors] = useState<{ bank?: string; book?: string }>({});
  const [teamUsers, setTeamUsers] = useState<
    Array<{ id: string; name: string; email: string; role: string }>
  >([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamForm, setTeamForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "reviewer" as "admin" | "reviewer",
  });
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobs, setJobs] = useState<
    Array<{
      id: string;
      jobType: string;
      status: string;
      message?: string | null;
      errorMessage?: string | null;
      attemptCount: number;
      maxRetries: number;
      createdAt: string;
      deadLetteredAt?: string | null;
    }>
  >([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditEntries, setAuditEntries] = useState<
    Array<{
      id: string;
      action: string;
      actorName?: string | null;
      actorEmail?: string | null;
      entityType: string;
      createdAt: string;
    }>
  >([]);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [passwordNotice, setPasswordNotice] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const bankMapped = bankTransactions.length > 0;
  const bookMapped = bookTransactions.length > 0;
  const isAdmin = currentUser?.role === "admin";

  const fileProgress = useMemo(() => {
    const readyCount = Number(bankMapped) + Number(bookMapped);
    return {
      readyCount,
      percent: Math.round((readyCount / 2) * 100),
    };
  }, [bankMapped, bookMapped]);

  const visibleJobs = useMemo(() => {
    const unfinishedJobs = jobs.filter((job) => job.status !== "completed");
    return (unfinishedJobs.length > 0 ? unfinishedJobs : jobs).slice(0, 6);
  }, [jobs]);

  const handleUploadFile = async (file: File, source: "bank" | "book") => {
    try {
      const validationError = validateFile(file);
      if (validationError) {
        setFileErrors((prev) => ({ ...prev, [source]: validationError }));
        return;
      }
      setFileErrors((prev) => ({ ...prev, [source]: undefined }));
      setError(null);
      await uploadFile(file, source);
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  const validateFile = (file: File) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const name = file.name.toLowerCase();
    const allowed = [".pdf", ".xlsx", ".xls", ".csv"];
    const hasAllowedExt = allowed.some((ext) => name.endsWith(ext));
    if (!hasAllowedExt) {
      return "Unsupported file type. Use PDF, XLSX, or CSV.";
    }
    if (file.size > maxSize) {
      return "File too large. Maximum size is 10MB.";
    }
    return null;
  };

  const formatFileSize = (size: number) => {
    if (!size && size !== 0) return "";
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getStatus = (source: "bank" | "book") => {
    const isUploading = loading && currentMappingSource === source;
    const hasSession = source === "bank" ? !!bankSessionId : !!bookSessionId;
    const isMapped = source === "bank" ? bankMapped : bookMapped;

    if (isUploading) return "uploading";
    if (isMapped) return "mapped";
    if (hasSession) return "uploaded";
    return "waiting";
  };

  const bankStatus = getStatus("bank");
  const bookStatus = getStatus("book");

  const loadUsers = async () => {
    if (!isAdmin) return;
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
          deadLetteredAt: job.dead_lettered_at || null,
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
      const response = await apiClient.listAuditLogs({ limit: 10 });
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
      const response = await apiClient.createUser(teamForm);
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
    loadUsers().catch((error) => {
      console.error("Failed to load users:", error);
    });
    loadJobs().catch((error) => {
      console.error("Failed to load jobs:", error);
    });
    loadAuditLogs().catch((error) => {
      console.error("Failed to load audit logs:", error);
    });
  }, [isAdmin, currentUser?.id]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">
            Reconcile Faster with AI
          </h1>
          <p className="text-lg text-slate-600">
            Upload your bank statement and cash book to prepare matching.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            {["PDF", "XLSX", "CSV"].map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-slate-600"
              >
                {tag} supported
              </span>
            ))}
            <button
              onClick={() => setStep("history")}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:bg-slate-50"
            >
              <History className="h-3.5 w-3.5" />
              Monthly history
            </button>
            {isAdmin ? (
              <button
                onClick={() => setStep("ops")}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:bg-slate-50"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Operations
              </button>
            ) : null}
            {currentOrganization ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                {currentOrganization.name}
              </span>
            ) : null}
            {currentUser ? (
              <button
                onClick={() => logout()}
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:bg-slate-50"
              >
                Sign out {currentUser.name}
              </button>
            ) : null}
          </div>
        </div>

        {/* Summary */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Step 1 of 2
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Prepare both files
              </h2>
              <p className="text-sm text-slate-600">
                {fileProgress.readyCount} of 2 files mapped and ready.
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">
                {fileProgress.percent}%
              </p>
              <p className="text-xs text-slate-500">Overall readiness</p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all"
              style={{ width: `${fileProgress.percent}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <StatusPill label="Bank Statement" status={bankStatus} />
            <StatusPill label="Cash Book" status={bookStatus} />
            {currentUser ? (
              <StatusPill
                label={`Role: ${currentUser.role}`}
                status={currentUser.role === "admin" ? "mapped" : "uploaded"}
              />
            ) : null}
          </div>
        </div>

        {!isAdmin ? (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Reviewer access
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Uploads, mapping, reconciliation runs, and month close/reopen are admin-only.
                  You can still open history, inspect workspaces, approve or reject matches, and download reports.
                </p>
              </div>
              <button
                onClick={() => setStep("history")}
                className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              >
                Open History
              </button>
            </div>
          </div>
        ) : null}

        {/* Upload Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Bank Statement Upload */}
          <UploadArea
            title="Bank Statement"
            icon="🏦"
            onUpload={(file) => handleUploadFile(file, "bank")}
            loading={loading}
            status={bankStatus}
            fileName={bankFile?.name}
            fileSize={bankFile?.size ? formatFileSize(bankFile.size) : ""}
            errorMessage={fileErrors.bank}
            disabled={!isAdmin}
            disabledMessage="Only admins can upload or replace files."
          />

          {/* Cash Book Upload */}
          <UploadArea
            title="Cash Book"
            icon="📚"
            onUpload={(file) => handleUploadFile(file, "book")}
            loading={loading}
            status={bookStatus}
            fileName={bookFile?.name}
            fileSize={bookFile?.size ? formatFileSize(bookFile.size) : ""}
            errorMessage={fileErrors.book}
            disabled={!isAdmin}
            disabledMessage="Only admins can upload or replace files."
          />
        </div>

        {isAdmin ? (
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Team Access
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Admins and reviewers
                </h3>
                <p className="text-sm text-slate-600">
                  Admins can upload, run jobs, and close months. Reviewers can inspect workspaces, approve/reject matches, and download reports.
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
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                    Loading team members...
                  </div>
                ) : teamUsers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    No extra users yet. Add a reviewer or another admin below.
                  </div>
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
                          user.role === "admin"
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
                <p className="text-sm font-semibold text-slate-900">Add team member</p>
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
                    placeholder="Temporary password"
                    type="password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                  <select
                    value={teamForm.role}
                    onChange={(event) =>
                      setTeamForm((prev) => ({
                        ...prev,
                        role: event.target.value as "admin" | "reviewer",
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="reviewer">Reviewer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    onClick={handleCreateUser}
                    disabled={
                      !teamForm.name || !teamForm.email || !teamForm.password || teamLoading
                    }
                    className={`w-full rounded-xl px-4 py-2 text-sm font-semibold ${
                      !teamForm.name || !teamForm.email || !teamForm.password || teamLoading
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

        <div
          className={clsx(
            "mt-8 grid gap-6",
            isAdmin ? "lg:grid-cols-[0.9fr_1.1fr]" : "lg:grid-cols-1"
          )}
        >
          <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Account Security
                </p>
                <h3 className="text-lg font-semibold text-slate-900">
                  Change your password
                </h3>
                <p className="text-sm text-slate-600">
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

          {isAdmin ? (
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Job Recovery
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Failed and queued jobs
                  </h3>
                  <p className="text-sm text-slate-600">
                    Retry dead-lettered or failed jobs without leaving the workspace.
                  </p>
                </div>
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
                  <ShieldCheck className="h-4 w-4" />
                  Open dashboard
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {jobsLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                    Loading background jobs...
                  </div>
                ) : visibleJobs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    No recent jobs yet.
                  </div>
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
                              {job.jobType === "reconciliation"
                                ? "Reconciliation"
                                : "Extraction"}
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
                            <p className="mt-2 text-xs text-rose-600">
                              {job.errorMessage}
                            </p>
                          ) : null}
                        </div>
                        {job.status === "failed" || job.status === "dead_lettered" ? (
                          <button
                            onClick={() => handleRetryJob(job.id)}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
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

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Audit Trail
              </p>
              <h3 className="text-lg font-semibold text-slate-900">
                Recent user actions
              </h3>
              <p className="text-sm text-slate-600">
                A lightweight view of who changed passwords, created users, queued jobs, and took reconciliation actions.
              </p>
            </div>
            <button
              onClick={() => loadAuditLogs()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ShieldCheck className="h-4 w-4" />
              Refresh audit
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {auditLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                Loading audit trail...
              </div>
            ) : auditEntries.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                No audit events recorded yet.
              </div>
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

        {/* Error + Recovery */}
        {error && (
          <div className="mt-8 p-4 bg-rose-50 border border-rose-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                <p className="font-medium mb-1">Upload failed</p>
                <p>{error}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setError(null)}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-100"
              >
                Try again
              </button>
              <button
                onClick={() => reset()}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700"
              >
                Reset uploads
              </button>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Backend Connected ✅</p>
              <p>
                Upload real PDF, Excel, or CSV files. The system will extract,
                standardize, and match transactions using AI.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type UploadAreaProps = {
  title: string;
  icon: string;
  onUpload: (file: File) => void;
  loading: boolean;
  status: "uploading" | "mapped" | "uploaded" | "waiting";
  fileName?: string;
  fileSize?: string;
  errorMessage?: string;
  disabled?: boolean;
  disabledMessage?: string;
};

function UploadArea({
  title,
  icon,
  onUpload,
  loading,
  status,
  fileName,
  fileSize,
  errorMessage,
  disabled = false,
  disabledMessage,
}: UploadAreaProps) {
  const [dragActive, setDragActive] = useState(false);
  const variant = title === "Bank Statement" ? "blue" : "green";

  const styles = {
    blue: {
      drag: "border-blue-500 bg-blue-50",
      idle: "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50",
      iconBg: "bg-blue-100",
      iconText: "text-blue-600",
      actionText: "text-blue-600",
    },
    green: {
      drag: "border-green-500 bg-green-50",
      idle:
        "border-slate-300 bg-slate-50 hover:border-green-400 hover:bg-green-50",
      iconBg: "bg-green-100",
      iconText: "text-green-600",
      actionText: "text-green-600",
    },
  } as const;

  const style = styles[variant];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.includes("pdf") || file.name.endsWith(".xlsx") || file.name.endsWith(".csv")) {
        onUpload(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
  };

  return (
    <label
      onDragEnter={() => setDragActive(true)}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={clsx(
        "p-8 rounded-2xl border-2 border-dashed transition-all bg-white shadow-sm",
        disabled
          ? "cursor-not-allowed opacity-70"
          : "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        dragActive ? style.drag : style.idle,
        status === "mapped" && "border-emerald-400 bg-emerald-50/40"
      )}
    >
      <input
        type="file"
        accept=".pdf,.xlsx,.xls,.csv"
        onChange={handleChange}
        disabled={disabled || (loading && status === "uploading")}
        className="hidden"
      />
      <div className="text-center">
        <div
          className={clsx(
            "inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4",
            style.iconBg
          )}
        >
          {status === "uploading" ? (
            <Loader className={clsx("w-6 h-6 animate-spin", style.iconText)} />
          ) : status === "mapped" ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          ) : status === "uploaded" ? (
            <Clock3 className="w-6 h-6 text-amber-600" />
          ) : (
            <File className={clsx("w-6 h-6", style.iconText)} />
          )}
        </div>
        <h3 className="font-semibold text-slate-900 mb-1">
          {icon} {title}
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          {status === "mapped"
            ? "Mapped and ready"
            : status === "uploaded"
            ? "Uploaded • awaiting mapping"
            : status === "uploading"
            ? "Uploading..."
            : "PDF, XLSX, or CSV format"}
        </p>
        <div className="mb-3 flex items-center justify-center gap-1 text-[11px] text-slate-400">
          <span>Accepted: PDF, XLSX, CSV · Max size 10MB</span>
          <span className="relative group">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span className="absolute right-0 top-5 hidden group-hover:block whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 shadow-lg">
              Files over 10MB or non-PDF/XLSX/CSV formats will be rejected.
            </span>
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Upload className={clsx("w-4 h-4", style.actionText)} />
          <span className={clsx("text-sm font-medium", style.actionText)}>
            {disabled && disabledMessage
              ? disabledMessage
              : status === "mapped"
              ? "Replace file"
              : status === "uploaded"
              ? "Replace file"
              : status === "uploading"
              ? "Uploading..."
              : "Click to upload or drag"}
          </span>
        </div>
        {errorMessage ? (
          <p className="text-xs text-rose-600">{errorMessage}</p>
        ) : (
          <div className="text-xs text-slate-500">
            {fileName ? (
              <div className="flex items-center justify-center gap-2">
                <span className="truncate max-w-[160px]">{fileName}</span>
                {fileSize && <span className="text-slate-400">({fileSize})</span>}
              </div>
            ) : (
              "Maximum file size: 10MB"
            )}
          </div>
        )}
      </div>
    </label>
  );
}

function StatusPill({
  label,
  status,
}: {
  label: string;
  status: "uploading" | "mapped" | "uploaded" | "waiting";
}) {
  const statusLabel =
    status === "mapped"
      ? "Mapped"
      : status === "uploaded"
      ? "Uploaded"
      : status === "uploading"
      ? "Uploading"
      : "Waiting";

  const style =
    status === "mapped"
      ? "bg-emerald-100 text-emerald-800"
      : status === "uploaded"
      ? "bg-amber-100 text-amber-800"
      : status === "uploading"
      ? "bg-blue-100 text-blue-800"
      : "bg-slate-100 text-slate-600";

  return (
    <span className={clsx("px-3 py-1 rounded-full", style)}>
      {label}: {statusLabel}
    </span>
  );
}
