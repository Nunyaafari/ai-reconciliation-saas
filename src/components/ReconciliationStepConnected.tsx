"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Zap,
  Loader,
} from "lucide-react";
import { useReconciliationStore } from "@/store/reconciliation-api";
import MatchReviewPanel from "./MatchReviewPanel";

export default function ReconciliationStep() {
  const {
    bankTransactions,
    bookTransactions,
    matchGroups,
    unmatchedSuggestions,
    loading,
    progress,
    startReconciliation,
    createMatch,
    approveMatch,
    rejectMatch,
    approveMatchesBulk,
    rejectMatchesBulk,
    activityLog,
    setStep,
    bankSessionId,
    bookSessionId,
    orgId,
  } = useReconciliationStore();

  const [selectedBankTx, setSelectedBankTx] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [confirmBulkAction, setConfirmBulkAction] = useState<
    "approve" | "reject" | "approve-threshold" | null
  >(null);
  const [activityFilter, setActivityFilter] = useState<
    "all" | "match_created" | "match_approved" | "match_rejected"
  >("all");
  const [thresholdInput, setThresholdInput] = useState<number>(90);

  useEffect(() => {
    if (!statusMessage) return;
    const timer = setTimeout(() => setStatusMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [statusMessage]);

  // Initialize reconciliation on mount - only if both files uploaded
  useEffect(() => {
    if (!initialized && bankSessionId && bookSessionId && orgId) {
      setInitialized(true);
      startReconciliation(orgId);
    }
  }, [initialized, bankSessionId, bookSessionId, orgId, startReconciliation]);

  // Calculate match statistics
  const stats = useMemo(() => {
    const totalBank = bankTransactions.length;
    const matchedBank = bankTransactions.filter((t) => t.matched).length;
    const totalBook = bookTransactions.length;
    const matchedBook = bookTransactions.filter((t) => t.matched).length;
    const pending = matchGroups.filter((g) => g.status === "pending").length;
    const approved = matchGroups.filter((g) => g.status === "approved").length;
    const rejected = matchGroups.filter((g) => g.status === "rejected").length;

    return {
      bankMatched: matchedBank,
      bankTotal: totalBank,
      bookMatched: matchedBook,
      bookTotal: totalBook,
      pending,
      approved,
      rejected,
      progressPercent:
        totalBank + totalBook > 0
          ? Math.round(((matchedBank + matchedBook) / (totalBank + totalBook)) * 100)
          : 0,
    };
  }, [bankTransactions, bookTransactions, matchGroups]);

  const unmatchedBank = bankTransactions.filter((t) => !t.matched);
  const unmatchedBook = bookTransactions.filter((t) => !t.matched);

  const suggestionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of unmatchedSuggestions) {
      map.set(entry.bankTransactionId, entry.suggestions.length);
    }
    return map;
  }, [unmatchedSuggestions]);

  const pendingGroups = useMemo(
    () => matchGroups.filter((g) => g.status === "pending"),
    [matchGroups]
  );
  const activityCounts = useMemo(() => {
    return {
      all: activityLog.length,
      match_created: activityLog.filter((entry) => entry.action === "match_created")
        .length,
      match_approved: activityLog.filter((entry) => entry.action === "match_approved")
        .length,
      match_rejected: activityLog.filter((entry) => entry.action === "match_rejected")
        .length,
    };
  }, [activityLog]);

  useEffect(() => {
    if (!unmatchedBank.length) {
      setSelectedIndex(-1);
      return;
    }
    if (selectedBankTx) {
      const idx = unmatchedBank.findIndex((tx) => tx.id === selectedBankTx);
      if (idx >= 0) {
        setSelectedIndex(idx);
      }
    }
  }, [selectedBankTx, unmatchedBank]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const active = document.activeElement;
      if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) {
        return;
      }

      if (!unmatchedBank.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = selectedIndex < 0 ? 0 : Math.min(selectedIndex + 1, unmatchedBank.length - 1);
        setSelectedIndex(next);
        setSelectedBankTx(unmatchedBank[next].id);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const prev = selectedIndex < 0 ? 0 : Math.max(selectedIndex - 1, 0);
        setSelectedIndex(prev);
        setSelectedBankTx(unmatchedBank[prev].id);
      }

      if (event.key === "Enter") {
        if (selectedBankTx) {
          setShowSuggestions(true);
        }
      }

      if (event.key === "Escape") {
        setShowSuggestions(false);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedIndex, unmatchedBank, selectedBankTx]);

  // AI suggestions from backend
  const suggestions = useMemo(() => {
    if (!selectedBankTx) return [];
    const suggestionEntry = unmatchedSuggestions.find(
      (u) => u.bankTransactionId === selectedBankTx
    );
    if (!suggestionEntry) return [];

    return suggestionEntry.suggestions.flatMap((s) => {
      const tx = bookTransactions.find((t) => t.id === s.bookTransactionId);
      if (!tx) return [];
      return [
        {
          transaction: tx,
          confidence: s.confidence,
          score: {
            value: Math.round((s.signals.value || 0) * 100),
            date: Math.round((s.signals.date || 0) * 100),
            narration: Math.round((s.signals.narration || 0) * 100),
          },
          explanation: s.explanation,
        },
      ];
    });
  }, [selectedBankTx, unmatchedSuggestions, bookTransactions]);

  const handleCreateMatch = async (bookTxId: string) => {
    const bankTx = bankTransactions.find((t) => t.id === selectedBankTx);
    const bookTx = bookTransactions.find((t) => t.id === bookTxId);

    if (bankTx && bookTx) {
      const confidence = suggestions.find((s) => s.transaction.id === bookTxId)
        ?.confidence || 0;

      try {
        await createMatch([bankTx.id], [bookTx.id], confidence);
        setStatusMessage({
          tone: "success",
          text: "Match created. Pending approval.",
        });
        setSelectedBankTx(null);
        setShowSuggestions(false);
      } catch (error) {
        setStatusMessage({
          tone: "error",
          text: "Failed to create match. Please try again.",
        });
        console.error("Failed to create match:", error);
      }
    }
  };

  const handleApproveMatch = async (groupId: string) => {
    try {
      await approveMatch(groupId);
      setStatusMessage({ tone: "success", text: "Match approved." });
    } catch (error) {
      setStatusMessage({ tone: "error", text: "Approval failed." });
      console.error("Failed to approve match:", error);
    }
  };

  const handleRejectMatch = async (groupId: string) => {
    try {
      await rejectMatch(groupId);
      setStatusMessage({ tone: "info", text: "Match rejected." });
    } catch (error) {
      setStatusMessage({ tone: "error", text: "Rejection failed." });
      console.error("Failed to reject match:", error);
    }
  };

  const handleApproveAll = async () => {
    if (pendingGroups.length === 0) return;
    try {
      await approveMatchesBulk(pendingGroups.map((group) => group.id));
      setStatusMessage({ tone: "success", text: "All pending matches approved." });
    } catch (error) {
      setStatusMessage({ tone: "error", text: "Failed to approve all matches." });
    }
  };

  const handleRejectAll = async () => {
    if (pendingGroups.length === 0) return;
    try {
      await rejectMatchesBulk(pendingGroups.map((group) => group.id));
      setStatusMessage({ tone: "info", text: "All pending matches rejected." });
    } catch (error) {
      setStatusMessage({ tone: "error", text: "Failed to reject all matches." });
    }
  };

  const handleApproveAboveThreshold = async (threshold: number) => {
    const targets = pendingGroups.filter((g) => g.confidence >= threshold);
    if (targets.length === 0) {
      setStatusMessage({ tone: "info", text: "No pending matches meet the threshold." });
      return;
    }
    try {
      await approveMatchesBulk(targets.map((g) => g.id));
      setStatusMessage({
        tone: "success",
        text: `Approved ${targets.length} match${targets.length === 1 ? "" : "es"} (≥${threshold}%).`,
      });
    } catch (error) {
      setStatusMessage({ tone: "error", text: "Failed to approve by threshold." });
    }
  };

  const handleConfirmBulk = async () => {
    if (!confirmBulkAction) return;
    if (confirmBulkAction === "approve") {
      await handleApproveAll();
    } else if (confirmBulkAction === "approve-threshold") {
      await handleApproveAboveThreshold(thresholdInput);
    } else {
      await handleRejectAll();
    }
    setConfirmBulkAction(null);
  };

  if (!bankSessionId || !bookSessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center bg-white rounded-xl shadow-lg border border-slate-200 p-8 max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Missing Files
          </h2>
          <p className="text-slate-600 mb-4">
            Please upload both a{" "}
            <span className="font-semibold">Bank Statement</span> and a{" "}
            <span className="font-semibold">Cash Book</span> to begin reconciliation.
          </p>
          <p className="text-xs text-slate-500 mb-4">
            Bank: {bankSessionId ? "✅" : "❌"} | Book: {bookSessionId ? "✅" : "❌"}
          </p>
          <button
            onClick={() => setStep("upload")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            ← Back to Upload
          </button>
        </div>
      </div>
    );
  }

  if (loading && bankTransactions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Running Reconciliation...
          </h2>
          <p className="text-slate-600">
            Extracting and matching transactions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-slate-900">
              Reconciliation Workspace
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setConfirmBulkAction("approve")}
                disabled={pendingGroups.length === 0}
                className={`px-3 py-2 text-xs font-semibold rounded-lg ${
                  pendingGroups.length === 0
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                Approve all
              </button>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                  <span className="text-slate-500">≥</span>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    step={1}
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(Number(e.target.value))}
                    className="w-14 bg-transparent text-slate-700 outline-none"
                  />
                  <span className="text-slate-400">%</span>
                </div>
                <button
                  onClick={() => setConfirmBulkAction("approve-threshold")}
                  disabled={pendingGroups.length === 0}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg ${
                    pendingGroups.length === 0
                      ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                      : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
                >
                  Approve ≥{thresholdInput}%
                </button>
              </div>
              <button
                onClick={() => setConfirmBulkAction("reject")}
                disabled={pendingGroups.length === 0}
                className={`px-3 py-2 text-xs font-semibold rounded-lg ${
                  pendingGroups.length === 0
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-rose-600 text-white hover:bg-rose-700"
                }`}
              >
                Reject all
              </button>
              <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">
                ✓ Complete
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-yellow-600" />
                <span className="text-sm font-medium text-slate-700">
                  {stats.bankMatched + stats.bookMatched} of{" "}
                  {stats.bankTotal + stats.bookTotal} transactions matched
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                  {stats.pending} pending
                </span>
                <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  {stats.approved} approved
                </span>
                <span className="text-[11px] px-2 py-1 rounded-full bg-rose-100 text-rose-800">
                  {stats.rejected} rejected
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-600 to-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${stats.progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {statusMessage && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
              statusMessage.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : statusMessage.tone === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity Log */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Activity Log
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "All", value: "all" as const, count: activityCounts.all },
                    {
                      label: "Created",
                      value: "match_created" as const,
                      count: activityCounts.match_created,
                    },
                    {
                      label: "Approved",
                      value: "match_approved" as const,
                      count: activityCounts.match_approved,
                    },
                    {
                      label: "Rejected",
                      value: "match_rejected" as const,
                      count: activityCounts.match_rejected,
                    },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setActivityFilter(filter.value)}
                      className={`px-2 py-1 text-[11px] rounded-full border ${
                        activityFilter === filter.value
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {filter.label} {filter.count}
                    </button>
                  ))}
                </div>
              </div>
              {activityLog.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No activity yet. Approve or reject matches to see updates here.
                </p>
              ) : (
                <div className="max-h-32 overflow-y-auto divide-y divide-slate-100">
                  {activityLog
                    .filter((entry) =>
                      activityFilter === "all" ? true : entry.action === activityFilter
                    )
                    .map((entry) => (
                      <div
                        key={`${entry.action}-${entry.timestamp}-${entry.id}`}
                        className="py-2 text-xs text-slate-600"
                      >
                        <span className="font-semibold text-slate-700">
                          {entry.action === "match_created"
                            ? "Created"
                            : entry.action === "match_approved"
                            ? "Approved"
                            : "Rejected"}
                        </span>{" "}
                        match{" "}
                        <span className="text-slate-400">({entry.matchType || "1:1"})</span>{" "}
                        {entry.confidence !== undefined && (
                          <span className="text-slate-400">· {entry.confidence}%</span>
                        )}
                        <span className="text-slate-400">
                          {" "}
                          · {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
          {/* Bank Transactions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-96">
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                  🏦 Bank Statement
                </h2>
                <div className="relative group">
                  <span className="text-xs text-slate-500 cursor-help">
                    Keyboard
                  </span>
                  <div className="absolute right-0 top-6 z-10 hidden group-hover:block bg-white border border-slate-200 shadow-lg rounded-lg p-3 w-52 text-[11px] text-slate-700">
                    <p className="font-semibold text-slate-600 mb-2">
                      Shortcuts
                    </p>
                    <ul className="space-y-1">
                      <li>↑/↓ Select transaction</li>
                      <li>Enter Open suggestions</li>
                      <li>Esc Close suggestions</li>
                    </ul>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {stats.bankMatched} of {stats.bankTotal} matched
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {unmatchedBank.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">All bank transactions matched!</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {unmatchedBank.map((tx) => (
                    <button
                      key={tx.id}
                      onClick={() => {
                        setSelectedBankTx(tx.id);
                        setShowSuggestions(true);
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-all border ${
                        selectedBankTx === tx.id
                          ? "bg-blue-50 border-blue-300 ring-2 ring-blue-200"
                          : "hover:bg-slate-50 border-transparent hover:border-slate-200"
                      }`}
                      aria-selected={selectedBankTx === tx.id}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {tx.date}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            ${tx.amount.toFixed(2)}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full ${
                              (suggestionCounts.get(tx.id) || 0) > 0
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {(suggestionCounts.get(tx.id) || 0)} suggestions
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 truncate">
                        {tx.narration}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Book Transactions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-96">
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-green-50 to-green-100">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                📚 Cash Book
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                {stats.bookMatched} of {stats.bookTotal} matched
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {unmatchedBook.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">All book transactions matched!</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {unmatchedBook.map((tx) => (
                    <button
                      key={tx.id}
                      className="w-full text-left p-3 rounded-lg transition-all border hover:bg-slate-50 border-transparent hover:border-slate-200"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {tx.date}
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          ${tx.amount.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 truncate">
                        {tx.narration}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Match Review Panel */}
        {showSuggestions && selectedBankTx && (
          <MatchReviewPanel
            bankTx={bankTransactions.find((t) => t.id === selectedBankTx)!}
            suggestions={suggestions}
            onMatch={handleCreateMatch}
            onClose={() => setShowSuggestions(false)}
          />
        )}

        {confirmBulkAction && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {confirmBulkAction === "approve"
                  ? "Approve"
                  : confirmBulkAction === "approve-threshold"
                  ? "Approve"
                  : "Reject"}{" "}
                {confirmBulkAction === "approve-threshold" ? "high-confidence" : "all"}{" "}
                pending matches?
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                {confirmBulkAction === "approve-threshold"
                  ? `This will approve all pending matches with confidence ≥ ${thresholdInput}%.`
                  : `This will ${
                      confirmBulkAction === "approve" ? "approve" : "reject"
                    } ${pendingGroups.length} pending match${
                      pendingGroups.length === 1 ? "" : "es"
                    }.`}
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setConfirmBulkAction(null)}
                  className="px-3 py-2 text-sm font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBulk}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg text-white ${
                    confirmBulkAction === "approve" ||
                    confirmBulkAction === "approve-threshold"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Matched Transactions Summary */}
        {matchGroups.length > 0 && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Matched Transactions ({matchGroups.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {matchGroups.map((group) => (
                <div
                  key={group.id}
                  className="p-3 bg-white border border-slate-200 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        group.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : group.status === "rejected"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {group.status} · {group.confidence}% confidence
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      ${group.totalBankAmount.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {group.matchType} transaction
                  </p>

                  {group.status === "pending" && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleApproveMatch(group.id)}
                        className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectMatch(group.id)}
                        className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-rose-600 text-white hover:bg-rose-700"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
