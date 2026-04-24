"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCcw,
  Save,
} from "lucide-react";
import clsx from "clsx";

import {
  ExtractionDraftRow,
  useReconciliationStore,
} from "@/store/reconciliation-api";

type EditableRow = ExtractionDraftRow & {
  dirty?: boolean;
};

const rowTypeOptions: ExtractionDraftRow["rowType"][] = [
  "transaction",
  "header",
  "summary",
  "footer",
  "unknown",
  "deleted",
];

export default function ExtractionReviewStepConnected() {
  const {
    currentDraft,
    currentMappingSource,
    updateDraftRows,
    updateDraftRegion,
    refreshDraftValidation,
    finalizeDraft,
    setStep,
    loading,
    currentUser,
  } = useReconciliationStore();

  const [rows, setRows] = useState<EditableRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setRows((currentDraft?.reviewedRows || []).map((row) => ({ ...row, dirty: false })));
    setSelectedRows([]);
  }, [currentDraft?.id, currentDraft?.updatedAt]);

  const isAdmin =
    currentUser?.role === "admin" || currentUser?.role === "super_admin";
  const blockingIssues = useMemo(
    () =>
      (currentDraft?.validationSummary.issues || []).filter(
        (issue) => issue.severity === "blocking"
      ),
    [currentDraft]
  );
  const dirtyRows = useMemo(
    () => rows.filter((row) => row.dirty),
    [rows]
  );

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">
            Admin access required
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            PDF review changes extracted rows before they are standardized, so only admins can continue here.
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

  if (!currentDraft) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold text-slate-900">
            No PDF draft loaded
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Return to mapping and reopen the PDF review workflow.
          </p>
          <button
            onClick={() => setStep("mapping")}
            className="mt-6 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Back to mapping
          </button>
        </div>
      </div>
    );
  }

  const selectedRowObjects = rows.filter((row) => selectedRows.includes(row.rowIndex));
  const activeSource = currentMappingSource || "bank";

  const setRowSelection = (rowIndex: number, checked: boolean) => {
    setSelectedRows((current) =>
      checked ? Array.from(new Set([...current, rowIndex])) : current.filter((value) => value !== rowIndex)
    );
  };

  const updateCell = (rowIndex: number, cellIndex: number, value: string) => {
    setRows((current) =>
      current.map((row) => {
        if (row.rowIndex !== rowIndex) return row;
        const cells = [...row.cells];
        cells[cellIndex] = value;
        return { ...row, cells, dirty: true };
      })
    );
  };

  const updateRowTypeLocally = (rowIndex: number, rowType: ExtractionDraftRow["rowType"]) => {
    setRows((current) =>
      current.map((row) =>
        row.rowIndex === rowIndex ? { ...row, rowType, dirty: true } : row
      )
    );
  };

  const updateRepeatedLocally = (rowIndex: number, checked: boolean) => {
    setRows((current) =>
      current.map((row) =>
        row.rowIndex === rowIndex
          ? { ...row, isRepeatedHeader: checked, dirty: true }
          : row
      )
    );
  };

  const saveDirtyRows = async () => {
    if (!dirtyRows.length) return currentDraft;
    const updatedDraft = await updateDraftRows(
      currentDraft.id,
      dirtyRows.map((row) => ({
        rowIndex: row.rowIndex,
        cells: row.cells,
        rowType: row.rowType,
        isRepeatedHeader: row.isRepeatedHeader,
      }))
    );
    setNotice(`Saved ${dirtyRows.length} edited row${dirtyRows.length === 1 ? "" : "s"}.`);
    return updatedDraft;
  };

  const applyBulkRowType = (rowType: ExtractionDraftRow["rowType"]) => {
    setRows((current) =>
      current.map((row) =>
        selectedRows.includes(row.rowIndex) ? { ...row, rowType, dirty: true } : row
      )
    );
  };

  const markAsDeleted = () => applyBulkRowType("deleted");
  const markAsSummary = () => applyBulkRowType("summary");
  const markAsFooter = () => applyBulkRowType("footer");
  const markAsTransaction = () => applyBulkRowType("transaction");

  const applyHeaderRow = async () => {
    if (!selectedRowObjects.length) return;
    const row = selectedRowObjects[0];
    await saveDirtyRows();
    await updateDraftRegion(currentDraft.id, {
      headerRowIndex: row.rowIndex,
      tableStartRowIndex: currentDraft.tableStartRowIndex,
      tableEndRowIndex: currentDraft.tableEndRowIndex,
    });
    setNotice(`Using row ${row.rowIndex + 1} as the draft header.`);
  };

  const applyStartHere = async () => {
    if (!selectedRowObjects.length) return;
    const row = selectedRowObjects[0];
    await saveDirtyRows();
    await updateDraftRegion(currentDraft.id, {
      headerRowIndex: currentDraft.headerRowIndex,
      tableStartRowIndex: row.rowIndex,
      tableEndRowIndex: currentDraft.tableEndRowIndex,
    });
    setNotice(`Transaction region now starts at row ${row.rowIndex + 1}.`);
  };

  const applyEndHere = async () => {
    if (!selectedRowObjects.length) return;
    const row = selectedRowObjects[selectedRowObjects.length - 1];
    await saveDirtyRows();
    await updateDraftRegion(currentDraft.id, {
      headerRowIndex: currentDraft.headerRowIndex,
      tableStartRowIndex: currentDraft.tableStartRowIndex,
      tableEndRowIndex: row.rowIndex,
    });
    setNotice(`Transaction region now ends at row ${row.rowIndex + 1}.`);
  };

  const recalculateValidation = async () => {
    if (dirtyRows.length) {
      await saveDirtyRows();
    }
    await refreshDraftValidation(currentDraft.id);
    setNotice("Validation refreshed from the latest reviewed rows.");
  };

  const handleFinalize = async () => {
    if (dirtyRows.length) {
      await saveDirtyRows();
    }
    await finalizeDraft(currentDraft.id, activeSource);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 md:px-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="rounded-3xl border border-sky-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-700">
                PDF Review Draft
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                Review Extracted Data Before Standardization
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                We’re keeping the raw PDF upload native, but this stage lets us correct rows before they become
                transactions. Clean up headers, summaries, and wrong debit/credit rows here.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setStep("mapping")}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Mapping
              </button>
              <button
                onClick={saveDirtyRows}
                disabled={loading || dirtyRows.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save Edits
              </button>
              <button
                onClick={handleFinalize}
                disabled={loading || blockingIssues.length > 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                <CheckCircle2 className="h-4 w-4" />
                Finalize Draft
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Method" value={currentDraft.sourceMethod} />
            <MetricCard label="Confidence" value={`${currentDraft.confidence}%`} />
            <MetricCard
              label="Rows Extracted"
              value={String(currentDraft.reviewedRows.length)}
            />
            <MetricCard
              label="Suspicious Rows"
              value={String(currentDraft.validationSummary.suspiciousRowCount)}
            />
            <MetricCard
              label="Totals"
              value={`DR ${formatNumber(currentDraft.validationSummary.totals.debit_total)} / CR ${formatNumber(
                currentDraft.validationSummary.totals.credit_total
              )}`}
            />
          </div>

          {notice ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {notice}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Editable Extraction Grid</h2>
                <p className="text-sm text-slate-500">
                  Header row: {currentDraft.headerRowIndex != null ? currentDraft.headerRowIndex + 1 : "Not set"} ·
                  Region:{" "}
                  {currentDraft.tableStartRowIndex != null ? currentDraft.tableStartRowIndex + 1 : "?"} to{" "}
                  {currentDraft.tableEndRowIndex != null ? currentDraft.tableEndRowIndex + 1 : "?"}
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Draft v{currentDraft.version}
              </div>
            </div>
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
              <div className="flex items-center gap-4 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">
                  Quick actions ({selectedRows.length} selected)
                </span>
                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1">
                  <ActionButton onClick={applyHeaderRow} disabled={!selectedRows.length || loading}>
                    Use selected row as header
                  </ActionButton>
                  <ActionButton onClick={applyStartHere} disabled={!selectedRows.length || loading}>
                    Start transactions here
                  </ActionButton>
                  <ActionButton onClick={applyEndHere} disabled={!selectedRows.length || loading}>
                    End transactions here
                  </ActionButton>
                  <ActionButton onClick={markAsTransaction} disabled={!selectedRows.length || loading}>
                    Mark as transaction
                  </ActionButton>
                  <ActionButton onClick={markAsSummary} disabled={!selectedRows.length || loading}>
                    Mark as summary
                  </ActionButton>
                  <ActionButton onClick={markAsFooter} disabled={!selectedRows.length || loading}>
                    Mark as footer
                  </ActionButton>
                  <ActionButton onClick={markAsDeleted} disabled={!selectedRows.length || loading}>
                    Delete selected rows
                  </ActionButton>
                  <ActionButton onClick={recalculateValidation} disabled={loading}>
                    <RefreshCcw className="h-4 w-4" />
                    Recalculate validation
                  </ActionButton>
                </div>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-[0.28em] text-slate-500">
                    <th className="px-3 py-3">Pick</th>
                    <th className="px-3 py-3">Row</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Flags</th>
                    {currentDraft.columnHeaders.map((header) => (
                      <th key={header} className="px-3 py-3 min-w-[180px]">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.rowIndex}
                      className={clsx(
                        "border-b border-slate-100 align-top",
                        row.isWithinSelectedRegion ? "bg-white" : "bg-slate-50/80",
                        row.dirty && "bg-amber-50/50"
                      )}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(row.rowIndex)}
                          onChange={(event) => setRowSelection(row.rowIndex, event.target.checked)}
                          className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">
                        {row.rowIndex + 1}
                      </td>
                      <td className="px-3 py-3">
                        <select
                          value={row.rowType}
                          onChange={(event) =>
                            updateRowTypeLocally(row.rowIndex, event.target.value as ExtractionDraftRow["rowType"])
                          }
                          className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                        >
                          {rowTypeOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={row.isRepeatedHeader}
                              onChange={(event) =>
                                updateRepeatedLocally(row.rowIndex, event.target.checked)
                              }
                              className="h-3.5 w-3.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                            />
                            repeated header
                          </label>
                          {row.warnings.length ? (
                            <div className="rounded-xl bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                              {row.warnings.join(" • ")}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              {row.isWithinSelectedRegion ? "in region" : "outside region"}
                            </span>
                          )}
                        </div>
                      </td>
                      {currentDraft.columnHeaders.map((header, cellIndex) => (
                        <td key={`${row.rowIndex}-${header}`} className="px-3 py-3">
                          <input
                            value={String(row.cells[cellIndex] ?? "")}
                            onChange={(event) =>
                              updateCell(row.rowIndex, cellIndex, event.target.value)
                            }
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Validation</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              {currentDraft.validationSummary.issues.length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800">
                  Draft looks clean enough to finalize.
                </div>
              ) : (
                currentDraft.validationSummary.issues.map((issue) => (
                  <div
                    key={`${issue.code}-${issue.message}`}
                    className={clsx(
                      "rounded-2xl border px-4 py-3",
                      issue.severity === "blocking"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : issue.severity === "warning"
                        ? "border-amber-200 bg-amber-50 text-amber-900"
                        : "border-sky-200 bg-sky-50 text-sky-800"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">
                          {issue.severity === "blocking" ? "Blocking" : "Attention"}
                        </p>
                        <p>{issue.message}</p>
                        {issue.rowIndices.length ? (
                          <p className="mt-1 text-xs opacity-80">
                            Rows: {issue.rowIndices.slice(0, 8).map((value) => value + 1).join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function formatNumber(value?: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}
