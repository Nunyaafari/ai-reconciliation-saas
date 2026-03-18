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
  matchType: string;
  totalBankAmount: number;
  totalBookAmount: number;
  variance: number;
};

export type ActivityLogEntry = {
  id: string;
  timestamp: string;
  action: "match_created" | "match_approved" | "match_rejected";
  confidence?: number;
  matchType?: string;
  amount?: number;
};

export type MatchSignals = {
  value: number;
  date: number;
  reference: number;
  narration: number;
};

export type MatchSuggestion = {
  bookTransactionId: string;
  confidence: number;
  signals: MatchSignals;
  explanation?: string;
};

export type UnmatchedSuggestion = {
  bankTransactionId: string;
  suggestions: MatchSuggestion[];
};

export type ColumnMapping = {
  date: string;
  narration: string;
  reference: string;
  amount?: string;
  debit?: string;
  credit?: string;
};

export type ExtractionResult = {
  mapping: ColumnMapping;
  previewRows: Record<string, any>[];
  extractionMethod: string;
  extractionConfidence: number;
  columnHeaders: string[];
};

// ===== STORE =====

export type ReconciliationStore = {
  // State
  step: "upload" | "mapping" | "reconciliation" | "complete";
  bankTransactions: Transaction[];
  bookTransactions: Transaction[];
  matchGroups: MatchGroup[];
  unmatchedSuggestions: UnmatchedSuggestion[];
  activityLog: ActivityLogEntry[];
  columnMapping: ColumnMapping | null;
  uploadedFileName: string | null;
  orgId: string | null;
  bankSessionId: string | null;
  bookSessionId: string | null;
  bankFile: File | null;
  bookFile: File | null;
  currentMappingSource: "bank" | "book" | null;

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
  setOrgId: (id: string | null) => void;
  setBankSessionId: (id: string) => void;
  setBookSessionId: (id: string) => void;
  setBankFile: (file: File | null) => void;
  setBookFile: (file: File | null) => void;
  setError: (error: string | null) => void;
  setProgress: (progress: number) => void;

  // Async Actions
  initOrg: () => Promise<string>;
  uploadFile: (file: File, source: "bank" | "book") => Promise<string>;
  extractAndPreviewData: (
    file: File,
    sessionId: string
  ) => Promise<ExtractionResult>;
  confirmMappingAndStandardize: (
    file: File,
    sessionId: string,
    mapping: ColumnMapping,
    source: "bank" | "book"
  ) => Promise<void>;
  startReconciliation: (orgId?: string) => Promise<void>;
  createMatch: (
    bankTransactionIds: string[],
    bookTransactionIds: string[],
    confidenceScore: number
  ) => Promise<void>;
  approveMatch: (groupId: string) => Promise<void>;
  rejectMatch: (groupId: string) => Promise<void>;
  approveMatchesBulk: (groupIds: string[]) => Promise<void>;
  rejectMatchesBulk: (groupIds: string[]) => Promise<void>;
  logActivity: (entry: ActivityLogEntry) => void;

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
  unmatchedSuggestions: [],
  activityLog: [],
  columnMapping: null,
  uploadedFileName: null,
  orgId: null,
  bankSessionId: null,
  bookSessionId: null,
  bankFile: null,
  bookFile: null,
  currentMappingSource: null,
  loading: false,
  error: null,
  progress: 0,

  // Synchronous Actions
  setStep: (step) => set({ step }),
  setBankTransactions: (transactions) =>
    set({ bankTransactions: transactions }),
  setBookTransactions: (transactions) =>
    set({ bookTransactions: transactions }),
  setColumnMapping: (mapping) => set({ columnMapping: mapping }),
  setUploadedFileName: (name) => set({ uploadedFileName: name }),
  setOrgId: (id) => set({ orgId: id }),
  setBankSessionId: (id) => set({ bankSessionId: id }),
  setBookSessionId: (id) => set({ bookSessionId: id }),
  setBankFile: (file) => set({ bankFile: file }),
  setBookFile: (file) => set({ bookFile: file }),
  setError: (error) => set({ error }),
  setProgress: (progress) => set({ progress }),
  logActivity: (entry) =>
    set((state) => ({
      activityLog: [entry, ...state.activityLog].slice(0, 20),
    })),

  // ===== ASYNC ACTIONS =====

  initOrg: async () => {
    set({ loading: true, error: null });

    try {
      const response = await apiClient.bootstrapOrg();
      if (!response.success || !response.data?.id) {
        throw new Error(response.error || "Failed to initialize organization");
      }
      const id = String(response.data.id);
      set({ orgId: id, loading: false });
      return id;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Org init failed";
      set({ error: msg, loading: false });
      throw error;
    }
  },

  uploadFile: async (file: File, source: "bank" | "book") => {
    let { orgId } = get();
    if (!orgId) {
      orgId = await get().initOrg();
    }

    set({ loading: true, error: null });

    try {
      const response = await apiClient.createUploadSession(
        orgId,
        file,
        source
      );

      if (!response.success) {
        set({
          error: response.error || "Upload failed",
          loading: false,
        });
        throw new Error(response.error || "Upload failed");
      }

      const sessionId = response.data?.id;

      if (source === "bank") {
        set({
          bankSessionId: sessionId,
          bankFile: file,
          uploadedFileName: file.name,
          currentMappingSource: "bank",
        });
      } else {
        set({
          bookSessionId: sessionId,
          bookFile: file,
          uploadedFileName: file.name,
          currentMappingSource: "book",
        });
      }

      // Auto-transition to mapping after a short delay
      setTimeout(() => {
        set({ step: "mapping", loading: false });
      }, 500);

      return sessionId;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      set({ error: msg, loading: false });
      throw error;
    }
  },

  extractAndPreviewData: async (file: File, sessionId: string) => {
    set({ loading: true, error: null });

    try {
      const response = await apiClient.extractData(sessionId, file);

      if (!response.success) {
        throw new Error(response.error || "Extraction failed");
      }

      const rawData = response.data?.raw_data || [];
      const columnHeaders =
        response.data?.column_headers?.length > 0
          ? response.data.column_headers
          : (rawData[0] || []).map((_: any, idx: number) => `Col_${idx + 1}`);

      const hasDebit = Boolean(response.data?.ai_guess_mapping?.debit);
      const hasCredit = Boolean(response.data?.ai_guess_mapping?.credit);
      const amountGuess = response.data?.ai_guess_mapping?.amount;

      const aiMapping: ColumnMapping = {
        date: response.data?.ai_guess_mapping?.date || columnHeaders[0] || "Date",
        narration:
          response.data?.ai_guess_mapping?.narration ||
          columnHeaders[1] ||
          "Narration",
        reference:
          response.data?.ai_guess_mapping?.reference ||
          columnHeaders[2] ||
          "Reference",
        amount:
          amountGuess || (!hasDebit && !hasCredit ? columnHeaders[3] || "Amount" : undefined),
        debit: response.data?.ai_guess_mapping?.debit,
        credit: response.data?.ai_guess_mapping?.credit,
      };

      const previewRows = rawData.map((row: any[]) => {
        const rowObj: Record<string, any> = {};
        columnHeaders.forEach((header: string, idx: number) => {
          rowObj[header] = row[idx];
        });
        return rowObj;
      });

      set({ loading: false });
      return {
        mapping: aiMapping,
        previewRows,
        extractionMethod: response.data?.extraction_method || "unknown",
        extractionConfidence: response.data?.ai_confidence ?? 0,
        columnHeaders,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Extraction failed";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  confirmMappingAndStandardize: async (
    file: File,
    sessionId: string,
    mapping: ColumnMapping,
    source: "bank" | "book"
  ) => {
    set({ loading: true, error: null });

    try {
      const response = await apiClient.confirmMapping(
        sessionId,
        file,
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

      // Fetch the standardized transactions for the appropriate source
      const txResponse = source === "bank"
        ? await apiClient.getBankTransactions(sessionId)
        : await apiClient.getBookTransactions(sessionId);

      if (txResponse.success && Array.isArray(txResponse.data)) {
        const transactions: Transaction[] = (txResponse.data || []).map(
          (tx: any) => ({
            id: tx.id,
            date: tx.trans_date,
            narration: tx.narration,
            reference: tx.reference || "",
            amount: parseFloat(tx.amount),
            source: source,
            matched: tx.status === "matched",
            matchGroupId: tx.match_group_id,
          })
        );

        if (source === "bank") {
          set({ bankTransactions: transactions });
        } else {
          set({ bookTransactions: transactions });
        }
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Standardization failed";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  startReconciliation: async (orgId?: string) => {
    const { bankSessionId, bookSessionId } = get();
    const resolvedOrgId = orgId || get().orgId;

    if (!bankSessionId || !bookSessionId) {
      set({ error: "Missing required session IDs" });
      return;
    }

    if (!resolvedOrgId) {
      set({ error: "Organization not initialized" });
      return;
    }

    set({ loading: true, error: null });

    try {
      const response = await apiClient.startReconciliation(
        resolvedOrgId,
        bankSessionId,
        bookSessionId
      );

      if (!response.success) {
        throw new Error(response.error || "Reconciliation failed");
      }

      const data = response.data;

      // Parse match groups with real data
      const groups: MatchGroup[] = (data.match_groups || []).map((mg: any) => ({
        id: mg.id,
        bankTransactionIds: [],
        bookTransactionIds: [],
        confidence: mg.confidence_score,
        status: mg.status,
        matchType: mg.match_type || "1:1",
        totalBankAmount: parseFloat(mg.total_bank_amount),
        totalBookAmount: parseFloat(mg.total_book_amount),
        variance: parseFloat(mg.variance),
      }));

      const unmatchedSuggestions: UnmatchedSuggestion[] = (data.unmatched_suggestions || []).map(
        (u: any) => ({
          bankTransactionId: u.bank_transaction_id,
          suggestions: (u.suggestions || []).map((s: any) => ({
            bookTransactionId: s.book_transaction_id,
            confidence: s.confidence_score,
            signals: s.match_signals,
            explanation: s.explanation,
          })),
        })
      );

      // Refresh transactions to reflect any "pending" matches from the backend
      const bankTxResponse = await apiClient.getBankTransactions(bankSessionId);
      const bookTxResponse = await apiClient.getBookTransactions(bookSessionId);

      const bankTransactions: Transaction[] =
        bankTxResponse.success && Array.isArray(bankTxResponse.data)
          ? (bankTxResponse.data || []).map((tx: any) => ({
              id: tx.id,
              date: tx.trans_date,
              narration: tx.narration,
              reference: tx.reference || "",
              amount: parseFloat(tx.amount),
              source: "bank",
              matched: tx.status === "matched" || tx.status === "pending",
              matchGroupId: tx.match_group_id,
            }))
          : get().bankTransactions;

      const bookTransactions: Transaction[] =
        bookTxResponse.success && Array.isArray(bookTxResponse.data)
          ? (bookTxResponse.data || []).map((tx: any) => ({
              id: tx.id,
              date: tx.trans_date,
              narration: tx.narration,
              reference: tx.reference || "",
              amount: parseFloat(tx.amount),
              source: "book",
              matched: tx.status === "matched" || tx.status === "pending",
              matchGroupId: tx.match_group_id,
            }))
          : get().bookTransactions;

      set({
        matchGroups: groups,
        unmatchedSuggestions,
        bankTransactions,
        bookTransactions,
        progress: data.progress_percent || 0,
        step: "reconciliation",
        loading: false,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Reconciliation failed";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  createMatch: async (
    bankTransactionIds: string[],
    bookTransactionIds: string[],
    confidenceScore: number
  ) => {
    let { orgId } = get();
    if (!orgId) {
      orgId = await get().initOrg();
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
        matchType: `${bankTransactionIds.length}:${bookTransactionIds.length}`,
        totalBankAmount: 0,
        totalBookAmount: 0,
        variance: 0,
      };

      set((state) => ({
        matchGroups: [...state.matchGroups, newGroup],
        unmatchedSuggestions: state.unmatchedSuggestions.filter(
          (u) => !bankTransactionIds.includes(u.bankTransactionId)
        ),
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

      get().logActivity({
        id: newGroup.id,
        timestamp: new Date().toISOString(),
        action: "match_created",
        confidence: confidenceScore,
        matchType: newGroup.matchType,
        amount: newGroup.totalBankAmount || 0,
      });

      // Update progress
      const state = get();
      const totalTxs =
        state.bankTransactions.length + state.bookTransactions.length;
      const matchedTxs =
        state.bankTransactions.filter((t) => t.matched).length +
        state.bookTransactions.filter((t) => t.matched).length;
      set({
        progress: totalTxs > 0 ? Math.round((matchedTxs / totalTxs) * 100) : 0,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Match creation failed";
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

      const group = get().matchGroups.find((g) => g.id === groupId);
      get().logActivity({
        id: groupId,
        timestamp: new Date().toISOString(),
        action: "match_approved",
        confidence: group?.confidence,
        matchType: group?.matchType,
        amount: group?.totalBankAmount,
      });
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

      const groupBefore = get().matchGroups.find((g) => g.id === groupId);
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

      get().logActivity({
        id: groupId,
        timestamp: new Date().toISOString(),
        action: "match_rejected",
        confidence: groupBefore?.confidence,
        matchType: groupBefore?.matchType,
        amount: groupBefore?.totalBankAmount,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Rejection failed";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  approveMatchesBulk: async (groupIds: string[]) => {
    if (groupIds.length === 0) return;
    await Promise.all(groupIds.map((id) => get().approveMatch(id)));
  },

  rejectMatchesBulk: async (groupIds: string[]) => {
    if (groupIds.length === 0) return;
    await Promise.all(groupIds.map((id) => get().rejectMatch(id)));
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
    set((state) => ({
      step: "upload",
      bankTransactions: [],
      bookTransactions: [],
      matchGroups: [],
      unmatchedSuggestions: [],
      activityLog: [],
      columnMapping: null,
      uploadedFileName: null,
      bankSessionId: null,
      bookSessionId: null,
      bankFile: null,
      bookFile: null,
      currentMappingSource: null,
      loading: false,
      error: null,
      progress: 0,
      orgId: state.orgId,
    })),
}));
