"use client";

import { useState } from "react";
import { Upload, File, AlertCircle } from "lucide-react";
import { useReconciliationStore } from "@/store/reconciliation";
import { mockBankData, mockBookData } from "@/data/mockData";

export default function UploadStep() {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { setStep, setBankTransactions, setBookTransactions, setUploadedFileName } =
    useReconciliationStore();

  const handleSimulateUpload = (type: "bank" | "book") => {
    setError(null);

    if (type === "bank") {
      setBankTransactions(mockBankData);
      setUploadedFileName("bank_statement_jan_2025.xlsx");
    } else {
      setBookTransactions(mockBookData);
      setUploadedFileName("cashbook_jan_2025.csv");
    }

    // Simulate upload delay
    setTimeout(() => {
      setStep("mapping");
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Bank Reconciliation
          </h1>
          <p className="text-lg text-slate-600">
            Upload your bank statement and cash book to get started
          </p>
        </div>

        {/* Upload Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Bank Statement Upload */}
          <div
            onDragEnter={() => setDragActive(true)}
            onDragLeave={() => setDragActive(false)}
            onDrop={() => setDragActive(false)}
            onClick={() => handleSimulateUpload("bank")}
            className={`p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer ${
              dragActive
                ? "border-blue-500 bg-blue-50"
                : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"
            }`}
          >
            <div className="text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 mb-4">
                <File className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">
                Bank Statement
              </h3>
              <p className="text-sm text-slate-600 mb-4">
                PDF, XLSX, or CSV format
              </p>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">
                  Click to upload or drag
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Maximum file size: 10MB
              </p>
            </div>
          </div>

          {/* Cash Book Upload */}
          <div
            onClick={() => handleSimulateUpload("book")}
            className="p-8 rounded-xl border-2 border-dashed transition-all cursor-pointer border-slate-300 bg-slate-50 hover:border-green-400 hover:bg-green-50"
          >
            <div className="text-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 mb-4">
                <File className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">Cash Book</h3>
              <p className="text-sm text-slate-600 mb-4">
                PDF, XLSX, or CSV format
              </p>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">
                  Click to upload or drag
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Maximum file size: 10MB
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Demo Mode</p>
              <p>
                Click either upload area to load sample data and see the
                reconciliation workflow in action.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
