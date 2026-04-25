"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronRight } from "lucide-react";
import { ReconSetup, useReconciliationStore } from "@/store/reconciliation-api";
import {
  DEFAULT_CURRENCY_CODE,
  MAJOR_CURRENCY_OPTIONS,
  normalizeCurrencyCode,
} from "@/lib/currency";
import AppBrand from "./AppBrand";

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

export default function NewReconSetupStep() {
  const {
    beginNewRecon,
    reconSetup,
    setError,
  } = useReconciliationStore();

  const today = new Date();
  const [accountName, setAccountName] = useState(reconSetup?.accountName || "");
  const [accountNumber, setAccountNumber] = useState(
    reconSetup?.accountNumber || ""
  );
  const [month, setMonth] = useState(reconSetup?.month || today.getMonth() + 1);
  const [year, setYear] = useState(reconSetup?.year || today.getFullYear());
  const [bankOpenBalance, setBankOpenBalance] = useState(
    reconSetup?.bankOpenBalance != null ? String(reconSetup.bankOpenBalance) : ""
  );
  const [bookOpenBalance, setBookOpenBalance] = useState(
    reconSetup?.bookOpenBalance != null ? String(reconSetup.bookOpenBalance) : ""
  );
  const [bankClosingBalance, setBankClosingBalance] = useState(
    reconSetup?.bankClosingBalance != null ? String(reconSetup.bankClosingBalance) : ""
  );
  const [bookClosingBalance, setBookClosingBalance] = useState(
    reconSetup?.bookClosingBalance != null ? String(reconSetup.bookClosingBalance) : ""
  );
  const [currencyCode, setCurrencyCode] = useState(
    normalizeCurrencyCode(reconSetup?.currencyCode || DEFAULT_CURRENCY_CODE)
  );

  useEffect(() => {
    if (!reconSetup) return;
    setAccountName(reconSetup.accountName);
    setAccountNumber(reconSetup.accountNumber || "");
    setMonth(reconSetup.month);
    setYear(reconSetup.year);
    setBankOpenBalance(
      reconSetup.bankOpenBalance != null ? String(reconSetup.bankOpenBalance) : ""
    );
    setBookOpenBalance(
      reconSetup.bookOpenBalance != null ? String(reconSetup.bookOpenBalance) : ""
    );
    setBankClosingBalance(
      reconSetup.bankClosingBalance != null ? String(reconSetup.bankClosingBalance) : ""
    );
    setBookClosingBalance(
      reconSetup.bookClosingBalance != null ? String(reconSetup.bookClosingBalance) : ""
    );
    setCurrencyCode(
      normalizeCurrencyCode(reconSetup.currencyCode || DEFAULT_CURRENCY_CODE)
    );
  }, [reconSetup]);

  const periodMonth = `${year}-${String(month).padStart(2, "0")}`;

  const yearOptions = useMemo(() => {
    const currentYear = today.getFullYear();
    return Array.from({ length: 7 }, (_, idx) => currentYear - 2 + idx);
  }, [today]);

  const handleContinue = () => {
    const trimmedAccountName = accountName.trim();
    if (!trimmedAccountName) {
      setError("Account name is required before uploading statements.");
      return;
    }

    const setup: ReconSetup = {
      accountName: trimmedAccountName,
      accountNumber: accountNumber.trim() || undefined,
      month,
      year,
      periodMonth,
      bankOpenBalance:
        bankOpenBalance.trim() === "" ? undefined : Number(bankOpenBalance),
      bookOpenBalance:
        bookOpenBalance.trim() === "" ? undefined : Number(bookOpenBalance),
      bankClosingBalance:
        bankClosingBalance.trim() === "" ? undefined : Number(bankClosingBalance),
      bookClosingBalance:
        bookClosingBalance.trim() === "" ? undefined : Number(bookClosingBalance),
      currencyCode: normalizeCurrencyCode(currencyCode),
    };
    setError(null);
    beginNewRecon(setup);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8">
          <AppBrand subtitle="Account And Period Setup" />
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900">
            Account Setup
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            Set up the reconciliation account and the period you want to work on. After that, the workspace keeps every month grouped under the same account so we can continue cleanly month by month.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <CalendarRange className="h-5 w-5 text-blue-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Recon Setup
                </h2>
                <p className="text-sm text-slate-500">
                  Account-scoped monthly setup before any bank or cash book upload.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Account Name
                </span>
                <input
                  type="text"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  placeholder="e.g. HFC Investments Main Account"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Account Number
                </span>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                  placeholder="Optional account number"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Recon Month
                </span>
                <select
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {MONTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Recon Year
                </span>
                <select
                  value={year}
                  onChange={(event) => setYear(Number(event.target.value))}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {yearOptions.map((optionYear) => (
                    <option key={optionYear} value={optionYear}>
                      {optionYear}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Currency
                </span>
                <select
                  value={currencyCode}
                  onChange={(event) =>
                    setCurrencyCode(normalizeCurrencyCode(event.target.value))
                  }
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {MAJOR_CURRENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Opening Bank Balance
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={bankOpenBalance}
                  onChange={(event) => setBankOpenBalance(event.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Opening Cash Book Balance
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={bookOpenBalance}
                  onChange={(event) => setBookOpenBalance(event.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Closing Bank Balance
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={bankClosingBalance}
                  onChange={(event) => setBankClosingBalance(event.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Closing Cash Book Balance
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={bookClosingBalance}
                  onChange={(event) => setBookClosingBalance(event.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>

            </div>

            <div className="mt-8 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Selected Period
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {accountName.trim() || "Choose an account"}
                  {accountNumber.trim() ? ` · ${accountNumber.trim()}` : ""}
                  {" · "}
                  {periodMonth}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Opening and closing balances are optional here and can still be edited later in the reconciliation report stage.
                </p>
              </div>
              <button
                type="button"
                onClick={handleContinue}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Continue To Uploads
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Workflow
              </p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>1. Set the account and recon month.</p>
                <p>2. Upload the raw cash book and bank statement for that exact account-month.</p>
                <p>3. Verify mapping in raw `DR / CR` format before matching begins.</p>
                <p>4. Reconcile, remove matched items, and carry forward the true outstanding items only.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
