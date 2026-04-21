"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import { Transaction } from "@/store/reconciliation-api";
import { formatCurrency, normalizeCurrencyCode } from "@/lib/currency";

const formatMoney = (value: number, currencyCode?: string | null) =>
  formatCurrency(value, normalizeCurrencyCode(currencyCode));

const transactionDebit = (transaction: Transaction) =>
  Number(transaction.debitAmount || 0);
const transactionCredit = (transaction: Transaction) =>
  Number(transaction.creditAmount || 0);

const compareTransactions = (left: Transaction, right: Transaction) => {
  const dateCompare = String(left.date || "").localeCompare(
    String(right.date || "")
  );
  if (dateCompare !== 0) return dateCompare;

  const referenceCompare = String(left.reference || "").localeCompare(
    String(right.reference || "")
  );
  if (referenceCompare !== 0) return referenceCompare;

  return String(left.narration || "").localeCompare(
    String(right.narration || "")
  );
};

const sortTransactions = (
  transactions: Transaction[],
  rowOrderByTransactionId?: Map<string, number>
) =>
  [...transactions].sort((left, right) => {
    const leftOrder = rowOrderByTransactionId?.get(left.id);
    const rightOrder = rowOrderByTransactionId?.get(right.id);

    if (leftOrder !== undefined && rightOrder !== undefined && leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    if (leftOrder !== undefined && rightOrder === undefined) {
      return -1;
    }
    if (leftOrder === undefined && rightOrder !== undefined) {
      return 1;
    }

    return compareTransactions(left, right);
  });

const PAGE_SIZE_OPTIONS = [5, 10, 25, 100] as const;

const normalizeSearchValue = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9.:-]/g, "");

function transactionMatchesQuery(
  transaction: Transaction,
  direction: BucketDirection,
  query: string,
  currencyCode?: string | null
) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;

  const amount = amountForDirection(transaction, direction);
  const rawFields = [
    transaction.date || "",
    transaction.reference || "",
    transaction.narration || "",
    transaction.isCarryforward ? "carryforward" : "",
    amount > 0 ? formatMoney(amount, currencyCode) : "",
    amount > 0 ? amount.toFixed(2) : "",
    amount > 0 ? String(amount) : "",
  ];

  const loweredFields = rawFields.map((value) => value.toLowerCase());
  const normalizedFields = rawFields.map(normalizeSearchValue);
  const tokens = trimmedQuery
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens.every((token) => {
    const normalizedToken = normalizeSearchValue(token);
    return loweredFields.some((field) => field.includes(token)) ||
      normalizedFields.some((field) => field.includes(normalizedToken));
  });
}

type BucketDirection = "debit" | "credit";

type TransactionMatchState = {
  groupId: string;
  confidence: number;
  status: "pending" | "approved" | "rejected" | string;
  selected: boolean;
};

type BucketInteractiveConfig = {
  matchStateByTransactionId?: Map<string, TransactionMatchState>;
  rowOrderByTransactionId?: Map<string, number>;
  onToggleGroup?: (groupId: string, checked: boolean) => void;
  manualSelectedTransactionIds?: Set<string>;
  onToggleManualSelection?: (transactionId: string, checked: boolean) => void;
  suggestionCountByTransactionId?: Map<string, number>;
  suggestionConfidenceByTransactionId?: Map<string, number>;
  reviewedSuggestionConfidenceByTransactionId?: Map<string, number>;
  activeReviewTransactionId?: string | null;
  onReviewSuggestions?: (transactionId: string) => void;
  onCreateSuggestedMatch?: (transactionId: string) => void;
  canCreateSuggestedMatch?: boolean;
};

type BucketProps = {
  title: string;
  direction: BucketDirection;
  transactions: Transaction[];
  emptyMessage: string;
  currencyCode?: string | null;
  interactiveConfig?: BucketInteractiveConfig;
  sharedSearchQuery?: string;
  onSharedSearchChange?: (value: string) => void;
};

type LaneTotalsProps = {
  leftLabel: string;
  leftTotal: number;
  rightLabel: string;
  rightTotal: number;
  currencyCode?: string | null;
};

