"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Check, ArrowRight, Loader, RotateCcw } from "lucide-react";
import { useReconciliationStore } from "@/store/reconciliation-api";
import { ColumnMapping } from "@/store/reconciliation-api";

export default function MappingStep() {
  const {
    setStep,
    bankSessionId,
    bookSessionId,
    currentMappingSource,
    currentDraft,
    extractAndPreviewData,
    confirmMappingAndStandardize,
    prepareReconciliationContext,
    loading,
    activeJob,
    currentUser,
    error,
    setError,
  } = useReconciliationStore();
  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const [confirmed, setConfirmed] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [extractionMethod, setExtractionMethod] = useState<string>("unknown");
  const [extractionConfidence, setExtractionConfidence] = useState<number>(0);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [columnMetrics, setColumnMetrics] = useState<
    Record<
      string,
      {
        nonEmptyCount: number;
        parsedAmountCount: number;
        parsedAmountTotal: number;
      }
    >
  >({});
  const [aiMapping, setAiMapping] = useState<ColumnMapping | null>(null);
  const [isPdfDraftFlow, setIsPdfDraftFlow] = useState(false);
  const [userMapping, setUserMapping] = useState<ColumnMapping>({
    date: "Date",
    narration: "Narration",
    reference: "Reference",
    amount: "__none__",
    debit: "__none__",
    credit: "__none__",
  });

  const sampleRows = useMemo(() => previewRows.slice(0, 5), [previewRows]);

  const columnSamples = useMemo(() => {
    const samples: Record<string, string[]> = {};
    if (columnHeaders.length === 0 || sampleRows.length === 0) return samples;

    for (const header of columnHeaders) {
      const values = sampleRows
        .map((row) => row?.[header])
        .filter((value) => value !== undefined && value !== null && String(value).trim() !== "")
        .map((value) => String(value).trim())
        .slice(0, 3);
      samples[header] = values.length > 0 ? values : ["—"];
    }
    return samples;
  }, [columnHeaders, sampleRows]);

  const columnStats = useMemo(() => {
    const stats: Record<string, { missing: number; total: number }> = {};
    if (columnHeaders.length === 0 || sampleRows.length === 0) return stats;

    for (const header of columnHeaders) {
      let missing = 0;
      for (const row of sampleRows) {
        const value = row?.[header];
        if (value === undefined || value === null || String(value).trim() === "") {
          missing += 1;
        }
      }
      stats[header] = { missing, total: sampleRows.length };
    }
    return stats;
  }, [columnHeaders, sampleRows]);

  const valueLooksLikeDate = (value: any) => {
    if (!value) return false;
    const str = String(value).trim();
    if (!str) return false;
    if (!isNaN(Date.parse(str))) return true;
    return /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})$/.test(
      str
    );
  };

  const valueLooksLikeAmount = (value: any) => {
    if (value === null || value === undefined) return false;
    const str = String(value).replace(/[, ]/g, "").replace(/\$/g, "").trim();
    return /^-?\d+(\.\d{1,2})?$/.test(str);
  };

  const isSelected = (value?: string) =>
    Boolean(value && value !== "__select__" && value !== "__none__");

  const parseAmount = (value: any) => {
    if (value === null || value === undefined) return null;
    let str = String(value).trim();
    if (!str) return null;
    let negative = false;
    if (str.startsWith("(") && str.endsWith(")")) {
      negative = true;
      str = str.slice(1, -1);
    }
    str = str.replace(/[, ]/g, "").replace(/\$/g, "");
    const num = Number(str);
    if (Number.isNaN(num)) return null;
    return negative ? -num : num;
  };

  const hasCellValue = (value: any) =>
    value !== null && value !== undefined && String(value).trim() !== "";

  const formatPreviewDateCell = (value: any) => {
    if (value === null || value === undefined) return "—";
    const raw = String(value).trim();
    if (!raw) return "—";

    const isoDateMatch = raw.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (isoDateMatch) return isoDateMatch[1];

    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      const date = new Date(parsed);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      const day = String(date.getUTCDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    return raw;
  };

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const findHeaderMatch = (headers: string[], keywords: string[]) => {
    const lowered = headers.map((h) => h.toLowerCase().trim());
    for (let i = 0; i < headers.length; i += 1) {
      const normalized = lowered[i].replace(/[^a-z0-9]+/g, " ");
      const tokens = new Set(normalized.split(" ").filter(Boolean));
      if (
        keywords.some((keyword) =>
          keyword.length <= 2 ? tokens.has(keyword) : lowered[i].includes(keyword)
        )
      ) {
        return headers[i];
      }
    }
    return undefined;
  };

  const valueLooksLikeReference = (value: any) => {
    if (!value) return false;
    const str = String(value).trim();
    if (!str) return false;
    const normalized = str.replace(/[^A-Za-z0-9]/g, "");
    if (normalized.length < 4) return false;
    const hasDigit = /\d/.test(normalized);
    const hasAlpha = /[A-Za-z]/.test(normalized);
    return (hasDigit && normalized.length <= 20) || (hasAlpha && hasDigit);
  };

  const valueLooksLikeNarration = (value: any) => {
    if (!value) return false;
    const str = String(value).trim();
    if (str.length < 6) return false;
    const letters = (str.match(/[A-Za-z]/g) || []).length;
    const digits = (str.match(/\d/g) || []).length;
    const spaces = (str.match(/\s/g) || []).length;
    return letters >= 4 && letters > digits && spaces >= 1;
  };

  const columnSampleValidation = useMemo(() => {
    const results: Record<string, { ok: boolean; message: string }> = {};

    if (sampleRows.length === 0) return results;

    const validateSelected = (
      key: string,
      header: string | undefined,
      rule: (value: any) => boolean,
      label: string
    ) => {
      if (!isSelected(header)) {
        return;
      }

      const values = sampleRows
        .map((row) => row?.[header as string])
        .filter((value) => value !== undefined && value !== null && String(value).trim() !== "");

      if (values.length === 0) {
        results[key] = {
          ok: true,
          message: `Column is mostly empty in samples. Verify ${label} values.`,
        };
        return;
      }

      const checks = values.map((value) => rule(value));
      const passCount = checks.filter(Boolean).length;
      const ok = passCount >= Math.max(1, Math.ceil(values.length * 0.6));
      results[key] = {
        ok,
        message: ok
          ? `Sample values look like ${label}.`
          : `Selected column doesn't look like ${label}.`,
      };
    };

    // Always validate date column
    if (!isSelected(userMapping.date)) {
      results.date = { ok: false, message: "Select a column to validate." };
    } else {
      validateSelected("date", userMapping.date, valueLooksLikeDate, "dates");
    }

    const hasDebit = isSelected(userMapping.debit);
    const hasCredit = isSelected(userMapping.credit);

    validateSelected("debit", userMapping.debit, valueLooksLikeAmount, "debit amounts");
    validateSelected("credit", userMapping.credit, valueLooksLikeAmount, "credit amounts");

    return results;
  }, [sampleRows, userMapping, valueLooksLikeDate, valueLooksLikeAmount, isSelected]);

  const columnFitRatio = (header: string, rule: (value: any) => boolean) => {
    if (!header || header === "__select__" || sampleRows.length === 0) return 0;
    const checks = sampleRows.map((row) => rule(row?.[header]));
    return checks.filter(Boolean).length / sampleRows.length;
  };

  const mappingQuality = useMemo(() => {
    if (columnHeaders.length === 0 || sampleRows.length === 0) {
      return { score: 0, label: "Waiting for preview" };
    }

    const dateRatio = columnFitRatio(userMapping.date, valueLooksLikeDate);

    const amountRatios: number[] = [];
    if (isSelected(userMapping.debit)) {
      amountRatios.push(columnFitRatio(userMapping.debit as string, valueLooksLikeAmount));
    }
    if (isSelected(userMapping.credit)) {
      amountRatios.push(columnFitRatio(userMapping.credit as string, valueLooksLikeAmount));
    }

    const amountRatio =
      amountRatios.length > 0
        ? amountRatios.reduce((sum, value) => sum + value, 0) / amountRatios.length
        : 0;

    const selectedHeaders = [
      userMapping.date,
      userMapping.narration,
      userMapping.reference,
      isSelected(userMapping.debit) ? userMapping.debit : null,
      isSelected(userMapping.credit) ? userMapping.credit : null,
    ].filter(Boolean) as string[];

    const completenessRatios = selectedHeaders.map((header) => {
      if (!header || header === "__select__") return 0;
      const stats = columnStats[header];
      if (!stats) return 0;
      return (stats.total - stats.missing) / stats.total;
    });

    const completeness =
      completenessRatios.length > 0
        ? completenessRatios.reduce((sum, value) => sum + value, 0) /
          completenessRatios.length
        : 0;

    const score = Math.round(((dateRatio + amountRatio + completeness) / 3) * 100);
    const label =
      score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Needs review";

    return { score, label };
  }, [
    columnHeaders,
    sampleRows,
    userMapping,
    columnStats,
    valueLooksLikeDate,
    valueLooksLikeAmount,
    isSelected,
  ]);

  const autoFixSuggestions = useMemo(() => {
    const suggestions: { message: string; apply: () => void }[] = [];
    if (sampleRows.length === 0) return null;

    const narrationRatio = columnFitRatio(
      userMapping.narration,
      valueLooksLikeNarration
    );
    const referenceRatio = columnFitRatio(
      userMapping.reference,
      valueLooksLikeReference
    );
    const swappedNarrationRatio = columnFitRatio(
      userMapping.reference,
      valueLooksLikeNarration
    );
    const swappedReferenceRatio = columnFitRatio(
      userMapping.narration,
      valueLooksLikeReference
    );

    const swapNarrationRef =
      swappedNarrationRatio > narrationRatio + 0.2 &&
      swappedReferenceRatio > referenceRatio + 0.2;

    if (swapNarrationRef) {
      suggestions.push({
        message: "Suggested fix: swap Narration and Reference columns.",
        apply: () =>
          setUserMapping((prev) => ({
            ...prev,
            narration: prev.reference,
            reference: prev.narration,
          })),
      });
    }

    return suggestions.length > 0 ? suggestions : null;
  }, [
    sampleRows,
    userMapping,
    valueLooksLikeDate,
    valueLooksLikeAmount,
    valueLooksLikeNarration,
    valueLooksLikeReference,
    isSelected,
  ]);

  // Determine which file we're working with based on currentMappingSource
  const sessionId = currentMappingSource === "bank" ? bankSessionId :
                    currentMappingSource === "book" ? bookSessionId :
                    bankSessionId || bookSessionId;

  // Initial load: extract data and get AI guess
  const [initialized, setInitialized] = useState(false);
  const applyExtractionResult = useCallback((result: Awaited<ReturnType<typeof extractAndPreviewData>>) => {
    setPreviewRows(result.previewRows);
    setTotalRows(result.totalRows || result.previewRows.length || 0);
    setColumnMetrics(result.columnMetrics || {});
    const headers =
      result.columnHeaders.length > 0
        ? result.columnHeaders
        : Object.keys(result.previewRows[0] || {});
    setColumnHeaders(headers);

    const detectedDebit = findHeaderMatch(headers, [
      "debit",
      "dr",
      "withdrawal",
      "withdraw",
      "paid out",
      "payment",
      "charge",
    ]);
    const detectedCredit = findHeaderMatch(headers, [
      "credit",
      "cr",
      "deposit",
      "paid in",
      "receipt",
      "received",
    ]);

    const resolvedDebit = result.mapping.debit && headers.includes(result.mapping.debit)
      ? result.mapping.debit
      : detectedDebit || "__none__";
    const resolvedCredit = result.mapping.credit && headers.includes(result.mapping.credit)
      ? result.mapping.credit
      : detectedCredit || "__none__";

    const resolvedMapping: ColumnMapping = {
      date: headers.includes(result.mapping.date)
        ? result.mapping.date
        : headers[0] || result.mapping.date,
      narration: headers.includes(result.mapping.narration)
        ? result.mapping.narration
        : headers[1] || result.mapping.narration,
      reference: headers.includes(result.mapping.reference)
        ? result.mapping.reference
        : headers[2] || result.mapping.reference,
      amount: "__none__",
      debit: resolvedDebit,
      credit: resolvedCredit,
    };

    setAiMapping(resolvedMapping);
    setUserMapping(resolvedMapping);
    setExtractionMethod(result.extractionMethod);
    setExtractionConfidence(result.extractionConfidence);
    setIsPdfDraftFlow(Boolean(result.draft));
  }, [extractAndPreviewData]);

  useEffect(() => {
    if (initialized || !sessionId) return;
    setInitialized(true);
    extractAndPreviewData(sessionId)
      .then((result) => applyExtractionResult(result))
      .catch((err) => {
        console.error("Failed to extract data:", err);
      });
  }, [initialized, sessionId, extractAndPreviewData, applyExtractionResult]);

  const isCashBookMapping = currentMappingSource === "book";
  const sourceLabel = isCashBookMapping ? "Cash Book" : "Bank Statement";

  const mappingValidation = useMemo(() => {
    if (columnHeaders.length === 0) {
      return { valid: false, message: "" };
    }

    if (!isSelected(userMapping.date) || !isSelected(userMapping.narration) || !isSelected(userMapping.reference)) {
      return { valid: false, message: "Please select Date, Description, and Reference columns." };
    }

    const hasDebit = isSelected(userMapping.debit);
    const hasCredit = isSelected(userMapping.credit);

    if (!hasDebit || !hasCredit) {
      return {
        valid: false,
        message:
          "Map both Debit and Credit amount columns. Single Amount mapping is no longer used.",
      };
    }

    const selected = [
      userMapping.date,
      userMapping.narration,
      userMapping.reference,
      hasDebit ? userMapping.debit : null,
      hasCredit ? userMapping.credit : null,
    ].filter(Boolean) as string[];

    const unique = new Set(selected);
    if (unique.size !== selected.length) {
      return { valid: false, message: "Each field must map to a different column." };
    }

    const missing = selected.filter((value) => !columnHeaders.includes(value));
    if (missing.length > 0) {
      return { valid: false, message: "Selected columns must exist in the preview." };
    }

    const dateValidation = columnSampleValidation.date;
    if (dateValidation && !dateValidation.ok) {
      return { valid: false, message: dateValidation.message };
    }

    const debitValidation = columnSampleValidation.debit;
    if (debitValidation && !debitValidation.ok) {
      return { valid: false, message: debitValidation.message };
    }
    const creditValidation = columnSampleValidation.credit;
    if (creditValidation && !creditValidation.ok) {
      return { valid: false, message: creditValidation.message };
    }

    return { valid: true, message: "" };
  }, [userMapping, columnHeaders, columnSampleValidation, isSelected, isCashBookMapping]);

  const handleConfirm = async () => {
    if (!sessionId) return;
    if (!mappingValidation.valid) {
      if (mappingValidation.message) {
        setError(mappingValidation.message);
      }
      return;
    }

    try {
      setError(null);

      const source = currentMappingSource || "bank";
      if (!currentMappingSource) {
        setError("Unable to determine file type");
        return;
      }

      await confirmMappingAndStandardize(sessionId, userMapping, source);
      setConfirmed(true);

      if (isPdfDraftFlow || currentDraft) {
        return;
      }

      // After confirming mapping, check if both files are uploaded
      const hasBank = bankSessionId !== null;
      const hasBook = bookSessionId !== null;

      if (!hasBank || !hasBook) {
        // Only one file uploaded, go back to upload to get the second file
        const missingFile = hasBank ? "Cash Book" : "Bank Statement";
        console.log(`⚠️  Please upload ${missingFile} to continue`);
      }

      // Return to the upload workspace so previews + subtotals are visible before recon starts.
      setStep("upload");
    } catch (err) {
      console.error("Confirm error:", err);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">
            Admin access required
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Mapping and standardization change the uploaded source data, so they are reserved for admins.
            Reviewers can still open history, inspect reconciliation workspaces, and download reports.
          </p>
          <button
            onClick={() => setStep("workspace")}
            className="mt-6 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open Workspace
          </button>
        </div>
      </div>
    );
  }

  const isDebitCreditMode =
    isSelected(userMapping.debit) &&
    isSelected(userMapping.credit);

  const mappingFields = [
    { key: "date" as const, label: "Transaction Date", shortLabel: "Date" },
    { key: "narration" as const, label: "Description", shortLabel: "Narration" },
    { key: "reference" as const, label: "Reference", shortLabel: "Reference" },
    { key: "debit" as const, label: "Debit Amount", shortLabel: "Debit" },
    { key: "credit" as const, label: "Credit Amount", shortLabel: "Credit" },
  ];

  const selectedDebitMetric = isSelected(userMapping.debit)
    ? columnMetrics[userMapping.debit as string]
    : null;
  const selectedCreditMetric = isSelected(userMapping.credit)
    ? columnMetrics[userMapping.credit as string]
    : null;

  const extractionMethodBadge = useMemo(() => {
    const method = extractionMethod.toLowerCase();

    if (method.includes("azure")) {
      return {
        label: "Parsed via Azure",
        tone: "sky" as const,
      };
    }
    if (method.includes("ocr")) {
      return {
        label: "Parsed via OCR",
        tone: "amber" as const,
      };
    }
    if (method.includes("xlsx")) {
      return {
        label: "Parsed via XLSX",
        tone: "emerald" as const,
      };
    }
    if (method.includes("csv")) {
      return {
        label: "Parsed via CSV",
        tone: "emerald" as const,
      };
    }
    if (method.includes("pdfplumber") || method.includes("pdf-local")) {
      return {
        label: "Parsed via Local PDF Parser",
        tone: "slate" as const,
      };
    }
    if (method === "unknown" || !method) {
      return {
        label: "Extraction method pending",
        tone: "slate" as const,
      };
    }
    return {
      label: `Parsed via ${extractionMethod}`,
      tone: "slate" as const,
    };
  }, [extractionMethod]);

  const renderFieldHelper = (_key: "date" | "narration" | "reference" | "debit" | "credit") => {
    return null;
  };

  const getMappedHeader = (key: "date" | "narration" | "reference" | "debit" | "credit") => {
    const value = userMapping[key];
    return isSelected(value) ? value : undefined;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Verify {sourceLabel} Column Mapping
          </h1>
          <p className="text-slate-600">
            AI detected the following columns from the {sourceLabel.toLowerCase()}. Verify the preview before proceeding.
          </p>
          {!isCashBookMapping ? (
            <div className="mt-3 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              Bank statement uploads always open AI preview first so we can verify the auto-mapped headers.
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Preview-Aligned Mapping
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Match each field directly above the preview column it should read from.
              </p>
            </div>
            {aiMapping ? (
              <button
                type="button"
                onClick={() => setUserMapping(aiMapping)}
                className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <RotateCcw className="h-4 w-4" />
                Reset to AI guess
              </button>
            ) : null}
          </div>

          <div className="space-y-4 border-b border-slate-200 bg-slate-50/70 px-6 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Rows Uploaded
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {totalRows.toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Mapping Quality
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {mappingQuality.label} · {mappingQuality.score}%
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                  AI Confidence
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-900">
                  {aiMapping ? "Strong match detected" : "Analyzing..."}
                </p>
              </div>

              <div
                className={`rounded-xl px-3 py-2 ${
                  extractionMethodBadge.tone === "sky"
                    ? "border border-sky-200 bg-sky-50"
                    : extractionMethodBadge.tone === "amber"
                      ? "border border-amber-200 bg-amber-50"
                      : extractionMethodBadge.tone === "emerald"
                        ? "border border-emerald-200 bg-emerald-50"
                        : "border border-slate-200 bg-white"
                }`}
              >
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    extractionMethodBadge.tone === "sky"
                      ? "text-sky-700"
                      : extractionMethodBadge.tone === "amber"
                        ? "text-amber-700"
                        : extractionMethodBadge.tone === "emerald"
                          ? "text-emerald-700"
                          : "text-slate-500"
                  }`}
                >
                  Extraction Method
                </p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    extractionMethodBadge.tone === "sky"
                      ? "text-sky-900"
                      : extractionMethodBadge.tone === "amber"
                        ? "text-amber-900"
                        : extractionMethodBadge.tone === "emerald"
                          ? "text-emerald-900"
                          : "text-slate-900"
                  }`}
                >
                  {extractionMethodBadge.label}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Confidence {extractionConfidence}%
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Debit Total
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedDebitMetric
                    ? formatMoney(selectedDebitMetric.parsedAmountTotal)
                    : "Select debit"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {selectedDebitMetric
                    ? `${selectedDebitMetric.nonEmptyCount} populated rows`
                    : "Waiting for column selection"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Credit Total
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedCreditMetric
                    ? formatMoney(selectedCreditMetric.parsedAmountTotal)
                    : "Select credit"}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {selectedCreditMetric
                    ? `${selectedCreditMetric.nonEmptyCount} populated rows`
                    : "Waiting for column selection"}
                </p>
              </div>

              {isDebitCreditMode ? (
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
                  Debit/Credit mode detected
                </div>
              ) : null}
            </div>

            {autoFixSuggestions ? (
              <div className="space-y-2">
                {autoFixSuggestions.map((suggestion, idx) => (
                  <div
                    key={`auto-fix-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3"
                  >
                    <p className="text-xs text-blue-900">{suggestion.message}</p>
                    <button
                      type="button"
                      onClick={suggestion.apply}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900"
                    >
                      Apply
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {columnHeaders.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500">
                  Detected Columns
                </p>
                <div className="flex flex-wrap gap-2">
                  {columnHeaders.map((header) => (
                    <span
                      key={`header-${header}`}
                      className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      {header}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {!mappingValidation.valid && mappingValidation.message ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-xs text-amber-900">{mappingValidation.message}</p>
              </div>
            ) : null}

            {extractionMethod.includes("ocr") ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-xs text-amber-900">
                  OCR was used to extract this PDF. Please verify the mapping and preview carefully.
                </p>
              </div>
            ) : null}

            {!extractionMethod.includes("ocr") &&
            extractionConfidence > 0 &&
            extractionConfidence < 70 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-xs text-amber-900">
                  Extraction confidence is low ({extractionConfidence}%). Please verify the mapping and preview carefully.
                </p>
              </div>
            ) : null}
          </div>

          <div className="px-6 py-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Data Preview</h3>
              <p className="text-xs text-slate-500">
                Mapping controls now sit directly above the matching preview columns.
              </p>
            </div>

            {previewRows.length === 0 ? (
              <div className="py-10 text-center">
                {error && !loading ? (
                  <div className="mx-auto max-w-sm rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-left">
                    <p className="text-sm font-semibold text-rose-900">
                      Preview failed
                    </p>
                    <p className="mt-2 text-sm text-rose-800">{error}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!sessionId) return;
                        setError(null);
                        extractAndPreviewData(sessionId)
                          .then((result) => applyExtractionResult(result))
                          .catch((err) => {
                            console.error("Retry failed:", err);
                          });
                      }}
                      className="mt-4 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700"
                    >
                      Retry Preview
                    </button>
                  </div>
                ) : (
                  <>
                    <Loader className="mx-auto mb-2 h-8 w-8 animate-spin text-slate-400" />
                    <p className="text-sm text-slate-600">
                      {activeJob?.message || "Extracting data..."}
                    </p>
                    {typeof activeJob?.progressPercent === "number" &&
                    activeJob.progressPercent > 0 ? (
                      <p className="mt-2 text-xs text-slate-500">
                        {activeJob.progressPercent}% complete
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="min-w-[1080px] w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[28%]" />
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                  </colgroup>
                  <thead>
                    <tr className="align-top border-b border-slate-200 bg-slate-50">
                      {mappingFields.map(({ key, label }) => {
                        const selectedHeader = getMappedHeader(key);

                        return (
                          <th key={`mapping-${key}`} className="px-3 py-4 text-left">
                            <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                {label}
                              </label>
                              {selectedHeader ? (
                                <div className="relative group">
                                  <span className="cursor-help text-[11px] text-slate-500">
                                    Samples
                                  </span>
                                  <div className="absolute right-0 top-6 z-10 hidden w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg group-hover:block">
                                    <p className="mb-2 text-[11px] font-semibold text-slate-500">
                                      Sample values
                                    </p>
                                    <ul className="space-y-1 text-xs text-slate-700">
                                      {(columnSamples[selectedHeader] || ["—"]).map(
                                        (sample: string, idx: number) => (
                                          <li key={`${key}-sample-${idx}`} className="truncate">
                                            {sample}
                                          </li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            <select
                              value={userMapping[key] || "__select__"}
                              onChange={(e) =>
                                setUserMapping({ ...userMapping, [key]: e.target.value })
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="__select__" disabled>
                                Select a column
                              </option>
                              {columnHeaders.map((header) => (
                                <option key={`${key}-${header}`} value={header}>
                                  {header}
                                </option>
                              ))}
                            </select>

                            {renderFieldHelper(key)}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                    <tr className="border-b border-slate-200 bg-white">
                      {mappingFields.map(({ key, shortLabel }) => (
                        <th
                          key={`preview-header-${key}`}
                          className={`px-3 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 ${
                            key === "debit" || key === "credit" ? "text-right" : "text-left"
                          }`}
                        >
                          {isSelected(userMapping[key]) ? userMapping[key] : shortLabel}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => {
                      const debitPreview = isSelected(userMapping.debit)
                        ? row[userMapping.debit as string]
                        : null;
                      const creditPreview = isSelected(userMapping.credit)
                        ? row[userMapping.credit as string]
                        : null;
                      const hasDebitValue = hasCellValue(debitPreview);
                      const hasCreditValue = hasCellValue(creditPreview);

                      return (
                        <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                          <td
                            className={`px-3 py-3 align-top ${
                              row[userMapping.date]
                                ? "text-slate-600"
                                : "bg-rose-50/60 text-rose-600"
                            }`}
                          >
                            {formatPreviewDateCell(row[userMapping.date])}
                          </td>
                          <td
                            className={`px-3 py-3 align-top ${
                              row[userMapping.narration]
                                ? "text-slate-600"
                                : "bg-rose-50/60 text-rose-600"
                            }`}
                          >
                            <div className="truncate">
                              {row[userMapping.narration] || "—"}
                            </div>
                          </td>
                          <td
                            className={`px-3 py-3 align-top ${
                              row[userMapping.reference]
                                ? "text-slate-600"
                                : "bg-rose-50/60 text-rose-600"
                            }`}
                          >
                            {row[userMapping.reference] || "—"}
                          </td>
                          <td
                            className={`px-3 py-3 text-right font-mono align-top ${
                              hasDebitValue ? "text-slate-900" : "text-slate-400"
                            }`}
                          >
                            {hasDebitValue ? debitPreview : "—"}
                          </td>
                          <td
                            className={`px-3 py-3 text-right font-mono align-top ${
                              hasCreditValue ? "text-slate-900" : "text-slate-400"
                            }`}
                          >
                            {hasCreditValue ? creditPreview : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-4 border-t border-slate-200 pt-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-xs text-slate-500">
                Showing preview of extracted data for the selected columns.
              </p>

              <button
                onClick={handleConfirm}
                disabled={confirmed || loading || !mappingValidation.valid}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium text-white transition-colors ${
                  confirmed
                    ? "bg-green-600 cursor-default"
                    : !mappingValidation.valid || loading
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {loading ? (
                  <>
                    <Loader className="h-5 w-5 animate-spin" />
                    Standardizing...
                  </>
                ) : confirmed ? (
                  <>
                    <Check className="h-5 w-5" />
                    Mapping Confirmed
                  </>
                ) : (
                  <>
                    Confirm & Continue
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
