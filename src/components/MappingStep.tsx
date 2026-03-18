"use client";

import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { useReconciliationStore } from "@/store/reconciliation";

type ColumnName = "date" | "narration" | "reference" | "amount";

export default function MappingStep() {
  const [confirmed, setConfirmed] = useState(false);
  const { setStep, bankTransactions, setColumnMapping } =
    useReconciliationStore();

  const [mapping, setMapping] = useState<Record<ColumnName, string>>({
    date: "Date",
    narration: "Narration",
    reference: "Reference",
    amount: "Amount",
  });

  const handleConfirm = () => {
    setColumnMapping(mapping);
    setConfirmed(true);
    setTimeout(() => setStep("reconciliation"), 500);
  };

  const sampleData = bankTransactions.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Verify Column Mapping
          </h1>
          <p className="text-slate-600">
            AI detected the following columns. Verify they're correct before
            proceeding.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Mapping Configuration */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              📋 Column Mapping
            </h2>

            <div className="space-y-4">
              {(
                [
                  { key: "date" as const, label: "📅 Transaction Date" },
                  { key: "narration" as const, label: "📝 Description" },
                  { key: "reference" as const, label: "🔖 Reference" },
                  { key: "amount" as const, label: "💰 Amount" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {label}
                  </label>
                  <select
                    value={mapping[key]}
                    onChange={(e) =>
                      setMapping({ ...mapping, [key]: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option>Date</option>
                    <option>Narration</option>
                    <option>Reference</option>
                    <option>Amount</option>
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-900">
                ✅ AI Confidence: 94% - These mappings look correct!
              </p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={confirmed}
              className="w-full mt-6 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-green-600 disabled:cursor-default flex items-center justify-center gap-2"
            >
              {confirmed ? (
                <>
                  <Check className="w-5 h-5" />
                  Mapping Confirmed
                </>
              ) : (
                <>
                  Confirm & Continue
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {/* Data Preview */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              👁️ Data Preview
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-2 font-semibold text-slate-700">
                      {mapping.date}
                    </th>
                    <th className="text-left py-2 px-2 font-semibold text-slate-700">
                      {mapping.narration}
                    </th>
                    <th className="text-left py-2 px-2 font-semibold text-slate-700">
                      {mapping.reference}
                    </th>
                    <th className="text-right py-2 px-2 font-semibold text-slate-700">
                      {mapping.amount}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sampleData.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="py-3 px-2 text-slate-600">{row.date}</td>
                      <td className="py-3 px-2 text-slate-600 truncate max-w-xs">
                        {row.narration}
                      </td>
                      <td className="py-3 px-2 text-slate-600">{row.reference}</td>
                      <td className="py-3 px-2 text-right font-mono text-slate-900">
                        ${row.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Showing 3 of {bankTransactions.length} transactions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
