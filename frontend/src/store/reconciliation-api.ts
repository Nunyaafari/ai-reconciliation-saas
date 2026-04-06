import { create } from "zustand";
import { apiClient } from "@/lib/api";

// ===== TYPES =====

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

export type ColumnMapping = {
  date: string;
  narration: string;
  reference: string;
  amount: string;
};

export type UploadSession = {
  id: string;
  fileName: string;
  fileType: string;
  uploadSource: "bank" | "book";
  status: string;
  rowsExtracted?: number;
  rowsStandardized?: number;
};

// ===== STORE =====

export type ReconciliationStore = {
  // State
  step: "upload" | "mapping" | "reconciliation" | "complete";
  bankTransactions: Transaction[];
  bookTransactions: Transaction[];
  matchGroups: MatchGroup[];
  columnMapping: ColumnMapping | null;
  uploadedFileName: string | null;
  bankSessionId: string | null;
  bookSessionId: string | null;
  orgId: string | null;

  // UI State
  loading: boolean;
  error: string | null;
  progress: number;

  // Actions
  setStep: (step: ReconciliationStore["step"]) => void;
  setBankTransactions: (transactions: Transaction[]) => void;
  setBookTransactions: (transactions: Transaction[]) => void;
  setColumnMapping: (mapping: ColumnMapping | null) => void;
  setUploadedFileName: (name: string | null) => void;
  setOrgId: (id: string) => void;
  setBankSessionId: (id: string) => void;
  setBookSessionId: (id: string) => void;
  setError: (error: string | null) => void;
  setProgress: (progress: number) => void;

  // Async Actions
  uploadFile: (file: File, source: "bank" | "book") => Promise<void>;
  extractAndPreviewData: (file: File, sessionId: string) => Promise<ColumnMapping>;
  confirmMappingAndStandardize: (
    file: File,
    sessionId: string,
    mapping: ColumnMapping
  ) => Promise<void>;
  startReconciliation: () => Promise<void>;
  createMatch: (
    bankTransactionIds: string[],
    bookTransactionIds: string[],
    confidenceScore: number
  ) => Promise<void>;
  approveMatch: (groupId: string) => Promise<void>;
  rejectMatch: (groupId: string) => Promise<void>;

  // Utility
  addMatchGroup: (group: MatchGroup) => void;
  reset: () => void;
};

