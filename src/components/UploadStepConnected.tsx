"use client";

import { useMemo, useState } from "react";
import {
  Upload,
  File,
  AlertCircle,
  Loader,
  CheckCircle2,
  Clock3,
  Info,
} from "lucide-react";
import { useReconciliationStore } from "@/store/reconciliation-api";
import clsx from "clsx";

export default function UploadStep() {
  const {
    uploadFile,
    loading,
    error,
    setError,
    reset,
    bankSessionId,
    bookSessionId,
    bankFile,
    bookFile,
    bankTransactions,
    bookTransactions,
    currentMappingSource,
  } = useReconciliationStore();
  const [fileErrors, setFileErrors] = useState<{ bank?: string; book?: string }>({});

  const bankMapped = bankTransactions.length > 0;
  const bookMapped = bookTransactions.length > 0;

  const fileProgress = useMemo(() => {
    const readyCount = Number(bankMapped) + Number(bookMapped);
    return {
      readyCount,
      percent: Math.round((readyCount / 2) * 100),
    };
  }, [bankMapped, bookMapped]);

  const handleUploadFile = async (file: File, source: "bank" | "book") => {
    try {
      const validationError = validateFile(file);
      if (validationError) {
        setFileErrors((prev) => ({ ...prev, [source]: validationError }));
        return;
      }
      setFileErrors((prev) => ({ ...prev, [source]: undefined }));
      setError(null);
      await uploadFile(file, source);
    } catch (err) {
      console.error("Upload error:", err);
    }
  };

  const validateFile = (file: File) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const name = file.name.toLowerCase();
    const allowed = [".pdf", ".xlsx", ".xls", ".csv"];
    const hasAllowedExt = allowed.some((ext) => name.endsWith(ext));
    if (!hasAllowedExt) {
      return "Unsupported file type. Use PDF, XLSX, or CSV.";
    }
    if (file.size > maxSize) {
      return "File too large. Maximum size is 10MB.";
    }
    return null;
  };

  const formatFileSize = (size: number) => {
    if (!size && size !== 0) return "";
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getStatus = (source: "bank" | "book") => {
    const isUploading = loading && currentMappingSource === source;
    const hasSession = source === "bank" ? !!bankSessionId : !!bookSessionId;
    const isMapped = source === "bank" ? bankMapped : bookMapped;

    if (isUploading) return "uploading";
    if (isMapped) return "mapped";
    if (hasSession) return "uploaded";
    return "waiting";
  };

  const bankStatus = getStatus("bank");
  const bookStatus = getStatus("book");

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 mb-4">
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
          <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">
            Reconcile Faster with AI
          </h1>
          <p className="text-lg text-slate-600">
            Upload your bank statement and cash book to prepare matching.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            {["PDF", "XLSX", "CSV"].map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-slate-600"
              >
                {tag} supported
              </span>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Step 1 of 2
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Prepare both files
              </h2>
              <p className="text-sm text-slate-600">
                {fileProgress.readyCount} of 2 files mapped and ready.
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">
                {fileProgress.percent}%
              </p>
              <p className="text-xs text-slate-500">Overall readiness</p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all"
              style={{ width: `${fileProgress.percent}%` }}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <StatusPill label="Bank Statement" status={bankStatus} />
            <StatusPill label="Cash Book" status={bookStatus} />
          </div>
        </div>

        {/* Upload Areas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Bank Statement Upload */}
          <UploadArea
            title="Bank Statement"
            icon="🏦"
            onUpload={(file) => handleUploadFile(file, "bank")}
            loading={loading}
            status={bankStatus}
            fileName={bankFile?.name}
            fileSize={bankFile?.size ? formatFileSize(bankFile.size) : ""}
            errorMessage={fileErrors.bank}
          />

          {/* Cash Book Upload */}
          <UploadArea
            title="Cash Book"
            icon="📚"
            onUpload={(file) => handleUploadFile(file, "book")}
            loading={loading}
            status={bookStatus}
            fileName={bookFile?.name}
            fileSize={bookFile?.size ? formatFileSize(bookFile.size) : ""}
            errorMessage={fileErrors.book}
          />
        </div>

        {/* Error + Recovery */}
        {error && (
          <div className="mt-8 p-4 bg-rose-50 border border-rose-200 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-rose-900">
                <p className="font-medium mb-1">Upload failed</p>
                <p>{error}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setError(null)}
                className="px-3 py-2 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-100"
              >
                Try again
              </button>
              <button
                onClick={() => reset()}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700"
              >
                Reset uploads
              </button>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">Backend Connected ✅</p>
              <p>
                Upload real PDF, Excel, or CSV files. The system will extract,
                standardize, and match transactions using AI.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type UploadAreaProps = {
  title: string;
  icon: string;
  onUpload: (file: File) => void;
  loading: boolean;
  status: "uploading" | "mapped" | "uploaded" | "waiting";
  fileName?: string;
  fileSize?: string;
  errorMessage?: string;
};

function UploadArea({
  title,
  icon,
  onUpload,
  loading,
  status,
  fileName,
  fileSize,
  errorMessage,
}: UploadAreaProps) {
  const [dragActive, setDragActive] = useState(false);
  const variant = title === "Bank Statement" ? "blue" : "green";

  const styles = {
    blue: {
      drag: "border-blue-500 bg-blue-50",
      idle: "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50",
      iconBg: "bg-blue-100",
      iconText: "text-blue-600",
      actionText: "text-blue-600",
    },
    green: {
      drag: "border-green-500 bg-green-50",
      idle:
        "border-slate-300 bg-slate-50 hover:border-green-400 hover:bg-green-50",
      iconBg: "bg-green-100",
      iconText: "text-green-600",
      actionText: "text-green-600",
    },
  } as const;

  const style = styles[variant];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.includes("pdf") || file.name.endsWith(".xlsx") || file.name.endsWith(".csv")) {
        onUpload(file);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
    }
  };

  return (
    <label
      onDragEnter={() => setDragActive(true)}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={clsx(
        "p-8 rounded-2xl border-2 border-dashed transition-all cursor-pointer bg-white shadow-sm hover:-translate-y-0.5 hover:shadow-md",
        dragActive ? style.drag : style.idle,
        status === "mapped" && "border-emerald-400 bg-emerald-50/40"
      )}
    >
      <input
        type="file"
        accept=".pdf,.xlsx,.xls,.csv"
        onChange={handleChange}
        disabled={loading && status === "uploading"}
        className="hidden"
      />
      <div className="text-center">
        <div
          className={clsx(
            "inline-flex h-12 w-12 items-center justify-center rounded-2xl mb-4",
            style.iconBg
          )}
        >
          {status === "uploading" ? (
            <Loader className={clsx("w-6 h-6 animate-spin", style.iconText)} />
          ) : status === "mapped" ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          ) : status === "uploaded" ? (
            <Clock3 className="w-6 h-6 text-amber-600" />
          ) : (
            <File className={clsx("w-6 h-6", style.iconText)} />
          )}
        </div>
        <h3 className="font-semibold text-slate-900 mb-1">
          {icon} {title}
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          {status === "mapped"
            ? "Mapped and ready"
            : status === "uploaded"
            ? "Uploaded • awaiting mapping"
            : status === "uploading"
            ? "Uploading..."
            : "PDF, XLSX, or CSV format"}
        </p>
        <div className="mb-3 flex items-center justify-center gap-1 text-[11px] text-slate-400">
          <span>Accepted: PDF, XLSX, CSV · Max size 10MB</span>
          <span className="relative group">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span className="absolute right-0 top-5 hidden group-hover:block whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 shadow-lg">
              Files over 10MB or non-PDF/XLSX/CSV formats will be rejected.
            </span>
          </span>
        </div>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Upload className={clsx("w-4 h-4", style.actionText)} />
          <span className={clsx("text-sm font-medium", style.actionText)}>
            {status === "mapped"
              ? "Replace file"
              : status === "uploaded"
              ? "Replace file"
              : status === "uploading"
              ? "Uploading..."
              : "Click to upload or drag"}
          </span>
        </div>
        {errorMessage ? (
          <p className="text-xs text-rose-600">{errorMessage}</p>
        ) : (
          <div className="text-xs text-slate-500">
            {fileName ? (
              <div className="flex items-center justify-center gap-2">
                <span className="truncate max-w-[160px]">{fileName}</span>
                {fileSize && <span className="text-slate-400">({fileSize})</span>}
              </div>
            ) : (
              "Maximum file size: 10MB"
            )}
          </div>
        )}
      </div>
    </label>
  );
}

function StatusPill({
  label,
  status,
}: {
  label: string;
  status: "uploading" | "mapped" | "uploaded" | "waiting";
}) {
  const statusLabel =
    status === "mapped"
      ? "Mapped"
      : status === "uploaded"
      ? "Uploaded"
      : status === "uploading"
      ? "Uploading"
      : "Waiting";

  const style =
    status === "mapped"
      ? "bg-emerald-100 text-emerald-800"
      : status === "uploaded"
      ? "bg-amber-100 text-amber-800"
      : status === "uploading"
      ? "bg-blue-100 text-blue-800"
      : "bg-slate-100 text-slate-600";

  return (
    <span className={clsx("px-3 py-1 rounded-full", style)}>
      {label}: {statusLabel}
    </span>
  );
}
