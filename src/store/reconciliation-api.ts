import { create } from "zustand";
import { apiClient } from "@/lib/api";

// ===== TYPES =====

export type Transaction = {
  id: string;
  date: string;
  narration: string;
  reference: string;
  amount: number;
  direction?: "debit" | "credit" | null;
  debitAmount?: number;
  creditAmount?: number;
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

export type ReconciliationSession = {
  id: string;
  periodMonth: string;
  bankUploadSessionId?: string | null;
  bookUploadSessionId?: string | null;
  bankOpenBalance: number;
  bankClosingBalance: number;
  bookOpenBalance: number;
  bookClosingBalance: number;
  status: "open" | "closed" | string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
};

export type ReconciliationBucketSummary = {
  count: number;
  total: number;
};

export type ReconciliationSummary = {
  periodMonth: string;
  netBankMovement: number;
  netBookMovement: number;
  bankOpenBalance: number;
  bankClosingBalance: number;
  bookOpenBalance: number;
  bookClosingBalance: number;
  adjustedBankBalance: number;
  adjustedBookBalance: number;
  difference: number;
  unresolvedBankDebits: ReconciliationBucketSummary;
  unresolvedBankCredits: ReconciliationBucketSummary;
  unresolvedBookDebits: ReconciliationBucketSummary;
  unresolvedBookCredits: ReconciliationBucketSummary;
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

export type ProcessingJob = {
  id: string;
  orgId?: string | null;
  uploadSessionId?: string | null;
  jobType: string;
  status: string;
  progressPercent: number;
  attemptCount: number;
  maxRetries: number;
  message?: string | null;
  resultPayload?: any;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  lastRetryAt?: string | null;
  deadLetteredAt?: string | null;
};

export type AuthUser = {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
};

export type AuthOrganization = {
  id: string;
  name: string;
  slug: string;
  email: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toNumber = (value: any) => {
  const parsed =
    typeof value === "number" ? value : parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapTransaction = (
  tx: any,
  source: "bank" | "book"
): Transaction => ({
  id: tx.id,
  date: tx.trans_date,
  narration: tx.narration,
  reference: tx.reference || "",
  amount: toNumber(tx.amount),
  direction: tx.direction || null,
  debitAmount: toNumber(tx.debit_amount),
  creditAmount: toNumber(tx.credit_amount),
  source,
  matched: tx.status === "matched" || tx.status === "pending",
  matchGroupId: tx.match_group_id || undefined,
});

const mapMatchGroup = (mg: any): MatchGroup => ({
  id: mg.id,
  bankTransactionIds: (mg.bank_transaction_ids || []).map(String),
  bookTransactionIds: (mg.book_transaction_ids || []).map(String),
  confidence: mg.confidence_score,
  status: mg.status,
  matchType: mg.match_type || "1:1",
  totalBankAmount: toNumber(mg.total_bank_amount),
  totalBookAmount: toNumber(mg.total_book_amount),
  variance: toNumber(mg.variance),
});

const mapSummary = (summary: any): ReconciliationSummary | null => {
  if (!summary) return null;
  return {
    periodMonth: summary.period_month,
    netBankMovement: toNumber(summary.net_bank_movement),
    netBookMovement: toNumber(summary.net_book_movement),
    bankOpenBalance: toNumber(summary.bank_open_balance),
    bankClosingBalance: toNumber(summary.bank_closing_balance),
    bookOpenBalance: toNumber(summary.book_open_balance),
    bookClosingBalance: toNumber(summary.book_closing_balance),
    adjustedBankBalance: toNumber(summary.adjusted_bank_balance),
    adjustedBookBalance: toNumber(summary.adjusted_book_balance),
    difference: toNumber(summary.difference),
    unresolvedBankDebits: {
      count: summary.unresolved_bank_debits?.count || 0,
      total: toNumber(summary.unresolved_bank_debits?.total),
    },
    unresolvedBankCredits: {
      count: summary.unresolved_bank_credits?.count || 0,
      total: toNumber(summary.unresolved_bank_credits?.total),
    },
    unresolvedBookDebits: {
      count: summary.unresolved_book_debits?.count || 0,
      total: toNumber(summary.unresolved_book_debits?.total),
    },
    unresolvedBookCredits: {
      count: summary.unresolved_book_credits?.count || 0,
      total: toNumber(summary.unresolved_book_credits?.total),
    },
  };
};

const mapReconciliationSession = (session: any): ReconciliationSession | null => {
  if (!session) return null;
  return {
    id: session.id,
    periodMonth: session.period_month,
    bankUploadSessionId: session.bank_upload_session_id || null,
    bookUploadSessionId: session.book_upload_session_id || null,
    bankOpenBalance: toNumber(session.bank_open_balance),
    bankClosingBalance: toNumber(session.bank_closing_balance),
    bookOpenBalance: toNumber(session.book_open_balance),
    bookClosingBalance: toNumber(session.book_closing_balance),
    status: session.status,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    closedAt: session.closed_at || null,
  };
};

const mapProcessingJob = (job: any): ProcessingJob | null => {
  if (!job) return null;
  return {
    id: String(job.id),
    orgId: job.org_id ? String(job.org_id) : null,
    uploadSessionId: job.upload_session_id ? String(job.upload_session_id) : null,
    jobType: job.job_type,
    status: job.status,
    progressPercent: job.progress_percent || 0,
    attemptCount: job.attempt_count || 0,
    maxRetries: job.max_retries || 0,
    message: job.message || null,
    resultPayload: job.result_payload,
    errorMessage: job.error_message || null,
    createdAt: job.created_at,
    startedAt: job.started_at || null,
    completedAt: job.completed_at || null,
    lastRetryAt: job.last_retry_at || null,
    deadLetteredAt: job.dead_lettered_at || null,
  };
};

const mapAuthUser = (user: any): AuthUser | null => {
  if (!user) return null;
  return {
    id: String(user.id),
    orgId: String(user.org_id),
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: Boolean(user.is_active),
  };
};

const mapAuthOrganization = (organization: any): AuthOrganization | null => {
  if (!organization) return null;
  return {
    id: String(organization.id),
    name: organization.name,
    slug: organization.slug,
    email: organization.email,
  };
};

const waitForProcessingJob = async (
  jobId: string,
  onUpdate: (job: ProcessingJob) => void
): Promise<ProcessingJob> => {
  for (let attempt = 0; attempt < 900; attempt += 1) {
    const response = await apiClient.getProcessingJob(jobId);

    if (!response.success) {
      throw new Error(response.error || "Failed to fetch processing job");
    }

    const job = mapProcessingJob(response.data);
    if (!job) {
      throw new Error("Processing job response was empty");
    }

    onUpdate(job);

    if (job.status === "completed") {
      return job;
    }

    if (job.status === "failed" || job.status === "dead_lettered") {
      throw new Error(job.errorMessage || "Background processing failed");
    }

    await sleep(1000);
  }

  throw new Error("Background processing timed out");
};

const mapUnmatchedSuggestions = (items: any[] = []): UnmatchedSuggestion[] =>
  items.map((u: any) => ({
    bankTransactionId: u.bank_transaction_id,
    suggestions: (u.suggestions || []).map((s: any) => ({
      bookTransactionId: s.book_transaction_id,
      confidence: s.confidence_score,
      signals: s.match_signals,
      explanation: s.explanation,
    })),
  }));

// ===== STORE =====

export type ReconciliationStore = {
  // State
  step: "upload" | "mapping" | "reconciliation" | "history" | "ops" | "complete";
  bankTransactions: Transaction[];
  bookTransactions: Transaction[];
  matchGroups: MatchGroup[];
  unmatchedSuggestions: UnmatchedSuggestion[];
  activityLog: ActivityLogEntry[];
  columnMapping: ColumnMapping | null;
  uploadedFileName: string | null;
  orgId: string | null;
  authStatus: "loading" | "authenticated" | "anonymous";
  currentUser: AuthUser | null;
  currentOrganization: AuthOrganization | null;
  bankSessionId: string | null;
  bookSessionId: string | null;
  bankFile: File | null;
  bookFile: File | null;
  currentMappingSource: "bank" | "book" | null;
  reconciliationSession: ReconciliationSession | null;
  summary: ReconciliationSummary | null;
  historySessions: ReconciliationSession[];
  activeJob: ProcessingJob | null;

  // UI State
  loading: boolean;
  error: string | null;
  progress: number;
  historyLoading: boolean;

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
  hydrateAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    name: string;
    email: string;
    password: string;
    organizationName: string;
    organizationSlug?: string;
  }) => Promise<void>;
  logout: () => void;
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
  loadReconciliationHistory: () => Promise<void>;
  openHistorySession: (
    session: ReconciliationSession,
    reopenClosed?: boolean
  ) => Promise<void>;
  startReconciliation: (orgId?: string) => Promise<void>;
  refreshReconciliation: (orgId?: string) => Promise<void>;
  createMatch: (
    bankTransactionIds: string[],
    bookTransactionIds: string[],
    confidenceScore: number
  ) => Promise<void>;
  approveMatch: (groupId: string) => Promise<void>;
  rejectMatch: (groupId: string) => Promise<void>;
  approveMatchesBulk: (groupIds: string[]) => Promise<void>;
  rejectMatchesBulk: (groupIds: string[]) => Promise<void>;
  closeReconciliationSession: () => Promise<void>;
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
  authStatus: "loading",
  currentUser: null,
  currentOrganization: null,
  bankSessionId: null,
  bookSessionId: null,
  bankFile: null,
  bookFile: null,
  currentMappingSource: null,
  reconciliationSession: null,
  summary: null,
  historySessions: [],
  activeJob: null,
  loading: false,
  error: null,
  progress: 0,
  historyLoading: false,

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
    const existingOrgId =
      get().currentOrganization?.id || get().orgId;
    if (existingOrgId) {
      set({ orgId: existingOrgId, authStatus: "authenticated" });
      return existingOrgId;
    }

    await get().hydrateAuth();
    const hydratedOrgId = get().currentOrganization?.id || get().orgId;
    if (!hydratedOrgId) {
      throw new Error("Please sign in to continue");
    }
    return hydratedOrgId;
  },

  hydrateAuth: async () => {
    const token = apiClient.getStoredToken();
    if (!token) {
      set({
        authStatus: "anonymous",
        currentUser: null,
        currentOrganization: null,
        orgId: null,
      });
      return;
    }

    set({ loading: true, error: null, authStatus: "loading" });

    try {
      const response = await apiClient.getCurrentSession();
      if (!response.success || !response.data?.organization?.id) {
        apiClient.clearStoredToken();
        set({
          authStatus: "anonymous",
          currentUser: null,
          currentOrganization: null,
          orgId: null,
          loading: false,
        });
        return;
      }

      if (response.data?.access_token) {
        apiClient.setStoredToken(response.data.access_token);
      }

      const currentUser = mapAuthUser(response.data.user);
      const currentOrganization = mapAuthOrganization(response.data.organization);

      set({
        authStatus: "authenticated",
        currentUser,
        currentOrganization,
        orgId: currentOrganization?.id || null,
        loading: false,
      });
    } catch (error) {
      apiClient.clearStoredToken();
      const msg = error instanceof Error ? error.message : "Session restore failed";
      set({
        authStatus: "anonymous",
        currentUser: null,
        currentOrganization: null,
        orgId: null,
        error: msg,
        loading: false,
      });
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null });

    try {
      const response = await apiClient.login({ email, password });
      if (!response.success || !response.data?.access_token) {
        throw new Error(response.error || "Login failed");
      }

      apiClient.setStoredToken(response.data.access_token);
      const currentUser = mapAuthUser(response.data.user);
      const currentOrganization = mapAuthOrganization(response.data.organization);
      set({
        authStatus: "authenticated",
        currentUser,
        currentOrganization,
        orgId: currentOrganization?.id || null,
        loading: false,
        step: "upload",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Login failed";
      set({ error: msg, loading: false, authStatus: "anonymous" });
      throw error;
    }
  },

  register: async ({ name, email, password, organizationName, organizationSlug }) => {
    set({ loading: true, error: null });

    try {
      const response = await apiClient.register({
        name,
        email,
        password,
        organization_name: organizationName,
        organization_slug: organizationSlug,
      });
      if (!response.success || !response.data?.access_token) {
        throw new Error(response.error || "Registration failed");
      }

      apiClient.setStoredToken(response.data.access_token);
      const currentUser = mapAuthUser(response.data.user);
      const currentOrganization = mapAuthOrganization(response.data.organization);
      set({
        authStatus: "authenticated",
        currentUser,
        currentOrganization,
        orgId: currentOrganization?.id || null,
        loading: false,
        step: "upload",
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Registration failed";
      set({ error: msg, loading: false, authStatus: "anonymous" });
      throw error;
    }
  },

  logout: () => {
    apiClient.clearStoredToken();
    set({
      authStatus: "anonymous",
      currentUser: null,
      currentOrganization: null,
      orgId: null,
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
      reconciliationSession: null,
      summary: null,
      historySessions: [],
      activeJob: null,
      error: null,
      loading: false,
      progress: 0,
    });
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
      const reusedCompletedSession =
        response.data?.status === "complete" &&
        Number(response.data?.rows_standardized || 0) > 0;

      if (source === "bank") {
        set({
          bankSessionId: sessionId,
          bankFile: file,
          uploadedFileName: file.name,
          currentMappingSource: reusedCompletedSession ? null : "bank",
        });
      } else {
        set({
          bookSessionId: sessionId,
          bookFile: file,
          uploadedFileName: file.name,
          currentMappingSource: reusedCompletedSession ? null : "book",
        });
      }

      if (reusedCompletedSession) {
        const txResponse =
          source === "bank"
            ? await apiClient.getBankTransactions(sessionId)
            : await apiClient.getBookTransactions(sessionId);

        if (txResponse.success && Array.isArray(txResponse.data)) {
          const transactions: Transaction[] = (txResponse.data || []).map((tx: any) =>
            mapTransaction(tx, source)
          );

          if (source === "bank") {
            set({ bankTransactions: transactions });
          } else {
            set({ bookTransactions: transactions });
          }
        }

        const hasBothSidesMapped =
          (source === "bank" ? get().bookTransactions : get().bankTransactions).length > 0;

        set({
          step: hasBothSidesMapped ? "reconciliation" : "upload",
          loading: false,
        });
      } else {
        // Auto-transition to mapping after a short delay
        setTimeout(() => {
          set({ step: "mapping", loading: false });
        }, 500);
      }

      return sessionId;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Upload failed";
      set({ error: msg, loading: false });
      throw error;
    }
  },

  extractAndPreviewData: async (file: File, sessionId: string) => {
    set({ loading: true, error: null, activeJob: null });

    try {
      const jobResponse = await apiClient.startExtractionJob(sessionId, file);

      if (!jobResponse.success) {
        throw new Error(jobResponse.error || "Extraction failed");
      }

      const queuedJob = mapProcessingJob(jobResponse.data);
      if (!queuedJob) {
        throw new Error("Failed to start extraction job");
      }

      set({
        activeJob: queuedJob,
        progress: queuedJob.progressPercent || 0,
      });

      const completedJob = await waitForProcessingJob(queuedJob.id, (job) => {
        set({
          activeJob: job,
          progress: job.progressPercent || 0,
        });
      });

      const payload = completedJob.resultPayload;
      if (!payload) {
        throw new Error("Extraction job completed without preview data");
      }

      const rawData = payload?.raw_data || [];
      const columnHeaders =
        payload?.column_headers?.length > 0
          ? payload.column_headers
          : (rawData[0] || []).map((_: any, idx: number) => `Col_${idx + 1}`);

      const hasDebit = Boolean(payload?.ai_guess_mapping?.debit);
      const hasCredit = Boolean(payload?.ai_guess_mapping?.credit);
      const amountGuess = payload?.ai_guess_mapping?.amount;

      const aiMapping: ColumnMapping = {
        date: payload?.ai_guess_mapping?.date || columnHeaders[0] || "Date",
        narration:
          payload?.ai_guess_mapping?.narration ||
          columnHeaders[1] ||
          "Narration",
        reference:
          payload?.ai_guess_mapping?.reference ||
          columnHeaders[2] ||
          "Reference",
        amount:
          amountGuess || (!hasDebit && !hasCredit ? columnHeaders[3] || "Amount" : undefined),
        debit: payload?.ai_guess_mapping?.debit,
        credit: payload?.ai_guess_mapping?.credit,
      };

      const previewRows = rawData.map((row: any[]) => {
        const rowObj: Record<string, any> = {};
        columnHeaders.forEach((header: string, idx: number) => {
          rowObj[header] = row[idx];
        });
        return rowObj;
      });

      set({ loading: false, activeJob: null, progress: 0 });
      return {
        mapping: aiMapping,
        previewRows,
        extractionMethod: payload?.extraction_method || "unknown",
        extractionConfidence: payload?.ai_confidence ?? 0,
        columnHeaders,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Extraction failed";
      set({ error: errorMsg, loading: false, activeJob: null });
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
        const transactions: Transaction[] = (txResponse.data || []).map((tx: any) =>
          mapTransaction(tx, source)
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

  loadReconciliationHistory: async () => {
    let { orgId } = get();
    if (!orgId) {
      orgId = await get().initOrg();
    }

    set({ historyLoading: true, error: null });

    try {
      const response = await apiClient.listReconciliationSessions(orgId);

      if (!response.success) {
        throw new Error(response.error || "Failed to load reconciliation history");
      }

      set({
        historySessions: (response.data || []).map(mapReconciliationSession).filter(Boolean) as ReconciliationSession[],
        historyLoading: false,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to load reconciliation history";
      set({ error: errorMsg, historyLoading: false });
      throw error;
    }
  },

  openHistorySession: async (
    session: ReconciliationSession,
    reopenClosed: boolean = false
  ) => {
    let { orgId } = get();
    if (!orgId) {
      orgId = await get().initOrg();
    }

    if (!session.bankUploadSessionId || !session.bookUploadSessionId) {
      throw new Error("This reconciliation session is missing its upload references");
    }

    set({
      loading: true,
      error: null,
      bankSessionId: session.bankUploadSessionId,
      bookSessionId: session.bookUploadSessionId,
      bankFile: null,
      bookFile: null,
      currentMappingSource: null,
    });

    try {
      if (reopenClosed && session.status === "closed") {
        const reopenResponse = await apiClient.reopenReconciliationSession(session.id);
        if (!reopenResponse.success) {
          throw new Error(reopenResponse.error || "Failed to reopen session");
        }
        set({
          reconciliationSession: mapReconciliationSession(reopenResponse.data),
        });
      }

      await get().refreshReconciliation(orgId);
      await get().loadReconciliationHistory();

      set({
        step: "reconciliation",
        loading: false,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to open reconciliation session";
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

    set({ loading: true, error: null, activeJob: null });

    try {
      const response = await apiClient.startReconciliationJob(
        resolvedOrgId,
        bankSessionId,
        bookSessionId
      );

      if (!response.success) {
        throw new Error(response.error || "Reconciliation failed");
      }

      const queuedJob = mapProcessingJob(response.data);
      if (!queuedJob) {
        throw new Error("Failed to start reconciliation job");
      }

      set({
        activeJob: queuedJob,
        progress: queuedJob.progressPercent || 0,
      });

      const completedJob = await waitForProcessingJob(queuedJob.id, (job) => {
        set({
          activeJob: job,
          progress: job.progressPercent || 0,
        });
      });

      const data = completedJob.resultPayload;
      if (!data) {
        throw new Error("Reconciliation job completed without a result");
      }

      const groups: MatchGroup[] = (data.match_groups || []).map(mapMatchGroup);

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
          ? (bankTxResponse.data || []).map((tx: any) =>
              mapTransaction(tx, "bank")
            )
          : get().bankTransactions;

      const bookTransactions: Transaction[] =
        bookTxResponse.success && Array.isArray(bookTxResponse.data)
          ? (bookTxResponse.data || []).map((tx: any) =>
              mapTransaction(tx, "book")
            )
          : get().bookTransactions;

      set({
        matchGroups: groups,
        unmatchedSuggestions,
        bankTransactions,
        bookTransactions,
        progress: data.progress_percent || 0,
        activeJob: null,
        reconciliationSession: mapReconciliationSession(
          data.reconciliation_session
        ),
        summary: mapSummary(data.summary),
        step: "reconciliation",
        loading: false,
      });
      await get().loadReconciliationHistory();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Reconciliation failed";
      set({ error: errorMsg, loading: false, activeJob: null });
      throw error;
    }
  },

  refreshReconciliation: async (orgId?: string) => {
    const { bankSessionId, bookSessionId } = get();
    const resolvedOrgId = orgId || get().orgId;

    if (!bankSessionId || !bookSessionId || !resolvedOrgId) {
      return;
    }

    const response = await apiClient.getReconciliationStatus(
      resolvedOrgId,
      bankSessionId,
      bookSessionId
    );

    if (!response.success) {
      throw new Error(response.error || "Failed to refresh reconciliation");
    }

    const bankTxResponse = await apiClient.getBankTransactions(bankSessionId);
    const bookTxResponse = await apiClient.getBookTransactions(bookSessionId);

    set({
      matchGroups: (response.data?.match_groups || []).map(mapMatchGroup),
      unmatchedSuggestions: (response.data?.unmatched_suggestions || []).map(
        (u: any) => ({
          bankTransactionId: u.bank_transaction_id,
          suggestions: (u.suggestions || []).map((s: any) => ({
            bookTransactionId: s.book_transaction_id,
            confidence: s.confidence_score,
            signals: s.match_signals,
            explanation: s.explanation,
          })),
        })
      ),
      bankTransactions:
        bankTxResponse.success && Array.isArray(bankTxResponse.data)
          ? (bankTxResponse.data || []).map((tx: any) =>
              mapTransaction(tx, "bank")
            )
          : get().bankTransactions,
      bookTransactions:
        bookTxResponse.success && Array.isArray(bookTxResponse.data)
          ? (bookTxResponse.data || []).map((tx: any) =>
              mapTransaction(tx, "book")
            )
          : get().bookTransactions,
      progress: response.data?.progress_percent || 0,
      reconciliationSession: mapReconciliationSession(
        response.data?.reconciliation_session
      ),
      summary: mapSummary(response.data?.summary),
      loading: false,
    });
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

      await get().refreshReconciliation(orgId);
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
      await get().refreshReconciliation();
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
      await get().refreshReconciliation();
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

  closeReconciliationSession: async () => {
    const currentSession = get().reconciliationSession;
    if (!currentSession?.id) {
      throw new Error("No reconciliation session to close");
    }

    set({ loading: true, error: null });

    try {
      const response = await apiClient.closeReconciliationSession(currentSession.id);

      if (!response.success) {
        throw new Error(response.error || "Failed to close reconciliation session");
      }

      set({
        reconciliationSession: mapReconciliationSession(response.data),
        loading: false,
      });
      await get().loadReconciliationHistory();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to close reconciliation session";
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
      reconciliationSession: null,
      summary: null,
      activeJob: null,
      loading: false,
      error: null,
      progress: 0,
      orgId: state.orgId,
      authStatus: state.authStatus,
      currentUser: state.currentUser,
      currentOrganization: state.currentOrganization,
    })),
}));
