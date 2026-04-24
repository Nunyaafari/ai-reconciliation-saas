"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Clock3,
  FileDown,
  FolderKanban,
  FolderOpen,
  PlusCircle,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  type ReconciliationSession,
  type ReconciliationSummary,
  type Transaction,
  useReconciliationStore,
} from "@/store/reconciliation-api";
import {
  DEFAULT_CURRENCY_CODE,
  normalizeCurrencyCode,
} from "@/lib/currency";
import { openReconciliationReportPreview } from "@/lib/report-preview";

type WorkspaceAccountGroup = {
  key: string;
  accountName: string;
  accountNumber: string;
  latestUpdatedAt: string;
  openSessionCount: number;
  sessions: ReconciliationSession[];
};

const mapSessionFromApi = (session: any): ReconciliationSession => ({
  id: session.id,
  accountName: session.account_name || "Default Account",
  accountNumber: session.account_number || null,
  periodMonth: session.period_month,
  bankUploadSessionId: session.bank_upload_session_id || null,
  bookUploadSessionId: session.book_upload_session_id || null,
  bankOpenBalance: toNumber(session.bank_open_balance),
  bankClosingBalance: toNumber(session.bank_closing_balance),
  bookOpenBalance: toNumber(session.book_open_balance),
  bookClosingBalance: toNumber(session.book_closing_balance),
  companyName: session.company_name || null,
  companyAddress: session.company_address || null,
  companyLogoDataUrl: session.company_logo_data_url || null,
  preparedBy: session.prepared_by || null,
  reviewedBy: session.reviewed_by || null,
  currencyCode: normalizeCurrencyCode(
    session.currency_code || DEFAULT_CURRENCY_CODE
  ),
  status: session.status || "open",
  createdAt: session.created_at,
  updatedAt: session.updated_at,
  closedAt: session.closed_at || null,
});

const formatTimestamp = (value: string) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

const formatPeriodMonth = (periodMonth: string) => {
  const [year, month] = periodMonth.split("-").map(Number);
  if (!year || !month) return periodMonth;

  return new Date(year, month - 1, 1).toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
};

const buildNextPeriodSetup = (account: WorkspaceAccountGroup) => {
  const latestSession = account.sessions[0];
  const [baseYear, baseMonth] = (latestSession?.periodMonth || "")
    .split("-")
    .map(Number);
  const seedDate =
    baseYear && baseMonth
      ? new Date(baseYear, baseMonth - 1, 1)
      : new Date();
  seedDate.setMonth(seedDate.getMonth() + 1);

  const year = seedDate.getFullYear();
  const month = seedDate.getMonth() + 1;

  return {
    accountName: account.accountName,
    accountNumber: account.accountNumber || undefined,
    year,
    month,
    periodMonth: `${year}-${String(month).padStart(2, "0")}`,
    bankOpenBalance: latestSession?.bankClosingBalance ?? undefined,
    bookOpenBalance: latestSession?.bookClosingBalance ?? undefined,
    bankClosingBalance: undefined,
    bookClosingBalance: undefined,
    currencyCode: normalizeCurrencyCode(
      latestSession?.currencyCode || DEFAULT_CURRENCY_CODE
    ),
  };
};

