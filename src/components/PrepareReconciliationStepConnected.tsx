"use client";

import { useMemo, useState } from "react";
import {
  FileDown,
  History,
  PlayCircle,
  PlusCircle,
  Save,
} from "lucide-react";
import WorkbookReconciliationStatement from "./WorkbookReconciliationStatement";
import ReconcileProgressCue from "./ReconcileProgressCue";
import {
  ReconciliationSummary,
  Transaction,
  useReconciliationStore,
} from "@/store/reconciliation-api";
import { openReconciliationReportPreview } from "@/lib/report-preview";

export default function PrepareReconciliationStepConnected() {
  const {
    bankTransactions,
    bookTransactions,
    reconSetup,
    summary,
    reconciliationSession,
    currentUser,
    currentOrganization,
    loading,
    setError,
    setStep,
    startReconciliation,
    saveReconciliationSession,
    refreshReconciliation,
    orgId,
  } = useReconciliationStore();
  const [downloadingReport, setDownloadingReport] = useState(false);

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
  const currencyCode =
    reconciliationSession?.currencyCode || reconSetup?.currencyCode || "GHS";

  const buildBuckets = (
    bankTxs: Transaction[],
    bookTxs: Transaction[]
  ) => {
    const byDirection = (
      transactions: Transaction[],
      direction: "debit" | "credit"
    ) => transactions.filter((transaction) => transaction.direction === direction);
    return {
      bankCredits: byDirection(bankTxs, "credit"),
      bankDebits: byDirection(bankTxs, "debit"),
      bookDebits: byDirection(bookTxs, "debit"),
      bookCredits: byDirection(bookTxs, "credit"),
    };
  };

  const subtotalForDirection = (
    transactions: Transaction[],
    direction: "debit" | "credit"
  ) =>
    transactions.reduce(
      (total, tx) =>
        total +
        Number(direction === "debit" ? tx.debitAmount || 0 : tx.creditAmount || 0),
      0
    );

  const buildFallbackSummary = (
    period: string,
    bucketSet: ReturnType<typeof buildBuckets>
  ): ReconciliationSummary => {
    const bankDebitSubtotal = subtotalForDirection(bucketSet.bankDebits, "debit");
    const bankCreditSubtotal = subtotalForDirection(
      bucketSet.bankCredits,
      "credit"
    );
    const bookDebitSubtotal = subtotalForDirection(bucketSet.bookDebits, "debit");
    const bookCreditSubtotal = subtotalForDirection(
      bucketSet.bookCredits,
      "credit"
    );
    const adjustedBookBalance =
      Number(bookClosingBalance || 0) + bankCreditSubtotal + bookCreditSubtotal;
    const adjustedBankBalance =
      Number(bankClosingBalance || 0) + bookDebitSubtotal + bankDebitSubtotal;

    return {
      periodMonth: period,
      netBankMovement: 0,
      netBookMovement: 0,
      bankOpenBalance: Number(bankOpenBalance || 0),
      bankClosingBalance: Number(bankClosingBalance || 0),
      bookOpenBalance: Number(bookOpenBalance || 0),
      bookClosingBalance: Number(bookClosingBalance || 0),
      bankDebitSubtotal,
      bankCreditSubtotal,
      bookDebitSubtotal,
      bookCreditSubtotal,
      laneOneDifference: bankCreditSubtotal - bookDebitSubtotal,
      laneTwoDifference: bookCreditSubtotal - bankDebitSubtotal,
      adjustedBankBalance,
      adjustedBookBalance,
      difference: adjustedBookBalance - adjustedBankBalance,
      unresolvedBankDebits: {
        count: bucketSet.bankDebits.length,
        total: bankDebitSubtotal,
      },
      unresolvedBankCredits: {
        count: bucketSet.bankCredits.length,
        total: bankCreditSubtotal,
      },
      unresolvedBookDebits: {
        count: bucketSet.bookDebits.length,
        total: bookDebitSubtotal,
      },
      unresolvedBookCredits: {
        count: bucketSet.bookCredits.length,
        total: bookCreditSubtotal,
      },
    };
  };

  const handleOpenReportPreview = async () => {
    setDownloadingReport(true);
    try {
      let nextSummary = summary;
      let nextSession = reconciliationSession;
      let nextOrganization = currentOrganization;
      let nextBankTransactions = bankTransactions;
      let nextBookTransactions = bookTransactions;

      if (!nextSummary) {
        await refreshReconciliation(orgId || undefined);
        const refreshedState = useReconciliationStore.getState();
        nextSummary = refreshedState.summary;
        nextSession = refreshedState.reconciliationSession;
        nextOrganization = refreshedState.currentOrganization;
        nextBankTransactions = refreshedState.bankTransactions;
        nextBookTransactions = refreshedState.bookTransactions;
      }

      const nextBuckets = buildBuckets(nextBankTransactions, nextBookTransactions);
      const periodMonth =
        reconSetup?.periodMonth || nextSession?.periodMonth || "Period pending";
      const reportSummary =
        nextSummary || buildFallbackSummary(periodMonth, nextBuckets);

      openReconciliationReportPreview({
        accountName:
          reconSetup?.accountName || nextSession?.accountName || "Account not set",
        accountNumber: reconSetup?.accountNumber || nextSession?.accountNumber || null,
        periodMonth:
          reportSummary.periodMonth || nextSession?.periodMonth || "Period pending",
        status: nextSession?.status,
        companyName:
          nextOrganization?.name ||
          nextSession?.companyName ||
          reconSetup?.companyName,
        companyAddress:
          nextOrganization?.companyAddress ||
          nextSession?.companyAddress ||
          reconSetup?.companyAddress,
        companyLogoDataUrl:
          nextOrganization?.companyLogoDataUrl ||
          nextSession?.companyLogoDataUrl ||
          reconSetup?.companyLogoDataUrl,
        preparedBy: nextSession?.preparedBy || reconSetup?.preparedBy,
        reviewedBy: nextSession?.reviewedBy || reconSetup?.reviewedBy,
        currencyCode,
        summary: reportSummary,
        bankCredits: nextBuckets.bankCredits,
        bookDebits: nextBuckets.bookDebits,
        bookCredits: nextBuckets.bookCredits,
        bankDebits: nextBuckets.bankDebits,
      });
    } catch (error) {
      console.error("Failed to open report preview:", error);
      setError(
        error instanceof Error ? error.message : "Failed to open report preview."
      );
    } finally {
      setDownloadingReport(false);
    }
  };

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
                  onClick={handleOpenReportPreview}
                  disabled={downloadingReport}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                    downloadingReport
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : "bg-slate-900 text-white hover:bg-slate-800"
                  }`}
                >
                  <FileDown className="h-4 w-4" />
                  {downloadingReport ? "Preparing..." : "Report"}
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
          hideHeaderText
          hideAccountNote
        />
      </div>
    </div>
  );
}
