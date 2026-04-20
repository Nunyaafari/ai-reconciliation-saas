"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileDown,
  Info,
  Loader,
  PlusCircle,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { apiClient } from "@/lib/api";
import { formatCurrency, normalizeCurrencyCode } from "@/lib/currency";
import { openReconciliationReportPreview } from "@/lib/report-preview";
import ReconcileProgressCue from "./ReconcileProgressCue";
import WorkbookReconciliationStatement from "./WorkbookReconciliationStatement";
import {
  MatchGroup,
  Transaction,
  useReconciliationStore,
} from "@/store/reconciliation-api";

type StatusTone = "success" | "error" | "info";
type MatchLaneKey = "cashCreditBankDebit" | "cashDebitBankCredit";

type ExpandedMatchGroup = MatchGroup & {
  bankTransactions: Transaction[];
  bookTransactions: Transaction[];
  lane: MatchLaneKey;
};

type UndoMatchSnapshot = {
  bankTransactionIds: string[];
  bookTransactionIds: string[];
  confidence: number;
};

type OutstandingBucket = {
  id: string;
  title: string;
  transactions: Transaction[];
  source: "bank" | "book";
  direction: "debit" | "credit";
};

type AuditActivityEntry = {
  id: string;
  action: string;
  actorName?: string | null;
  actorEmail?: string | null;
  entityType: string;
  createdAt: string;
  metadataJson?: Record<string, unknown> | null;
};

type ActivityFilter = "all" | "created" | "approved" | "removed";

const activityActionMeta: Record<
  string,
  {
    label: string;
    category: Exclude<ActivityFilter, "all"> | null;
  }
> = {
  "match.created": {
    label: "Created match",
    category: "created",
  },
  "match.approved": {
    label: "Approved match",
    category: "approved",
  },
  "match.rejected": {
    label: "Removed match",
    category: "removed",
  },
  "transactions.removed_from_carryforward": {
    label: "Removed by user",
    category: "removed",
  },
  "transactions.restored_to_carryforward": {
    label: "Restored by user",
    category: null,
  },
  "reconciliation_session.balances_updated": {
    label: "Opening balances updated",
    category: null,
  },
  "reconciliation_session.closed": {
    label: "Month closed",
    category: null,
  },
  "reconciliation_session.reopened": {
    label: "Month reopened",
    category: null,
  },
  "reconciliation_session.saved": {
    label: "Progress saved",
    category: null,
  },
  "report.downloaded": {
    label: "Report downloaded",
    category: null,
  },
};

const formatMoney = (value: number, currencyCode?: string | null) =>
  formatCurrency(value, normalizeCurrencyCode(currencyCode));

const transactionDebit = (transaction: Transaction) =>
  Number(transaction.debitAmount || 0);

const transactionCredit = (transaction: Transaction) =>
  Number(transaction.creditAmount || 0);

const transactionLane = (
  bankTransactions: Transaction[],
  bookTransactions: Transaction[]
): MatchLaneKey => {
  const bankDirection = bankTransactions[0]?.direction;
  const bookDirection = bookTransactions[0]?.direction;

  if (bankDirection === "debit" || bookDirection === "credit") {
    return "cashCreditBankDebit";
  }

  return "cashDebitBankCredit";
};

const buildOutstandingStatementBuckets = (
  bankTransactions: Transaction[],
  bookTransactions: Transaction[]
) => {
  const activeBankTransactions = bankTransactions.filter(
    (transaction) => !transaction.isRemoved
  );
  const activeBookTransactions = bookTransactions.filter(
    (transaction) => !transaction.isRemoved
  );

  return {
    bankCredits: activeBankTransactions.filter(
      (transaction) => transaction.direction === "credit" && !transaction.matched
    ),
    bookDebits: activeBookTransactions.filter(
      (transaction) => transaction.direction === "debit" && !transaction.matched
    ),
    bookCredits: activeBookTransactions.filter(
      (transaction) => transaction.direction === "credit" && !transaction.matched
    ),
    bankDebits: activeBankTransactions.filter(
      (transaction) => transaction.direction === "debit" && !transaction.matched
    ),
  };
};

const sumTransactions = (
  transactions: Transaction[],
  direction: "debit" | "credit"
) =>
  transactions.reduce((total, transaction) => {
    return total + (direction === "debit" ? transactionDebit(transaction) : transactionCredit(transaction));
  }, 0);

const statusToneClass = (tone: StatusTone) => {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "error") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-blue-200 bg-blue-50 text-blue-800";
};

const getActivityCategory = (entry: AuditActivityEntry): ActivityFilter => {
  return activityActionMeta[entry.action]?.category || "all";
};

const formatActivityTimestamp = (value: string) =>
  new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });

const formatActivityActor = (entry: AuditActivityEntry) =>
  entry.actorName || entry.actorEmail || "System";

const formatActivityDetail = (entry: AuditActivityEntry) => {
  const metadata = entry.metadataJson || {};

  if (entry.action === "match.created") {
    const matchType = metadata.match_type;
    const confidence = metadata.confidence_score;
    return [matchType, typeof confidence === "number" ? `${confidence}% confidence` : null]
      .filter(Boolean)
      .join(" · ");
  }

  if (entry.action === "transactions.removed_from_carryforward") {
    const bankCount = Number(metadata.bank_transaction_count || 0);
    const bookCount = Number(metadata.book_transaction_count || 0);
    return `${bankCount} bank row${bankCount === 1 ? "" : "s"}, ${bookCount} cash book row${
      bookCount === 1 ? "" : "s"
    }`;
  }

  if (entry.action === "transactions.restored_to_carryforward") {
    const bankCount = Number(metadata.bank_transaction_count || 0);
    const bookCount = Number(metadata.book_transaction_count || 0);
    return `${bankCount} bank row${bankCount === 1 ? "" : "s"}, ${bookCount} cash book row${
      bookCount === 1 ? "" : "s"
    } restored`;
  }

  if (entry.action === "reconciliation_session.balances_updated") {
    const bankOpen = metadata.bank_open_balance;
    const bookOpen = metadata.book_open_balance;
    if (bankOpen || bookOpen) {
      return `Bank ${bankOpen || "0.00"} · Cash Book ${bookOpen || "0.00"}`;
    }
  }

  if (entry.action === "report.downloaded" && metadata.period_month) {
    return `Period ${String(metadata.period_month)}`;
  }

  if (
    (entry.action === "reconciliation_session.closed" ||
      entry.action === "reconciliation_session.reopened") &&
    metadata.period_month
  ) {
    return `Period ${String(metadata.period_month)}`;
  }

  return "";
};

const laneCopy: Record<
  MatchLaneKey,
  {
    title: string;
    subtitle: string;
    bookLabel: string;
    bankLabel: string;
    accent: string;
  }
> = {
  cashCreditBankDebit: {
    title: "Cash Book Credits Matched To Bank Debits",
    subtitle: "Cash book credits should reconcile against bank statement debits.",
    bookLabel: "Cash Book Credits",
    bankLabel: "Bank Debits",
    accent: "emerald",
  },
  cashDebitBankCredit: {
    title: "Cash Book Debits Matched To Bank Credits",
    subtitle: "Cash book debits should reconcile against bank statement credits.",
    bookLabel: "Cash Book Debits",
    bankLabel: "Bank Credits",
    accent: "blue",
  },
};

const RECONCILE_THRESHOLD_SEQUENCE = [100, 75, 50, 25] as const;

const getThresholdBandUpperBound = (threshold: number) => {
  if (threshold === 75) return 100;
  if (threshold === 50) return 75;
  if (threshold === 25) return 50;
  return Number.POSITIVE_INFINITY;
};

const confidenceBucketForGroup = (confidence: number) => {
  if (confidence >= 100) return 100;
  if (confidence >= 75) return 75;
  if (confidence >= 50) return 50;
  if (confidence >= 25) return 25;
  return null;
};

