"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  CheckCircle,
  AlertCircle,
  ClipboardCheck,
  Zap,
} from "lucide-react";
import { useReconciliationStore } from "@/store/reconciliation";
import MatchReviewPanel from "./MatchReviewPanel";

export default function ReconciliationStep() {
  const {
    bankTransactions,
    bookTransactions,
    matchGroups,
    addMatchGroup,
  } = useReconciliationStore();

  const [selectedBankTx, setSelectedBankTx] = useState<string | null>(null);
  const [selectedBookTx, setSelectedBookTx] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Calculate match statistics
  const stats = useMemo(() => {
    const totalBank = bankTransactions.length;
    const matchedBank = bankTransactions.filter((t) => t.matched).length;
    const totalBook = bookTransactions.length;
    const matchedBook = bookTransactions.filter((t) => t.matched).length;

    return {
      bankMatched: matchedBank,
      bankTotal: totalBank,
      bookMatched: matchedBook,
      bookTotal: totalBook,
      progressPercent: Math.round(
        ((matchedBank + matchedBook) / (totalBank + totalBook)) * 100
      ),
    };
  }, [bankTransactions, bookTransactions]);

  const unmatchedBank = bankTransactions.filter((t) => !t.matched);
  const unmatchedBook = bookTransactions.filter((t) => !t.matched);

  // Simulate AI matching suggestions
  const suggestions = useMemo(() => {
    if (!selectedBankTx) return [];
    const bank = bankTransactions.find((t) => t.id === selectedBankTx);
    if (!bank) return [];

    return bookTransactions
      .filter(
        (t) =>
          !t.matched &&
          Math.abs(t.amount - bank.amount) < 0.01 &&
          new Date(t.date).getTime() - new Date(bank.date).getTime() <
            14 * 24 * 60 * 60 * 1000
      )
      .slice(0, 3)
      .map((t) => ({
        transaction: t,
        confidence: Math.floor(75 + Math.random() * 20),
        score: {
          value: 100,
          date: 80,
          narration: 60,
        },
      }));
  }, [selectedBankTx, bankTransactions, bookTransactions]);

  const handleCreateMatch = (bookTxId: string) => {
    const bankTx = bankTransactions.find((t) => t.id === selectedBankTx);
    const bookTx = bookTransactions.find((t) => t.id === bookTxId);

    if (bankTx && bookTx) {
      addMatchGroup({
        id: `match_${Date.now()}`,
        bankTransactionIds: [bankTx.id],
        bookTransactionIds: [bookTx.id],
        confidence: suggestions.find((s) => s.transaction.id === bookTxId)
          ?.confidence || 0,
        status: "pending",
        totalBankAmount: bankTx.amount,
        totalBookAmount: bookTx.amount,
        variance: Math.abs(bankTx.amount - bookTx.amount),
      });

      setSelectedBankTx(null);
      setShowSuggestions(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-slate-900">
              Reconciliation Workspace
            </h1>
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors">
              ✓ Complete
            </button>
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
        {/* Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bank Transactions */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-96">
            <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-blue-100">
              <h2 className="font-semibold text-slate-900 flex items-center gap-2">
                🏦 Bank Statement
              </h2>
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
                      onClick={() => setSelectedBookTx(tx.id)}
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
                  className="p-3 bg-green-50 border border-green-200 rounded-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span
                      className={`text-xs px-2 py-1 rounded font-medium ${
                        group.confidence >= 90
                          ? "bg-green-200 text-green-900"
                          : "bg-yellow-200 text-yellow-900"
                      }`}
                    >
                      {group.confidence}% confidence
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      ${group.totalBankAmount.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    1 Bank ↔ 1 Book transaction
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
