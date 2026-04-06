"use client";

import { useMemo } from "react";
import { FileSpreadsheet, PlayCircle, PlusCircle } from "lucide-react";
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
    orgId,
  } = useReconciliationStore();

  const isAdmin = currentUser?.role === "admin";

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

  const bookOpenBalance =
    summary?.bookOpenBalance ?? reconciliationSession?.bookOpenBalance ?? 0;
  const bookClosingBalance =
    summary?.bookClosingBalance ?? reconciliationSession?.bookClosingBalance ?? 0;
  const bankOpenBalance =
    summary?.bankOpenBalance ?? reconciliationSession?.bankOpenBalance ?? 0;
  const bankClosingBalance =
    summary?.bankClosingBalance ?? reconciliationSession?.bankClosingBalance ?? 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50 px-6 py-10">
      <div className="mx-auto max-w-[1650px] space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900">
              Recon Workspace
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              This is the workbook-style worksheet before reconciliation. We have split the uploaded
              files into the four raw buckets, and the next click will run matching against these
              exact sections.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setStep("upload")}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <span className="inline-flex items-center gap-2">
                <PlusCircle className="h-4 w-4" />
                Add Records
              </span>
            </button>
            <button
              onClick={handleRunReconciliation}
              disabled={!isAdmin || loading || bankTransactions.length === 0 || bookTransactions.length === 0}
              className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                !isAdmin || loading || bankTransactions.length === 0 || bookTransactions.length === 0
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
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

        {!isAdmin ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Reviewer access is read-only here. An admin needs to click <span className="font-semibold">Reconcile</span> to generate and review match suggestions.
          </div>
        ) : null}

        <WorkbookReconciliationStatement
          title="Recon Workspace"
          subtitle="Top row: Bank Credits against Cash Book Debits. Bottom row: Cash Book Credits against Bank Debits. This matches the workbook sequence exactly before we remove any matched rows."
          accountName={reconSetup?.accountName || reconciliationSession?.accountName || "Account not set"}
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