type LaneSelectionSummaryProps = {
  leftLabel: string;
  leftSelectedTotal: number;
  rightLabel: string;
  rightSelectedTotal: number;
  checkedGroupCount: number;
  currencyCode?: string | null;
  onRemoveSelected?: () => void;
  canEdit?: boolean;
  summaryTitle?: string;
  checkedItemLabel?: string;
  checkedItemDescription?: string;
  removeButtonLabel?: string;
};

type LaneInteractiveConfig = {
  leftBucketInteractive?: BucketInteractiveConfig;
  rightBucketInteractive?: BucketInteractiveConfig;
  leftSelectedTotal: number;
  rightSelectedTotal: number;
  checkedGroupCount: number;
  currencyCode?: string | null;
  onRemoveSelected?: () => void;
  canEdit?: boolean;
  summaryTitle?: string;
  checkedItemLabel?: string;
  checkedItemDescription?: string;
  removeButtonLabel?: string;
};

type WorkbookReconciliationStatementProps = {
  title: string;
  subtitle: string;
  accountName: string;
  accountNumber?: string | null;
  periodMonth: string;
  bookOpenBalance: number;
  bookClosingBalance: number;
  bankOpenBalance: number;
  bankClosingBalance: number;
  currencyCode?: string | null;
  bankCredits: Transaction[];
  bookDebits: Transaction[];
  bookCredits: Transaction[];
  bankDebits: Transaction[];
  outstandingOnly?: boolean;
  topLaneInteractive?: LaneInteractiveConfig;
  bottomLaneInteractive?: LaneInteractiveConfig;
  hideHeaderText?: boolean;
  hideAccountNote?: boolean;
  balanceEditorConfig?: {
    canEdit: boolean;
    dirty: boolean;
    values: {
      bankOpenBalance: string;
      bankClosingBalance: string;
      bookOpenBalance: string;
      bookClosingBalance: string;
    };
    onChange: (
      field:
        | "bankOpenBalance"
        | "bankClosingBalance"
        | "bookOpenBalance"
        | "bookClosingBalance",
      value: string
    ) => void;
    onSave: () => void;
  };
};

function amountForDirection(
  transaction: Transaction,
  direction: BucketDirection
): number {
  return direction === "debit"
    ? transactionDebit(transaction)
    : transactionCredit(transaction);
}