export const useReconciliationStore = create<ReconciliationStore>((set, get) => ({
  // Initial State
  step: "upload",
  bankTransactions: [],
  bookTransactions: [],
  matchGroups: [],
  columnMapping: null,
  uploadedFileName: null,
  bankSessionId: null,
  bookSessionId: null,
  orgId: null,
  loading: false,
  error: null,
  progress: 0,

  // Synchronous Actions
  setStep: (step) => set({ step }),
  setBankTransactions: (transactions) => set({ bankTransactions: transactions }),
  setBookTransactions: (transactions) => set({ bookTransactions: transactions }),
  setColumnMapping: (mapping) => set({ columnMapping: mapping }),
  setUploadedFileName: (name) => set({ uploadedFileName: name }),
  setOrgId: (id) => set({ orgId: id }),
  setBankSessionId: (id) => set({ bankSessionId: id }),
  setBookSessionId: (id) => set({ bookSessionId: id }),
  setError: (error) => set({ error }),
  setProgress: (progress) => set({ progress }),

  // ===== ASYNC ACTIONS =====

  uploadFile: async (file: File, source: "bank" | "book") => {
    if (!get().orgId) {
      set({ error: "Organization ID not set. Please set organization first.", loading: false });
      return;
    }

    set({ loading: true, error: null });

    try {
      const response = await apiClient.createUploadSession(
        get().orgId!,
        file,
        source
      );

      if (!response.success) {
        set({ error: response.error || "Upload failed", loading: false });
        return;
      }

      const sessionId = response.data?.id;
      if (source === "bank") {
        set({ bankSessionId: sessionId, uploadedFileName: file.name });
      } else {
        set({ bookSessionId: sessionId, uploadedFileName: file.name });
      }

      // Auto-transition to mapping after a short delay
      setTimeout(() => {
        set({ step: "mapping", loading: false });
      }, 500);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Upload failed",
        loading: false,
      });
    }
  },

  extractAndPreviewData: async (file: File, sessionId: string) => {
    set({ loading: true, error: null });

    try {
      const response = await apiClient.extractData(sessionId);

      if (!response.success) {
        throw new Error(response.error || "Extraction failed");
      }

      const aiMapping: ColumnMapping = {
        date: response.data?.ai_guess_mapping?.date || "Date",
        narration: response.data?.ai_guess_mapping?.narration || "Narration",
        reference: response.data?.ai_guess_mapping?.reference || "Reference",
        amount: response.data?.ai_guess_mapping?.amount || "Amount",
      };

      set({ loading: false });
      return aiMapping;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Extraction failed";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  confirmMappingAndStandardize: async (
    file: File,
    sessionId: string,
    mapping: ColumnMapping
  ) => {
    set({ loading: true, error: null });

    try {
      const response = await apiClient.confirmMapping(
        sessionId,
        mapping,
        true
      );

      if (!response.success) {
        throw new Error(response.error || "Standardization failed");
      }

      set({
        columnMapping: mapping,
        loading: false,
      });

      // Fetch the standardized transactions
      const txResponse = await apiClient.getBankTransactions(sessionId);
      if (txResponse.success && Array.isArray(txResponse.data)) {
        const transactions: Transaction[] = txResponse.data.map((tx: any) => ({
          id: tx.id,
          date: tx.trans_date,
          narration: tx.narration,
          reference: tx.reference || "",
          amount: parseFloat(tx.amount),
          source: "bank",
          matched: tx.status === "matched",
          matchGroupId: tx.match_group_id,
        }));
        set({ bankTransactions: transactions });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Standardization failed";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  startReconciliation: async () => {
    const { orgId, bankSessionId, bookSessionId } = get();

    if (!orgId || !bankSessionId || !bookSessionId) {
      set({ error: "Missing required session IDs" });
      return;
    }

    set({ loading: true, error: null });

    try {
      const response = await apiClient.startReconciliation(
        orgId,
        bankSessionId,
        bookSessionId
      );

      if (!response.success) {
        throw new Error(response.error || "Reconciliation failed");
      }

      const data = response.data;

      // Parse bank transactions
      const bankTxs: Transaction[] = data.bank_transactions?.map((tx: any) => ({
        id: tx.id,
        date: tx.trans_date,
        narration: tx.narration,
        reference: tx.reference || "",
        amount: parseFloat(tx.amount),
        source: "bank",
        matched: tx.status === "matched",
        matchGroupId: tx.match_group_id,
      })) || [];

      // Parse book transactions
      const bookTxs: Transaction[] = data.book_transactions?.map((tx: any) => ({
        id: tx.id,
        date: tx.trans_date,
        narration: tx.narration,
        reference: tx.reference || "",
        amount: parseFloat(tx.amount),
        source: "book",
        matched: tx.status === "matched",
        matchGroupId: tx.match_group_id,
      })) || [];

      // Parse match groups
      const groups: MatchGroup[] = (data.match_groups || []).map((mg: any) => ({
        id: mg.id,
        bankTransactionIds: [],
        bookTransactionIds: [],
        confidence: mg.confidence_score,
        status: mg.status,
        totalBankAmount: parseFloat(mg.total_bank_amount),
        totalBookAmount: parseFloat(mg.total_book_amount),
        variance: parseFloat(mg.variance),
      }));

      set({
        bankTransactions: bankTxs,
        bookTransactions: bookTxs,
        matchGroups: groups,
        progress: data.progress_percent || 0,
        step: "reconciliation",
        loading: false,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Reconciliation failed";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  createMatch: async (
    bankTransactionIds: string[],
    bookTransactionIds: string[],
    confidenceScore: number
  ) => {
    const { orgId } = get();
    if (!orgId) {
      set({ error: "Organization ID not set" });
      return;
    }

    set({ loading: true, error: null });

    try {
      const response = await apiClient.createMatch(
        orgId,
        bankTransactionIds,
        bookTransactionIds,
        confidenceScore
      );

      if (!response.success) {
        throw new Error(response.error || "Match creation failed");
      }

      const newGroup: MatchGroup = {
        id: response.data?.id,
        bankTransactionIds,
        bookTransactionIds,
        confidence: confidenceScore,
        status: "pending",
        totalBankAmount: 0,
        totalBookAmount: 0,
        variance: 0,
      };

      set((state) => ({
        matchGroups: [...state.matchGroups, newGroup],
        bankTransactions: state.bankTransactions.map((tx) =>
          bankTransactionIds.includes(tx.id)
            ? { ...tx, matched: true, matchGroupId: newGroup.id }
            : tx
        ),
        bookTransactions: state.bookTransactions.map((tx) =>
          bookTransactionIds.includes(tx.id)
            ? { ...tx, matched: true, matchGroupId: newGroup.id }
            : tx
        ),
        loading: false,
      }));

      // Update progress
      const state = get();
      const totalTxs = state.bankTransactions.length + state.bookTransactions.length;
      const matchedTxs = state.bankTransactions.filter((t) => t.matched).length +
                        state.bookTransactions.filter((t) => t.matched).length;
      set({ progress: totalTxs > 0 ? Math.round((matchedTxs / totalTxs) * 100) : 0 });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Match creation failed";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  approveMatch: async (groupId: string) => {
    set({ loading: true, error: null });

    try {
      const response = await apiClient.approveMatch(groupId);

      if (!response.success) {
        throw new Error(response.error || "Approval failed");
      }

      set((state) => ({
        matchGroups: state.matchGroups.map((g) =>
          g.id === groupId ? { ...g, status: "approved" } : g
        ),
        loading: false,
      }));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Approval failed";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  rejectMatch: async (groupId: string) => {
    set({ loading: true, error: null });

    try {
      const response = await apiClient.rejectMatch(groupId);

      if (!response.success) {
        throw new Error(response.error || "Rejection failed");
      }

      set((state) => {
        const rejectedGroup = state.matchGroups.find((g) => g.id === groupId);
        return {
          matchGroups: state.matchGroups.filter((g) => g.id !== groupId),
          bankTransactions: state.bankTransactions.map((t) =>
            rejectedGroup?.bankTransactionIds.includes(t.id)
              ? { ...t, matched: false, matchGroupId: undefined }
              : t
          ),
          bookTransactions: state.bookTransactions.map((t) =>
            rejectedGroup?.bookTransactionIds.includes(t.id)
              ? { ...t, matched: false, matchGroupId: undefined }
              : t
          ),
          loading: false,
        };
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Rejection failed";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  addMatchGroup: (group: MatchGroup) => {
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
    }));
  },

  reset: () =>
    set({
      step: "upload",
      bankTransactions: [],
      bookTransactions: [],
      matchGroups: [],
      columnMapping: null,
      uploadedFileName: null,
      bankSessionId: null,
      bookSessionId: null,
      orgId: null,
      loading: false,
      error: null,
      progress: 0,
    }),
}));
