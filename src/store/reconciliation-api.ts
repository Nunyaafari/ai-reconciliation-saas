import { create } from "zustand";
import { apiClient } from "@/lib/api";

// ===== TYPES =====

export type Transaction = {
  id: string;
  date: string;
  narration: string;
  reference: string;
  amount: number;
  status?: "unreconciled" | "pending" | "matched" | string;
  direction?: "debit" | "credit" | null;
  debitAmount?: number;
  creditAmount?: number;
  isRemoved?: boolean;
  removedAt?: string | null;
  isCarryforward?: boolean;
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
  accountName: string;
  accountNumber?: string | null;
  periodMonth: string;
  bankUploadSessionId?: string | null;
  bookUploadSessionId?: string | null;
  bankOpenBalance: number;
  bankClosingBalance: number;
  bookOpenBalance: number;
  bookClosingBalance: number;
  companyName?: string | null;
  companyAddress?: string | null;
  companyLogoDataUrl?: string | null;
  preparedBy?: string | null;
  reviewedBy?: string | null;
  currencyCode: string;
  status: "open" | "closed" | string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
};

export type ReconSetup = {
  accountName: string;
  accountNumber?: string | null;
  periodMonth: string;
  month: number;
  year: number;
  bankOpenBalance?: number | null;
  bookOpenBalance?: number | null;
  bankClosingBalance?: number | null;
  bookClosingBalance?: number | null;
  companyName?: string | null;
  companyAddress?: string | null;
  companyLogoDataUrl?: string | null;
  preparedBy?: string | null;
  reviewedBy?: string | null;
  currencyCode?: string | null;
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
  bankDebitSubtotal: number;
  bankCreditSubtotal: number;
  bookDebitSubtotal: number;
  bookCreditSubtotal: number;
  laneOneDifference: number;
  laneTwoDifference: number;
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
  totalRows: number;
  columnMetrics: Record<
    string,
    {
      nonEmptyCount: number;
      parsedAmountCount: number;
      parsedAmountTotal: number;
    }
  >;
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
  companyAddress?: string | null;
  companyLogoDataUrl?: string | null;
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
  status: tx.status || "unreconciled",
  direction: tx.direction || null,
  debitAmount: toNumber(tx.debit_amount),
  creditAmount: toNumber(tx.credit_amount),
  isRemoved: Boolean(tx.is_removed),
  removedAt: tx.removed_at || null,
  isCarryforward: Boolean(tx.is_carryforward),
  source,
  matched: tx.status === "matched",
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
    bankDebitSubtotal: toNumber(summary.bank_debit_subtotal),
    bankCreditSubtotal: toNumber(summary.bank_credit_subtotal),
    bookDebitSubtotal: toNumber(summary.book_debit_subtotal),
    bookCreditSubtotal: toNumber(summary.book_credit_subtotal),
    laneOneDifference: toNumber(summary.lane_one_difference),
    laneTwoDifference: toNumber(summary.lane_two_difference),
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

type AutoExactMatchCandidate = {
  bankTransactionId: string;
  bookTransactionId: string;
  confidence: number;
};

const getAutoExactMatchCandidates = (
  unmatchedSuggestions: UnmatchedSuggestion[],
  existingGroups: MatchGroup[]
): AutoExactMatchCandidate[] => {
  const matchedBankIds = new Set(
    existingGroups.flatMap((group) => group.bankTransactionIds)
  );
  const matchedBookIds = new Set(
    existingGroups.flatMap((group) => group.bookTransactionIds)
  );

  const exactCandidates = unmatchedSuggestions
    .map((entry) => {
      const exactSuggestions = entry.suggestions.filter(
        (suggestion) => suggestion.confidence >= 100
      );
      if (exactSuggestions.length !== 1) {
        return null;
      }

      const exactSuggestion = exactSuggestions[0];
      if (
        matchedBankIds.has(entry.bankTransactionId) ||
        matchedBookIds.has(exactSuggestion.bookTransactionId)
      ) {
        return null;
      }

      return {
        bankTransactionId: entry.bankTransactionId,
        bookTransactionId: exactSuggestion.bookTransactionId,
        confidence: exactSuggestion.confidence,
      };
    })
    .filter(Boolean) as AutoExactMatchCandidate[];

  const uniqueByBook = new Map<string, AutoExactMatchCandidate>();
  for (const candidate of exactCandidates) {
    const existing = uniqueByBook.get(candidate.bookTransactionId);
    if (!existing || candidate.confidence > existing.confidence) {
      uniqueByBook.set(candidate.bookTransactionId, candidate);
    }
  }

  return Array.from(uniqueByBook.values());
};

const mapReconciliationSession = (session: any): ReconciliationSession | null => {
  if (!session) return null;
  return {
    id: session.id,
    accountName: session.account_name || "Default Account",
    accountNumber: session.account_number || null,
    periodMonth: session.period_month,
    bankUploadSessionId: session.bank_upload_session_id || null,
    bookUploadSessionId: session.book_upload_session_id || null,
    bankOpenBalance: toNumber(session.bank_open_balance),
    bankClosingBalance: toNumber(session.bank_closing_balance),
    bookOpenBalance: toNumber(session.book_open_balance),
    bookClosingBalance: toNumber(session.book_closing_balance),
    companyName: session.company_name || null,
    companyAddress: session.company_address || null,
    companyLogoDataUrl: session.company_logo_data_url || null,
    preparedBy: session.prepared_by || null,
    reviewedBy: session.reviewed_by || null,
    currencyCode: session.currency_code || "GHS",
    status: session.status,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    closedAt: session.closed_at || null,
  };
};

const buildReconSetupFromSession = (
  session: ReconciliationSession,
  overrides?: Partial<ReconSetup>
): ReconSetup => ({
  accountName: session.accountName,
  accountNumber: overrides?.accountNumber ?? session.accountNumber ?? undefined,
  periodMonth: session.periodMonth,
  year: Number(session.periodMonth.split("-")[0]),
  month: Number(session.periodMonth.split("-")[1]),
  bankOpenBalance: overrides?.bankOpenBalance ?? session.bankOpenBalance,
  bookOpenBalance: overrides?.bookOpenBalance ?? session.bookOpenBalance,
  bankClosingBalance:
    overrides?.bankClosingBalance ?? session.bankClosingBalance,
  bookClosingBalance:
    overrides?.bookClosingBalance ?? session.bookClosingBalance,
  companyName: overrides?.companyName ?? session.companyName ?? undefined,
  companyAddress:
    overrides?.companyAddress ?? session.companyAddress ?? undefined,
  companyLogoDataUrl:
    overrides?.companyLogoDataUrl ?? session.companyLogoDataUrl ?? undefined,
  preparedBy: overrides?.preparedBy ?? session.preparedBy ?? undefined,
  reviewedBy: overrides?.reviewedBy ?? session.reviewedBy ?? undefined,
  currencyCode: overrides?.currencyCode ?? session.currencyCode ?? "GHS",
});

const buildReconSetupForSession = (
  session: ReconciliationSession,
  overrides?: Partial<ReconSetup>
): ReconSetup => {
  const setup = buildReconSetupFromSession(session, overrides);

  if (!session.bankUploadSessionId && !session.bookUploadSessionId) {
    setup.bankClosingBalance = null;
    setup.bookClosingBalance = null;
  }

  return setup;
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
    companyAddress: organization.company_address || null,
    companyLogoDataUrl: organization.company_logo_data_url || null,
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

// ===== STORE =====

export type ReconciliationStore = {
  // State
  step: "setup" | "upload" | "mapping" | "prepare" | "reconciliation" | "workspace" | "history" | "settings" | "ops" | "complete";
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
  reconSetup: ReconSetup | null;
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
  setReconSetup: (setup: ReconSetup | null) => void;
  setCurrentOrganization: (organization: AuthOrganization | null) => void;
  setError: (error: string | null) => void;
  setProgress: (progress: number) => void;
  beginNewRecon: (setup: ReconSetup) => void;

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
    sessionId: string
  ) => Promise<ExtractionResult>;
  confirmMappingAndStandardize: (
    sessionId: string,
    mapping: ColumnMapping,
    source: "bank" | "book"
  ) => Promise<void>;
  loadReconciliationHistory: () => Promise<void>;
  openHistorySession: (
    session: ReconciliationSession,
    reopenClosed?: boolean
  ) => Promise<void>;
  prepareReconciliationContext: (orgId?: string) => Promise<void>;
  startReconciliation: (orgId?: string) => Promise<void>;
  refreshReconciliation: (orgId?: string) => Promise<void>;
  createMatch: (
    bankTransactionIds: string[],
    bookTransactionIds: string[],
    confidenceScore: number
  ) => Promise<void>;
  approveMatch: (groupId: string) => Promise<void>;
  rejectMatch: (groupId: string) => Promise<void>;
  approveMatchesBulk: (
    groupIds: string[]
  ) => Promise<{ approved: string[]; failed: string[] }>;
  rejectMatchesBulk: (groupIds: string[]) => Promise<void>;
  closeReconciliationSession: () => Promise<void>;
  saveReconciliationSession: () => Promise<void>;
  resetReconciliationSession: (sessionId: string) => Promise<void>;
  updateOpeningBalances: (payload: {
    bankOpenBalance: number;
    bookOpenBalance: number;
    bankClosingBalance: number;
    bookClosingBalance: number;
    accountNumber?: string | null;
    companyName?: string | null;
    companyAddress?: string | null;
    companyLogoDataUrl?: string | null;
    preparedBy?: string | null;
    reviewedBy?: string | null;
    currencyCode?: string | null;
  }) => Promise<void>;
  updateTransactionRemovalState: (payload: {
    bankTransactionIds?: string[];
    bookTransactionIds?: string[];
    removed: boolean;
  }) => Promise<void>;
  createManualEntry: (payload: {
    bucket: "bank_debit" | "bank_credit" | "book_debit" | "book_credit";
    transDate: string;
    narration: string;
    reference?: string | null;
    amount: number;
  }) => Promise<void>;
  logActivity: (entry: ActivityLogEntry) => void;

  // Utility
  addMatchGroup: (group: MatchGroup) => void;
  reset: () => void;
};

export const useReconciliationStore = create<ReconciliationStore>((set, get) => ({
  // Initial State
  step: "workspace",
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
  reconSetup: null,
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
  setReconSetup: (setup) => set({ reconSetup: setup }),
  setCurrentOrganization: (organization) => set({ currentOrganization: organization }),
  setError: (error) => set({ error }),
  setProgress: (progress) => set({ progress }),
  beginNewRecon: (setup) =>
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
      reconSetup: setup,
      reconciliationSession: null,
      summary: null,
      activeJob: null,
      loading: false,
      error: null,
      progress: 0,
      historySessions: state.historySessions,
      orgId: state.orgId,
      authStatus: state.authStatus,
      currentUser: state.currentUser,
      currentOrganization: state.currentOrganization,
    })),
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
        step: "workspace",
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
        step: "workspace",
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
      step: "setup",
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
      reconSetup: null,
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
    let { orgId, reconSetup } = get();
    if (!orgId) {
      orgId = await get().initOrg();
    }
    if (!reconSetup?.accountName || !reconSetup?.periodMonth) {
      const msg = "Set up the account and recon month before uploading files.";
      set({ error: msg, loading: false, step: "setup" });
      throw new Error(msg);
    }

    set({
      loading: true,
      error: null,
      currentMappingSource: source,
      matchGroups: [],
      unmatchedSuggestions: [],
      progress: 0,
    });

    try {
      const response = await apiClient.createUploadSession(
        orgId,
        file,
        source,
        {
          accountName: reconSetup.accountName,
          periodMonth: reconSetup.periodMonth,
        }
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
      const shouldForceMappingPreview = true;
      const shouldOpenMapping = shouldForceMappingPreview || !reusedCompletedSession;

      if (source === "bank") {
        set({
          bankSessionId: sessionId,
          bankFile: file,
          uploadedFileName: file.name,
          currentMappingSource: shouldOpenMapping ? "bank" : null,
          bankTransactions: shouldOpenMapping ? [] : get().bankTransactions,
        });
      } else {
        set({
          bookSessionId: sessionId,
          bookFile: file,
          uploadedFileName: file.name,
          currentMappingSource: shouldOpenMapping ? "book" : null,
          bookTransactions: shouldOpenMapping ? [] : get().bookTransactions,
        });
      }

      if (reusedCompletedSession && !shouldForceMappingPreview) {
        const txResponse = await apiClient.getBookTransactions(sessionId);

        if (txResponse.success && Array.isArray(txResponse.data)) {
          const transactions: Transaction[] = (txResponse.data || []).map((tx: any) =>
            mapTransaction(tx, "book")
          );

          set({ bookTransactions: transactions });
        }

        const hasBothSidesMapped = get().bankTransactions.length > 0;

        if (hasBothSidesMapped) {
          await get().prepareReconciliationContext(orgId);
        } else {
          set({
            step: "upload",
            loading: false,
          });
        }
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

  extractAndPreviewData: async (sessionId: string) => {
    set({ loading: true, error: null, activeJob: null });

    try {
      const sessionResponse = await apiClient.getUploadSession(sessionId);
      if (!sessionResponse.success || !sessionResponse.data?.file_type) {
        throw new Error(sessionResponse.error || "Failed to load upload session");
      }

      const fileType = String(sessionResponse.data.file_type).toLowerCase();
      let payload: any;

      if (fileType === "pdf") {
        const jobResponse = await apiClient.startExtractionJob(sessionId);

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

        payload = completedJob.resultPayload;
        if (!payload) {
          throw new Error("Extraction job completed without preview data");
        }
      } else {
        const response = await apiClient.extractData(sessionId);
        if (!response.success) {
          throw new Error(response.error || "Extraction failed");
        }
        payload = response.data;
      }

      const rawData = payload?.raw_data || [];
      const columnHeaders =
        payload?.column_headers?.length > 0
          ? payload.column_headers
          : (rawData[0] || []).map((_: any, idx: number) => `Col_${idx + 1}`);

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
        amount: "__none__",
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

      const columnMetrics = Object.fromEntries(
        Object.entries(payload?.column_metrics || {}).map(([header, value]: [string, any]) => [
          header,
          {
            nonEmptyCount: Number(value?.non_empty_count || 0),
            parsedAmountCount: Number(value?.parsed_amount_count || 0),
            parsedAmountTotal: toNumber(value?.parsed_amount_total),
          },
        ])
      );

      set({ loading: false, activeJob: null, progress: 0 });
      return {
        mapping: aiMapping,
        previewRows,
        extractionMethod: payload?.extraction_method || "unknown",
        extractionConfidence: payload?.ai_confidence ?? 0,
        columnHeaders,
        totalRows: Number(payload?.total_rows || rawData.length || 0),
        columnMetrics,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Extraction failed";
      set({ error: errorMsg, loading: false, activeJob: null });
      throw error;
    }
  },

  confirmMappingAndStandardize: async (
    sessionId: string,
    mapping: ColumnMapping,
    source: "bank" | "book"
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

    set({
      loading: true,
      error: null,
      bankSessionId: session.bankUploadSessionId || null,
      bookSessionId: session.bookUploadSessionId || null,
      bankFile: null,
      bookFile: null,
      currentMappingSource: null,
      reconSetup: buildReconSetupForSession(session),
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

      const worksheetSessionId =
        useReconciliationStore.getState().reconciliationSession?.id || session.id;
      const worksheetResponse = await apiClient.getReconciliationWorksheet(
        worksheetSessionId
      );

      if (!worksheetResponse.success) {
        throw new Error(
          worksheetResponse.error || "Failed to open reconciliation worksheet"
        );
      }

      const worksheetSession = mapReconciliationSession(
        worksheetResponse.data?.reconciliation_session
      );

      set({
        matchGroups: (worksheetResponse.data?.match_groups || []).map(mapMatchGroup),
        unmatchedSuggestions: mapUnmatchedSuggestions(
          worksheetResponse.data?.unmatched_suggestions || []
        ),
        bankTransactions: Array.isArray(worksheetResponse.data?.bank_transactions)
          ? (worksheetResponse.data?.bank_transactions || []).map((tx: any) =>
              mapTransaction(tx, "bank")
            )
          : [],
        bookTransactions: Array.isArray(worksheetResponse.data?.book_transactions)
          ? (worksheetResponse.data?.book_transactions || []).map((tx: any) =>
              mapTransaction(tx, "book")
            )
          : [],
        progress: worksheetResponse.data?.progress_percent || 0,
        reconciliationSession: worksheetSession,
        bankSessionId: worksheetSession?.bankUploadSessionId || null,
        bookSessionId: worksheetSession?.bookUploadSessionId || null,
        summary: mapSummary(worksheetResponse.data?.summary),
      });
      await get().loadReconciliationHistory();

      set({
        step:
          worksheetSession?.bankUploadSessionId || worksheetSession?.bookUploadSessionId
            ? "reconciliation"
            : "prepare",
        loading: false,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to open reconciliation session";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  prepareReconciliationContext: async (orgId?: string) => {
    const { bankSessionId, bookSessionId, reconSetup } = get();
    const resolvedOrgId = orgId || get().orgId;

    if (!bankSessionId || !bookSessionId || !resolvedOrgId) {
      return;
    }

    set({ loading: true, error: null });

    const response = await apiClient.prepareReconciliationContext(
      resolvedOrgId,
      bankSessionId,
      bookSessionId
    );

    if (!response.success) {
      const errorMsg = response.error || "Failed to prepare reconciliation worksheet";
      set({ error: errorMsg, loading: false });
      throw new Error(errorMsg);
    }

    let preparedSession = mapReconciliationSession(
      response.data?.reconciliation_session
    );
    let preparedSummary = mapSummary(response.data?.summary);

    const requestedBankOpenBalance =
      reconSetup?.bankOpenBalance ?? undefined;
    const requestedBookOpenBalance =
      reconSetup?.bookOpenBalance ?? undefined;
    const requestedBankClosingBalance =
      reconSetup?.bankClosingBalance ?? undefined;
    const requestedBookClosingBalance =
      reconSetup?.bookClosingBalance ?? undefined;
    const requestedAccountNumber = reconSetup?.accountNumber ?? undefined;
    const requestedCompanyName = reconSetup?.companyName ?? undefined;
    const requestedCompanyAddress = reconSetup?.companyAddress ?? undefined;
    const requestedCompanyLogoDataUrl =
      reconSetup?.companyLogoDataUrl ?? undefined;
    const requestedPreparedBy = reconSetup?.preparedBy ?? undefined;
    const requestedReviewedBy = reconSetup?.reviewedBy ?? undefined;
    const requestedCurrencyCode = reconSetup?.currencyCode ?? undefined;

    if (
      preparedSession &&
      (requestedBankOpenBalance !== undefined ||
        requestedBookOpenBalance !== undefined ||
        requestedBankClosingBalance !== undefined ||
        requestedBookClosingBalance !== undefined ||
        requestedAccountNumber !== undefined ||
        requestedCompanyName !== undefined ||
        requestedCompanyAddress !== undefined ||
        requestedCompanyLogoDataUrl !== undefined ||
        requestedPreparedBy !== undefined ||
        requestedReviewedBy !== undefined ||
        requestedCurrencyCode !== undefined)
    ) {
      const balanceResponse = await apiClient.updateReconciliationSessionBalances(
        preparedSession.id,
        {
          bank_open_balance:
            requestedBankOpenBalance ?? preparedSession.bankOpenBalance,
          book_open_balance:
            requestedBookOpenBalance ?? preparedSession.bookOpenBalance,
          bank_closing_balance:
            requestedBankClosingBalance !== undefined
              ? requestedBankClosingBalance
              : preparedSession.bankClosingBalance,
          book_closing_balance:
            requestedBookClosingBalance !== undefined
              ? requestedBookClosingBalance
              : preparedSession.bookClosingBalance,
          account_number:
            requestedAccountNumber ?? preparedSession.accountNumber ?? "",
          company_name:
            requestedCompanyName ?? preparedSession.companyName ?? "",
          company_address:
            requestedCompanyAddress ?? preparedSession.companyAddress ?? "",
          company_logo_data_url:
            requestedCompanyLogoDataUrl ??
            preparedSession.companyLogoDataUrl ??
            "",
          prepared_by: requestedPreparedBy ?? preparedSession.preparedBy ?? "",
          reviewed_by: requestedReviewedBy ?? preparedSession.reviewedBy ?? "",
          currency_code:
            requestedCurrencyCode ?? preparedSession.currencyCode ?? "GHS",
        }
      );

      if (!balanceResponse.success) {
        const errorMsg =
          balanceResponse.error || "Failed to apply opening balances";
        set({ error: errorMsg, loading: false });
        throw new Error(errorMsg);
      }

      preparedSession = mapReconciliationSession(balanceResponse.data);

      if (!preparedSession) {
        const errorMsg = "Failed to refresh reconciliation session";
        set({ error: errorMsg, loading: false });
        throw new Error(errorMsg);
      }

      const refreshedStatus = await apiClient.getReconciliationWorksheet(
        preparedSession.id
      );

      if (refreshedStatus.success) {
        preparedSession = mapReconciliationSession(
          refreshedStatus.data?.reconciliation_session
        );
        preparedSummary = mapSummary(refreshedStatus.data?.summary);
      }
    }

    set({
      matchGroups: (response.data?.match_groups || []).map(mapMatchGroup),
      unmatchedSuggestions: mapUnmatchedSuggestions(
        response.data?.unmatched_suggestions || []
      ),
      bankTransactions: Array.isArray(response.data?.bank_transactions)
        ? (response.data?.bank_transactions || []).map((tx: any) =>
            mapTransaction(tx, "bank")
          )
        : get().bankTransactions,
      bookTransactions: Array.isArray(response.data?.book_transactions)
        ? (response.data?.book_transactions || []).map((tx: any) =>
            mapTransaction(tx, "book")
          )
        : get().bookTransactions,
      progress: response.data?.progress_percent || 0,
      reconciliationSession: preparedSession,
      reconSetup: preparedSession
        ? buildReconSetupForSession(preparedSession, {
            bankOpenBalance:
              requestedBankOpenBalance ?? preparedSession.bankOpenBalance,
            bookOpenBalance:
              requestedBookOpenBalance ?? preparedSession.bookOpenBalance,
            bankClosingBalance:
              requestedBankClosingBalance !== undefined
                ? requestedBankClosingBalance
                : preparedSession.bankClosingBalance,
            bookClosingBalance:
              requestedBookClosingBalance !== undefined
                ? requestedBookClosingBalance
                : preparedSession.bookClosingBalance,
            accountNumber:
              requestedAccountNumber ?? preparedSession.accountNumber ?? undefined,
            companyName:
              requestedCompanyName ?? preparedSession.companyName ?? undefined,
            companyAddress:
              requestedCompanyAddress ??
              preparedSession.companyAddress ??
              undefined,
            companyLogoDataUrl:
              requestedCompanyLogoDataUrl ??
              preparedSession.companyLogoDataUrl ??
              undefined,
            preparedBy:
              requestedPreparedBy ?? preparedSession.preparedBy ?? undefined,
            reviewedBy:
              requestedReviewedBy ?? preparedSession.reviewedBy ?? undefined,
            currencyCode:
              requestedCurrencyCode ?? preparedSession.currencyCode ?? "GHS",
          })
        : get().reconSetup,
      summary: preparedSummary,
      loading: false,
      step: "prepare",
    });
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

    set({ loading: true, error: null, activeJob: null, progress: 0 });

    try {
      // Use the synchronous reconciliation route here so the UI moves directly
      // from "Reconciling..." into highlighted in-quadrant matches without
      // depending on a background worker poll loop.
      const response = await apiClient.startReconciliation(
        resolvedOrgId,
        bankSessionId,
        bookSessionId
      );

      if (!response.success) {
        throw new Error(response.error || "Reconciliation failed");
      }

      let reconciliationPayload = response.data;
      let groups: MatchGroup[] = (reconciliationPayload.match_groups || []).map(
        mapMatchGroup
      );

      let unmatchedSuggestions: UnmatchedSuggestion[] = (
        reconciliationPayload.unmatched_suggestions || []
      ).map((u: any) => ({
        bankTransactionId: u.bank_transaction_id,
        suggestions: (u.suggestions || []).map((s: any) => ({
          bookTransactionId: s.book_transaction_id,
          confidence: s.confidence_score,
          signals: s.match_signals,
          explanation: s.explanation,
        })),
      }));

      const autoExactMatches = getAutoExactMatchCandidates(
        unmatchedSuggestions,
        groups
      );

      if (autoExactMatches.length > 0) {
        for (const candidate of autoExactMatches) {
          const result = await apiClient.createMatch(
            resolvedOrgId,
            [candidate.bankTransactionId],
            [candidate.bookTransactionId],
            candidate.confidence
          );
          if (!result.success) {
            throw new Error(
              result.error || "Failed to stage exact-match suggestions"
            );
          }
        }

        const sessionId = reconciliationPayload?.reconciliation_session?.id;
        const refreshedStatusResponse = sessionId
          ? await apiClient.getReconciliationWorksheet(sessionId)
          : await apiClient.getReconciliationStatus(
              resolvedOrgId,
              bankSessionId,
              bookSessionId
            );

        if (!refreshedStatusResponse.success) {
          throw new Error(
            refreshedStatusResponse.error ||
              "Failed to refresh reconciliation after staging exact matches"
          );
        }

        reconciliationPayload = refreshedStatusResponse.data;
        groups = (reconciliationPayload?.match_groups || []).map(mapMatchGroup);
        unmatchedSuggestions = mapUnmatchedSuggestions(
          reconciliationPayload?.unmatched_suggestions || []
        );
      }

      const bankTransactions: Transaction[] = Array.isArray(
        reconciliationPayload?.bank_transactions
      )
        ? (reconciliationPayload.bank_transactions || []).map((tx: any) =>
            mapTransaction(tx, "bank")
          )
        : get().bankTransactions;

      const bookTransactions: Transaction[] = Array.isArray(
        reconciliationPayload?.book_transactions
      )
        ? (reconciliationPayload.book_transactions || []).map((tx: any) =>
            mapTransaction(tx, "book")
          )
        : get().bookTransactions;

      set({
        matchGroups: groups,
        unmatchedSuggestions,
        bankTransactions,
        bookTransactions,
        progress:
          typeof reconciliationPayload?.progress_percent === "number"
            ? reconciliationPayload.progress_percent
            : 100,
        activeJob: null,
        reconciliationSession: mapReconciliationSession(
          reconciliationPayload.reconciliation_session
        ),
        summary: mapSummary(reconciliationPayload.summary),
        step: "reconciliation",
        loading: false,
      });
      const nextSession = mapReconciliationSession(
        reconciliationPayload.reconciliation_session
      );
      if (nextSession) {
        set({
          reconSetup: buildReconSetupForSession(nextSession),
        });
      }
      await get().loadReconciliationHistory();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Reconciliation failed";
      set({ error: errorMsg, loading: false, activeJob: null, progress: 0 });
      throw error;
    }
  },

  refreshReconciliation: async (orgId?: string) => {
    const { bankSessionId, bookSessionId, reconciliationSession } = get();
    const resolvedOrgId = orgId || get().orgId;

    if (!resolvedOrgId) {
      return;
    }

    let response;
    if (reconciliationSession?.id) {
      response = await apiClient.getReconciliationWorksheet(
        reconciliationSession.id
      );
    } else {
      if (!bankSessionId || !bookSessionId) {
        return;
      }
      response = await apiClient.getReconciliationStatus(
        resolvedOrgId,
        bankSessionId,
        bookSessionId
      );
    }

    if (!response.success) {
      throw new Error(response.error || "Failed to refresh reconciliation");
    }

    const refreshedSession = mapReconciliationSession(
      response.data?.reconciliation_session
    );

    set({
      matchGroups: (response.data?.match_groups || []).map(mapMatchGroup),
      unmatchedSuggestions: mapUnmatchedSuggestions(
        response.data?.unmatched_suggestions || []
      ),
      bankTransactions: Array.isArray(response.data?.bank_transactions)
        ? (response.data?.bank_transactions || []).map((tx: any) =>
            mapTransaction(tx, "bank")
          )
        : get().bankTransactions,
      bookTransactions: Array.isArray(response.data?.book_transactions)
        ? (response.data?.book_transactions || []).map((tx: any) =>
            mapTransaction(tx, "book")
          )
        : get().bookTransactions,
      progress: response.data?.progress_percent || 0,
      reconciliationSession: refreshedSession,
      bankSessionId: refreshedSession?.bankUploadSessionId || null,
      bookSessionId: refreshedSession?.bookUploadSessionId || null,
      reconSetup: refreshedSession
        ? buildReconSetupForSession(refreshedSession)
        : get().reconSetup,
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
    if (groupIds.length === 0) {
      return { approved: [], failed: [] };
    }

    set({ loading: true, error: null });

    try {
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const invalidIds = groupIds.filter((id) => !uuidPattern.test(id));
      const validIds = groupIds.filter((id) => uuidPattern.test(id));

      if (validIds.length === 0) {
        set({ loading: false });
        return { approved: [], failed: invalidIds };
      }

      const response = await apiClient.approveMatchesBulk(validIds);
      if (!response.success) {
        throw new Error(response.error || "Bulk approval failed");
      }

      const approvedIds = (response.data?.approved_ids || []).map(String);
      const failedIds = [
        ...(response.data?.failed_ids || []).map(String),
        ...invalidIds,
      ];

      set((state) => ({
        matchGroups: state.matchGroups.map((group) =>
          approvedIds.includes(group.id)
            ? { ...group, status: "approved" }
            : group
        ),
        loading: false,
      }));

      await get().refreshReconciliation();
      return { approved: approvedIds, failed: failedIds };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Bulk approval failed";
      set({ error: errorMsg, loading: false });
      throw error;
    }
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

      const closedSession = mapReconciliationSession(response.data?.closed_session);
      const nextSession = mapReconciliationSession(response.data?.next_session);

      if (nextSession?.id) {
        const worksheetResponse = await apiClient.getReconciliationWorksheet(
          nextSession.id
        );

        if (!worksheetResponse.success) {
          throw new Error(
            worksheetResponse.error || "Failed to open next month carryforward worksheet"
          );
        }

        const worksheetSession = mapReconciliationSession(
          worksheetResponse.data?.reconciliation_session
        );

        set({
          reconciliationSession: worksheetSession,
          bankSessionId: worksheetSession?.bankUploadSessionId || null,
          bookSessionId: worksheetSession?.bookUploadSessionId || null,
          bankTransactions: Array.isArray(worksheetResponse.data?.bank_transactions)
            ? (worksheetResponse.data?.bank_transactions || []).map((tx: any) =>
                mapTransaction(tx, "bank")
              )
            : [],
          bookTransactions: Array.isArray(worksheetResponse.data?.book_transactions)
            ? (worksheetResponse.data?.book_transactions || []).map((tx: any) =>
                mapTransaction(tx, "book")
              )
            : [],
          matchGroups: (worksheetResponse.data?.match_groups || []).map(mapMatchGroup),
          unmatchedSuggestions: mapUnmatchedSuggestions(
            worksheetResponse.data?.unmatched_suggestions || []
          ),
          summary: mapSummary(worksheetResponse.data?.summary),
          reconSetup: worksheetSession
            ? buildReconSetupForSession(worksheetSession)
            : get().reconSetup,
          step: "prepare",
          loading: false,
        });
      } else {
        set({
          reconciliationSession: closedSession,
          loading: false,
        });
      }
      await get().loadReconciliationHistory();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to close reconciliation session";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  saveReconciliationSession: async () => {
    const currentSession = get().reconciliationSession;
    if (!currentSession?.id) {
      throw new Error("No reconciliation session to save");
    }

    set({ loading: true, error: null });

    try {
      const response = await apiClient.saveReconciliationSession(currentSession.id);
      if (!response.success) {
        throw new Error(response.error || "Failed to save reconciliation session");
      }

      const savedSession = mapReconciliationSession(response.data);
      set({
        reconciliationSession: savedSession,
        reconSetup: savedSession
          ? buildReconSetupForSession(savedSession)
          : get().reconSetup,
        loading: false,
      });
      await get().loadReconciliationHistory();
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to save reconciliation session";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  resetReconciliationSession: async (sessionId: string) => {
    set({ loading: true, error: null });

    try {
      const response = await apiClient.resetReconciliationSession(sessionId);
      if (!response.success) {
        throw new Error(response.error || "Failed to reset reconciliation session");
      }

      const resetSession = mapReconciliationSession(response.data);

      set((state) => ({
        reconciliationSession:
          state.reconciliationSession?.id === sessionId ? resetSession : state.reconciliationSession,
        reconSetup:
          resetSession && state.reconciliationSession?.id === sessionId
            ? buildReconSetupForSession(resetSession)
            : state.reconSetup,
        bankTransactions:
          state.reconciliationSession?.id === sessionId ? [] : state.bankTransactions,
        bookTransactions:
          state.reconciliationSession?.id === sessionId ? [] : state.bookTransactions,
        matchGroups:
          state.reconciliationSession?.id === sessionId ? [] : state.matchGroups,
        unmatchedSuggestions:
          state.reconciliationSession?.id === sessionId ? [] : state.unmatchedSuggestions,
        loading: false,
      }));

      await get().loadReconciliationHistory();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to reset reconciliation session";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  updateOpeningBalances: async ({
    bankOpenBalance,
    bookOpenBalance,
    bankClosingBalance,
    bookClosingBalance,
    accountNumber,
    companyName,
    companyAddress,
    companyLogoDataUrl,
    preparedBy,
    reviewedBy,
    currencyCode,
  }) => {
    const currentSession = get().reconciliationSession;
    if (!currentSession?.id) {
      throw new Error("No reconciliation session to update");
    }

    set({ loading: true, error: null });

    try {
      const response = await apiClient.updateReconciliationSessionBalances(
        currentSession.id,
        {
          bank_open_balance: bankOpenBalance,
          book_open_balance: bookOpenBalance,
          bank_closing_balance: bankClosingBalance,
          book_closing_balance: bookClosingBalance,
          account_number: accountNumber,
          company_name: companyName,
          company_address: companyAddress,
          company_logo_data_url: companyLogoDataUrl,
          prepared_by: preparedBy,
          reviewed_by: reviewedBy,
          currency_code: currencyCode,
        }
      );

      if (!response.success) {
        throw new Error(response.error || "Failed to update opening balances");
      }

      set({
        reconciliationSession: mapReconciliationSession(response.data),
        loading: false,
      });
      await get().refreshReconciliation();
      await get().loadReconciliationHistory();
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to update opening balances";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  updateTransactionRemovalState: async ({
    bankTransactionIds = [],
    bookTransactionIds = [],
    removed,
  }) => {
    if (bankTransactionIds.length === 0 && bookTransactionIds.length === 0) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const response = await apiClient.updateTransactionRemovalState({
        bank_transaction_ids: bankTransactionIds,
        book_transaction_ids: bookTransactionIds,
        removed,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to update transaction removal state");
      }

      await get().refreshReconciliation();
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to update transaction removal state";
      set({ error: errorMsg, loading: false });
      throw error;
    }
  },

  createManualEntry: async ({
    bucket,
    transDate,
    narration,
    reference,
    amount,
  }) => {
    const { orgId, reconciliationSession } = get();
    if (!orgId || !reconciliationSession?.id) {
      throw new Error("Reconciliation session is not available.");
    }

    set({ loading: true, error: null });

    try {
      const response = await apiClient.createManualEntry(orgId, reconciliationSession.id, {
        bucket,
        trans_date: transDate,
        narration,
        reference: reference || null,
        amount,
      });

      if (!response.success) {
        throw new Error(response.error || "Failed to add manual entry");
      }

      set({
        matchGroups: (response.data?.match_groups || []).map(mapMatchGroup),
        unmatchedSuggestions: mapUnmatchedSuggestions(
          response.data?.unmatched_suggestions || []
        ),
        bankTransactions: Array.isArray(response.data?.bank_transactions)
          ? (response.data?.bank_transactions || []).map((tx: any) =>
              mapTransaction(tx, "bank")
            )
          : get().bankTransactions,
        bookTransactions: Array.isArray(response.data?.book_transactions)
          ? (response.data?.book_transactions || []).map((tx: any) =>
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
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to add manual entry";
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
      step: state.reconSetup ? "upload" : "setup",
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
      reconSetup: state.reconSetup,
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
