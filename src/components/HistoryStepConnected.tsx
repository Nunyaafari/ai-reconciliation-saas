"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarRange,
  FileDown,
  FolderOpen,
  History,
  Loader,
  RotateCcw,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  ReconciliationSession,
  useReconciliationStore,
} from "@/store/reconciliation-api";

export default function HistoryStep() {
  const {
    historySessions,
    historyLoading,
    loadReconciliationHistory,
    openHistorySession,
    setStep,
    orgId,
    setError,
    currentUser,
  } = useReconciliationStore();
  const [workingSessionId, setWorkingSessionId] = useState<string | null>(null);
  const [downloadingSessionId, setDownloadingSessionId] = useState<string | null>(null);
  const isAdmin = currentUser?.role === "admin";

  useEffect(() => {
    loadReconciliationHistory().catch((error) => {
      console.error("Failed to load reconciliation history:", error);
    });
  }, [loadReconciliationHistory]);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);

  const formatTimestamp = (value?: string | null) => {
    if (!value) return "Not yet closed";
    return new Date(value).toLocaleString();
  };

  const handleOpenSession = async (session: ReconciliationSession) => {
    try {
      setWorkingSessionId(session.id);
      setError(null);
      await openHistorySession(session, session.status === "closed" && isAdmin);
    } catch (error) {
      console.error("Failed to reopen reconciliation session:", error);
    } finally {
      setWorkingSessionId(null);
    }
  };

  const handleDownloadReport = async (session: ReconciliationSession) => {
    if (!orgId || !session.bankUploadSessionId || !session.bookUploadSessionId) {
      setError("This historical session is missing its upload references.");
      return;
    }

    try {
      setDownloadingSessionId(session.id);
      setError(null);
      const response = await apiClient.downloadReconciliationReport(
        orgId,
        session.bankUploadSessionId,
        session.bookUploadSessionId
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to download report");
      }

      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `reconciliation-${session.periodMonth}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to download report";
      setError(message);
    } finally {
      setDownloadingSessionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <History className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900">
              Monthly Reconciliation History
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Reopen a prior month to continue approvals, or download the reconciliation report that was generated from that session.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStep("upload")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back To Uploads
            </button>
            <button
              onClick={() => loadReconciliationHistory()}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <RotateCcw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Sessions
            </p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {historySessions.length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Months currently recorded for this workspace.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Closed Months
            </p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {historySessions.filter((session) => session.status === "closed").length}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Reopen any month when you need to continue manual review.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Carry Forward
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Each new month inherits the prior month’s closing balances, so history doubles as your continuity ledger.
            </p>
          </div>
        </div>

        {historyLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <Loader className="mx-auto h-8 w-8 animate-spin text-slate-500" />
            <p className="mt-4 text-sm text-slate-600">
              Loading reconciliation history...
            </p>
          </div>
        ) : historySessions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 p-12 text-center">
            <CalendarRange className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-xl font-semibold text-slate-900">
              No monthly sessions yet
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
              Once you run a reconciliation, the month will appear here with its opening balances, closing balances, and downloadable report.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {historySessions.map((session) => {
              const isWorking = workingSessionId === session.id;
              const isDownloading = downloadingSessionId === session.id;
              const missingUploads =
                !session.bankUploadSessionId || !session.bookUploadSessionId;

              return (
                <div
                  key={session.id}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-semibold text-slate-900">
                          {session.periodMonth}
                        </h2>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            session.status === "closed"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {session.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        Updated {formatTimestamp(session.updatedAt)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleOpenSession(session)}
                        disabled={isWorking || missingUploads}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                          isWorking || missingUploads
                            ? "cursor-not-allowed bg-slate-200 text-slate-500"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        <FolderOpen className="h-4 w-4" />
                        {isWorking
                          ? "Opening..."
                          : session.status === "closed"
                          ? isAdmin
                            ? "Reopen Month"
                            : "Open Read-only"
                          : "Open Workspace"}
                      </button>
                      <button
                        onClick={() => handleDownloadReport(session)}
                        disabled={isDownloading || missingUploads}
                        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ${
                          isDownloading || missingUploads
                            ? "cursor-not-allowed bg-slate-200 text-slate-500"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <FileDown className="h-4 w-4" />
                        {isDownloading ? "Preparing..." : "Download Report"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-4">
                    <MetricCard
                      label="Bank Opening"
                      value={formatMoney(session.bankOpenBalance)}
                    />
                    <MetricCard
                      label="Bank Closing"
                      value={formatMoney(session.bankClosingBalance)}
                    />
                    <MetricCard
                      label="Cash Book Opening"
                      value={formatMoney(session.bookOpenBalance)}
                    />
                    <MetricCard
                      label="Cash Book Closing"
                      value={formatMoney(session.bookClosingBalance)}
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <span>
                      Created {formatTimestamp(session.createdAt)}
                    </span>
                    <span>
                      Closed {formatTimestamp(session.closedAt)}
                    </span>
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
