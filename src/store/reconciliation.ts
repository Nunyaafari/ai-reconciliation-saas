import { create } from "zustand";

export type Transaction = {
  id: string;
  date: string;
  narration: string;
  reference: string;
  amount: number;
  source: "bank" | "book";
  matched: boolean;
  matchGroupId?: string;
  confidence?: number;
};

export type MatchGroup = {
  id: string;
  bankTransactionIds: string[];
  bookTransactionIds: string[];
  confidence: number;
  status: "pending" | "approved" | "rejected";
  totalBankAmount: number;
  totalBookAmount: number;
  variance: number;
};

export type ReconciliationStore = {
  step: "upload" | "mapping" | "reconciliation" | "complete";
  bankTransactions: Transaction[];
  bookTransactions: Transaction[];
  matchGroups: MatchGroup[];
  columnMapping: {
    date: string;
    narration: string;
    reference: string;
    amount?: string;
    debit?: string;
    credit?: string;
  } | null;
  uploadedFileName: string | null;

  // Actions
  setStep: (step: ReconciliationStore["step"]) => void;
  setBankTransactions: (transactions: Transaction[]) => void;
  setBookTransactions: (transactions: Transaction[]) => void;
  setColumnMapping: (mapping: ReconciliationStore["columnMapping"]) => void;
  setUploadedFileName: (name: string) => void;
  addMatchGroup: (group: MatchGroup) => void;
  approveMatch: (groupId: string) => void;
  rejectMatch: (groupId: string) => void;
  reset: () => void;
};

export const useReconciliationStore = create<ReconciliationStore>((set) => ({
  step: "upload",
  bankTransactions: [],
  bookTransactions: [],
  matchGroups: [],
  columnMapping: null,
  uploadedFileName: null,

  setStep: (step) => set({ step }),
  setBankTransactions: (transactions) => set({ bankTransactions: transactions }),
  setBookTransactions: (transactions) => set({ bookTransactions: transactions }),
  setColumnMapping: (mapping) => set({ columnMapping: mapping }),
  setUploadedFileName: (name) => set({ uploadedFileName: name }),
  addMatchGroup: (group) =>
    set((state) => ({
      matchGroups: [...state.matchGroups, group],
      bankTransactions: state.bankTransactions.map((t) =>
        group.bankTransactionIds.includes(t.id)
          ? { ...t, matched: true, matchGroupId: group.id }
          : t
      ),
      bookTransactions: state.bookTransactions.map((t) =>
        group.bookTransactionIds.includes(t.id)
          ? { ...t, matched: true, matchGroupId: group.id }
          : t
      ),
    })),
  approveMatch: (groupId) =>
    set((state) => ({
      matchGroups: state.matchGroups.map((g) =>
        g.id === groupId ? { ...g, status: "approved" } : g
      ),
    })),
  rejectMatch: (groupId) =>
    set((state) => ({
      matchGroups: state.matchGroups.filter((g) => g.id !== groupId),
      bankTransactions: state.bankTransactions.map((t) =>
        t.matchGroupId === groupId ? { ...t, matched: false } : t
      ),
      bookTransactions: state.bookTransactions.map((t) =>
        t.matchGroupId === groupId ? { ...t, matched: false } : t
      ),
    })),
  reset: () =>
    set({
      step: "upload",
      bankTransactions: [],
      bookTransactions: [],
      matchGroups: [],
      columnMapping: null,
      uploadedFileName: null,
    }),
}));
