"use client";

import type {
  ReconciliationSummary,
  Transaction,
} from "@/store/reconciliation-api";
import { formatCurrency, normalizeCurrencyCode } from "@/lib/currency";

type ReportPreviewInput = {
  accountName: string;
  accountNumber?: string | null;
  periodMonth: string;
  status?: string;
  companyName?: string | null;
  companyAddress?: string | null;
  companyLogoDataUrl?: string | null;
  preparedBy?: string | null;
  reviewedBy?: string | null;
  currencyCode?: string | null;
  summary: ReconciliationSummary;
  bankCredits: Transaction[];
  bookDebits: Transaction[];
  bookCredits: Transaction[];
  bankDebits: Transaction[];
};

const formatMoney = (value: number, currencyCode?: string | null) =>
  formatCurrency(Number(value || 0), normalizeCurrencyCode(currencyCode));

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const amountForDirection = (
  transaction: Transaction,
  direction: "debit" | "credit"
) =>
  Number(
    direction === "debit"
      ? transaction.debitAmount || 0
      : transaction.creditAmount || 0
  );

const sortTransactions = (transactions: Transaction[]) =>
  [...transactions].sort((left, right) => {
    const dateCompare = String(left.date || "").localeCompare(
      String(right.date || "")
    );
    if (dateCompare !== 0) return dateCompare;

    const referenceCompare = String(left.reference || "").localeCompare(
      String(right.reference || "")
    );
    if (referenceCompare !== 0) return referenceCompare;

    return String(left.narration || "").localeCompare(
      String(right.narration || "")
    );
  });

const subtotalForDirection = (
  transactions: Transaction[],
  direction: "debit" | "credit"
) =>
  transactions.reduce(
    (total, transaction) => total + amountForDirection(transaction, direction),
    0
  );

const renderTransactionRows = (
  transactions: Transaction[],
  direction: "debit" | "credit",
  emptyMessage: string,
  currencyCode?: string | null
) => {
  const rows = sortTransactions(transactions);

  if (rows.length === 0) {
    return `<tr><td colspan="4" class="empty">${escapeHtml(emptyMessage)}</td></tr>`;
  }

  return rows
    .map((transaction) => {
      const amount = amountForDirection(transaction, direction);
      return `
        <tr>
          <td>${escapeHtml(transaction.date || "-")}</td>
          <td>${escapeHtml(transaction.reference || "-")}</td>
          <td>${escapeHtml(transaction.narration || "-")}</td>
          <td class="amount">${amount > 0 ? escapeHtml(formatMoney(amount, currencyCode)) : "-"}</td>
        </tr>
      `;
    })
    .join("");
};

const renderLane = ({
  currencyCode,
  title,
  leftLabel,
  rightLabel,
  leftTransactions,
  rightTransactions,
  leftDirection,
  rightDirection,
}: {
  currencyCode?: string | null;
  title: string;
  leftLabel: string;
  rightLabel: string;
  leftTransactions: Transaction[];
  rightTransactions: Transaction[];
  leftDirection: "debit" | "credit";
  rightDirection: "debit" | "credit";
}) => {
  const leftTotal = subtotalForDirection(leftTransactions, leftDirection);
  const rightTotal = subtotalForDirection(rightTransactions, rightDirection);
  const difference = leftTotal - rightTotal;
  const leftAmountLabel = leftDirection === "debit" ? "DR" : "CR";
  const rightAmountLabel = rightDirection === "debit" ? "DR" : "CR";

  return `
    <section class="lane">
      <h3>${escapeHtml(title)}</h3>
      <div class="lane-grid">
        <article class="bucket">
          <div class="bucket-head">
            <div>
              <h4>${escapeHtml(leftLabel)}</h4>
              <p>${leftTransactions.length} row${leftTransactions.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Narration</th>
                <th class="amount">${leftAmountLabel}</th>
              </tr>
            </thead>
            <tbody>
              ${renderTransactionRows(
                leftTransactions,
                leftDirection,
                `No ${leftLabel.toLowerCase()} in this section.`,
                currencyCode
              )}
            </tbody>
          </table>
        </article>
        <article class="bucket">
          <div class="bucket-head">
            <div>
              <h4>${escapeHtml(rightLabel)}</h4>
              <p>${rightTransactions.length} row${rightTransactions.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Narration</th>
                <th class="amount">${rightAmountLabel}</th>
              </tr>
            </thead>
            <tbody>
              ${renderTransactionRows(
                rightTransactions,
                rightDirection,
                `No ${rightLabel.toLowerCase()} in this section.`,
                currencyCode
              )}
            </tbody>
          </table>
        </article>
      </div>
      <div class="totals-grid">
        <div class="total-card right">
          <span>Sub Total - ${escapeHtml(leftLabel)}</span>
          <strong>${escapeHtml(formatMoney(leftTotal, currencyCode))}</strong>
        </div>
        <div class="total-card right">
          <span>Sub Total - ${escapeHtml(rightLabel)}</span>
          <strong>${escapeHtml(formatMoney(rightTotal, currencyCode))}</strong>
        </div>
      </div>
    </section>
  `;
};

