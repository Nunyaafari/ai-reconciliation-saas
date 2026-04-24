"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Upload,
  File,
  AlertCircle,
  Loader,
  CheckCircle2,
  Clock3,
  Info,
  History,
} from "lucide-react";
import {
  Transaction,
  useReconciliationStore,
} from "@/store/reconciliation-api";
import clsx from "clsx";
import { formatCurrency, normalizeCurrencyCode } from "@/lib/currency";
import { apiClient } from "@/lib/api";

const formatMoney = (value: number, currencyCode?: string | null) =>
  formatCurrency(value, normalizeCurrencyCode(currencyCode));

const sortTransactions = (transactions: Transaction[]) =>
  [...transactions].sort((left, right) => {
    const dateCompare = String(left.date || "").localeCompare(String(right.date || ""));
    if (dateCompare !== 0) return dateCompare;

    const referenceCompare = String(left.reference || "").localeCompare(
      String(right.reference || "")
    );
    if (referenceCompare !== 0) return referenceCompare;

    return String(left.narration || "").localeCompare(String(right.narration || ""));
  });

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
    reconSetup,
    reconciliationSession,
    prepareReconciliationContext,
    refreshReconciliation,
    resumeUploadWorkflow,
    progress,
    matchGroups,
    setStep,
    currentUser,
    orgId,
  } = useReconciliationStore();
  const [fileErrors, setFileErrors] = useState<{ bank?: string; book?: string }>({});
  const [sessionCompletion, setSessionCompletion] = useState<{
    bank: boolean;
    book: boolean;
  }>({ bank: false, book: false });
  const [isPreparingWorkspace, setIsPreparingWorkspace] = useState(false);

  const uploadedBankTransactions = useMemo(
    () => bankTransactions.filter((transaction) => !transaction.isCarryforward),
    [bankTransactions]
  );
  const uploadedBookTransactions = useMemo(
    () => bookTransactions.filter((transaction) => !transaction.isCarryforward),
    [bookTransactions]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchStatus = async (source: "bank" | "book", sessionId: string | null) => {
      if (!cancelled) {
        setSessionCompletion((prev) => ({ ...prev, [source]: false }));
      }

      if (!sessionId) {
        return;
      }

      try {
        const response = await apiClient.getUploadSession(sessionId);
        const standardizedCount = Number(response.data?.rows_standardized || 0);
        const isComplete = Boolean(
          response.success &&
            response.data?.status === "complete" &&
            standardizedCount > 0
        );
        if (!cancelled) {
          setSessionCompletion((prev) => ({ ...prev, [source]: isComplete }));
        }
      } catch (statusError) {
        console.error(`Failed to load ${source} upload session status`, statusError);
        if (!cancelled) {
          setSessionCompletion((prev) => ({ ...prev, [source]: false }));
        }
      }
    };

    fetchStatus("bank", bankSessionId);
    fetchStatus("book", bookSessionId);

    return () => {
      cancelled = true;
    };
  }, [bankSessionId, bookSessionId]);

  const bankMapped = uploadedBankTransactions.length > 0 || sessionCompletion.bank;
  const bookMapped = uploadedBookTransactions.length > 0 || sessionCompletion.book;
  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "super_admin";
  const currencyCode = normalizeCurrencyCode(reconSetup?.currencyCode || "GHS");

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
  const hasPreparedTransactions = bankMapped && bookMapped;
  const bankNeedsReview = Boolean(bankSessionId) && !bankMapped;
  const bookNeedsReview = Boolean(bookSessionId) && !bookMapped;
  const hasReconProgress =
    (reconciliationSession?.id && ((progress || 0) > 0 || matchGroups.length > 0)) ||
    false;
  const canContinueReconciliation = Boolean(
    hasReconProgress || hasPreparedTransactions
  );
  const isContinueReconReady = Boolean(
    canContinueReconciliation &&
      !loading &&
      !isPreparingWorkspace &&
      !bankNeedsReview &&
      !bookNeedsReview &&
      bankStatus !== "uploading" &&
      bookStatus !== "uploading"
  );

  const handleContinueReconciliation = async () => {
    if (!isContinueReconReady) {
      setError(
        "Uploads are still processing. Wait until both file lanes finish mapping before continuing reconciliation."
      );
      return;
    }

    try {
      setIsPreparingWorkspace(true);
      setError(null);

      const latestState = useReconciliationStore.getState();
      const hasStartedReconPasses =
        (latestState.progress || progress || 0) > 0 ||
        (latestState.matchGroups?.length || matchGroups.length) > 0;

      if (!hasStartedReconPasses && (!bankMapped || !bookMapped)) {
        const missingSources = [
          !bankMapped ? "Bank Statement" : null,
          !bookMapped ? "Cash Book" : null,
        ].filter(Boolean);

        setError(
          missingSources.length === 2
            ? "Finalize both uploads first so transactions are available in the reconciliation worksheet."
            : `Finalize the ${missingSources[0]} upload first so its transactions are available in the reconciliation worksheet.`
        );
        return;
      }

      if (
        hasStartedReconPasses &&
        (reconciliationSession?.id || latestState.reconciliationSession?.id)
      ) {
        await refreshReconciliation(orgId || undefined);
        setStep("reconciliation");
        return;
      }

      if (bankSessionId && bookSessionId) {
        await prepareReconciliationContext(orgId || undefined);
      }

      setStep("prepare");
    } catch (err) {
      console.error("Continue reconciliation error:", err);
    } finally {
      setIsPreparingWorkspace(false);
    }
  };

  if (!reconSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">
            Set up an account period first
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Choose the reconciliation account plus the month and year before uploading a bank statement or cash book.
          </p>
          <button
            onClick={() => setStep("setup")}
            className="mt-6 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open Account Setup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[1400px]">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">
            Reconcile Faster with AI
          </h1>
          <p className="text-lg text-slate-600">
            Upload the raw bank statement and cash book for this account-month, or add more records into the same open month.
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
            <button
              onClick={() => setStep("workspace")}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 hover:bg-slate-50"
            >
              <History className="h-3.5 w-3.5" />
              Workspace
            </button>
            {canContinueReconciliation ? (
              <button
                onClick={handleContinueReconciliation}
                disabled={!isContinueReconReady}
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-semibold ${
                  isContinueReconReady
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                }`}
              >
                {isPreparingWorkspace ? (
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {isPreparingWorkspace ? "Preparing Workspace..." : "Continue Recon"}
              </button>
            ) : null}
            {bankNeedsReview ? (
              <button
                onClick={() => resumeUploadWorkflow("bank").catch((err) => console.error("Resume bank workflow error:", err))}
                className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-700 hover:bg-amber-100"
              >
                <Clock3 className="h-3.5 w-3.5" />
                Continue Bank Review
              </button>
            ) : null}
            {bookNeedsReview ? (
              <button
                onClick={() => resumeUploadWorkflow("book").catch((err) => console.error("Resume cash book workflow error:", err))}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <Clock3 className="h-3.5 w-3.5" />
                Continue Cash Book Review
              </button>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">
              Settings moved to the top-right user menu
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Step 2 of 3
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Prepare both files
              </h2>
              <p className="text-sm text-slate-600">
                {fileProgress.readyCount} of 2 file lanes currently mapped. Re-uploading a side will append fresh rows into this same month after mapping.
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-900">
                {fileProgress.percent}%
              </p>
              <p className="text-xs text-slate-500">Overall readiness</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              Active Recon
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-blue-950">
                  {reconSetup.accountName}
                </p>
                <p className="text-sm text-blue-800">{reconSetup.periodMonth}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canContinueReconciliation ? (
                  <button
                    onClick={handleContinueReconciliation}
                    disabled={!isContinueReconReady}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                      isContinueReconReady
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "cursor-not-allowed bg-slate-200 text-slate-500"
                    }`}
                  >
                    {isPreparingWorkspace ? "Preparing Workspace..." : "Continue Recon"}
                  </button>
                ) : null}
                {bankNeedsReview ? (
                  <button
                    onClick={() => resumeUploadWorkflow("bank").catch((err) => console.error("Resume bank workflow error:", err))}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    Continue Bank Review
                  </button>
                ) : null}
                {bookNeedsReview ? (
                  <button
                    onClick={() => resumeUploadWorkflow("book").catch((err) => console.error("Resume cash book workflow error:", err))}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Continue Cash Book Review
                  </button>
                ) : null}
                <button
                  onClick={() => setStep("setup")}
                  className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                >
                  Edit Recon Setup
                </button>
              </div>
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
            {currentUser ? (
              <StatusPill
                label={`Role: ${currentUser.role}`}
                status={
                  currentUser.role === "admin" || currentUser.role === "super_admin"
                    ? "mapped"
                    : "uploaded"
                }
              />
            ) : null}
          </div>
        </div>

        {!isAdmin ? (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Reviewer access
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  Uploads, mapping, reconciliation runs, and month close/reopen are admin-only.
                  You can still open history, inspect workspaces, and download reports.
                </p>
              </div>
              <button
                onClick={() => setStep("workspace")}
                className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              >
                Open Workspace
              </button>
            </div>
          </div>
        ) : null}

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
            disabled={!isAdmin}
            disabledMessage="Only admins can upload or replace files."
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
            disabled={!isAdmin}
            disabledMessage="Only admins can upload or replace files."
          />
        </div>

        {bankMapped || bookMapped ? (
          <div className="mt-10 space-y-8">
            {bankMapped ? (
              <TransactionPreviewPanel
                title="Uploaded Bank Statement Preview"
                subtitle="Review every bank-statement transaction that was classified from the uploaded file."
                transactions={uploadedBankTransactions}
                debitLabel="Bank Debits"
                creditLabel="Bank Credits"
                tone="blue"
                currencyCode={currencyCode}
              />
            ) : null}

            {bookMapped ? (
              <TransactionPreviewPanel
                title="Uploaded Cash Book Preview"
                subtitle="Review every cash-book transaction that was classified from the uploaded file."
                transactions={uploadedBookTransactions}
                debitLabel="Cash Book Debits"
                creditLabel="Cash Book Credits"
                tone="emerald"
                currencyCode={currencyCode}
              />
            ) : null}
          </div>
        ) : null}

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
  disabled?: boolean;
  disabledMessage?: string;
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
  disabled = false,
  disabledMessage,
}: UploadAreaProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpload(files[0]);
      e.target.value = "";
    }
  };

  const openFilePicker = () => {
    if (disabled || (loading && status === "uploading")) return;
    inputRef.current?.click();
  };

  const canOpenPicker = !disabled && !(loading && status === "uploading");

  return (
    <div
      role={canOpenPicker ? "button" : undefined}
      tabIndex={canOpenPicker ? 0 : -1}
      onClick={() => {
        if (canOpenPicker) openFilePicker();
      }}
      onKeyDown={(event) => {
        if (!canOpenPicker) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openFilePicker();
        }
      }}
      className={clsx(
        "rounded-2xl border-2 border-dashed bg-white p-3 shadow-sm transition-all sm:p-4",
        disabled
          ? "cursor-not-allowed opacity-70"
          : "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        style.idle,
        status === "mapped" && "border-emerald-400 bg-emerald-50/40"
      )}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv"
        onChange={handleChange}
        disabled={disabled || (loading && status === "uploading")}
        className="sr-only"
      />
      <div className="text-center">
        <div
          className={clsx(
            "mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl",
            style.iconBg
          )}
        >
          {status === "uploading" ? (
            <Loader className={clsx("w-5 h-5 animate-spin", style.iconText)} />
          ) : status === "mapped" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : status === "uploaded" ? (
            <Clock3 className="w-5 h-5 text-amber-600" />
          ) : (
            <File className={clsx("w-5 h-5", style.iconText)} />
          )}
        </div>
        <h3 className="font-semibold text-slate-900 mb-1 text-sm">
          {icon} {title}
        </h3>
        <p className="mb-2 text-[10px] text-slate-500">
          {status === "mapped"
            ? "Mapped and ready"
            : status === "uploaded"
            ? "Uploaded • awaiting mapping"
            : status === "uploading"
            ? "Uploading..."
            : "PDF, XLSX, or CSV format"}
        </p>
        {!disabled ? (
          <div className="mb-2">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openFilePicker();
              }}
              className={clsx(
                "inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-semibold transition",
                loading && status === "uploading"
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              )}
              disabled={loading && status === "uploading"}
            >
              <Upload className="h-3.5 w-3.5" />
              {disabled && disabledMessage
                ? disabledMessage
                : status === "mapped" || status === "uploaded"
                ? "Replace file"
                : status === "uploading"
                ? "Uploading..."
                : "Choose file"}
            </button>
          </div>
        ) : null}
        {errorMessage ? (
          <p className="text-[11px] text-rose-600">{errorMessage}</p>
        ) : (
          <div className="text-[11px] text-slate-500">
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
    </div>
  );
}