const toNumber = (value: any) => {
  const parsed =
    typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapWorksheetTransaction = (
  tx: any,
  source: "bank" | "book"
): Transaction => ({
  id: String(tx.id),
  date: tx.trans_date,
  narration: tx.narration,
  reference: tx.reference || "",
  amount: toNumber(tx.amount),
  status: tx.status || "unreconciled",
  direction: tx.direction || null,
  debitAmount: toNumber(tx.debit_amount),
  creditAmount: toNumber(tx.credit_amount),
  isRemoved: Boolean(tx.is_removed),
  removedAt: tx.removed_at || null,
  isCarryforward: Boolean(tx.is_carryforward),
  source,
  matched: tx.status === "matched",
  matchGroupId: tx.match_group_id || undefined,
});

const mapSummary = (summary: any): ReconciliationSummary | null => {
  if (!summary) return null;

  return {
    periodMonth: summary.period_month,
    netBankMovement: toNumber(summary.net_bank_movement),
    netBookMovement: toNumber(summary.net_book_movement),
    bankOpenBalance: toNumber(summary.bank_open_balance),
    bankClosingBalance: toNumber(summary.bank_closing_balance),
    bookOpenBalance: toNumber(summary.book_open_balance),
    bookClosingBalance: toNumber(summary.book_closing_balance),
    bankDebitSubtotal: toNumber(summary.bank_debit_subtotal),
    bankCreditSubtotal: toNumber(summary.bank_credit_subtotal),
    bookDebitSubtotal: toNumber(summary.book_debit_subtotal),
    bookCreditSubtotal: toNumber(summary.book_credit_subtotal),
    laneOneDifference: toNumber(summary.lane_one_difference),
    laneTwoDifference: toNumber(summary.lane_two_difference),
    adjustedBankBalance: toNumber(summary.adjusted_bank_balance),
    adjustedBookBalance: toNumber(summary.adjusted_book_balance),
    difference: toNumber(summary.difference),
    unresolvedBankDebits: {
      count: summary.unresolved_bank_debits?.count || 0,
      total: toNumber(summary.unresolved_bank_debits?.total),
    },
    unresolvedBankCredits: {
      count: summary.unresolved_bank_credits?.count || 0,
      total: toNumber(summary.unresolved_bank_credits?.total),
    },
    unresolvedBookDebits: {
      count: summary.unresolved_book_debits?.count || 0,
      total: toNumber(summary.unresolved_book_debits?.total),
    },
    unresolvedBookCredits: {
      count: summary.unresolved_book_credits?.count || 0,
      total: toNumber(summary.unresolved_book_credits?.total),
    },
  };
};

export default function WorkspaceStep() {
  const {
    currentOrganization,
    currentUser,
    historySessions,
    historyLoading,
    loadReconciliationHistory,
    beginNewRecon,
    openHistorySession,
    resetReconciliationSession,
    setReconSetup,
    setStep,
    setError,
    reconSetup,
  } = useReconciliationStore();
  const [selectedWorkspaceAccountKey, setSelectedWorkspaceAccountKey] = useState<
    string | null
  >(null);
  const [openingWorkspaceSessionId, setOpeningWorkspaceSessionId] = useState<
    string | null
  >(null);
  const [reportingSessionId, setReportingSessionId] = useState<string | null>(
    null
  );
  const [resettingSessionId, setResettingSessionId] = useState<string | null>(
    null
  );
  const [resetCandidateSession, setResetCandidateSession] =
    useState<ReconciliationSession | null>(null);
  const [showBlankPeriodModal, setShowBlankPeriodModal] = useState(false);
  const [blankPeriodAccount, setBlankPeriodAccount] =
    useState<WorkspaceAccountGroup | null>(null);
  const [blankPeriodMonth, setBlankPeriodMonth] = useState("");
  const [creatingBlankPeriod, setCreatingBlankPeriod] = useState(false);

  const workspaceAccounts = useMemo<WorkspaceAccountGroup[]>(() => {
    const grouped = new Map<string, WorkspaceAccountGroup>();

    for (const session of historySessions) {
      const key = `${session.accountName}::${session.accountNumber || ""}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          key,
          accountName: session.accountName,
          accountNumber: session.accountNumber || "",
          latestUpdatedAt: session.updatedAt,
          openSessionCount: session.status === "open" ? 1 : 0,
          sessions: [session],
        });
        continue;
      }

      existing.sessions.push(session);
      if (session.updatedAt > existing.latestUpdatedAt) {
        existing.latestUpdatedAt = session.updatedAt;
      }
      if (session.status === "open") {
        existing.openSessionCount += 1;
      }
    }

    return Array.from(grouped.values())
      .map((group) => ({
        ...group,
        sessions: [...group.sessions].sort((left, right) => {
          const periodCompare = right.periodMonth.localeCompare(left.periodMonth);
          if (periodCompare !== 0) return periodCompare;
          return right.updatedAt.localeCompare(left.updatedAt);
        }),
      }))
      .sort((left, right) => {
        if (right.openSessionCount !== left.openSessionCount) {
          return right.openSessionCount - left.openSessionCount;
        }

        const updatedCompare = right.latestUpdatedAt.localeCompare(
          left.latestUpdatedAt
        );
        if (updatedCompare !== 0) return updatedCompare;

        return left.accountName.localeCompare(right.accountName);
      });
  }, [historySessions]);

  const selectedWorkspaceAccount = useMemo(
    () =>
      workspaceAccounts.find(
        (account) => account.key === selectedWorkspaceAccountKey
      ) || workspaceAccounts[0] || null,
    [selectedWorkspaceAccountKey, workspaceAccounts]
  );

  useEffect(() => {
    loadReconciliationHistory().catch((error) =>
      console.error("Failed to load reconciliation history:", error)
    );
  }, [loadReconciliationHistory]);

  const handleNewAccount = () => {
    setError(null);
    setReconSetup(null);
    setStep("setup");
  };

  const handleNewPeriod = (account: WorkspaceAccountGroup) => {
    setError(null);
    beginNewRecon(buildNextPeriodSetup(account));
  };

  const handleOpenBlankPeriod = (account: WorkspaceAccountGroup) => {
    setBlankPeriodAccount(account);
    setBlankPeriodMonth(
      account.sessions[0]?.periodMonth ||
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
    );
    setShowBlankPeriodModal(true);
  };

  const handleCreateBlankPeriod = async () => {
    if (!blankPeriodAccount || !blankPeriodMonth) {
      setError("Select a month before continuing.");
      return;
    }

    const referenceSession = blankPeriodAccount.sessions[0];
    if (!referenceSession) {
      setError("No prior session found to carry forward balances.");
      return;
    }

    try {
      setError(null);
      setCreatingBlankPeriod(true);
      const response = await apiClient.startBlankReconciliationPeriod(
        referenceSession.id,
        blankPeriodMonth
      );

      if (!response.success) {
        throw new Error(response.error || "Failed to open blank period");
      }

      const newSession = mapSessionFromApi(response.data);
      setShowBlankPeriodModal(false);
      await openHistorySession(newSession, false);
      await loadReconciliationHistory();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to open blank period."
      );
    } finally {
      setCreatingBlankPeriod(false);
    }
  };

  const handleOpenWorkspaceSession = async (session: ReconciliationSession) => {
    try {
      setError(null);
      setOpeningWorkspaceSessionId(session.id);
      await openHistorySession(session, false);
    } catch (error) {
      console.error("Failed to open workspace session:", error);
    } finally {
      setOpeningWorkspaceSessionId(null);
    }
  };

  const handleOpenReportPreview = async (session: ReconciliationSession) => {
    try {
      setError(null);
      setReportingSessionId(session.id);
      const response = await apiClient.getReconciliationWorksheet(session.id);

      if (!response.success) {
        throw new Error(response.error || "Failed to open the report preview");
      }

      const summary = mapSummary(response.data?.summary);
      if (!summary) {
        throw new Error("No summary data available for this month yet.");
      }

      openReconciliationReportPreview({
        accountName: session.accountName,
        accountNumber: session.accountNumber || null,
        periodMonth: summary.periodMonth || session.periodMonth,
        status: session.status,
        companyName: currentOrganization?.name || session.companyName,
        companyAddress: currentOrganization?.companyAddress || session.companyAddress,
        companyLogoDataUrl:
          currentOrganization?.companyLogoDataUrl || session.companyLogoDataUrl,
        preparedBy: session.preparedBy,
        reviewedBy: session.reviewedBy,
        currencyCode: session.currencyCode,
        summary,
        bankCredits: (response.data?.bank_transactions || [])
          .map((tx: any) => mapWorksheetTransaction(tx, "bank"))
          .filter((tx: Transaction) => tx.direction === "credit"),
        bookDebits: (response.data?.book_transactions || [])
          .map((tx: any) => mapWorksheetTransaction(tx, "book"))
          .filter((tx: Transaction) => tx.direction === "debit"),
        bookCredits: (response.data?.book_transactions || [])
          .map((tx: any) => mapWorksheetTransaction(tx, "book"))
          .filter((tx: Transaction) => tx.direction === "credit"),
        bankDebits: (response.data?.bank_transactions || [])
          .map((tx: any) => mapWorksheetTransaction(tx, "bank"))
          .filter((tx: Transaction) => tx.direction === "debit"),
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to open the report preview."
      );
    } finally {
      setReportingSessionId(null);
    }
  };

  const handleResetSession = async (session: ReconciliationSession) => {
    setResetCandidateSession(session);
  };

  const handleConfirmResetSession = async () => {
    if (!resetCandidateSession) return;
    try {
      setError(null);
      setResettingSessionId(resetCandidateSession.id);
      await resetReconciliationSession(resetCandidateSession.id);
      await loadReconciliationHistory();
      setResetCandidateSession(null);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to reset the reconciliation month."
      );
    } finally {
      setResettingSessionId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        {showBlankPeriodModal ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    New Period
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Open a blank worksheet
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    We will open a blank worksheet for the period you choose. Balances
                    start at zero and will recompute after you upload fresh files.
                  </p>
                </div>
                <button
                  onClick={() => setShowBlankPeriodModal(false)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Period Month
                  <input
                    type="month"
                    value={blankPeriodMonth}
                    onChange={(event) => setBlankPeriodMonth(event.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                </label>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  If the selected month already exists, we will reset that month to a
                  blank worksheet before opening it.
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => setShowBlankPeriodModal(false)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBlankPeriod}
                  disabled={creatingBlankPeriod}
                  className={`rounded-full px-5 py-2 text-xs font-semibold text-white ${
                    creatingBlankPeriod
                      ? "cursor-not-allowed bg-slate-300"
                      : "bg-slate-900 hover:bg-slate-800"
                  }`}
                >
                  {creatingBlankPeriod ? "Opening..." : "Open Blank Period"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {resetCandidateSession ? (
          <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">
                Confirm Reset Month
              </p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">
                Reset {formatPeriodMonth(resetCandidateSession.periodMonth)}?
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                This clears transactions, matches, and balances for the selected month.
              </p>
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setResetCandidateSession(null)}
                  disabled={resettingSessionId === resetCandidateSession.id}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmResetSession}
                  disabled={resettingSessionId === resetCandidateSession.id}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    resettingSessionId === resetCandidateSession.id
                      ? "cursor-not-allowed bg-rose-200 text-rose-600"
                      : "bg-rose-600 text-white hover:bg-rose-700"
                  }`}
                >
                  {resettingSessionId === resetCandidateSession.id
                    ? "Resetting..."
                    : "Yes, Reset Month"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
                <Building2 className="h-6 w-6" />
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900">
                Account Workspace
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStep(reconSetup ? "upload" : "setup")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back To Current Recon
            </button>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <InfoCard
            label="Workspace"
            title={currentOrganization?.name || "Workspace"}
            description={
              currentOrganization?.companyAddress ||
              currentOrganization?.slug ||
              "No address available"
            }
          />
          <InfoCard
            label="Your Role"
            title={currentUser?.role || "user"}
            description={currentUser?.email || "No email available"}
          />
          <InfoCard
            label="Accounts"
            title={`${workspaceAccounts.length} reconciliation account${
              workspaceAccounts.length === 1 ? "" : "s"
            }`}
            description="Each account now owns its own monthly history and recon continuation path."
          />
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Account Workspace
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                Accounts and monthly recon history
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Pick an account to see its previous months, last updated dates, and continue any open work without leaving the workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => loadReconciliationHistory()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh workspace
              </button>
              <button
                onClick={handleNewAccount}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                <PlusCircle className="h-4 w-4" />
                New Account
              </button>
            </div>
          </div>

          {historyLoading ? (
            <div className="mt-5 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="h-[96px] rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="h-4 w-32 rounded-full bg-slate-200" />
                    <div className="mt-3 h-3 w-24 rounded-full bg-slate-200" />
                    <div className="mt-4 h-3 w-40 rounded-full bg-slate-200" />
                  </div>
                ))}
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                  Loading account details...
                </div>
              </div>
            </div>
          ) : workspaceAccounts.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
              <FolderKanban className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No reconciliation accounts yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Create the first account here and each month will stay neatly stacked under that account.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-3">
                {workspaceAccounts.map((account) => {
                  const selected = selectedWorkspaceAccount?.key === account.key;
                  return (
                    <button
                      key={account.key}
                      type="button"
                      onClick={() => setSelectedWorkspaceAccountKey(account.key)}
                      className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                        selected
                          ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold">
                            {account.accountName}
                          </p>
                          <p
                            className={`mt-1 text-xs ${
                              selected ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            {account.accountNumber
                              ? `Account No. ${account.accountNumber}`
                              : "No account number yet"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                            account.openSessionCount > 0
                              ? selected
                                ? "bg-emerald-500/20 text-emerald-100"
                                : "bg-emerald-100 text-emerald-700"
                              : selected
                              ? "bg-white/10 text-slate-100"
                              : "bg-slate-200 text-slate-700"
                          }`}
                        >
                          {account.openSessionCount > 0
                            ? `${account.openSessionCount} open`
                            : "Closed"}
                        </span>
                      </div>
                      <div
                        className={`mt-4 flex items-center gap-2 text-xs ${
                          selected ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        <Clock3 className="h-3.5 w-3.5" />
                        Last updated {formatTimestamp(account.latestUpdatedAt)}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                {selectedWorkspaceAccount ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Selected Account
                        </p>
                        <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                          {selectedWorkspaceAccount.accountName}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedWorkspaceAccount.accountNumber
                            ? `Account No. ${selectedWorkspaceAccount.accountNumber}`
                            : "No account number saved"}{" "}
                          · {selectedWorkspaceAccount.sessions.length} month
                          {selectedWorkspaceAccount.sessions.length === 1 ? "" : "s"} recorded
                        </p>
                      </div>
                      <button
                        onClick={() => handleOpenBlankPeriod(selectedWorkspaceAccount)}
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-100"
                      >
                        <PlusCircle className="h-4 w-4" />
                        New Month
                      </button>
                    </div>

                    <div className="mt-5 space-y-3">
                      {selectedWorkspaceAccount.sessions.map((session) => {
                        const opening = openingWorkspaceSessionId === session.id;
                        const canEdit = session.status !== "closed";
                        return (
                          <div
                            key={session.id}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-base font-semibold text-slate-900">
                                    {formatPeriodMonth(session.periodMonth)}
                                  </p>
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                      session.status === "closed"
                                        ? "bg-slate-200 text-slate-700"
                                        : "bg-emerald-100 text-emerald-700"
                                    }`}
                                  >
                                    {session.status}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                  Last updated {formatTimestamp(session.updatedAt)}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenWorkspaceSession(session)}
                                  disabled={opening}
                                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${
                                    opening
                                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                      : canEdit
                                      ? "bg-blue-600 text-white hover:bg-blue-700"
                                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <FolderOpen className="h-4 w-4" />
                                  {opening
                                    ? "Opening..."
                                    : canEdit
                                    ? "Edit"
                                    : "Open"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReportPreview(session)}
                                  disabled={reportingSessionId === session.id}
                                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${
                                    reportingSessionId === session.id
                                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  <FileDown className="h-4 w-4" />
                                  {reportingSessionId === session.id
                                    ? "Preparing..."
                                    : "Report"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleResetSession(session)}
                                  disabled={resettingSessionId === session.id}
                                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold ${
                                    resettingSessionId === session.id
                                      ? "cursor-not-allowed bg-rose-200 text-rose-600"
                                      : "border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                                  }`}
                                >
                                  <RefreshCw className="h-4 w-4" />
                                  {resettingSessionId === session.id
                                    ? "Resetting..."
                                    : "Reset"}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center text-sm text-slate-500">
                    <FolderKanban className="h-8 w-8 text-slate-300" />
                    <p className="mt-3 font-semibold text-slate-600">
                      Select an account to view its monthly history
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      The month list appears here once an account is selected.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}
