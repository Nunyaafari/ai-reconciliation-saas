"use client";

import { useMemo } from "react";
import {
  FileDown,
  History,
  PlayCircle,
  PlusCircle,
  Save,
} from "lucide-react";
import WorkbookReconciliationStatement from "./WorkbookReconciliationStatement";
import ReconcileProgressCue from "./ReconcileProgressCue";
import { Transaction, useReconciliationStore } from "@/store/reconciliation-api";

export default function PrepareReconciliationStepConnected() {
  const {
    bankTransactions,
    bookTransactions,
    reconSetup,
    summary,
    reconciliationSession,
    currentUser,
    loading,
    setError,
    setStep,
    startReconciliation,
    saveReconciliationSession,
    orgId,
  } = useReconciliationStore();

  const isAdmin = currentUser?.role === "admin";
  const isSessionClosed = reconciliationSession?.status === "closed";
  const canEditSession = Boolean(isAdmin && !isSessionClosed);

  const buckets = useMemo(() => {
    const byDirection = (transactions: Transaction[], direction: "debit" | "credit") =>
      transactions.filter((transaction) => transaction.direction === direction);

    return {
      cashBookDebits: byDirection(bookTransactions, "debit"),
      cashBookCredits: byDirection(bookTransactions, "credit"),
      bankDebits: byDirection(bankTransactions, "debit"),
      bankCredits: byDirection(bankTransactions, "credit"),
    };
  }, [bankTransactions, bookTransactions]);

  const handleRunReconciliation = async () => {
    if (!orgId) {
      setError("Organization context is missing. Please refresh and try again.");
      return;
    }

    try {
      setError(null);
      await startReconciliation(orgId);
    } catch (error) {
      console.error("Failed to start reconciliation:", error);
      setStep("prepare");
    }
  };

  const handleSaveSession = async () => {
    if (!canEditSession || !reconciliationSession) return;
    try {
      setError(null);
      await saveReconciliationSession();
    } catch (error) {
      console.error("Failed to save reconciliation session:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Could not save this reconciliation session."
      );
    }
  };

  const bookOpenBalance =
    summary?.bookOpenBalance ?? reconciliationSession?.bookOpenBalance ?? 0;
  const bookClosingBalance =
    summary?.bookClosingBalance ?? reconciliationSession?.bookClosingBalance ?? 0;
  const bankOpenBalance =
    summary?.bankOpenBalance ?? reconciliationSession?.bankOpenBalance ?? 0;
  const bankClosingBalance =
    summary?.bankClosingBalance ?? reconciliationSession?.bankClosingBalance ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50">
      <div className="sticky top-16 z-30 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-[1650px] px-6 py-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0">
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                Recon Workspace
              </h1>
            </div>

            <div className="w-full overflow-x-auto xl:w-auto xl:justify-self-end">
              <div className="flex min-w-max items-center gap-2 whitespace-nowrap">
                <button
                  onClick={() => setStep("workspace")}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <History className="h-4 w-4" />
                  Workspace
                </button>
                <button
                  onClick={() => setStep("upload")}
                  disabled={!canEditSession}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                    !canEditSession
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <PlusCircle className="h-4 w-4" />
                  Add Records
                </button>
                <button
                  onClick={handleSaveSession}
                  disabled={loading || !reconciliationSession || !canEditSession}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium ${
                    loading || !reconciliationSession || !canEditSession
                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
                <button
                  disabled
                  className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500"
                  title="Report becomes available once reconciliation suggestions are generated."
                >
                  <FileDown className="h-4 w-4" />
                  Report
                </button>
                <button
                  onClick={handleRunReconciliation}
                  disabled={!canEditSession || loading || bankTransactions.length === 0 || bookTransactions.length === 0}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    !canEditSession || loading || bankTransactions.length === 0 || bookTransactions.length === 0
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  {loading ? (
                    <ReconcileProgressCue label="Reconciling..." />
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" />
                      Reconcile
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1650px] space-y-8 px-6 py-10">

        {!isAdmin ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Reviewer access is read-only here. An admin needs to click <span className="font-semibold">Reconcile</span> to generate and review match suggestions.
          </div>
        ) : null}
        {isSessionClosed ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700">
            This month is closed. It is view-only and report-ready.
          </div>
        ) : null}

        <WorkbookReconciliationStatement
          title="Recon Workspace"
          subtitle="Top row: Bank Credits against Cash Book Debits. Bottom row: Cash Book Credits against Bank Debits. This matches the workbook sequence exactly before we remove any matched rows."
          accountName={reconSetup?.accountName || reconciliationSession?.accountName || "Account not set"}
          accountNumber={reconSetup?.accountNumber || reconciliationSession?.accountNumber || null}
          periodMonth={reconSetup?.periodMonth || summary?.periodMonth || reconciliationSession?.periodMonth || "Period pending"}
          bookOpenBalance={bookOpenBalance}
          bookClosingBalance={bookClosingBalance}
          bankOpenBalance={bankOpenBalance}
          bankClosingBalance={bankClosingBalance}
          currencyCode={
            reconciliationSession?.currencyCode || reconSetup?.currencyCode || "GHS"
          }
          bankCredits={buckets.bankCredits}
          bookDebits={buckets.cashBookDebits}
          bookCredits={buckets.cashBookCredits}
          bankDebits={buckets.bankDebits}
        />
      </div>
    </div>
  );
}