function CompactTransactionTable({
  transactions,
  emptyLabel,
}: {
  transactions: Transaction[];
  emptyLabel: string;
}) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center text-xs text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[96px_112px_minmax(220px,1fr)_108px_108px] gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        <span>Date</span>
        <span>Reference</span>
        <span>Narration</span>
        <span className="text-right">Debit</span>
        <span className="text-right">Credit</span>
      </div>
      <div className="divide-y divide-slate-100">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="grid grid-cols-[96px_112px_minmax(220px,1fr)_108px_108px] gap-3 px-3 py-2 text-[11px] text-slate-700"
          >
            <span className="font-mono text-slate-500">{transaction.date}</span>
            <span className="truncate font-mono text-slate-600">
              {transaction.reference || "-"}
            </span>
            <span className="truncate">{transaction.narration || "-"}</span>
            <span className="text-right font-mono">
              {transactionDebit(transaction) > 0
                ? formatMoney(transactionDebit(transaction))
                : "-"}
            </span>
            <span className="text-right font-mono">
              {transactionCredit(transaction) > 0
                ? formatMoney(transactionCredit(transaction))
                : "-"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchLaneSection({
  lane,
  groups,
  selectedGroupIds,
  onToggleGroup,
  onToggleAll,
  onRemoveSelected,
  onApproveGroup,
  onRejectGroup,
  canEdit,
}: {
  lane: MatchLaneKey;
  groups: ExpandedMatchGroup[];
  selectedGroupIds: string[];
  onToggleGroup: (groupId: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onRemoveSelected: () => void;
  onApproveGroup: (groupId: string) => void;
  onRejectGroup: (groupId: string) => void;
  canEdit: boolean;
}) {
  const copy = laneCopy[lane];
  const allSelected = groups.length > 0 && selectedGroupIds.length === groups.length;
  const bookSubtotal = groups.reduce((total, group) => {
    return total + sumTransactions(group.bookTransactions, lane === "cashCreditBankDebit" ? "credit" : "debit");
  }, 0);
  const bankSubtotal = groups.reduce((total, group) => {
    return total + sumTransactions(group.bankTransactions, lane === "cashCreditBankDebit" ? "debit" : "credit");
  }, 0);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{copy.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => onToggleAll(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Select all ({groups.length})
            </label>
            <button
              onClick={onRemoveSelected}
              disabled={!canEdit || selectedGroupIds.length === 0}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                !canEdit || selectedGroupIds.length === 0
                  ? "cursor-not-allowed bg-slate-100 text-slate-400"
                  : "bg-rose-600 text-white hover:bg-rose-700"
              }`}
            >
              <Trash2 className="h-4 w-4" />
              Remove selected
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {copy.bookLabel} subtotal
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{formatMoney(bookSubtotal)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {copy.bankLabel} subtotal
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{formatMoney(bankSubtotal)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Difference
            </p>
            <p
              className={`mt-2 text-lg font-semibold ${
                Math.abs(bookSubtotal - bankSubtotal) < 0.01
                  ? "text-emerald-700"
                  : "text-rose-700"
              }`}
            >
              {formatMoney(bookSubtotal - bankSubtotal)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            No matched items in this section yet.
          </div>
        ) : (
          groups.map((group) => (
            <article
              key={group.id}
              className={`rounded-2xl border p-4 ${
                group.status === "pending" && group.confidence >= 100
                  ? "border-emerald-300 bg-emerald-50/70 shadow-sm"
                  : "border-slate-200 bg-slate-50/60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.includes(group.id)}
                    onChange={(event) => onToggleGroup(group.id, event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                        {group.confidence}% confidence
                      </span>
                      {group.status === "pending" && group.confidence >= 100 ? (
                        <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                          Auto-selected exact match
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          group.status === "approved"
                            ? "bg-emerald-100 text-emerald-700"
                            : group.status === "rejected"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {group.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                        {group.matchType}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Cash subtotal {formatMoney(sumTransactions(group.bookTransactions, lane === "cashCreditBankDebit" ? "credit" : "debit"))}
                      {" · "}
                      Bank subtotal {formatMoney(sumTransactions(group.bankTransactions, lane === "cashCreditBankDebit" ? "debit" : "credit"))}
                    </p>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex items-center gap-2">
                    {group.status === "pending" && (
                      <button
                        onClick={() => onApproveGroup(group.id)}
                        className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                    )}
                    <button
                      onClick={() => onRejectGroup(group.id)}
                      className="rounded-full bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.bookLabel}
                  </p>
                  <CompactTransactionTable
                    transactions={group.bookTransactions}
                    emptyLabel="No cash book rows in this match group."
                  />
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {copy.bankLabel}
                  </p>
                  <CompactTransactionTable
                    transactions={group.bankTransactions}
                    emptyLabel="No bank rows in this match group."
                  />
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function OutstandingBucketCard({
  bucket,
  selectedIds,
  onToggle,
  onOpenSuggestions,
  suggestionCountByBankId,
}: {
  bucket: OutstandingBucket;
  selectedIds: string[];
  onToggle: (transactionId: string, checked: boolean) => void;
  onOpenSuggestions?: (transactionId: string) => void;
  suggestionCountByBankId: Map<string, number>;
}) {
  const subtotal = bucket.transactions.reduce((total, transaction) => {
    return total + (bucket.direction === "debit" ? transactionDebit(transaction) : transactionCredit(transaction));
  }, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{bucket.title}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {bucket.transactions.length} item{bucket.transactions.length === 1 ? "" : "s"} · {formatMoney(subtotal)}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {bucket.transactions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
            Nothing outstanding here.
          </div>
        ) : (
          bucket.transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(transaction.id)}
                  onChange={(event) => onToggle(transaction.id, event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <div className="min-w-0 flex-1">
                  <div className="grid grid-cols-[90px_110px_minmax(160px,1fr)_96px_96px] gap-3 text-[11px] text-slate-700">
                    <span className="font-mono text-slate-500">{transaction.date}</span>
                    <span className="truncate font-mono text-slate-600">
                      {transaction.reference || "-"}
                    </span>
                    <span className="truncate">{transaction.narration || "-"}</span>
                    <span className="text-right font-mono">
                      {transactionDebit(transaction) > 0
                        ? formatMoney(transactionDebit(transaction))
                        : "-"}
                    </span>
                    <span className="text-right font-mono">
                      {transactionCredit(transaction) > 0
                        ? formatMoney(transactionCredit(transaction))
                        : "-"}
                    </span>
                  </div>
                  {bucket.source === "bank" && onOpenSuggestions ? (
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">
                        {suggestionCountByBankId.get(transaction.id) || 0} suggestion(s)
                      </span>
                      <button
                        onClick={() => onOpenSuggestions(transaction.id)}
                        className="font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Review possible matches
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ReconciliationStep() {
  const {
    bankTransactions,
    bookTransactions,
    matchGroups,
    unmatchedSuggestions,
    loading,
    startReconciliation,
    saveReconciliationSession,
    createMatch,
    approveMatchesBulk,
    closeReconciliationSession,
    setStep,
    bankSessionId,
    bookSessionId,
    orgId,
    summary,
    reconciliationSession,
    reconSetup,
    activeJob,
    currentUser,
    currentOrganization,
    refreshReconciliation,
    updateOpeningBalances,
    updateTransactionRemovalState,
    createManualEntry,
  } = useReconciliationStore();

  const currencyCode = normalizeCurrencyCode(
    reconciliationSession?.currencyCode || reconSetup?.currencyCode || "GHS"
  );
  const formatMoney = useCallback(
    (value: number) => formatCurrency(value, currencyCode),
    [currencyCode]
  );

  const [selectedBankTx, setSelectedBankTx] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: StatusTone;
    text: string;
    details?: string[];
  } | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    bucket: "bank_credit",
    transDate: new Date().toISOString().slice(0, 10),
    narration: "",
    reference: "",
    amount: "",
  });
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditActivityEntry[]>([]);
  const [openingBalanceDraft, setOpeningBalanceDraft] = useState({
    bankOpenBalance: "0.00",
    bankClosingBalance: "0.00",
    bookOpenBalance: "0.00",
    bookClosingBalance: "0.00",
  });
  const [selectedMatchGroups, setSelectedMatchGroups] = useState<Record<MatchLaneKey, string[]>>({
    cashCreditBankDebit: [],
    cashDebitBankCredit: [],
  });
  const [selectedOutstanding, setSelectedOutstanding] = useState<{
    bankIds: string[];
    bookIds: string[];
  }>({ bankIds: [], bookIds: [] });
  const [selectedRemoved, setSelectedRemoved] = useState<{
    bankIds: string[];
    bookIds: string[];
  }>({ bankIds: [], bookIds: [] });
  const [manualSelections, setManualSelections] = useState<{
    topBankCreditIds: string[];
    topBookDebitIds: string[];
    bottomBookCreditIds: string[];
    bottomBankDebitIds: string[];
  }>({
    topBankCreditIds: [],
    topBookDebitIds: [],
    bottomBookCreditIds: [],
    bottomBankDebitIds: [],
  });
  const [lastRemovedMatches, setLastRemovedMatches] = useState<UndoMatchSnapshot[] | null>(null);
  const [attemptedThresholds, setAttemptedThresholds] = useState<number[]>([]);
  const [isRunningReconcilePass, setIsRunningReconcilePass] = useState(false);
  const isAdmin = currentUser?.role === "admin";
  const isSessionClosed = reconciliationSession?.status === "closed";
  const canEditSession = Boolean(isAdmin && !isSessionClosed);

  const loadAuditEntries = useCallback(async () => {
    if (!currentUser) return;

    setAuditLoading(true);
    try {
      const response = await apiClient.listAuditLogs({ limit: 25 });
      if (!response.success) {
        throw new Error(response.error || "Failed to load audit activity");
      }

      const reconciliationActions = new Set([
        "match.created",
        "match.approved",
        "match.rejected",
        "transactions.removed_from_carryforward",
        "transactions.restored_to_carryforward",
        "reconciliation_session.balances_updated",
        "reconciliation_session.saved",
        "reconciliation_session.closed",
        "reconciliation_session.reopened",
        "report.downloaded",
      ]);

      const entries = (response.data || [])
        .filter((entry: any) => reconciliationActions.has(entry.action))
        .map(
          (entry: any): AuditActivityEntry => ({
            id: String(entry.id),
            action: entry.action,
            actorName: entry.actor_user_name || null,
            actorEmail: entry.actor_user_email || null,
            entityType: entry.entity_type,
            createdAt: entry.created_at,
            metadataJson: entry.metadata_json || null,
          })
        );

      setAuditEntries(entries);
    } catch (error) {
      console.error("Failed to load reconciliation audit entries:", error);
    } finally {
      setAuditLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 8000);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  useEffect(() => {
    if (!summary) return;
    setOpeningBalanceDraft({
      bankOpenBalance: summary.bankOpenBalance.toFixed(2),
      bankClosingBalance: summary.bankClosingBalance.toFixed(2),
      bookOpenBalance: summary.bookOpenBalance.toFixed(2),
      bookClosingBalance: summary.bookClosingBalance.toFixed(2),
    });
  }, [
    summary?.bankOpenBalance,
    summary?.bankClosingBalance,
    summary?.bookOpenBalance,
    summary?.bookClosingBalance,
  ]);

  useEffect(() => {
    void loadAuditEntries();
  }, [loadAuditEntries, reconciliationSession?.id]);

  useEffect(() => {
    if (!initialized && bankSessionId && bookSessionId && orgId) {
      setInitialized(true);
      const hasExistingProgress =
        Boolean(activeJob) ||
        Boolean(summary) ||
        Boolean(reconciliationSession) ||
        matchGroups.length > 0 ||
        bankTransactions.some((transaction) => transaction.matched) ||
        bookTransactions.some((transaction) => transaction.matched);

      if (hasExistingProgress || !isAdmin) {
        refreshReconciliation(orgId).catch((error) => {
          console.error("Failed to load reconciliation:", error);
        });
      }
    }
  }, [
    initialized,
    bankSessionId,
    bookSessionId,
    orgId,
    summary,
    reconciliationSession,
    matchGroups.length,
    bankTransactions,
    bookTransactions,
    activeJob,
    isAdmin,
    refreshReconciliation,
  ]);

  useEffect(() => {
    setAttemptedThresholds([]);
    setSelectedBankTx(null);
    setManualSelections({
      topBankCreditIds: [],
      topBookDebitIds: [],
      bottomBookCreditIds: [],
      bottomBankDebitIds: [],
    });
  }, [reconciliationSession?.id]);

  useEffect(() => {
    setAttemptedThresholds([]);
    setSelectedBankTx(null);
    setManualSelections({
      topBankCreditIds: [],
      topBookDebitIds: [],
      bottomBookCreditIds: [],
      bottomBankDebitIds: [],
    });
  }, [bankSessionId, bookSessionId]);

  const bankById = useMemo(
    () => new Map(bankTransactions.map((transaction) => [transaction.id, transaction])),
    [bankTransactions]
  );
  const bookById = useMemo(
    () => new Map(bookTransactions.map((transaction) => [transaction.id, transaction])),
    [bookTransactions]
  );

  const activeBankTransactions = useMemo(
    () => bankTransactions.filter((transaction) => !transaction.isRemoved),
    [bankTransactions]
  );
  const activeBookTransactions = useMemo(
    () => bookTransactions.filter((transaction) => !transaction.isRemoved),
    [bookTransactions]
  );

  const expandedMatchGroups = useMemo<ExpandedMatchGroup[]>(() => {
    return matchGroups
      .map((group) => {
        const groupBankTransactions = group.bankTransactionIds
          .map((id) => bankById.get(id))
          .filter(Boolean) as Transaction[];
        const groupBookTransactions = group.bookTransactionIds
          .map((id) => bookById.get(id))
          .filter(Boolean) as Transaction[];

        return {
          ...group,
          bankTransactions: groupBankTransactions,
          bookTransactions: groupBookTransactions,
          lane: transactionLane(groupBankTransactions, groupBookTransactions),
        };
      })
      .sort((left, right) => right.confidence - left.confidence);
  }, [matchGroups, bankById, bookById]);

  const matchedSections = useMemo(() => {
    return {
      cashCreditBankDebit: expandedMatchGroups.filter(
        (group) => group.lane === "cashCreditBankDebit"
      ),
      cashDebitBankCredit: expandedMatchGroups.filter(
        (group) => group.lane === "cashDebitBankCredit"
      ),
    };
  }, [expandedMatchGroups]);

  const exactPendingSelections = useMemo(
    () => ({
      cashCreditBankDebit: matchedSections.cashCreditBankDebit
        .filter((group) => group.status === "pending" && group.confidence >= 100)
        .map((group) => group.id),
      cashDebitBankCredit: matchedSections.cashDebitBankCredit
        .filter((group) => group.status === "pending" && group.confidence >= 100)
        .map((group) => group.id),
    }),
    [matchedSections]
  );

  const effectiveSelectedMatchGroups = useMemo(
    () => ({
      cashCreditBankDebit: Array.from(
        new Set([
          ...selectedMatchGroups.cashCreditBankDebit,
          ...exactPendingSelections.cashCreditBankDebit,
        ])
      ),
      cashDebitBankCredit: Array.from(
        new Set([
          ...selectedMatchGroups.cashDebitBankCredit,
          ...exactPendingSelections.cashDebitBankCredit,
        ])
      ),
    }),
    [exactPendingSelections, selectedMatchGroups]
  );

  const buildLaneInteractiveState = useCallback(
    (
      lane: MatchLaneKey,
      groups: ExpandedMatchGroup[],
      selectedIds: string[]
    ) => {
      const leftMatchState = new Map<
        string,
        {
          groupId: string;
          confidence: number;
          status: string;
          selected: boolean;
        }
      >();
      const rightMatchState = new Map<
        string,
        {
          groupId: string;
          confidence: number;
          status: string;
          selected: boolean;
        }
      >();
      const leftRowOrder = new Map<string, number>();
      const rightRowOrder = new Map<string, number>();

      let leftSelectedTotal = 0;
      let rightSelectedTotal = 0;
      let checkedGroupCount = 0;
      let orderIndex = 0;

      for (const group of groups) {
        if (group.status !== "pending") continue;
        const selected = selectedIds.includes(group.id);

        const leftTransactions =
          lane === "cashDebitBankCredit"
            ? group.bankTransactions
            : group.bookTransactions;
        const rightTransactions =
          lane === "cashDebitBankCredit"
            ? group.bookTransactions
            : group.bankTransactions;

        const leftDirection =
          lane === "cashDebitBankCredit" ? "credit" : "credit";
        const rightDirection =
          lane === "cashDebitBankCredit" ? "debit" : "debit";

        for (const transaction of leftTransactions) {
          if (!leftRowOrder.has(transaction.id)) {
            leftRowOrder.set(transaction.id, orderIndex);
          }
          leftMatchState.set(transaction.id, {
            groupId: group.id,
            confidence: group.confidence,
            status: group.status,
            selected,
          });
        }
        for (const transaction of rightTransactions) {
          if (!rightRowOrder.has(transaction.id)) {
            rightRowOrder.set(transaction.id, orderIndex);
          }
          rightMatchState.set(transaction.id, {
            groupId: group.id,
            confidence: group.confidence,
            status: group.status,
            selected,
          });
        }

        if (selected) {
          checkedGroupCount += 1;
          leftSelectedTotal += sumTransactions(leftTransactions, leftDirection);
          rightSelectedTotal += sumTransactions(rightTransactions, rightDirection);
        }

        orderIndex += 1;
      }

      return {
        leftMatchState,
        rightMatchState,
        leftRowOrder,
        rightRowOrder,
        leftSelectedTotal,
        rightSelectedTotal,
        checkedGroupCount,
      };
    },
    []
  );

  const topLaneInteractiveState = useMemo(
    () =>
      buildLaneInteractiveState(
        "cashDebitBankCredit",
        matchedSections.cashDebitBankCredit,
        effectiveSelectedMatchGroups.cashDebitBankCredit
      ),
    [
      buildLaneInteractiveState,
      effectiveSelectedMatchGroups.cashDebitBankCredit,
      matchedSections.cashDebitBankCredit,
    ]
  );

  const bottomLaneInteractiveState = useMemo(
    () =>
      buildLaneInteractiveState(
        "cashCreditBankDebit",
        matchedSections.cashCreditBankDebit,
        effectiveSelectedMatchGroups.cashCreditBankDebit
      ),
    [
      buildLaneInteractiveState,
      effectiveSelectedMatchGroups.cashCreditBankDebit,
      matchedSections.cashCreditBankDebit,
    ]
  );

  const outstandingBuckets = useMemo(() => {
    const activeOutstandingBank = activeBankTransactions.filter(
      (transaction) => !transaction.matched
    );
    const activeOutstandingBook = activeBookTransactions.filter(
      (transaction) => !transaction.matched
    );
    const removedBank = bankTransactions.filter(
      (transaction) => transaction.isRemoved && !transaction.matched
    );
    const removedBook = bookTransactions.filter(
      (transaction) => transaction.isRemoved && !transaction.matched
    );

    return {
      active: [
        {
          id: "book-credit",
          title: "Outstanding Cash Book Credits",
          transactions: activeOutstandingBook.filter((transaction) => transaction.direction === "credit"),
          source: "book" as const,
          direction: "credit" as const,
        },
        {
          id: "bank-debit",
          title: "Outstanding Bank Debits",
          transactions: activeOutstandingBank.filter((transaction) => transaction.direction === "debit"),
          source: "bank" as const,
          direction: "debit" as const,
        },
        {
          id: "book-debit",
          title: "Outstanding Cash Book Debits",
          transactions: activeOutstandingBook.filter((transaction) => transaction.direction === "debit"),
          source: "book" as const,
          direction: "debit" as const,
        },
        {
          id: "bank-credit",
          title: "Outstanding Bank Credits",
          transactions: activeOutstandingBank.filter((transaction) => transaction.direction === "credit"),
          source: "bank" as const,
          direction: "credit" as const,
        },
      ] satisfies OutstandingBucket[],
      removed: [
        {
          id: "removed-book-credit",
          title: "Removed Cash Book Credits",
          transactions: removedBook.filter((transaction) => transaction.direction === "credit"),
          source: "book" as const,
          direction: "credit" as const,
        },
        {
          id: "removed-bank-debit",
          title: "Removed Bank Debits",
          transactions: removedBank.filter((transaction) => transaction.direction === "debit"),
          source: "bank" as const,
          direction: "debit" as const,
        },
        {
          id: "removed-book-debit",
          title: "Removed Cash Book Debits",
          transactions: removedBook.filter((transaction) => transaction.direction === "debit"),
          source: "book" as const,
          direction: "debit" as const,
        },
        {
          id: "removed-bank-credit",
          title: "Removed Bank Credits",
          transactions: removedBank.filter((transaction) => transaction.direction === "credit"),
          source: "bank" as const,
          direction: "credit" as const,
        },
      ] satisfies OutstandingBucket[],
    };
  }, [activeBankTransactions, activeBookTransactions, bankTransactions, bookTransactions]);

  const statementBuckets = useMemo(
    () => buildOutstandingStatementBuckets(bankTransactions, bookTransactions),
    [bankTransactions, bookTransactions]
  );

  useEffect(() => {
    const topBankIds = new Set(statementBuckets.bankCredits.map((tx) => tx.id));
    const topBookIds = new Set(statementBuckets.bookDebits.map((tx) => tx.id));
    const bottomBookIds = new Set(statementBuckets.bookCredits.map((tx) => tx.id));
    const bottomBankIds = new Set(statementBuckets.bankDebits.map((tx) => tx.id));

    setManualSelections((current) => {
      const next = {
        topBankCreditIds: current.topBankCreditIds.filter((id) => topBankIds.has(id)),
        topBookDebitIds: current.topBookDebitIds.filter((id) => topBookIds.has(id)),
        bottomBookCreditIds: current.bottomBookCreditIds.filter((id) => bottomBookIds.has(id)),
        bottomBankDebitIds: current.bottomBankDebitIds.filter((id) => bottomBankIds.has(id)),
      };

      const unchanged =
        next.topBankCreditIds.length === current.topBankCreditIds.length &&
        next.topBookDebitIds.length === current.topBookDebitIds.length &&
        next.bottomBookCreditIds.length === current.bottomBookCreditIds.length &&
        next.bottomBankDebitIds.length === current.bottomBankDebitIds.length;

      return unchanged ? current : next;
    });
  }, [statementBuckets]);

  const reconcileCandidatesByThreshold = useMemo(() => {
    const matchedBankIds = new Set(
      matchGroups.flatMap((group) => group.bankTransactionIds)
    );
    const matchedBookIds = new Set(
      matchGroups.flatMap((group) => group.bookTransactionIds)
    );

    return new Map(
      RECONCILE_THRESHOLD_SEQUENCE.map((threshold) => {
        const upperBound = getThresholdBandUpperBound(threshold);
        const provisionalCandidates = unmatchedSuggestions
          .map((entry) => {
            if (matchedBankIds.has(entry.bankTransactionId)) {
              return null;
            }

            const eligibleSuggestions = entry.suggestions.filter(
              (suggestion) =>
                suggestion.confidence >= threshold &&
                suggestion.confidence < upperBound &&
                !matchedBookIds.has(suggestion.bookTransactionId)
            );

            if (eligibleSuggestions.length !== 1) {
              return null;
            }

            const candidate = eligibleSuggestions[0];
            return {
              bankTransactionId: entry.bankTransactionId,
              bookTransactionId: candidate.bookTransactionId,
              confidence: candidate.confidence,
            };
          })
          .filter(Boolean) as {
          bankTransactionId: string;
          bookTransactionId: string;
          confidence: number;
        }[];

        const bestByBook = new Map<
          string,
          (typeof provisionalCandidates)[number]
        >();
        for (const candidate of provisionalCandidates) {
          const existing = bestByBook.get(candidate.bookTransactionId);
          if (!existing || candidate.confidence > existing.confidence) {
            bestByBook.set(candidate.bookTransactionId, candidate);
          }
        }

        return [threshold, Array.from(bestByBook.values())] as const;
      })
    );
  }, [matchGroups, unmatchedSuggestions]);

  const completedThresholdsFromGroups = useMemo(
    () =>
      Array.from(
        new Set(
          matchGroups
            .map((group) => confidenceBucketForGroup(group.confidence))
            .filter(
              (
                threshold
              ): threshold is (typeof RECONCILE_THRESHOLD_SEQUENCE)[number] =>
                threshold !== null
            )
        )
      ),
    [matchGroups]
  );

  const completedThresholds = useMemo(
    () =>
      Array.from(
        new Set([...attemptedThresholds, ...completedThresholdsFromGroups])
      ).sort((left, right) => right - left),
    [attemptedThresholds, completedThresholdsFromGroups]
  );

  const nextReconcileThreshold = useMemo(
    () =>
      RECONCILE_THRESHOLD_SEQUENCE.find(
        (threshold) => !completedThresholds.includes(threshold)
      ) ?? null,
    [completedThresholds]
  );

  const activeSuggestionThreshold =
    nextReconcileThreshold && nextReconcileThreshold < 100
      ? nextReconcileThreshold
      : null;
  const activeSuggestionUpperBound = activeSuggestionThreshold
    ? getThresholdBandUpperBound(activeSuggestionThreshold)
    : null;
  // Batch mode: only show staged pass matches. Do not pre-highlight future-pass suggestions.
  const showSuggestions = false;

  const suggestionCounts = useMemo(() => {
    if (!showSuggestions || !activeSuggestionThreshold || !activeSuggestionUpperBound) {
      return new Map<string, number>();
    }
    const countMap = new Map<string, number>();
    for (const entry of unmatchedSuggestions) {
      const count = entry.suggestions.filter(
        (suggestion) =>
          suggestion.confidence >= activeSuggestionThreshold &&
          suggestion.confidence < activeSuggestionUpperBound
      ).length;
      if (count > 0) {
        countMap.set(entry.bankTransactionId, count);
      }
    }
    return countMap;
  }, [
    showSuggestions,
    activeSuggestionThreshold,
    activeSuggestionUpperBound,
    unmatchedSuggestions,
  ]);

  const suggestionMaxConfidenceByBankId = useMemo(() => {
    if (!showSuggestions || !activeSuggestionThreshold || !activeSuggestionUpperBound) {
      return new Map<string, number>();
    }
    const confidenceMap = new Map<string, number>();
    for (const entry of unmatchedSuggestions) {
      const maxConfidence = entry.suggestions.reduce((highest, suggestion) => {
        if (
          suggestion.confidence >= activeSuggestionThreshold &&
          suggestion.confidence < activeSuggestionUpperBound
        ) {
          return Math.max(highest, suggestion.confidence || 0);
        }
        return highest;
      }, 0);
      if (maxConfidence > 0) {
        confidenceMap.set(entry.bankTransactionId, maxConfidence);
      }
    }
    return confidenceMap;
  }, [
    showSuggestions,
    activeSuggestionThreshold,
    activeSuggestionUpperBound,
    unmatchedSuggestions,
  ]);

  const suggestionMaxConfidenceByBookId = useMemo(() => {
    if (!showSuggestions || !activeSuggestionThreshold || !activeSuggestionUpperBound) {
      return new Map<string, number>();
    }
    const confidenceMap = new Map<string, number>();
    for (const entry of unmatchedSuggestions) {
      for (const suggestion of entry.suggestions) {
        if (
          suggestion.confidence < activeSuggestionThreshold ||
          suggestion.confidence >= activeSuggestionUpperBound
        ) {
          continue;
        }
        const current = confidenceMap.get(suggestion.bookTransactionId) || 0;
        const nextValue = Math.max(current, suggestion.confidence || 0);
        confidenceMap.set(suggestion.bookTransactionId, nextValue);
      }
    }
    return confidenceMap;
  }, [
    showSuggestions,
    activeSuggestionThreshold,
    activeSuggestionUpperBound,
    unmatchedSuggestions,
  ]);

  const selectedBankTransaction = useMemo(
    () =>
      selectedBankTx
        ? bankTransactions.find((transaction) => transaction.id === selectedBankTx) || null
        : null,
    [selectedBankTx, bankTransactions]
  );

  const selectedSuggestionConfidenceByBookId = useMemo(() => {
    const confidenceMap = new Map<string, number>();
    if (
      !selectedBankTx ||
      !showSuggestions ||
      !activeSuggestionThreshold ||
      !activeSuggestionUpperBound
    ) {
      return confidenceMap;
    }

    const suggestionEntry = unmatchedSuggestions.find(
      (entry) => entry.bankTransactionId === selectedBankTx
    );
    if (!suggestionEntry) return confidenceMap;

    for (const suggestion of suggestionEntry.suggestions) {
      if (
        suggestion.confidence < activeSuggestionThreshold ||
        suggestion.confidence >= activeSuggestionUpperBound
      ) {
        continue;
      }
      const current = confidenceMap.get(suggestion.bookTransactionId) || 0;
      confidenceMap.set(
        suggestion.bookTransactionId,
        Math.max(current, suggestion.confidence || 0)
      );
    }

    return confidenceMap;
  }, [
    selectedBankTx,
    showSuggestions,
    activeSuggestionThreshold,
    activeSuggestionUpperBound,
    unmatchedSuggestions,
  ]);

  const nextReconcileCandidates = useMemo(() => {
    if (!nextReconcileThreshold) return [];
    return reconcileCandidatesByThreshold.get(nextReconcileThreshold) || [];
  }, [nextReconcileThreshold, reconcileCandidatesByThreshold]);

  const hasPendingMatchGroups = useMemo(
    () => matchGroups.some((group) => group.status === "pending"),
    [matchGroups]
  );

  // Manual mode should start only after pass work is exhausted and there are no pending staged matches left to review/remove.
  const manualModeEnabled =
    nextReconcileThreshold === null && canEditSession && !hasPendingMatchGroups;

  const toggleManualSelection = useCallback(
    (
      key:
        | "topBankCreditIds"
        | "topBookDebitIds"
        | "bottomBookCreditIds"
        | "bottomBankDebitIds",
      transactionId: string,
      checked: boolean
    ) => {
      setManualSelections((current) => {
        const existing = current[key];
        const nextValues = checked
          ? existing.includes(transactionId)
            ? existing
            : [...existing, transactionId]
          : existing.filter((value) => value !== transactionId);
        return {
          ...current,
          [key]: nextValues,
        };
      });
    },
    []
  );

  const manualSelectionSets = useMemo(
    () => ({
      topBankCreditIds: new Set(manualSelections.topBankCreditIds),
      topBookDebitIds: new Set(manualSelections.topBookDebitIds),
      bottomBookCreditIds: new Set(manualSelections.bottomBookCreditIds),
      bottomBankDebitIds: new Set(manualSelections.bottomBankDebitIds),
    }),
    [manualSelections]
  );

  const manualTopLeftSelectedTotal = useMemo(
    () =>
      statementBuckets.bankCredits.reduce(
        (total, transaction) =>
          total +
          (manualSelectionSets.topBankCreditIds.has(transaction.id)
            ? transactionCredit(transaction)
            : 0),
        0
      ),
    [manualSelectionSets.topBankCreditIds, statementBuckets.bankCredits]
  );
  const manualTopRightSelectedTotal = useMemo(
    () =>
      statementBuckets.bookDebits.reduce(
        (total, transaction) =>
          total +
          (manualSelectionSets.topBookDebitIds.has(transaction.id)
            ? transactionDebit(transaction)
            : 0),
        0
      ),
    [manualSelectionSets.topBookDebitIds, statementBuckets.bookDebits]
  );
  const manualBottomLeftSelectedTotal = useMemo(
    () =>
      statementBuckets.bookCredits.reduce(
        (total, transaction) =>
          total +
          (manualSelectionSets.bottomBookCreditIds.has(transaction.id)
            ? transactionCredit(transaction)
            : 0),
        0
      ),
    [manualSelectionSets.bottomBookCreditIds, statementBuckets.bookCredits]
  );
  const manualBottomRightSelectedTotal = useMemo(
    () =>
      statementBuckets.bankDebits.reduce(
        (total, transaction) =>
          total +
          (manualSelectionSets.bottomBankDebitIds.has(transaction.id)
            ? transactionDebit(transaction)
            : 0),
        0
      ),
    [manualSelectionSets.bottomBankDebitIds, statementBuckets.bankDebits]
  );
  const manualTopCheckedCount =
    manualSelections.topBankCreditIds.length +
    manualSelections.topBookDebitIds.length;
  const manualBottomCheckedCount =
    manualSelections.bottomBookCreditIds.length +
    manualSelections.bottomBankDebitIds.length;

  const reviewingTopLane = selectedBankTransaction?.direction === "credit";
  const reviewingBottomLane = selectedBankTransaction?.direction === "debit";

  useEffect(() => {
    if (
      exactPendingSelections.cashCreditBankDebit.length === 0 &&
      exactPendingSelections.cashDebitBankCredit.length === 0
    ) {
      return;
    }

    setSelectedMatchGroups((current) => ({
      cashCreditBankDebit: Array.from(
        new Set([
          ...current.cashCreditBankDebit,
          ...exactPendingSelections.cashCreditBankDebit,
        ])
      ),
      cashDebitBankCredit: Array.from(
        new Set([
          ...current.cashDebitBankCredit,
          ...exactPendingSelections.cashDebitBankCredit,
        ])
      ),
    }));
  }, [
    exactPendingSelections.cashCreditBankDebit.join("|"),
    exactPendingSelections.cashDebitBankCredit.join("|"),
  ]);

  const activityCounts = useMemo(() => {
    return {
      all: auditEntries.length,
      created: auditEntries.filter((entry) => getActivityCategory(entry) === "created").length,
      approved: auditEntries.filter((entry) => getActivityCategory(entry) === "approved").length,
      removed: auditEntries.filter((entry) => getActivityCategory(entry) === "removed").length,
    };
  }, [auditEntries]);

  const filteredAuditEntries = useMemo(
    () =>
      auditEntries.filter((entry) =>
        activityFilter === "all" ? true : getActivityCategory(entry) === activityFilter
      ),
    [auditEntries, activityFilter]
  );

  const balanceDirty = useMemo(() => {
    const bankValue = Number(openingBalanceDraft.bankOpenBalance || 0);
    const bankClosingValue = Number(openingBalanceDraft.bankClosingBalance || 0);
    const bookValue = Number(openingBalanceDraft.bookOpenBalance || 0);
    const bookClosingValue = Number(openingBalanceDraft.bookClosingBalance || 0);
    return (
      Math.abs(bankValue - Number(summary?.bankOpenBalance || 0)) > 0.009 ||
      Math.abs(bankClosingValue - Number(summary?.bankClosingBalance || 0)) > 0.009 ||
      Math.abs(bookValue - Number(summary?.bookOpenBalance || 0)) > 0.009 ||
      Math.abs(bookClosingValue - Number(summary?.bookClosingBalance || 0)) > 0.009
    );
  }, [
    openingBalanceDraft,
    summary?.bankOpenBalance,
    summary?.bankClosingBalance,
    summary?.bookOpenBalance,
    summary?.bookClosingBalance,
  ]);

  const toggleSelection = (
    current: string[],
    id: string,
    checked: boolean
  ) => {
    if (checked) {
      return current.includes(id) ? current : [...current, id];
    }
    return current.filter((value) => value !== id);
  };

  const setLaneSelection = (lane: MatchLaneKey, ids: string[]) => {
    setSelectedMatchGroups((current) => ({ ...current, [lane]: ids }));
  };

  const handleCreateSuggestedMatch = async (bookTxId: string) => {
    if (!isAdmin || !selectedBankTx || !selectedBankTransaction) {
      setStatusMessage({
        tone: "info",
        text: "Only admins can stage discretionary matches.",
      });
      return;
    }

    const confidence =
      selectedSuggestionConfidenceByBookId.get(bookTxId) || 0;

    if (confidence <= 0) {
      setStatusMessage({
        tone: "info",
        text: "That row is not currently in the reviewed suggestion set.",
      });
      return;
    }

    try {
      await createMatch([selectedBankTx], [bookTxId], confidence);

      const createdGroup = useReconciliationStore
        .getState()
        .matchGroups.find(
          (group) =>
            group.status === "pending" &&
            group.bankTransactionIds.length === 1 &&
            group.bookTransactionIds.length === 1 &&
            group.bankTransactionIds[0] === selectedBankTx &&
            group.bookTransactionIds[0] === bookTxId
        );

      const lane: MatchLaneKey =
        selectedBankTransaction.direction === "credit"
          ? "cashDebitBankCredit"
          : "cashCreditBankDebit";

      if (createdGroup?.id) {
        setLaneSelection(lane, Array.from(new Set([...selectedMatchGroups[lane], createdGroup.id])));
      }

      setSelectedBankTx(null);
      await loadAuditEntries();
      setStatusMessage({
        tone: "success",
        text: `Staged a ${confidence}% side-by-side match inside the worksheet.`,
      });
    } catch (error) {
      console.error("Failed to create suggested match:", error);
      setStatusMessage({
        tone: "error",
        text: "Failed to stage that suggested match.",
      });
    }
  };

  const handleUndoRemovedMatches = async () => {
    if (!lastRemovedMatches || lastRemovedMatches.length === 0) return;

    try {
      for (const snapshot of lastRemovedMatches) {
        await createMatch(
          snapshot.bankTransactionIds,
          snapshot.bookTransactionIds,
          snapshot.confidence
        );
      }
      await loadAuditEntries();
      setLastRemovedMatches(null);
      setStatusMessage({
        tone: "success",
        text: "Removed matches restored as pending review items.",
      });
    } catch (error) {
      console.error("Failed to undo removed matches:", error);
      setStatusMessage({ tone: "error", text: "Could not restore those matches." });
    }
  };

  const handleRemoveSelectedMatches = async (lane: MatchLaneKey) => {
    const selectedIds = effectiveSelectedMatchGroups[lane];
    if (!selectedIds.length) return;

    try {
      const result = await approveMatchesBulk(selectedIds);
      await loadAuditEntries();
      setLaneSelection(lane, []);
      setSelectedBankTx(null);

      if (result.failed.length > 0 && result.approved.length === 0) {
        setStatusMessage({
          tone: "error",
          text: "Could not remove the checked matches. Please retry.",
        });
        return;
      }

      setStatusMessage({
        tone: result.failed.length > 0 ? "info" : "success",
        text:
          result.failed.length > 0
            ? `Removed ${result.approved.length} match${
                result.approved.length === 1 ? "" : "es"
              }, ${result.failed.length} failed.`
            : `Removed ${result.approved.length} checked match${
                result.approved.length === 1 ? "" : "es"
              } from this lane.`,
      });
    } catch (error) {
      console.error("Failed to remove checked matches:", error);
      setStatusMessage({ tone: "error", text: "Failed to remove checked matches." });
    }
  };

  const handleSaveOpeningBalances = async () => {
    if (!canEditSession) {
      setStatusMessage({
        tone: "info",
        text: "This month is closed. Balances are read-only.",
      });
      return;
    }
    try {
      await updateOpeningBalances({
        bankOpenBalance: Number(openingBalanceDraft.bankOpenBalance || 0),
        bankClosingBalance: Number(openingBalanceDraft.bankClosingBalance || 0),
        bookOpenBalance: Number(openingBalanceDraft.bookOpenBalance || 0),
        bookClosingBalance: Number(openingBalanceDraft.bookClosingBalance || 0),
        currencyCode,
      });
      await loadAuditEntries();
      setStatusMessage({
        tone: "success",
        text: "Opening and closing balances updated, and adjusted balances were recalculated.",
      });
    } catch (error) {
      console.error("Failed to update opening balances:", error);
      setStatusMessage({
        tone: "error",
        text: "Failed to update opening balances.",
      });
    }
  };

  const handleRemoveOutstanding = async () => {
    if (selectedOutstanding.bankIds.length === 0 && selectedOutstanding.bookIds.length === 0) {
      return;
    }

    try {
      await updateTransactionRemovalState({
        bankTransactionIds: selectedOutstanding.bankIds,
        bookTransactionIds: selectedOutstanding.bookIds,
        removed: true,
      });
      await loadAuditEntries();
      setSelectedOutstanding({ bankIds: [], bookIds: [] });
      setStatusMessage({
        tone: "success",
        text: "Selected outstanding items were removed from carryforward totals.",
      });
    } catch (error) {
      console.error("Failed to remove outstanding items:", error);
      setStatusMessage({ tone: "error", text: "Failed to remove outstanding items." });
    }
  };

  const handleRestoreRemoved = async () => {
    if (selectedRemoved.bankIds.length === 0 && selectedRemoved.bookIds.length === 0) {
      return;
    }

    try {
      await updateTransactionRemovalState({
        bankTransactionIds: selectedRemoved.bankIds,
        bookTransactionIds: selectedRemoved.bookIds,
        removed: false,
      });
      await loadAuditEntries();
      setSelectedRemoved({ bankIds: [], bookIds: [] });
      setStatusMessage({
        tone: "success",
        text: "Selected carryforward items were restored.",
      });
    } catch (error) {
      console.error("Failed to restore removed items:", error);
      setStatusMessage({ tone: "error", text: "Failed to restore removed items." });
    }
  };

  const handleCompleteSession = async () => {
    const shouldClose = window.confirm(
      "Are you sure you want to close this account period? This locks the month for editing and carries the remaining outstanding items into the next period."
    );

    if (!shouldClose) {
      return;
    }

    try {
      await closeReconciliationSession();
      await loadAuditEntries();
      setStatusMessage({
        tone: "success",
        text: "Month closed. We opened the next period with the carried outstanding rows and closing balances.",
      });
    } catch (error) {
      console.error("Failed to close reconciliation session:", error);
      setStatusMessage({ tone: "error", text: "Failed to close the month." });
    }
  };

  const handleDownloadReport = async () => {
    setDownloadingReport(true);
    try {
      let nextSummary = summary;
      let nextSession = reconciliationSession;
      let nextOrganization = currentOrganization;
      let nextBuckets = statementBuckets;

      if (!nextSummary) {
        await refreshReconciliation(orgId || undefined);
        const refreshedState = useReconciliationStore.getState();
        nextSummary = refreshedState.summary;
        nextSession = refreshedState.reconciliationSession;
        nextOrganization = refreshedState.currentOrganization;
        nextBuckets = buildOutstandingStatementBuckets(
          refreshedState.bankTransactions,
          refreshedState.bookTransactions
        );
      }

      if (!nextSummary) {
        throw new Error(
          "The report preview is not ready yet. Please reopen the recon once the worksheet finishes loading."
        );
      }

      openReconciliationReportPreview({
        accountName: nextSession?.accountName || "Account not set",
        accountNumber:
          nextSession?.accountNumber || reconSetup?.accountNumber || null,
        periodMonth:
          nextSummary.periodMonth ||
          nextSession?.periodMonth ||
          "Period pending",
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
        summary: nextSummary,
        bankCredits: nextBuckets.bankCredits,
        bookDebits: nextBuckets.bookDebits,
        bookCredits: nextBuckets.bookCredits,
        bankDebits: nextBuckets.bankDebits,
      });

      setStatusMessage({
        tone: "success",
        text: "PDF preview opened. Use Print / Save PDF from the preview window.",
      });
    } catch (error) {
      console.error("Failed to open report preview:", error);
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to open the report preview.",
      });
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleSaveSession = async () => {
    try {
      await saveReconciliationSession();
      await loadAuditEntries();
      setStatusMessage({
        tone: "success",
        text: "Progress saved. You can leave this recon and continue later.",
      });
    } catch (error) {
      console.error("Failed to save reconciliation session:", error);
      setStatusMessage({
        tone: "error",
        text: "Could not save this reconciliation session.",
      });
    }
  };

  const bucketOptions = [
    { value: "bank_credit", label: "Bank Credit" },
    { value: "bank_debit", label: "Bank Debit" },
    { value: "book_debit", label: "Cash Book Debit" },
    { value: "book_credit", label: "Cash Book Credit" },
  ];

  const handleSubmitManualEntry = async () => {
    if (!canEditSession) {
      setStatusMessage({
        tone: "info",
        text: "This month is closed. You cannot add records.",
      });
      return;
    }

    const amountValue = Number(manualEntry.amount);
    if (!manualEntry.transDate) {
      setStatusMessage({ tone: "error", text: "Please provide a transaction date." });
      return;
    }
    if (!manualEntry.narration.trim()) {
      setStatusMessage({ tone: "error", text: "Narration is required." });
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setStatusMessage({ tone: "error", text: "Amount must be greater than zero." });
      return;
    }

    try {
      await createManualEntry({
        bucket: manualEntry.bucket as
          | "bank_debit"
          | "bank_credit"
          | "book_debit"
          | "book_credit",
        transDate: manualEntry.transDate,
        narration: manualEntry.narration.trim(),
        reference: manualEntry.reference.trim() || null,
        amount: amountValue,
      });
      setShowManualEntry(false);
      setManualEntry((current) => ({
        ...current,
        narration: "",
        reference: "",
        amount: "",
      }));
      setStatusMessage({
        tone: "success",
        text: "Manual entry added to the selected bucket.",
      });
    } catch (error) {
      console.error("Failed to add manual entry:", error);
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Failed to add manual entry.",
      });
    }
  };

  const handleRunNextReconcilePass = async () => {
    if (!canEditSession) {
      setStatusMessage({
        tone: "info",
        text: "This month is closed. Reconciliation is view-only.",
      });
      return;
    }

    const formatMatchSummary = (
      candidates: { confidence: number }[]
    ): string[] => {
      const buckets = new Map<number, number>();

      candidates.forEach((candidate) => {
        const bucket = confidenceBucketForGroup(candidate.confidence);
        if (!bucket) return;
        buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
      });

      return Array.from(buckets.entries())
        .sort((left, right) => right[0] - left[0])
        .map(
          ([bucket, count]) =>
            `${count} match${count === 1 ? "" : "es"} at ${bucket}% confidence`
        );
    };

    const notifyNoMatchesFound = (message?: string) => {
      const resolvedMessage = message || "No matches found.";
      setStatusMessage({
        tone: "info",
        text: resolvedMessage,
        details: nextReconcileThreshold
          ? [`Pass: ${nextReconcileThreshold}% and above`]
          : undefined,
      });
    };

    if (!isAdmin) {
      setStatusMessage({
        tone: "info",
        text: "Only admins can run additional reconciliation passes.",
      });
      return;
    }

    if (!orgId) {
      setStatusMessage({
        tone: "error",
        text: "Organization context is missing. Please refresh and try again.",
      });
      return;
    }

    if (!nextReconcileThreshold) {
      notifyNoMatchesFound();
      return;
    }

    setIsRunningReconcilePass(true);
    setAttemptedThresholds((current) =>
      Array.from(new Set([...current, nextReconcileThreshold])).sort(
        (left, right) => right - left
      )
    );

    if (nextReconcileCandidates.length === 0) {
      notifyNoMatchesFound("No matches found in this pass.");
      setIsRunningReconcilePass(false);
      return;
    }

    try {
      useReconciliationStore.setState({ loading: true, error: null });

      const creationResults: Array<{
        success: boolean;
        data?: { id?: string };
        error?: string;
      }> = [];

      for (const candidate of nextReconcileCandidates) {
        const result = await apiClient.createMatch(
          orgId,
          [candidate.bankTransactionId],
          [candidate.bookTransactionId],
          candidate.confidence
        );
        if (!result.success) {
          throw new Error(
            result.error || "Failed to stage the next reconciliation pass"
          );
        }
        creationResults.push(result);
      }

      const nextSelections: Record<MatchLaneKey, string[]> = {
        cashCreditBankDebit: [],
        cashDebitBankCredit: [],
      };

      creationResults.forEach((result, index) => {
        const groupId = result.data?.id;
        const bankTx = bankById.get(nextReconcileCandidates[index]?.bankTransactionId);
        if (!groupId || !bankTx) return;
        const lane: MatchLaneKey =
          bankTx.direction === "credit"
            ? "cashDebitBankCredit"
            : "cashCreditBankDebit";
        nextSelections[lane].push(String(groupId));
      });

      await refreshReconciliation(orgId);
      setSelectedMatchGroups((current) => ({
        cashCreditBankDebit: Array.from(
          new Set([
            ...current.cashCreditBankDebit,
            ...nextSelections.cashCreditBankDebit,
          ])
        ),
        cashDebitBankCredit: Array.from(
          new Set([
            ...current.cashDebitBankCredit,
            ...nextSelections.cashDebitBankCredit,
          ])
        ),
      }));
      await loadAuditEntries();
      setSelectedBankTx(null);
      const matchSummary = formatMatchSummary(nextReconcileCandidates);
      setStatusMessage({
        tone: "success",
        text: `Matches found and highlighted in the quadrants.`,
        details:
          matchSummary.length > 0
            ? matchSummary
            : [
                `${nextReconcileCandidates.length} match${
                  nextReconcileCandidates.length === 1 ? "" : "es"
                } highlighted`,
              ],
      });
    } catch (error) {
      console.error("Failed to run next reconciliation pass:", error);
      useReconciliationStore.setState({ loading: false });
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to stage the next reconciliation pass.",
      });
    } finally {
      setIsRunningReconcilePass(false);
    }
  };

  if (!bankSessionId || !bookSessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-amber-600" />
          <h2 className="text-xl font-semibold text-slate-900">Missing files</h2>
          <p className="mt-2 text-sm text-slate-600">
            Please upload both the bank statement and the cash book before opening reconciliation.
          </p>
          <button
            onClick={() => setStep("upload")}
            className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to upload
          </button>
        </div>
      </div>
    );
  }

  if (loading && bankTransactions.length === 0 && bookTransactions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <Loader className="mx-auto mb-4 h-12 w-12 animate-spin text-blue-600" />
          <h2 className="text-xl font-semibold text-slate-900">Running reconciliation...</h2>
          <p className="mt-2 text-sm text-slate-600">
            {activeJob?.message || "Preparing matched and unreconciled lanes..."}
          </p>
          {typeof activeJob?.progressPercent === "number" && activeJob.progressPercent > 0 ? (
            <p className="mt-2 text-xs text-slate-500">{activeJob.progressPercent}% complete</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="sticky top-16 z-30 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-6 py-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold text-slate-900">Recon Workspace</h1>
            </div>
            <div className="w-full overflow-x-auto xl:w-auto xl:justify-self-end">
              <div className="flex min-w-max items-center gap-2 whitespace-nowrap">
              <button
                onClick={() => setShowManualEntry(true)}
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
                onClick={handleCompleteSession}
                disabled={!canEditSession}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  !canEditSession
                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                    : "bg-rose-600 text-white hover:bg-rose-700"
                }`}
              >
                {reconciliationSession?.status === "closed" ? "Month Closed" : "Close Month"}
              </button>
              <button
                onClick={handleDownloadReport}
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
                onClick={handleRunNextReconcilePass}
                disabled={
                  loading ||
                  isRunningReconcilePass ||
                  !nextReconcileThreshold ||
                  !canEditSession
                }
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  loading ||
                  isRunningReconcilePass ||
                  !nextReconcileThreshold ||
                  !canEditSession
                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {isRunningReconcilePass ? (
                  <ReconcileProgressCue label="Reconciling..." />
                ) : (
                  nextReconcileThreshold
                    ? `Reconcile ${nextReconcileThreshold}%`
                    : "Reconcile"
                )}
              </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="mx-auto max-w-[1600px] space-y-8 px-6 py-8">
        {showManualEntry ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 px-4">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Manual Entry
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Add a single transaction
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Choose the bucket, enter the transaction details, and we will
                    keep you in the same reconciliation session.
                  </p>
                </div>
                <button
                  onClick={() => setShowManualEntry(false)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Bucket
                  <select
                    value={manualEntry.bucket}
                    onChange={(event) =>
                      setManualEntry((current) => ({
                        ...current,
                        bucket: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    {bucketOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Transaction Date
                  <input
                    type="date"
                    value={manualEntry.transDate}
                    onChange={(event) =>
                      setManualEntry((current) => ({
                        ...current,
                        transDate: event.target.value,
                      }))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Narration
                  <input
                    type="text"
                    value={manualEntry.narration}
                    onChange={(event) =>
                      setManualEntry((current) => ({
                        ...current,
                        narration: event.target.value,
                      }))
                    }
                    placeholder="e.g. Fuel purchase"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Reference (optional)
                  <input
                    type="text"
                    value={manualEntry.reference}
                    onChange={(event) =>
                      setManualEntry((current) => ({
                        ...current,
                        reference: event.target.value,
                      }))
                    }
                    placeholder="REF00012"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-700">
                  Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualEntry.amount}
                    onChange={(event) =>
                      setManualEntry((current) => ({
                        ...current,
                        amount: event.target.value,
                      }))
                    }
                    placeholder="0.00"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
                  />
                </label>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => setStep("upload")}
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Upload file instead
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowManualEntry(false)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitManualEntry}
                    className="rounded-full bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Add Entry
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {statusMessage ? (
          <div className="fixed right-6 top-24 z-[70] w-[min(420px,calc(100vw-3rem))]">
            <div className={`rounded-2xl border px-4 py-3 text-sm shadow-lg ${statusToneClass(statusMessage.tone)}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-current">
                    {statusMessage.tone === "success" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : statusMessage.tone === "error" ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Info className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <p className="font-semibold">{statusMessage.text}</p>
                    {statusMessage.details && statusMessage.details.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {statusMessage.details.map((detail) => (
                          <span
                            key={detail}
                            className="rounded-full border border-current/20 bg-white/60 px-3 py-1 text-[11px] font-semibold"
                          >
                            {detail}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <button
                  onClick={() => setStatusMessage(null)}
                  className="rounded-full border border-current px-2.5 py-1 text-xs font-semibold"
                >
                  Dismiss
                </button>
              </div>
              {lastRemovedMatches && lastRemovedMatches.length > 0 ? (
                <button
                  onClick={handleUndoRemovedMatches}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-current px-3 py-1 text-xs font-semibold"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Undo removed matches
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <WorkbookReconciliationStatement
          title="Recon Workspace"
          subtitle="This is the live reconciliation worksheet. All review now happens inside these same quadrants: exact matches are checked in place, possible matches are reviewed side by side, and removed rows disappear here immediately so the quadrants become the outstanding view."
          accountName={reconciliationSession?.accountName || "Account not set"}
          accountNumber={
            reconciliationSession?.accountNumber || reconSetup?.accountNumber || null
          }
          periodMonth={summary?.periodMonth || reconciliationSession?.periodMonth || "Period pending"}
          bookOpenBalance={summary?.bookOpenBalance || 0}
          bookClosingBalance={summary?.bookClosingBalance || 0}
          bankOpenBalance={summary?.bankOpenBalance || 0}
          bankClosingBalance={summary?.bankClosingBalance || 0}
          currencyCode={currencyCode}
          bankCredits={statementBuckets.bankCredits}
          bookDebits={statementBuckets.bookDebits}
          bookCredits={statementBuckets.bookCredits}
          bankDebits={statementBuckets.bankDebits}
          outstandingOnly
          hideHeaderText
          hideAccountNote
          topLaneInteractive={{
            leftBucketInteractive: {
              matchStateByTransactionId: topLaneInteractiveState.leftMatchState,
              rowOrderByTransactionId: topLaneInteractiveState.leftRowOrder,
              manualSelectedTransactionIds: manualModeEnabled
                ? manualSelectionSets.topBankCreditIds
                : undefined,
              onToggleManualSelection: manualModeEnabled
                ? (transactionId, checked) =>
                    toggleManualSelection(
                      "topBankCreditIds",
                      transactionId,
                      checked
                    )
                : undefined,
              activeReviewTransactionId: reviewingTopLane ? selectedBankTx : null,
              onToggleGroup: (groupId, checked) =>
                setLaneSelection(
                  "cashDebitBankCredit",
                  toggleSelection(
                    selectedMatchGroups.cashDebitBankCredit,
                    groupId,
                    checked
                  )
                ),
              suggestionCountByTransactionId: suggestionCounts,
              suggestionConfidenceByTransactionId: suggestionMaxConfidenceByBankId,
              reviewedSuggestionConfidenceByTransactionId: undefined,
              onReviewSuggestions: (transactionId) => {
                setSelectedBankTx((current) =>
                  current === transactionId ? null : transactionId
                );
              },
            },
            rightBucketInteractive: {
              matchStateByTransactionId: topLaneInteractiveState.rightMatchState,
              rowOrderByTransactionId: topLaneInteractiveState.rightRowOrder,
              manualSelectedTransactionIds: manualModeEnabled
                ? manualSelectionSets.topBookDebitIds
                : undefined,
              onToggleManualSelection: manualModeEnabled
                ? (transactionId, checked) =>
                    toggleManualSelection(
                      "topBookDebitIds",
                      transactionId,
                      checked
                    )
                : undefined,
              suggestionConfidenceByTransactionId: showSuggestions
                ? suggestionMaxConfidenceByBookId
                : undefined,
              reviewedSuggestionConfidenceByTransactionId: reviewingTopLane
                ? selectedSuggestionConfidenceByBookId
                : undefined,
              onCreateSuggestedMatch: reviewingTopLane
                ? handleCreateSuggestedMatch
                : undefined,
              canCreateSuggestedMatch: Boolean(canEditSession && reviewingTopLane),
              onToggleGroup: (groupId, checked) =>
                setLaneSelection(
                  "cashDebitBankCredit",
                  toggleSelection(
                    selectedMatchGroups.cashDebitBankCredit,
                    groupId,
                    checked
                  )
                ),
            },
            leftSelectedTotal: manualModeEnabled
              ? manualTopLeftSelectedTotal
              : topLaneInteractiveState.leftSelectedTotal,
            rightSelectedTotal: manualModeEnabled
              ? manualTopRightSelectedTotal
              : topLaneInteractiveState.rightSelectedTotal,
            checkedGroupCount: manualModeEnabled
              ? manualTopCheckedCount
              : topLaneInteractiveState.checkedGroupCount,
            onRemoveSelected: manualModeEnabled
              ? undefined
              : () => handleRemoveSelectedMatches("cashDebitBankCredit"),
            canEdit: canEditSession,
          }}
          bottomLaneInteractive={{
            leftBucketInteractive: {
              matchStateByTransactionId: bottomLaneInteractiveState.leftMatchState,
              rowOrderByTransactionId: bottomLaneInteractiveState.leftRowOrder,
              manualSelectedTransactionIds: manualModeEnabled
                ? manualSelectionSets.bottomBookCreditIds
                : undefined,
              onToggleManualSelection: manualModeEnabled
                ? (transactionId, checked) =>
                    toggleManualSelection(
                      "bottomBookCreditIds",
                      transactionId,
                      checked
                    )
                : undefined,
              suggestionConfidenceByTransactionId: showSuggestions
                ? suggestionMaxConfidenceByBookId
                : undefined,
              reviewedSuggestionConfidenceByTransactionId: reviewingBottomLane
                ? selectedSuggestionConfidenceByBookId
                : undefined,
              onCreateSuggestedMatch: reviewingBottomLane
                ? handleCreateSuggestedMatch
                : undefined,
              canCreateSuggestedMatch: Boolean(canEditSession && reviewingBottomLane),
              onToggleGroup: (groupId, checked) =>
                setLaneSelection(
                  "cashCreditBankDebit",
                  toggleSelection(
                    selectedMatchGroups.cashCreditBankDebit,
                    groupId,
                    checked
                  )
                ),
            },
            rightBucketInteractive: {
              matchStateByTransactionId: bottomLaneInteractiveState.rightMatchState,
              rowOrderByTransactionId: bottomLaneInteractiveState.rightRowOrder,
              manualSelectedTransactionIds: manualModeEnabled
                ? manualSelectionSets.bottomBankDebitIds
                : undefined,
              onToggleManualSelection: manualModeEnabled
                ? (transactionId, checked) =>
                    toggleManualSelection(
                      "bottomBankDebitIds",
                      transactionId,
                      checked
                    )
                : undefined,
              activeReviewTransactionId: reviewingBottomLane ? selectedBankTx : null,
              onToggleGroup: (groupId, checked) =>
                setLaneSelection(
                  "cashCreditBankDebit",
                  toggleSelection(
                    selectedMatchGroups.cashCreditBankDebit,
                    groupId,
                    checked
                  )
                ),
              suggestionCountByTransactionId: suggestionCounts,
              suggestionConfidenceByTransactionId: suggestionMaxConfidenceByBankId,
              onReviewSuggestions: (transactionId) => {
                setSelectedBankTx((current) =>
                  current === transactionId ? null : transactionId
                );
              },
            },
            leftSelectedTotal: manualModeEnabled
              ? manualBottomLeftSelectedTotal
              : bottomLaneInteractiveState.leftSelectedTotal,
            rightSelectedTotal: manualModeEnabled
              ? manualBottomRightSelectedTotal
              : bottomLaneInteractiveState.rightSelectedTotal,
            checkedGroupCount: manualModeEnabled
              ? manualBottomCheckedCount
              : bottomLaneInteractiveState.checkedGroupCount,
            onRemoveSelected: manualModeEnabled
              ? undefined
              : () => handleRemoveSelectedMatches("cashCreditBankDebit"),
            canEdit: canEditSession,
          }}
          balanceEditorConfig={{
            canEdit: canEditSession,
            dirty: balanceDirty,
            values: openingBalanceDraft,
            onChange: (field, value) =>
              setOpeningBalanceDraft((current) => ({
                ...current,
                [field]: value,
              })),
            onSave: handleSaveOpeningBalances,
          }}
        />

      </div>

    </div>
  );
}
