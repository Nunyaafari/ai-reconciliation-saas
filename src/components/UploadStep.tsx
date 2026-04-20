"use client";

import { AlertCircle, File, Upload } from "lucide-react";
import { useReconciliationStore } from "@/store/reconciliation";
import { mockBankData, mockBookData } from "@/data/mockData";

export default function UploadStep() {
  const { setStep, setBankTransactions, setBookTransactions, setUploadedFileName } =
    useReconciliationStore();

  const handleSimulateUpload = (type: "bank" | "book") => {
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
            className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:bg-blue-50"
          >
            <div className="text-center">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100">
                <File className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">
                Bank Statement
              </h3>
              <p className="mb-3 text-[11px] text-slate-600">
                PDF, XLSX, or CSV format
              </p>
              <button
                type="button"
                onClick={() => handleSimulateUpload("bank")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Upload className="h-3.5 w-3.5 text-blue-600" />
                Choose file
              </button>
              <p className="mt-2 text-[11px] text-slate-500">
                Maximum file size: 10MB
              </p>
            </div>
          </div>

          {/* Cash Book Upload */}
          <div
            className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-green-400 hover:bg-green-50"
          >
            <div className="text-center">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-green-100">
                <File className="h-5 w-5 text-green-600" />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-slate-900">Cash Book</h3>
              <p className="mb-3 text-[11px] text-slate-600">
                PDF, XLSX, or CSV format
              </p>
              <button
                type="button"
                onClick={() => handleSimulateUpload("book")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Upload className="h-3.5 w-3.5 text-green-600" />
                Choose file
              </button>
              <p className="mt-2 text-[11px] text-slate-500">
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
