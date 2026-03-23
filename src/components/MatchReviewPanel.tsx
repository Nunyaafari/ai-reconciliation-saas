"use client";

import { ChevronDown, Check, X, AlertCircle } from "lucide-react";
import { Transaction } from "@/store/reconciliation-api";

interface Suggestion {
  transaction: Transaction;
  confidence: number;
  score: {
    value: number;
    date: number;
    narration: number;
  };
  explanation?: string;
}

interface MatchReviewPanelProps {
  bankTx: Transaction;
  suggestions: Suggestion[];
  onMatch: (bookTxId: string) => void;
  onClose: () => void;
  canMatch?: boolean;
}

export default function MatchReviewPanel({
  bankTx,
  suggestions,
  onMatch,
  onClose,
  canMatch = true,
}: MatchReviewPanelProps) {
  const formatTransactionAmount = (transaction: Transaction) => {
    const direction = transaction.direction || (transaction.amount >= 0 ? "credit" : "debit");
    const magnitude =
      direction === "debit"
        ? transaction.debitAmount ?? Math.abs(transaction.amount)
        : transaction.creditAmount ?? Math.abs(transaction.amount);

    return `${direction === "debit" ? "Debit" : "Credit"} $${magnitude.toFixed(2)}`;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600 bg-green-50";
    if (confidence >= 70) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 90) return "🚀 High Confidence";
    if (confidence >= 70) return "🟡 Medium Confidence";
    return "🔴 Low Confidence";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white w-full md:w-96 rounded-t-2xl shadow-2xl max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Find Matching Book Entry</h3>
            <p className="text-xs text-blue-100">
              {suggestions.length} AI suggestion{suggestions.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bank Transaction Info */}
        <div className="p-4 bg-blue-50 border-b border-blue-200">
          <p className="text-xs font-semibold text-blue-900 mb-2">
            🏦 BANK TRANSACTION
          </p>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Amount:</span>
              <span className="font-mono font-bold text-slate-900">
                {formatTransactionAmount(bankTx)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Date:</span>
              <span className="font-mono text-slate-700">{bankTx.date}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-sm text-slate-600">Description:</span>
              <span className="font-mono text-xs text-slate-700 text-right max-w-xs">
                {bankTx.narration}
              </span>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        <div className="p-4">
          {suggestions.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">
                No matching book entries found
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Try selecting a different bank transaction or verify your column mapping.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600 uppercase">
                AI Suggestions
              </p>

              {suggestions.map((suggestion, idx) => (
                <div key={suggestion.transaction.id} className="space-y-2">
                  {/* Score Badge */}
                  <div
                    className={`inline-block text-xs px-2 py-1 rounded font-medium ${getConfidenceColor(
                      suggestion.confidence
                    )}`}
                  >
                    {getConfidenceLabel(suggestion.confidence)}{" "}
                    {suggestion.confidence}%
                  </div>

                  {/* Suggestion Card */}
                  <div className="p-3 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">💰 Amount:</span>
                        <span
                          className={`font-mono font-bold ${
                            Math.abs(
                              suggestion.transaction.amount - bankTx.amount
                            ) < 0.01
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {formatTransactionAmount(suggestion.transaction)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">📅 Date:</span>
                        <span className="font-mono text-sm text-slate-700">
                          {suggestion.transaction.date}
                        </span>
                      </div>

                      <div className="flex justify-between items-start">
                        <span className="text-sm text-slate-600">📝 Desc:</span>
                        <span className="text-xs text-slate-700 text-right max-w-xs">
                          {suggestion.transaction.narration}
                        </span>
                      </div>
                    </div>

                    {/* Score Breakdown */}
                    <div className="text-xs space-y-1 mb-3 pb-3 border-t border-slate-200 pt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Value Match:</span>
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1 bg-slate-300 rounded">
                            <div
                              className="h-full bg-green-500 rounded"
                              style={{
                                width: `${suggestion.score.value}%`,
                              }}
                            ></div>
                          </div>
                          <span className="font-mono font-semibold text-slate-700 w-8">
                            {suggestion.score.value}%
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-600">Date Proximity:</span>
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1 bg-slate-300 rounded">
                            <div
                              className="h-full bg-yellow-500 rounded"
                              style={{
                                width: `${suggestion.score.date}%`,
                              }}
                            ></div>
                          </div>
                          <span className="font-mono font-semibold text-slate-700 w-8">
                            {suggestion.score.date}%
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-600">Description Sim:</span>
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1 bg-slate-300 rounded">
                            <div
                              className="h-full bg-blue-500 rounded"
                              style={{
                                width: `${suggestion.score.narration}%`,
                              }}
                            ></div>
                          </div>
                          <span className="font-mono font-semibold text-slate-700 w-8">
                            {suggestion.score.narration}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {suggestion.explanation && (
                      <p className="text-[11px] text-slate-500 mb-3">
                        {suggestion.explanation}
                      </p>
                    )}

                    {/* Match Button */}
                    <button
                      onClick={() => onMatch(suggestion.transaction.id)}
                      disabled={!canMatch}
                      className={`w-full px-3 py-2 text-sm rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                        canMatch
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "cursor-not-allowed bg-slate-200 text-slate-500"
                      }`}
                    >
                      <Check className="w-4 h-4" />
                      {canMatch ? "Confirm Match" : "Admin Only"}
                    </button>
                  </div>

                  {idx < suggestions.length - 1 && (
                    <div className="text-center">
                      <ChevronDown className="w-4 h-4 text-slate-400 mx-auto" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