export function openReconciliationReportPreview({
  accountName,
  accountNumber,
  periodMonth,
  status,
  companyName,
  companyAddress,
  companyLogoDataUrl,
  preparedBy,
  reviewedBy,
  currencyCode,
  summary,
  bankCredits,
  bookDebits,
  bookCredits,
  bankDebits,
}: ReportPreviewInput) {
  const previewWindow = window.open("", "_blank");

  if (!previewWindow) {
    throw new Error("Please allow pop-ups so we can open the PDF preview.");
  }

  const generatedAt = new Date().toLocaleString();

  const reportHtml = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reconciliation Report Preview</title>
        <style>
          :root {
            color-scheme: light;
            --ink: #0f172a;
            --muted: #64748b;
            --line: #dbe2ea;
            --paper: #ffffff;
            --panel: #f8fafc;
            --accent: #0f766e;
            --warn: #b91c1c;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            font-family: "Avenir Next", "Segoe UI", sans-serif;
            color: var(--ink);
            background: #e2e8f0;
          }
          .toolbar {
            position: sticky;
            top: 0;
            z-index: 5;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 16px;
            padding: 16px 20px;
            background: rgba(15, 23, 42, 0.94);
            color: white;
          }
          .toolbar button {
            border: 0;
            border-radius: 999px;
            padding: 10px 16px;
            font-weight: 700;
            cursor: pointer;
          }
          .toolbar .primary { background: #14b8a6; color: #042f2e; }
          .toolbar .secondary { background: rgba(255,255,255,0.12); color: white; }
          .page {
            width: min(1120px, calc(100% - 32px));
            margin: 24px auto 40px;
            background: var(--paper);
            border-radius: 24px;
            box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
            overflow: hidden;
          }
          .header {
            padding: 28px 32px;
            border-bottom: 1px solid var(--line);
            background: linear-gradient(135deg, #f8fafc, #ffffff 55%, #ecfeff);
          }
          .eyebrow, .card span, .total-card span, .bucket thead th {
            text-transform: uppercase;
            letter-spacing: 0.18em;
            font-size: 11px;
            font-weight: 700;
            color: var(--muted);
          }
          h1 {
            margin: 12px 0 6px;
            font-size: 32px;
            line-height: 1.1;
          }
          .subhead {
            margin: 0;
            font-size: 14px;
            line-height: 1.6;
            color: var(--muted);
          }
          .meta-grid, .totals-grid, .adjusted-grid, .lane-grid {
            display: grid;
            gap: 16px;
          }
          .meta-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            margin-top: 24px;
          }
          .card, .total-card, .bucket {
            border: 1px solid var(--line);
            border-radius: 20px;
            background: white;
          }
          .card {
            padding: 18px 20px;
          }
          .card strong, .total-card strong {
            display: block;
            margin-top: 10px;
            font-size: 26px;
            line-height: 1.1;
          }
          .card small {
            display: block;
            margin-top: 8px;
            color: var(--muted);
            font-size: 12px;
          }
          .content {
            padding: 24px 32px 32px;
          }
          .company-strip {
            display: flex;
            align-items: center;
            gap: 18px;
            margin: 0 0 20px;
            padding: 16px 18px;
            border: 1px solid var(--line);
            border-radius: 20px;
            background: rgba(255, 255, 255, 0.88);
          }
          .logo-wrap {
            width: 86px;
            height: 86px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 18px;
            border: 1px solid var(--line);
            background: white;
            overflow: hidden;
            flex-shrink: 0;
          }
          .logo-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
          .company-name {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
          }
          .company-address {
            margin: 8px 0 0;
            color: var(--muted);
            font-size: 14px;
            line-height: 1.6;
          }
          .lane {
            margin-top: 20px;
          }
          .lane:first-child { margin-top: 0; }
          .lane h3 {
            margin: 0 0 12px;
            font-size: 18px;
          }
          .lane-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .bucket-head {
            padding: 18px 20px;
            border-bottom: 1px solid var(--line);
          }
          .bucket h4 {
            margin: 0;
            font-size: 18px;
          }
          .bucket-head p {
            margin: 6px 0 0;
            color: var(--muted);
            font-size: 13px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          th, td {
            padding: 10px 12px;
            border-bottom: 1px solid #edf2f7;
            font-size: 12px;
            vertical-align: top;
          }
          td:nth-child(3) {
            word-break: break-word;
            overflow-wrap: anywhere;
          }
          th:nth-child(1), td:nth-child(1) { width: 92px; }
          th:nth-child(2), td:nth-child(2) { width: 112px; }
          th:nth-child(4), td:nth-child(4) { width: 118px; }
          td.amount, th.amount {
            text-align: right;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
          }
          td.empty {
            text-align: center;
            color: var(--muted);
            padding: 26px 12px;
          }
          .totals-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            margin-top: 16px;
          }
          .total-card {
            padding: 18px 20px;
          }
          .total-card.right { text-align: right; }
          .adjusted-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            margin-top: 24px;
          }
          .adjusted-card {
            border: 1px solid var(--line);
            border-radius: 22px;
            padding: 20px 22px;
            background: #0f172a;
            color: white;
          }
          .adjusted-card span {
            text-transform: uppercase;
            letter-spacing: 0.18em;
            font-size: 11px;
            font-weight: 700;
            color: #cbd5e1;
          }
          .adjusted-card strong {
            display: block;
            margin-top: 12px;
            font-size: 30px;
            line-height: 1.1;
          }
          .adjusted-card small {
            display: block;
            margin-top: 10px;
            font-size: 12px;
            color: #cbd5e1;
          }
          .difference-card {
            border: 1px solid var(--line);
            border-radius: 22px;
            padding: 20px 22px;
            background: white;
            text-align: center;
          }
          .difference-card strong {
            display: block;
            margin-top: 12px;
            font-size: 32px;
            line-height: 1.1;
            color: ${
              Math.abs(summary.difference) < 0.01
                ? '"var(--accent)"'
                : '"var(--warn)"'
            };
          }
          .signoff-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-top: 40px;
          }
          .signoff-card {
            border-top: 2px solid var(--line);
            padding-top: 14px;
          }
          .signoff-card span {
            text-transform: uppercase;
            letter-spacing: 0.18em;
            font-size: 11px;
            font-weight: 700;
            color: var(--muted);
          }
          .signoff-card strong {
            display: block;
            min-height: 32px;
            margin-top: 12px;
            font-size: 18px;
            font-weight: 700;
          }
          @media print {
            body { background: white; }
            .toolbar { display: none !important; }
            .page {
              width: 100%;
              margin: 0;
              border-radius: 0;
              box-shadow: none;
            }
            @page { size: A4 landscape; margin: 12mm; }
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <div>
            <strong>PDF Preview</strong>
            <div style="font-size:12px;opacity:0.82;margin-top:4px;">Use print to export or save as PDF.</div>
          </div>
          <div style="display:flex;gap:10px;">
            <button class="secondary" id="close-preview" type="button">Close</button>
            <button class="primary" id="print-preview" type="button" onclick="window.focus(); setTimeout(() => window.print(), 120);">
              Print / Save PDF
            </button>
          </div>
        </div>
        <main class="page">
          <header class="header">
            ${
              companyName || companyAddress || companyLogoDataUrl
                ? `
            <div class="company-strip">
              <div class="logo-wrap"><img src="${escapeHtml(
                companyLogoDataUrl || "/brand/ezfavicon.svg"
              )}" alt="Company logo" class="logo-image" /></div>
              <div class="company-meta">
                ${
                  companyName
                    ? `<p class="company-name">${escapeHtml(companyName)}</p>`
                    : ""
                }
                ${
                  companyAddress
                    ? `<p class="company-address">${escapeHtml(companyAddress).replace(/\n/g, "<br />")}</p>`
                    : ""
                }
              </div>
            </div>`
                : `
            <div class="company-strip">
              <div class="logo-wrap"><img src="/brand/ezfavicon.svg" alt="EZIRECON logo" class="logo-image" /></div>
              <div class="company-meta">
                <p class="company-name">EZIRECON</p>
              </div>
            </div>`
            }
            <div class="eyebrow">Reconciliation Report</div>
            <h1>BANK RECONCILIATION STATEMENT</h1>
            <p class="subhead">
              This print-ready preview focuses on the current outstanding reconciliation position for the selected account-month.
            </p>
            <div class="meta-grid">
              <div class="card">
                <span>Account / Period</span>
                <strong>${escapeHtml(accountName)}</strong>
                ${
                  accountNumber
                    ? `<small>Account No. ${escapeHtml(accountNumber)}</small>`
                    : ""
                }
                <small>${escapeHtml(periodMonth)}${status ? ` · ${escapeHtml(status)}` : ""}</small>
              </div>
              <div class="card">
                <span>Cash Book</span>
                <strong>${escapeHtml(formatMoney(summary.bookClosingBalance, currencyCode))}</strong>
                <small>Opening ${escapeHtml(formatMoney(summary.bookOpenBalance, currencyCode))} · Closing ${escapeHtml(formatMoney(summary.bookClosingBalance, currencyCode))}</small>
              </div>
              <div class="card">
                <span>Bank Statement</span>
                <strong>${escapeHtml(formatMoney(summary.bankClosingBalance, currencyCode))}</strong>
                <small>Opening ${escapeHtml(formatMoney(summary.bankOpenBalance, currencyCode))} · Closing ${escapeHtml(formatMoney(summary.bankClosingBalance, currencyCode))}</small>
              </div>
            </div>
            <p class="subhead" style="margin-top:18px;">Generated ${escapeHtml(generatedAt)}</p>
          </header>
          <section class="content">
            ${renderLane({
              currencyCode,
              title: "Bank Credits Against Cash Book Debits",
              leftLabel: "Bank Credits",
              rightLabel: "Cash Book Debits",
              leftTransactions: bankCredits,
              rightTransactions: bookDebits,
              leftDirection: "credit",
              rightDirection: "debit",
            })}
            ${renderLane({
              currencyCode,
              title: "Cash Book Credits Against Bank Debits",
              leftLabel: "Cash Book Credits",
              rightLabel: "Bank Debits",
              leftTransactions: bookCredits,
              rightTransactions: bankDebits,
              leftDirection: "credit",
              rightDirection: "debit",
            })}
            <div class="adjusted-grid">
              <div class="adjusted-card">
                <span>Adjusted Cash Book Balance</span>
                <strong>${escapeHtml(formatMoney(summary.adjustedBookBalance, currencyCode))}</strong>
                <small>
                  ${escapeHtml(formatMoney(summary.bookClosingBalance, currencyCode))} +
                  ${escapeHtml(formatMoney(summary.bankCreditSubtotal, currencyCode))} +
                  ${escapeHtml(formatMoney(summary.bookCreditSubtotal, currencyCode))}
                </small>
              </div>
              <div class="difference-card">
                <span class="eyebrow">Difference</span>
                <strong>${escapeHtml(formatMoney(summary.difference, currencyCode))}</strong>
              </div>
              <div class="adjusted-card">
                <span>Adjusted Bank Balance</span>
                <strong>${escapeHtml(formatMoney(summary.adjustedBankBalance, currencyCode))}</strong>
                <small>
                  ${escapeHtml(formatMoney(summary.bankClosingBalance, currencyCode))} +
                  ${escapeHtml(formatMoney(summary.bookDebitSubtotal, currencyCode))} +
                  ${escapeHtml(formatMoney(summary.bankDebitSubtotal, currencyCode))}
                </small>
              </div>
            </div>
            <div class="signoff-grid">
              <div class="signoff-card">
                <span>Prepared By</span>
                <strong>${escapeHtml(preparedBy || "")}</strong>
              </div>
              <div class="signoff-card">
                <span>Reviewed By</span>
                <strong>${escapeHtml(reviewedBy || "")}</strong>
              </div>
            </div>
          </section>
        </main>
        <script>
          document.getElementById("print-preview")?.addEventListener("click", () => {
            window.focus();
            setTimeout(() => window.print(), 120);
          });
          document.getElementById("close-preview")?.addEventListener("click", () => window.close());
        </script>
      </body>
    </html>
  `;

  previewWindow.document.open();
  previewWindow.document.write(reportHtml);
  previewWindow.document.close();
  previewWindow.focus();
}
