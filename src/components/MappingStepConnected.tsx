"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, ArrowRight, Loader, RotateCcw } from "lucide-react";
import { useReconciliationStore } from "@/store/reconciliation-api";
import { ColumnMapping } from "@/store/reconciliation-api";

export default function MappingStep() {
  const {
    setStep,
    bankSessionId,
    bookSessionId,
    bankFile,
    bookFile,
    currentMappingSource,
    extractAndPreviewData,
    confirmMappingAndStandardize,
    loading,
    activeJob,
    currentUser,
    setError,
  } = useReconciliationStore();
  const isAdmin = currentUser?.role === "admin";

  const [confirmed, setConfirmed] = useState(false);
  const [previewRows, setPreviewRows] = useState<Record<string, any>[]>([]);
  const [columnHeaders, setColumnHeaders] = useState<string[]>([]);
  const [extractionMethod, setExtractionMethod] = useState<string>("unknown");
  const [extractionConfidence, setExtractionConfidence] = useState<number>(0);
  const [aiMapping, setAiMapping] = useState<ColumnMapping | null>(null);
  const [userMapping, setUserMapping] = useState<ColumnMapping>({
    date: "Date",
    narration: "Narration",
    reference: "Reference",
    amount: "Amount",
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

  const findHeaderMatch = (headers: string[], keywords: string[]) => {
    const lowered = headers.map((h) => h.toLowerCase());
    for (let i = 0; i < headers.length; i += 1) {
      if (keywords.some((keyword) => lowered[i].includes(keyword))) {
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

    const hasAmount = isSelected(userMapping.amount);
    const hasDebit = isSelected(userMapping.debit);
    const hasCredit = isSelected(userMapping.credit);

    if (hasAmount) {
      validateSelected("amount", userMapping.amount, valueLooksLikeAmount, "amounts");
    } else {
      validateSelected("debit", userMapping.debit, valueLooksLikeAmount, "debit amounts");
      validateSelected("credit", userMapping.credit, valueLooksLikeAmount, "credit amounts");
    }

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
    if (isSelected(userMapping.amount)) {
      amountRatios.push(columnFitRatio(userMapping.amount as string, valueLooksLikeAmount));
    } else {
      if (isSelected(userMapping.debit)) {
        amountRatios.push(columnFitRatio(userMapping.debit as string, valueLooksLikeAmount));
      }
      if (isSelected(userMapping.credit)) {
        amountRatios.push(columnFitRatio(userMapping.credit as string, valueLooksLikeAmount));
      }
    }

    const amountRatio =
      amountRatios.length > 0
        ? amountRatios.reduce((sum, value) => sum + value, 0) / amountRatios.length
        : 0;

    const selectedHeaders = [
      userMapping.date,
      userMapping.narration,
      userMapping.reference,
      isSelected(userMapping.amount) ? userMapping.amount : null,
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

    const hasAmount = isSelected(userMapping.amount);
    const hasDebit = isSelected(userMapping.debit);
    const hasCredit = isSelected(userMapping.credit);

    if (hasAmount && !hasDebit && !hasCredit) {
      const dateRatio = columnFitRatio(userMapping.date, valueLooksLikeDate);
      const amountRatio = columnFitRatio(userMapping.amount as string, valueLooksLikeAmount);

      const swappedDateRatio = columnFitRatio(userMapping.amount as string, valueLooksLikeDate);
      const swappedAmountRatio = columnFitRatio(userMapping.date, valueLooksLikeAmount);

      const wouldImprove =
        swappedDateRatio > dateRatio + 0.2 && swappedAmountRatio > amountRatio + 0.2;

      if (wouldImprove) {
        suggestions.push({
          message: "Suggested fix: swap Date and Amount columns.",
          apply: () =>
            setUserMapping((prev) => ({
              ...prev,
              date: prev.amount || prev.date,
              amount: prev.date,
            })),
        });
      }
    }

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

  const file = currentMappingSource === "bank" ? bankFile :
               currentMappingSource === "book" ? bookFile :
               bankFile || bookFile;

  // Initial load: extract data and get AI guess
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (initialized || !sessionId || !file) return;
    setInitialized(true);
    extractAndPreviewData(file, sessionId)
      .then((result) => {
        setPreviewRows(result.previewRows);
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
        const detectedAmount = findHeaderMatch(headers, [
          "amount",
          "amt",
          "value",
          "transaction amount",
          "txn amount",
        ]);

        const resolvedDebit = result.mapping.debit && headers.includes(result.mapping.debit)
          ? result.mapping.debit
          : detectedDebit || "__none__";
        const resolvedCredit = result.mapping.credit && headers.includes(result.mapping.credit)
          ? result.mapping.credit
          : detectedCredit || "__none__";
        const resolvedAmount = result.mapping.amount && headers.includes(result.mapping.amount)
          ? result.mapping.amount
          : resolvedDebit !== "__none__" && resolvedCredit !== "__none__"
          ? "__none__"
          : detectedAmount || headers[3] || result.mapping.amount;

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
          amount: resolvedAmount,
          debit: resolvedDebit,
          credit: resolvedCredit,
        };

        setAiMapping(resolvedMapping);
        setUserMapping(resolvedMapping);
        setExtractionMethod(result.extractionMethod);
        setExtractionConfidence(result.extractionConfidence);
      })
      .catch((err) => {
        console.error("Failed to extract data:", err);
      });
  }, [initialized, sessionId, file, extractAndPreviewData]);

  const mappingValidation = useMemo(() => {
    if (columnHeaders.length === 0) {
      return { valid: false, message: "" };
    }

    if (!isSelected(userMapping.date) || !isSelected(userMapping.narration) || !isSelected(userMapping.reference)) {
      return { valid: false, message: "Please select Date, Description, and Reference columns." };
    }

    const hasAmount = isSelected(userMapping.amount);
    const hasDebit = isSelected(userMapping.debit);
    const hasCredit = isSelected(userMapping.credit);

    if (!hasAmount && !(hasDebit && hasCredit)) {
      return { valid: false, message: "Select Amount or both Debit and Credit columns." };
    }

    const selected = [
      userMapping.date,
      userMapping.narration,
      userMapping.reference,
      hasAmount ? userMapping.amount : null,
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

    if (hasAmount) {
      const amountValidation = columnSampleValidation.amount;
      if (amountValidation && !amountValidation.ok) {
        return { valid: false, message: amountValidation.message };
      }
    } else {
      const debitValidation = columnSampleValidation.debit;
      if (debitValidation && !debitValidation.ok) {
        return { valid: false, message: debitValidation.message };
      }
      const creditValidation = columnSampleValidation.credit;
      if (creditValidation && !creditValidation.ok) {
        return { valid: false, message: creditValidation.message };
      }
    }

    return { valid: true, message: "" };
  }, [userMapping, columnHeaders, columnSampleValidation, isSelected]);

  const handleConfirm = async () => {
    if (!sessionId || !file) return;
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

      await confirmMappingAndStandardize(file, sessionId, userMapping, source);
      setConfirmed(true);

      // After confirming mapping, check if both files are uploaded
      const hasBank = bankSessionId !== null;
      const hasBook = bookSessionId !== null;

      if (hasBank && hasBook) {
        // Both files uploaded, proceed to reconciliation
        setTimeout(() => setStep("reconciliation"), 1000);
      } else {
        // Only one file uploaded, go back to upload to get the second file
        const missingFile = hasBank ? "Cash Book" : "Bank Statement";
        console.log(`⚠️  Please upload ${missingFile} to continue`);
        setTimeout(() => setStep("upload"), 1000);
      }
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
            Reviewers can still open history, inspect reconciliation workspaces, approve or reject matches, and download reports.
          </p>
          <button
            onClick={() => setStep("history")}
            className="mt-6 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Open History
          </button>
        </div>
      </div>
    );
  }

  const amountHeaderLabel = isSelected(userMapping.amount)
    ? userMapping.amount
    : "Amount (Credit - Debit)";

  const isDebitCreditMode =
    isSelected(userMapping.debit) &&
    isSelected(userMapping.credit) &&
    !isSelected(userMapping.amount);

  const getAmountPreview = (row: Record<string, any>) => {
    if (isSelected(userMapping.amount)) {
      return row[userMapping.amount as string] ?? "—";
    }
    const debitValue = isSelected(userMapping.debit)
      ? parseAmount(row[userMapping.debit as string])
      : null;
    const creditValue = isSelected(userMapping.credit)
      ? parseAmount(row[userMapping.credit as string])
      : null;

    if (debitValue === null && creditValue === null) {
      return "—";
    }

    const net = (creditValue || 0) - (debitValue || 0);
    return net.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

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
                  { key: "date" as const, label: "📅 Transaction Date", optional: false },
                  { key: "narration" as const, label: "📝 Description", optional: false },
                  { key: "reference" as const, label: "🔖 Reference", optional: false },
                  { key: "amount" as const, label: "💰 Amount", optional: true },
                  { key: "debit" as const, label: "⬇️ Debit", optional: true },
                  { key: "credit" as const, label: "⬆️ Credit", optional: true },
                ] as const
              ).map(({ key, label, optional }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      {label}
                    </label>
                    {userMapping[key] && userMapping[key] !== "__select__" && (
                      <div className="relative group">
                        <span className="text-xs text-slate-500 cursor-help">
                          Preview
                        </span>
                        <div className="absolute right-0 top-6 z-10 hidden group-hover:block bg-white border border-slate-200 shadow-lg rounded-lg p-3 w-56">
                          <p className="text-[11px] font-semibold text-slate-500 mb-2">
                            Sample values
                          </p>
                          <ul className="space-y-1 text-xs text-slate-700">
                            {(columnSamples[userMapping[key]] || ["—"]).map(
                              (sample, idx) => (
                                <li key={`${key}-sample-${idx}`} className="truncate">
                                  {sample}
                                </li>
                              )
                            )}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                  <select
                    value={userMapping[key] || (optional ? "__none__" : "__select__")}
                    onChange={(e) =>
                      setUserMapping({ ...userMapping, [key]: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {!optional && (
                      <option value="__select__" disabled>
                        Select a column
                      </option>
                    )}
                    {optional && (
                      <option value="__none__">Not applicable</option>
                    )}
                    {columnHeaders.map((header) => (
                      <option key={`${key}-${header}`} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                  {(key === "date" ||
                    key === "amount" ||
                    key === "debit" ||
                    key === "credit") &&
                    columnSampleValidation[key]?.message && (
                      <p
                        className={`mt-1 text-xs ${
                          columnSampleValidation[key]?.ok
                            ? "text-emerald-600"
                            : "text-amber-600"
                        }`}
                      >
                        {columnSampleValidation[key]?.message}
                      </p>
                    )}
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-500">
              If your bank statement has separate Debit/Credit columns, set Amount to
              "Not applicable" and select Debit + Credit. Amount will be computed as
              Credit minus Debit.
            </p>

            {isDebitCreditMode && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                🔄 Debit/Credit mode detected
              </div>
            )}

            {aiMapping && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setUserMapping(aiMapping)}
                  className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to AI guess
                </button>
              </div>
            )}

            {autoFixSuggestions && (
              <div className="mt-4 space-y-2">
                {autoFixSuggestions.map((suggestion, idx) => (
                  <div
                    key={`auto-fix-${idx}`}
                    className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-3"
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
            )}

            <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div>
                <p className="text-xs font-semibold text-slate-600">Mapping Quality</p>
                <p className="text-sm font-medium text-slate-900">{mappingQuality.label}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-900">{mappingQuality.score}%</p>
                <p className="text-[11px] text-slate-500">Based on samples</p>
              </div>
            </div>

            {columnHeaders.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  Detected Columns
                </p>
                <div className="flex flex-wrap gap-2">
                  {columnHeaders.map((header) => (
                    <span
                      key={`header-${header}`}
                      className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                    >
                      {header}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-900">
                ✅ AI Confidence: {aiMapping ? "Strong match detected" : "Analyzing..."}
              </p>
            </div>

            {!mappingValidation.valid && mappingValidation.message && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-900">
                  {mappingValidation.message}
                </p>
              </div>
            )}

            {extractionMethod.includes("ocr") && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-900">
                  OCR was used to extract this PDF. Please verify the mapping and preview carefully.
                </p>
              </div>
            )}

            {!extractionMethod.includes("ocr") && extractionConfidence > 0 && extractionConfidence < 70 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-900">
                  Extraction confidence is low ({extractionConfidence}%). Please verify the mapping and preview carefully.
                </p>
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={confirmed || loading || !mappingValidation.valid}
              className={`w-full mt-6 px-4 py-3 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                confirmed
                  ? "bg-green-600 cursor-default"
                  : !mappingValidation.valid || loading
                  ? "bg-slate-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Standardizing...
                </>
              ) : confirmed ? (
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

            {previewRows.length === 0 ? (
              <div className="text-center py-8">
                <Loader className="w-8 h-8 text-slate-400 mx-auto mb-2 animate-spin" />
                <p className="text-sm text-slate-600">
                  {activeJob?.message || "Extracting data..."}
                </p>
                {typeof activeJob?.progressPercent === "number" &&
                activeJob.progressPercent > 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    {activeJob.progressPercent}% complete
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-2 px-2 font-semibold text-slate-700">
                        {userMapping.date}
                      </th>
                      <th className="text-left py-2 px-2 font-semibold text-slate-700">
                        {userMapping.narration}
                      </th>
                      <th className="text-left py-2 px-2 font-semibold text-slate-700">
                        {userMapping.reference}
                      </th>
                      <th className="text-right py-2 px-2 font-semibold text-slate-700">
                        {amountHeaderLabel}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, idx) => {
                      const amountPreview = getAmountPreview(row);
                      const hasAmountValue =
                        amountPreview !== "—" &&
                        amountPreview !== null &&
                        amountPreview !== undefined &&
                        String(amountPreview).trim() !== "";
                      return (
                        <tr key={idx} className="border-b border-slate-100">
                          <td
                            className={`py-3 px-2 ${
                              row[userMapping.date] ? "text-slate-600" : "text-rose-600 bg-rose-50/60"
                            }`}
                          >
                            {row[userMapping.date] || "—"}
                          </td>
                          <td
                            className={`py-3 px-2 truncate max-w-xs ${
                              row[userMapping.narration]
                                ? "text-slate-600"
                                : "text-rose-600 bg-rose-50/60"
                            }`}
                          >
                            {row[userMapping.narration] || "—"}
                          </td>
                          <td
                            className={`py-3 px-2 ${
                              row[userMapping.reference]
                                ? "text-slate-600"
                                : "text-rose-600 bg-rose-50/60"
                            }`}
                          >
                            {row[userMapping.reference] || "—"}
                          </td>
                          <td
                            className={`py-3 px-2 text-right font-mono ${
                              hasAmountValue
                                ? "text-slate-900"
                                : "text-rose-600 bg-rose-50/60"
                            }`}
                          >
                            {amountPreview || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mt-4 text-xs text-slate-500">
              Showing preview of extracted data for the selected columns
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
