"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import clsx from "clsx";
import { apiClient } from "@/lib/api";
import { useReconciliationStore } from "@/store/reconciliation-api";

type JobRecord = {
  id: string;
  jobType: string;
  status: string;
  progressPercent: number;
  message?: string | null;
  errorMessage?: string | null;
  attemptCount: number;
  maxRetries: number;
  createdAt: string;
  completedAt?: string | null;
  lastRetryAt?: string | null;
  deadLetteredAt?: string | null;
};

export default function OperationsDashboard() {
  const { currentUser, setStep, setError } = useReconciliationStore();
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [workingJobId, setWorkingJobId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"dead_lettered" | "failed" | "active" | "all">(
    "dead_lettered"
  );
  const isAdmin = currentUser?.role === "admin";

  const loadJobs = async () => {
    if (!isAdmin) {
      setJobs([]);
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.listProcessingJobs({ limit: 100 });
      if (!response.success) {
        throw new Error(response.error || "Failed to load operations data");
      }
      setJobs(
        (response.data || []).map((job: any) => ({
          id: String(job.id),
          jobType: job.job_type,
          status: job.status,
          progressPercent: job.progress_percent || 0,
          message: job.message || null,
          errorMessage: job.error_message || null,
          attemptCount: job.attempt_count || 0,
          maxRetries: job.max_retries || 0,
          createdAt: job.created_at,
          completedAt: job.completed_at || null,
          lastRetryAt: job.last_retry_at || null,
          deadLetteredAt: job.dead_lettered_at || null,
        }))
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load operations data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobs().catch((error) => {
      console.error("Failed to load jobs:", error);
    });
  }, [isAdmin]);

  const counts = useMemo(
    () => ({
      deadLettered: jobs.filter((job) => job.status === "dead_lettered").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      active: jobs.filter((job) => job.status === "queued" || job.status === "running").length,
      completed: jobs.filter((job) => job.status === "completed").length,
    }),
    [jobs]
  );

  const filteredJobs = useMemo(() => {
    if (filter === "all") return jobs;
    if (filter === "active") {
      return jobs.filter((job) => job.status === "queued" || job.status === "running");
    }
    return jobs.filter((job) => job.status === filter);
  }, [filter, jobs]);

  const formatTimestamp = (value?: string | null) =>
    value
      ? new Date(value).toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "Not yet available";

  const handleRetry = async (jobId: string) => {
    try {
      setWorkingJobId(jobId);
      setError(null);
      const response = await apiClient.retryProcessingJob(jobId);
      if (!response.success) {
        throw new Error(response.error || "Failed to retry job");
      }
      await loadJobs();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to retry job");
    } finally {
      setWorkingJobId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <div className="rounded-3xl border border-amber-200 bg-white p-10 text-center shadow-sm">
            <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
            <h1 className="mt-4 text-2xl font-semibold text-slate-900">
              Admin access required
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              The operations dashboard is reserved for admins because it exposes retry controls for failed and dead-lettered jobs.
            </p>
            <button
              onClick={() => setStep("settings")}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to settings
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Operations Dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Monitor failed jobs, dead-lettered work, and active queue pressure. Retry recoverable jobs without leaving the admin workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStep("settings")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back To Settings
            </button>
            <button
              onClick={() => loadJobs()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <OpsMetricCard
            label="Dead-lettered"
            value={counts.deadLettered}
            tone="danger"
            icon={<ShieldAlert className="h-5 w-5" />}
          />
          <OpsMetricCard
            label="Failed"
            value={counts.failed}
            tone="warning"
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <OpsMetricCard
            label="Queued / Running"
            value={counts.active}
            tone="info"
            icon={<Activity className="h-5 w-5" />}
          />
          <OpsMetricCard
            label="Completed"
            value={counts.completed}
            tone="success"
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {[
            ["dead_lettered", "Dead-lettered"],
            ["failed", "Failed"],
            ["active", "Queued / Running"],
            ["all", "All recent"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() =>
                setFilter(value as "dead_lettered" | "failed" | "active" | "all")
              }
              className={clsx(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                filter === value
                  ? "bg-slate-900 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <Loader className="mx-auto h-8 w-8 animate-spin text-slate-500" />
            <p className="mt-4 text-sm text-slate-600">Loading operations data...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-12 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              Nothing in this bucket right now
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
              When jobs fail or move to the dead-letter queue, they will show up here with retry controls and context.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => {
              const canRetry = job.status === "failed" || job.status === "dead_lettered";
              const isWorking = workingJobId === job.id;

              return (
                <div
                  key={job.id}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-semibold text-slate-900">
                          {job.jobType === "reconciliation"
                            ? "Reconciliation job"
                            : "Extraction job"}
                        </h2>
                        <span
                          className={clsx(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            job.status === "dead_lettered" &&
                              "bg-rose-100 text-rose-700",
                            job.status === "failed" &&
                              "bg-amber-100 text-amber-700",
                            (job.status === "queued" || job.status === "running") &&
                              "bg-blue-100 text-blue-700",
                            job.status === "completed" &&
                              "bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {job.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {job.message || "No status message recorded."}
                      </p>
                      {job.errorMessage ? (
                        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                          {job.errorMessage}
                        </div>
                      ) : null}
                    </div>

                    {canRetry ? (
                      <button
                        onClick={() => handleRetry(job.id)}
                        disabled={isWorking}
                        className={clsx(
                          "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold",
                          isWorking
                            ? "cursor-not-allowed bg-slate-200 text-slate-500"
                            : "bg-slate-900 text-white hover:bg-slate-800"
                        )}
                      >
                        <RotateCcw className="h-4 w-4" />
                        {isWorking ? "Retrying..." : "Retry job"}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <JobMetaCard
                      label="Attempts"
                      value={`${job.attemptCount}/${job.maxRetries || 0}`}
                    />
                    <JobMetaCard
                      label="Created"
                      value={formatTimestamp(job.createdAt)}
                    />
                    <JobMetaCard
                      label="Last retry"
                      value={formatTimestamp(job.lastRetryAt)}
                    />
                    <JobMetaCard
                      label="Dead-lettered"
                      value={formatTimestamp(job.deadLetteredAt)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function OpsMetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "info" | "success";
  icon: ReactNode;
}) {
  const styles = {
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  } as const;

  return (
    <div className={clsx("rounded-2xl border p-5 shadow-sm", styles[tone])}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-bold">{value}</p>
        </div>
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70">
          {icon}
        </div>
      </div>
    </div>
  );
}

function JobMetaCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