function BucketTable({
  title,
  direction,
  transactions,
  emptyMessage,
  currencyCode,
  interactiveConfig,
  sharedSearchQuery,
  onSharedSearchChange,
}: BucketProps) {
  const rows = useMemo(
    () =>
      sortTransactions(
        transactions,
        interactiveConfig?.rowOrderByTransactionId
      ),
    [interactiveConfig?.rowOrderByTransactionId, transactions]
  );
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(10);
  const [page, setPage] = useState(1);
  const searchQuery = sharedSearchQuery ?? localSearchQuery;
  const handleSearchChange = onSharedSearchChange ?? setLocalSearchQuery;

  const filteredRows = useMemo(
    () =>
      rows.filter((transaction) =>
        transactionMatchesQuery(transaction, direction, searchQuery, currencyCode)
      ),
    [currencyCode, direction, rows, searchQuery]
  );
  const selectableMatchGroupIds = useMemo(() => {
    if (!interactiveConfig?.onToggleGroup) return [];
    const groupIds = new Set<string>();

    for (const transaction of rows) {
      const matchState =
        interactiveConfig.matchStateByTransactionId?.get(transaction.id);
      if (matchState) {
        groupIds.add(matchState.groupId);
      }
    }

    return Array.from(groupIds);
  }, [
    rows,
    interactiveConfig?.matchStateByTransactionId,
    interactiveConfig?.onToggleGroup,
  ]);
  const selectableManualTransactionIds = useMemo(() => {
    if (!interactiveConfig?.onToggleManualSelection) return [];
    const transactionIds: string[] = [];

    for (const transaction of rows) {
      const matchState =
        interactiveConfig.matchStateByTransactionId?.get(transaction.id);
      if (!matchState) {
        transactionIds.push(transaction.id);
      }
    }

    return transactionIds;
  }, [
    rows,
    interactiveConfig?.matchStateByTransactionId,
    interactiveConfig?.onToggleManualSelection,
  ]);
  const selectedMatchGroupIds = useMemo(() => {
    const groupIds = new Set<string>();

    for (const transaction of rows) {
      const matchState =
        interactiveConfig?.matchStateByTransactionId?.get(transaction.id);
      if (matchState?.selected) {
        groupIds.add(matchState.groupId);
      }
    }

    return Array.from(groupIds);
  }, [rows, interactiveConfig?.matchStateByTransactionId]);
  const hasBulkSelectableRows =
    selectableMatchGroupIds.length > 0 ||
    selectableManualTransactionIds.length > 0;
  const selectedManualTransactionIds = useMemo(() => {
    if (!interactiveConfig?.manualSelectedTransactionIds) return [];

    return selectableManualTransactionIds.filter((transactionId) =>
      interactiveConfig.manualSelectedTransactionIds?.has(transactionId)
    );
  }, [
    selectableManualTransactionIds,
    interactiveConfig?.manualSelectedTransactionIds,
  ]);
  const hasCheckedRows =
    selectedMatchGroupIds.length > 0 || selectedManualTransactionIds.length > 0;
  const allRowsChecked =
    hasBulkSelectableRows &&
    selectedMatchGroupIds.length === selectableMatchGroupIds.length &&
    selectedManualTransactionIds.length === selectableManualTransactionIds.length;
  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);

  const handleBulkSelect = useCallback(
    (checked: boolean) => {
      if (interactiveConfig?.onToggleGroup) {
        for (const groupId of selectableMatchGroupIds) {
          interactiveConfig.onToggleGroup(groupId, checked);
        }
      }

      if (interactiveConfig?.onToggleManualSelection) {
        for (const transactionId of selectableManualTransactionIds) {
          interactiveConfig.onToggleManualSelection(transactionId, checked);
        }
      }
    },
    [
      interactiveConfig?.onToggleGroup,
      interactiveConfig?.onToggleManualSelection,
      selectableManualTransactionIds,
      selectableMatchGroupIds,
    ]
  );

  useEffect(() => {
    if (!headerCheckboxRef.current) return;
    headerCheckboxRef.current.indeterminate = hasCheckedRows && !allRowsChecked;
  }, [allRowsChecked, hasCheckedRows]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(filteredRows.length, currentPage * pageSize);
  const paginatedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredRows, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [pageSize, searchQuery, title]);

  useEffect(() => {
    if (page > pageCount) {
      setPage(pageCount);
    }
  }, [page, pageCount]);

  const amountLabel = direction === "debit" ? "DR" : "CR";

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        </div>
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative block w-full max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder={`Search ${title.toLowerCase()} by date, reference, narration, or amount`}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <label className="flex items-center gap-2">
              <span className="font-semibold uppercase tracking-[0.16em] text-slate-500">
                Show
              </span>
              <select
                value={pageSize}
                onChange={(event) =>
                  setPageSize(Number(event.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                }
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-300"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            {searchQuery.trim() ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                Found {filteredRows.length} match{filteredRows.length === 1 ? "" : "es"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[28px_82px_84px_minmax(0,1fr)_104px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:grid-cols-[32px_92px_100px_minmax(0,1fr)_112px] sm:gap-3 sm:px-4 lg:grid-cols-[34px_104px_112px_minmax(0,1fr)_120px]">
        <span className="flex items-center justify-center">
          {interactiveConfig ? (
            <input
              ref={headerCheckboxRef}
              type="checkbox"
              checked={allRowsChecked}
              disabled={!hasBulkSelectableRows && !hasCheckedRows}
              onChange={(event) => handleBulkSelect(event.target.checked)}
              className={`h-4 w-4 rounded border-slate-300 ${
                hasBulkSelectableRows || hasCheckedRows
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-40"
              }`}
              title="Check or uncheck all rows in this quadrant"
            />
          ) : (
            <span className="block h-4 w-4" />
          )}
        </span>
        <span className="truncate">Date</span>
        <span className="truncate">Reference</span>
        <span className="truncate">Narration</span>
        <span className="text-right">{amountLabel}</span>
      </div>

      <div className="max-h-[420px] overflow-y-auto bg-white">
        {paginatedRows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            {searchQuery.trim()
              ? `No rows in ${title.toLowerCase()} match "${searchQuery.trim()}".`
              : emptyMessage}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paginatedRows.map((transaction) => {
              const matchState =
                interactiveConfig?.matchStateByTransactionId?.get(transaction.id);
              const suggestionCount =
                interactiveConfig?.suggestionCountByTransactionId?.get(transaction.id) ||
                0;
              const suggestionConfidence =
                interactiveConfig?.suggestionConfidenceByTransactionId?.get(
                  transaction.id
                ) || 0;
              const reviewedSuggestionConfidence =
                interactiveConfig?.reviewedSuggestionConfidenceByTransactionId?.get(
                  transaction.id
                ) || 0;
              const activeReview =
                interactiveConfig?.activeReviewTransactionId === transaction.id;
              const amount = amountForDirection(transaction, direction);
              const canToggleExistingMatch = Boolean(
                matchState && interactiveConfig?.onToggleGroup
              );
              const canCreateSuggestedMatch = Boolean(
                !matchState &&
                  reviewedSuggestionConfidence > 0 &&
                  interactiveConfig?.canCreateSuggestedMatch &&
                  interactiveConfig?.onCreateSuggestedMatch
              );
              const canManualToggle = Boolean(
                !matchState && interactiveConfig?.onToggleManualSelection
              );
              const canReviewSuggestions = Boolean(
                !matchState &&
                  suggestionCount > 0 &&
                  interactiveConfig?.onReviewSuggestions
              );
              const isManuallySelected = Boolean(
                interactiveConfig?.manualSelectedTransactionIds?.has(
                  transaction.id
                )
              );
              const isCheckboxChecked = Boolean(
                matchState?.selected || activeReview || isManuallySelected
              );

              const rowClasses = matchState
                ? matchState.selected
                  ? matchState.confidence >= 100
                    ? "bg-emerald-50 ring-1 ring-inset ring-emerald-300"
                    : "bg-amber-50 ring-1 ring-inset ring-amber-300"
                  : "bg-sky-50 ring-1 ring-inset ring-sky-200"
                : activeReview
                ? "bg-blue-50 ring-2 ring-inset ring-blue-300"
                : reviewedSuggestionConfidence > 0
                ? reviewedSuggestionConfidence >= 90
                  ? "bg-amber-50 ring-1 ring-inset ring-amber-300"
                  : "bg-orange-50 ring-1 ring-inset ring-orange-200"
                : isManuallySelected
                ? "bg-violet-50 ring-1 ring-inset ring-violet-300"
                : suggestionConfidence > 0
                ? suggestionConfidence >= 90
                  ? "bg-amber-50 ring-1 ring-inset ring-amber-300"
                  : "bg-orange-50 ring-1 ring-inset ring-orange-200"
                : "";

              return (
                <div
                  key={transaction.id}
                  className={`mx-2 my-2 rounded-xl px-2 py-1 ${rowClasses}`}
                >
                  <div className="grid grid-cols-[28px_82px_84px_minmax(0,1fr)_104px] gap-2 px-2 py-2 text-[11px] text-slate-700 sm:grid-cols-[32px_92px_100px_minmax(0,1fr)_112px] sm:gap-3 lg:grid-cols-[34px_104px_112px_minmax(0,1fr)_120px]">
                    <div className="flex items-start justify-center pt-0.5">
                      {interactiveConfig ? (
                        <input
                          type="checkbox"
                          checked={isCheckboxChecked}
                          onChange={(event) => {
                            const checked = event.target.checked;

                            if (canToggleExistingMatch && matchState) {
                              interactiveConfig?.onToggleGroup?.(
                                matchState.groupId,
                                checked
                              );
                              return;
                            }

                            if (canCreateSuggestedMatch && checked) {
                              interactiveConfig?.onCreateSuggestedMatch?.(
                                transaction.id
                              );
                              return;
                            }

                            if (canManualToggle) {
                              interactiveConfig?.onToggleManualSelection?.(
                                transaction.id,
                                checked
                              );
                              return;
                            }

                            if (canReviewSuggestions) {
                              interactiveConfig?.onReviewSuggestions?.(
                                transaction.id
                              );
                            }
                          }}
                          disabled={
                            !canToggleExistingMatch &&
                            !canCreateSuggestedMatch &&
                            !canManualToggle &&
                            !canReviewSuggestions &&
                            !activeReview
                          }
                          className={`h-4 w-4 rounded border-slate-300 ${
                            canToggleExistingMatch ||
                            canCreateSuggestedMatch ||
                            canManualToggle ||
                            canReviewSuggestions ||
                            activeReview
                              ? "cursor-pointer"
                              : "cursor-not-allowed opacity-40"
                          }`}
                        />
                      ) : (
                        <span className="block h-4 w-4" />
                      )}
                    </div>
                    <span className="truncate font-mono text-slate-500">
                      {transaction.date || "-"}
                    </span>
                    <span className="truncate font-mono text-slate-600">
                      {transaction.reference || "-"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">
                        {transaction.narration || "-"}
                      </span>
                      {transaction.isCarryforward ? (
                        <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          (CF)
                        </span>
                      ) : null}
                      {matchState ? (
                        <span
                          className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            matchState.selected
                              ? matchState.confidence >= 100
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                              : "bg-sky-100 text-sky-700"
                          }`}
                        >
                          <CheckSquare className="h-3 w-3" />
                          {matchState.confidence}% match
                        </span>
                      ) : activeReview ? (
                        <button
                          onClick={() =>
                            interactiveConfig?.onReviewSuggestions?.(transaction.id)
                          }
                          className="mt-1 inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-200"
                        >
                          <Sparkles className="h-3 w-3" />
                          Hide side-by-side review
                        </button>
                      ) : reviewedSuggestionConfidence > 0 ? (
                        <span className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                              reviewedSuggestionConfidence >= 90
                                ? "bg-amber-100 text-amber-700"
                                : "bg-orange-100 text-orange-700"
                            }`}
                          >
                            <Sparkles className="h-3 w-3" />
                            {reviewedSuggestionConfidence}% Possible Match
                          </span>
                          {interactiveConfig?.canCreateSuggestedMatch &&
                          interactiveConfig?.onCreateSuggestedMatch ? (
                            <button
                              onClick={() =>
                                interactiveConfig.onCreateSuggestedMatch?.(
                                  transaction.id
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-slate-800"
                            >
                              Stage match
                            </button>
                          ) : null}
                        </span>
                      ) : isManuallySelected ? (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                          <CheckSquare className="h-3 w-3" />
                          Manual selection
                        </span>
                      ) : suggestionCount > 0 &&
                        interactiveConfig?.onReviewSuggestions ? (
                        <button
                          onClick={() =>
                            interactiveConfig.onReviewSuggestions?.(transaction.id)
                          }
                          className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
                        >
                          <Sparkles className="h-3 w-3" />
                          {activeReview
                            ? "Hide side-by-side review"
                            : suggestionConfidence > 0
                            ? `${suggestionConfidence}% Possible Match`
                            : "Possible Match"}
                        </button>
                      ) : null}
                    </span>
                    <span className="text-right font-mono tabular-nums">
                      {amount > 0 ? formatMoney(amount, currencyCode) : "-"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            {filteredRows.length === 0
              ? "No rows to display."
              : `Showing ${pageStart}-${pageEnd} of ${filteredRows.length} row${
                  filteredRows.length === 1 ? "" : "s"
                }`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={currentPage === 1}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold ${
                currentPage === 1
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-600 ring-1 ring-slate-200">
              {currentPage} / {pageCount}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((current) => Math.min(pageCount, current + 1))
              }
              disabled={currentPage === pageCount || filteredRows.length === 0}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-semibold ${
                currentPage === pageCount || filteredRows.length === 0
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              }`}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LaneTotals({
  leftLabel,
  leftTotal,
  rightLabel,
  rightTotal,
  currencyCode,
}: LaneTotalsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {leftLabel}
          </p>
          <p className="text-lg font-semibold text-slate-900">
            {formatMoney(leftTotal, currencyCode)}
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {rightLabel}
          </p>
          <p className="text-lg font-semibold text-slate-900">
            {formatMoney(rightTotal, currencyCode)}
          </p>
        </div>
      </div>
    </div>
  );
}

function LaneSelectionSummary({
  leftLabel,
  leftSelectedTotal,
  rightLabel,
  rightSelectedTotal,
  checkedGroupCount,
  currencyCode,
  onRemoveSelected,
  canEdit,
  summaryTitle,
  checkedItemLabel,
  checkedItemDescription,
  removeButtonLabel,
}: LaneSelectionSummaryProps) {
  if (checkedGroupCount === 0) {
    return null;
  }

  const difference = leftSelectedTotal - rightSelectedTotal;
  const resolvedItemLabel =
    checkedItemLabel || (onRemoveSelected ? "match" : "row");
  const resolvedDescription =
    checkedItemDescription ||
    (onRemoveSelected
      ? "staged for removal from this lane."
      : "selected in manual mode for discretionary balancing.");
  const resolvedSummaryTitle =
    summaryTitle || (onRemoveSelected ? "Live Matched Totals" : "Live Manual Totals");

  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {resolvedSummaryTitle}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {checkedGroupCount} checked{" "}
            {resolvedItemLabel}
            {checkedGroupCount === 1 ? "" : "es"}{" "}
            {resolvedDescription}
          </p>
        </div>
        {onRemoveSelected ? (
          <button
            onClick={onRemoveSelected}
            disabled={!canEdit || checkedGroupCount === 0}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              !canEdit || checkedGroupCount === 0
                ? "cursor-not-allowed bg-slate-200 text-slate-400"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {removeButtonLabel || "Remove checked matches"}
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-right shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {leftLabel}
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatMoney(leftSelectedTotal, currencyCode)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Difference
          </p>
          <p
            className={`mt-2 text-lg font-semibold ${
              Math.abs(difference) < 0.01 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {formatMoney(difference, currencyCode)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-right shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {rightLabel}
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {formatMoney(rightSelectedTotal, currencyCode)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function WorkbookReconciliationStatement({
  title,
  subtitle,
  accountName,
  accountNumber,
  periodMonth,
  bookOpenBalance,
  bookClosingBalance,
  bankOpenBalance,
  bankClosingBalance,
  currencyCode = "GHS",
  bankCredits,
  bookDebits,
  bookCredits,
  bankDebits,
  outstandingOnly = false,
  topLaneInteractive,
  bottomLaneInteractive,
  hideHeaderText = false,
  hideAccountNote = false,
  balanceEditorConfig,
}: WorkbookReconciliationStatementProps) {
  const bankCreditTotal = useMemo(
    () =>
      bankCredits.reduce(
        (total, transaction) => total + transactionCredit(transaction),
        0
      ),
    [bankCredits]
  );
  const bookDebitTotal = useMemo(
    () =>
      bookDebits.reduce(
        (total, transaction) => total + transactionDebit(transaction),
        0
      ),
    [bookDebits]
  );
  const bookCreditTotal = useMemo(
    () =>
      bookCredits.reduce(
        (total, transaction) => total + transactionCredit(transaction),
        0
      ),
    [bookCredits]
  );
  const bankDebitTotal = useMemo(
    () =>
      bankDebits.reduce(
        (total, transaction) => total + transactionDebit(transaction),
        0
      ),
    [bankDebits]
  );
  const [topLaneSearchQuery, setTopLaneSearchQuery] = useState("");
  const [bottomLaneSearchQuery, setBottomLaneSearchQuery] = useState("");

  const adjustedBookBalance =
    bookClosingBalance + bankCreditTotal + bookCreditTotal;
  const adjustedBankBalance =
    bankClosingBalance + bookDebitTotal + bankDebitTotal;
  const overallDifference = adjustedBookBalance - adjustedBankBalance;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-cyan-50 px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {!hideHeaderText ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {title}
              </p>
            ) : null}
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              BANK RECONCILIATION STATEMENT
            </h2>
            {!hideHeaderText ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Account / Period
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">
              {accountName}
            </p>
            {accountNumber ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Account No. {accountNumber}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-slate-500">{periodMonth}</p>
            {!hideAccountNote ? (
              <p className="mt-3 text-xs text-slate-400">
                {outstandingOnly
                  ? "Matched rows disappear here after they are removed, so the quadrants become the outstanding worksheet."
                  : "This is the raw classified worksheet before we remove matched rows."}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Cash Book Balances
              </p>
              {balanceEditorConfig?.canEdit ? (
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                  Editable
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Opening
                </span>
                {balanceEditorConfig ? (
                  <input
                    type="number"
                    step="0.01"
                    value={balanceEditorConfig.values.bookOpenBalance}
                    onChange={(event) =>
                      balanceEditorConfig.onChange("bookOpenBalance", event.target.value)
                    }
                    disabled={!balanceEditorConfig.canEdit}
                    className={`w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-slate-900 outline-none ${
                      balanceEditorConfig.canEdit
                        ? "focus:border-blue-400"
                        : "bg-slate-50 text-slate-500"
                    }`}
                  />
                ) : (
                  <p className="text-xl font-semibold text-slate-900">
                    {formatMoney(bookOpenBalance, currencyCode)}
                  </p>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Closing
                </span>
                {balanceEditorConfig ? (
                  <input
                    type="number"
                    step="0.01"
                    value={balanceEditorConfig.values.bookClosingBalance}
                    onChange={(event) =>
                      balanceEditorConfig.onChange("bookClosingBalance", event.target.value)
                    }
                    disabled={!balanceEditorConfig.canEdit}
                    className={`w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-slate-900 outline-none ${
                      balanceEditorConfig.canEdit
                        ? "focus:border-blue-400"
                        : "bg-slate-50 text-slate-500"
                    }`}
                  />
                ) : (
                  <p className="text-xl font-semibold text-slate-900">
                    {formatMoney(bookClosingBalance, currencyCode)}
                  </p>
                )}
              </label>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Bank Statement Balances
              </p>
              {balanceEditorConfig?.canEdit ? (
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">
                  Editable
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Opening
                </span>
                {balanceEditorConfig ? (
                  <input
                    type="number"
                    step="0.01"
                    value={balanceEditorConfig.values.bankOpenBalance}
                    onChange={(event) =>
                      balanceEditorConfig.onChange("bankOpenBalance", event.target.value)
                    }
                    disabled={!balanceEditorConfig.canEdit}
                    className={`w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-slate-900 outline-none ${
                      balanceEditorConfig.canEdit
                        ? "focus:border-blue-400"
                        : "bg-slate-50 text-slate-500"
                    }`}
                  />
                ) : (
                  <p className="text-xl font-semibold text-slate-900">
                    {formatMoney(bankOpenBalance, currencyCode)}
                  </p>
                )}
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Closing
                </span>
                {balanceEditorConfig ? (
                  <input
                    type="number"
                    step="0.01"
                    value={balanceEditorConfig.values.bankClosingBalance}
                    onChange={(event) =>
                      balanceEditorConfig.onChange("bankClosingBalance", event.target.value)
                    }
                    disabled={!balanceEditorConfig.canEdit}
                    className={`w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-slate-900 outline-none ${
                      balanceEditorConfig.canEdit
                        ? "focus:border-blue-400"
                        : "bg-slate-50 text-slate-500"
                    }`}
                  />
                ) : (
                  <p className="text-xl font-semibold text-slate-900">
                    {formatMoney(bankClosingBalance, currencyCode)}
                  </p>
                )}
              </label>
            </div>
          </div>
        </div>
        {balanceEditorConfig ? (
          <div className="mt-4 flex justify-end">
            <button
              onClick={balanceEditorConfig.onSave}
              disabled={!balanceEditorConfig.canEdit || !balanceEditorConfig.dirty}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                !balanceEditorConfig.canEdit || !balanceEditorConfig.dirty
                  ? "cursor-not-allowed bg-slate-200 text-slate-500"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              Save balances
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4 px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2">
          <BucketTable
            title="Bank Credits"
            direction="credit"
            transactions={bankCredits}
            emptyMessage="No outstanding bank credits in this section."
            currencyCode={currencyCode}
            interactiveConfig={topLaneInteractive?.leftBucketInteractive}
            sharedSearchQuery={topLaneSearchQuery}
            onSharedSearchChange={setTopLaneSearchQuery}
          />
          <BucketTable
            title="Cash Book Debits"
            direction="debit"
            transactions={bookDebits}
            emptyMessage="No outstanding cash book debits in this section."
            currencyCode={currencyCode}
            interactiveConfig={topLaneInteractive?.rightBucketInteractive}
            sharedSearchQuery={topLaneSearchQuery}
            onSharedSearchChange={setTopLaneSearchQuery}
          />
        </div>

        {topLaneInteractive ? (
          <LaneSelectionSummary
            leftLabel="CHECKED - Bank Credits"
            leftSelectedTotal={topLaneInteractive.leftSelectedTotal}
            rightLabel="CHECKED - Cash Book Debits"
            rightSelectedTotal={topLaneInteractive.rightSelectedTotal}
            checkedGroupCount={topLaneInteractive.checkedGroupCount}
            currencyCode={currencyCode}
            onRemoveSelected={topLaneInteractive.onRemoveSelected}
            canEdit={topLaneInteractive.canEdit}
            summaryTitle={topLaneInteractive.summaryTitle}
            checkedItemLabel={topLaneInteractive.checkedItemLabel}
            checkedItemDescription={topLaneInteractive.checkedItemDescription}
            removeButtonLabel={topLaneInteractive.removeButtonLabel}
          />
        ) : null}

        <LaneTotals
          leftLabel="SUB TOTAL - Bank Credits"
          leftTotal={bankCreditTotal}
          rightLabel="SUB TOTAL - Cash Book Debits"
          rightTotal={bookDebitTotal}
          currencyCode={currencyCode}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <BucketTable
            title="Cash Book Credits"
            direction="credit"
            transactions={bookCredits}
            emptyMessage="No outstanding cash book credits in this section."
            currencyCode={currencyCode}
            interactiveConfig={bottomLaneInteractive?.leftBucketInteractive}
            sharedSearchQuery={bottomLaneSearchQuery}
            onSharedSearchChange={setBottomLaneSearchQuery}
          />
          <BucketTable
            title="Bank Debits"
            direction="debit"
            transactions={bankDebits}
            emptyMessage="No outstanding bank debits in this section."
            currencyCode={currencyCode}
            interactiveConfig={bottomLaneInteractive?.rightBucketInteractive}
            sharedSearchQuery={bottomLaneSearchQuery}
            onSharedSearchChange={setBottomLaneSearchQuery}
          />
        </div>

        {bottomLaneInteractive ? (
          <LaneSelectionSummary
            leftLabel="CHECKED - Cash Book Credits"
            leftSelectedTotal={bottomLaneInteractive.leftSelectedTotal}
            rightLabel="CHECKED - Bank Debits"
            rightSelectedTotal={bottomLaneInteractive.rightSelectedTotal}
            checkedGroupCount={bottomLaneInteractive.checkedGroupCount}
            currencyCode={currencyCode}
            onRemoveSelected={bottomLaneInteractive.onRemoveSelected}
            canEdit={bottomLaneInteractive.canEdit}
            summaryTitle={bottomLaneInteractive.summaryTitle}
            checkedItemLabel={bottomLaneInteractive.checkedItemLabel}
            checkedItemDescription={bottomLaneInteractive.checkedItemDescription}
            removeButtonLabel={bottomLaneInteractive.removeButtonLabel}
          />
        ) : null}

        <LaneTotals
          leftLabel="SUB TOTAL - Cash Book Credits"
          leftTotal={bookCreditTotal}
          rightLabel="SUB TOTAL - Bank Debits"
          rightTotal={bankDebitTotal}
          currencyCode={currencyCode}
        />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-slate-900 px-5 py-5 text-white shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Adjusted Cash Book Balance
              </p>
              <p className="text-[1.65rem] font-semibold">
                {formatMoney(adjustedBookBalance, currencyCode)}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              {formatMoney(bookClosingBalance, currencyCode)} + {formatMoney(bankCreditTotal, currencyCode)} +{" "}
              {formatMoney(bookCreditTotal, currencyCode)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5 text-center shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Difference
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                Math.abs(overallDifference) < 0.01
                  ? "text-emerald-700"
                  : "text-rose-700"
              }`}
            >
              {formatMoney(overallDifference, currencyCode)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-900 px-5 py-5 text-white shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                Adjusted Bank Balance
              </p>
              <p className="text-[1.65rem] font-semibold">
                {formatMoney(adjustedBankBalance, currencyCode)}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-300">
              {formatMoney(bankClosingBalance, currencyCode)} + {formatMoney(bookDebitTotal, currencyCode)} +{" "}
              {formatMoney(bankDebitTotal, currencyCode)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