function TransactionPreviewPanel({
  title,
  subtitle,
  transactions,
  debitLabel,
  creditLabel,
  tone,
  currencyCode,
}: {
  title: string;
  subtitle: string;
  transactions: Transaction[];
  debitLabel: string;
  creditLabel: string;
  tone: "blue" | "emerald";
  currencyCode?: string | null;
}) {
  const rows = useMemo(() => sortTransactions(transactions), [transactions]);
  const debitRows = useMemo(
    () => rows.filter((transaction) => Number(transaction.debitAmount || 0) > 0),
    [rows]
  );
  const creditRows = useMemo(
    () => rows.filter((transaction) => Number(transaction.creditAmount || 0) > 0),
    [rows]
  );
  const debitTotal = useMemo(
    () => rows.reduce((sum, transaction) => sum + Number(transaction.debitAmount || 0), 0),
    [rows]
  );
  const creditTotal = useMemo(
    () => rows.reduce((sum, transaction) => sum + Number(transaction.creditAmount || 0), 0),
    [rows]
  );

  const toneStyles =
    tone === "blue"
      ? {
          shell: "border-blue-200 bg-blue-50/40",
          card: "border-blue-200 bg-white text-blue-950",
          label: "text-blue-700",
        }
      : {
          shell: "border-emerald-200 bg-emerald-50/40",
          card: "border-emerald-200 bg-white text-emerald-950",
          label: "text-emerald-700",
        };

  return (
    <section className={clsx("overflow-hidden rounded-3xl border shadow-sm", toneStyles.shell)}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-white px-6 py-5">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className={clsx("rounded-2xl border px-4 py-3 shadow-sm", toneStyles.card)}>
            <p className={clsx("text-[11px] font-semibold uppercase tracking-[0.16em]", toneStyles.label)}>
              Rows Uploaded
            </p>
            <p className="mt-2 text-lg font-semibold">{rows.length.toLocaleString()}</p>
          </div>
          <div className={clsx("rounded-2xl border px-4 py-3 shadow-sm", toneStyles.card)}>
            <p className={clsx("text-[11px] font-semibold uppercase tracking-[0.16em]", toneStyles.label)}>
              {debitLabel}
            </p>
            <p className="mt-2 text-lg font-semibold">{formatMoney(debitTotal, currencyCode)}</p>
          </div>
          <div className={clsx("rounded-2xl border px-4 py-3 shadow-sm", toneStyles.card)}>
            <p className={clsx("text-[11px] font-semibold uppercase tracking-[0.16em]", toneStyles.label)}>
              {creditLabel}
            </p>
            <p className="mt-2 text-lg font-semibold">{formatMoney(creditTotal, currencyCode)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 bg-white px-5 py-5 xl:grid-cols-2">
        <TransactionDirectionPanel
          title={debitLabel}
          amountLabel="Debit"
          transactions={debitRows}
          total={debitTotal}
          tone={tone}
          currencyCode={currencyCode}
          emptyMessage={`No ${debitLabel.toLowerCase()} were detected in this upload.`}
        />
        <TransactionDirectionPanel
          title={creditLabel}
          amountLabel="Credit"
          transactions={creditRows}
          total={creditTotal}
          tone={tone}
          currencyCode={currencyCode}
          emptyMessage={`No ${creditLabel.toLowerCase()} were detected in this upload.`}
        />
      </div>
    </section>
  );
}

function TransactionDirectionPanel({
  title,
  amountLabel,
  transactions,
  total,
  tone,
  currencyCode,
  emptyMessage,
}: {
  title: string;
  amountLabel: "Debit" | "Credit";
  transactions: Transaction[];
  total: number;
  tone: "blue" | "emerald";
  currencyCode?: string | null;
  emptyMessage: string;
}) {
  const amountKey = amountLabel === "Debit" ? "debitAmount" : "creditAmount";
  const toneClass =
    tone === "blue"
      ? "border-blue-200 bg-blue-50/40"
      : "border-emerald-200 bg-emerald-50/40";

  return (
    <div className={clsx("overflow-hidden rounded-2xl border", toneClass)}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
          <p className="mt-1 text-xs text-slate-500">
            {transactions.length.toLocaleString()} row{transactions.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Subtotal
          </p>
          <p className="mt-2 text-base font-semibold text-slate-900">{formatMoney(total, currencyCode)}</p>
        </div>
      </div>

      <div className="grid grid-cols-[110px_120px_minmax(200px,1fr)_120px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <span>Date</span>
        <span>Reference</span>
        <span>Narration</span>
        <span className="text-right">{amountLabel}</span>
      </div>

      <div className="max-h-[640px] overflow-y-auto bg-white">
        {transactions.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="grid grid-cols-[110px_120px_minmax(200px,1fr)_120px] gap-3 px-4 py-3 text-sm text-slate-700"
              >
                <span className="font-mono text-slate-500">{transaction.date || "-"}</span>
                <span className="truncate font-mono text-slate-600">
                  {transaction.reference || "-"}
                </span>
                <span className="truncate">{transaction.narration || "-"}</span>
                <span className="text-right font-mono">
                  {formatMoney(
                    Number(transaction[amountKey as keyof Transaction] || 0),
                    currencyCode
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
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
