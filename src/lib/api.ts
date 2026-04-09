// API configuration and client

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const AUTH_TOKEN_KEY = "reconciliation_auth_token";

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  status: number;
}

export interface ApiError {
  error: string;
  detail?: string;
  error_code?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  getStoredToken(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
  }

  setStoredToken(token: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  clearStoredToken() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  private buildAuthHeaders(
    headers: HeadersInit = {}
  ): HeadersInit {
    const token = this.getStoredToken();
    if (!token) return headers;
    return {
      ...headers,
      Authorization: `Bearer ${token}`,
    };
  }

  private extractErrorMessage(data: any, status: number): string {
    if (!data) return `HTTP ${status}`;
    return (
      data.error ||
      data.detail ||
      data.message ||
      `HTTP ${status}`
    );
  }

  private async readResponseBody(response: Response): Promise<any> {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        detail: text,
      };
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const { headers, ...restOptions } = options;
      const response = await fetch(url, {
        ...restOptions,
        headers: {
          "Content-Type": "application/json",
          ...this.buildAuthHeaders(headers || {}),
        },
      });

      const data = await this.readResponseBody(response);

      if (!response.ok) {
        return {
          success: false,
          error: this.extractErrorMessage(data, response.status),
          status: response.status,
        };
      }

      return {
        success: true,
        data,
        status: response.status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message,
        status: 0,
      };
    }
  }

  // ===== Upload Routes =====

  async createUploadSession(
    orgId: string,
    file: File,
    source: "bank" | "book",
    reconSetup?: {
      accountName: string;
      periodMonth: string;
    }
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("file", file);
    const params = new URLSearchParams({ source });
    if (reconSetup?.accountName) {
      params.set("account_name", reconSetup.accountName);
    }
    if (reconSetup?.periodMonth) {
      params.set("period_month", reconSetup.periodMonth);
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/api/uploads/create-session/${orgId}?${params.toString()}`,
        {
          method: "POST",
          headers: this.buildAuthHeaders(),
          body: formData,
        }
      );

      const data = await this.readResponseBody(response);

      if (!response.ok) {
        return {
          success: false,
          error: this.extractErrorMessage(data, response.status),
          status: response.status,
        };
      }

      return {
        success: true,
        data,
        status: response.status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message,
        status: 0,
      };
    }
  }

  async extractData(sessionId: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/uploads/extract/${sessionId}`,
        {
          method: "POST",
          headers: this.buildAuthHeaders(),
        }
      );

      const data = await this.readResponseBody(response);

      if (!response.ok) {
        return {
          success: false,
          error: this.extractErrorMessage(data, response.status),
          status: response.status,
        };
      }

      return {
        success: true,
        data,
        status: response.status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message,
        status: 0,
      };
    }
  }

  async startExtractionJob(sessionId: string): Promise<ApiResponse<any>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/uploads/extract-async/${sessionId}`,
        {
          method: "POST",
          headers: this.buildAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: this.extractErrorMessage(data, response.status),
          status: response.status,
        };
      }

      return {
        success: true,
        data,
        status: response.status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message,
        status: 0,
      };
    }
  }

  async confirmMapping(
    sessionId: string,
    columnMapping: {
      date: string;
      narration: string;
      reference: string;
      amount?: string;
      debit?: string;
      credit?: string;
    },
    saveAsFingerprint: boolean = true
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("column_mapping", JSON.stringify(columnMapping));
    formData.append("save_as_fingerprint", String(saveAsFingerprint));

    try {
      const response = await fetch(
        `${this.baseUrl}/api/uploads/confirm-mapping/${sessionId}`,
        {
          method: "POST",
          headers: this.buildAuthHeaders(),
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: this.extractErrorMessage(data, response.status),
          status: response.status,
        };
      }

      return {
        success: true,
        data,
        status: response.status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message,
        status: 0,
      };
    }
  }

  async getUploadSession(sessionId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/uploads/session/${sessionId}`);
  }

  async extractDraft(sessionId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/uploads/extract-draft/${sessionId}`, {
      method: "POST",
    });
  }

  async getDraftBySession(sessionId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/uploads/draft/by-session/${sessionId}`);
  }

  async updateDraftMapping(
    draftId: string,
    mapping: {
      date: string;
      narration: string;
      reference: string;
      amount?: string;
      debit?: string;
      credit?: string;
    }
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/uploads/draft/${draftId}/mapping`, {
      method: "PATCH",
      body: JSON.stringify({ mapping }),
    });
  }

  async updateDraftRegion(
    draftId: string,
    payload: {
      header_row_index?: number | null;
      table_start_row_index?: number | null;
      table_end_row_index?: number | null;
    }
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/uploads/draft/${draftId}/region`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async updateDraftRows(
    draftId: string,
    edits: Array<{
      row_index: number;
      cells?: any[];
      row_type?: string;
      is_repeated_header?: boolean;
      is_within_selected_region?: boolean;
    }>
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/uploads/draft/${draftId}/rows`, {
      method: "PATCH",
      body: JSON.stringify({ edits }),
    });
  }

  async getDraftValidation(draftId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/uploads/draft/${draftId}/validation`);
  }

  async finalizeDraft(draftId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/uploads/draft/${draftId}/finalize`, {
      method: "POST",
    });
  }

  async getBankTransactions(sessionId: string): Promise<ApiResponse<any[] | null>> {
    return this.request(`/api/uploads/transactions/${sessionId}/bank`);
  }

  async getBookTransactions(sessionId: string): Promise<ApiResponse<any[] | null>> {
    return this.request(`/api/uploads/transactions/${sessionId}/book`);
  }

  // ===== Reconciliation Routes =====

  async startReconciliation(
    orgId: string,
    bankSessionId: string,
    bookSessionId: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/start/${orgId}`, {
      method: "POST",
      body: JSON.stringify({
        bank_upload_session_id: bankSessionId,
        book_upload_session_id: bookSessionId,
      }),
    });
  }

  async startReconciliationJob(
    orgId: string,
    bankSessionId: string,
    bookSessionId: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/start-async/${orgId}`, {
      method: "POST",
      body: JSON.stringify({
        bank_upload_session_id: bankSessionId,
        book_upload_session_id: bookSessionId,
      }),
    });
  }

  async createMatch(
    orgId: string,
    bankTransactionIds: string[],
    bookTransactionIds: string[],
    confidenceScore: number
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/match/manual/${orgId}`, {
      method: "POST",
      body: JSON.stringify({
        bank_transaction_ids: bankTransactionIds,
        book_transaction_ids: bookTransactionIds,
        confidence_score: confidenceScore,
      }),
    });
  }

  async createManualEntry(
    orgId: string,
    sessionId: string,
    payload: {
      bucket: "bank_debit" | "bank_credit" | "book_debit" | "book_credit";
      trans_date: string;
      narration: string;
      reference?: string | null;
      amount: number;
    }
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/manual-entry/${orgId}/${sessionId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async approveMatch(matchId: string, notes?: string): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/match/${matchId}/approve`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
  }

  async approveMatchesBulk(
    matchIds: string[],
    notes?: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/match/bulk-approve`, {
      method: "POST",
      body: JSON.stringify({
        matchIds: matchIds,
        notes,
      }),
    });
  }

  async rejectMatch(matchId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/match/${matchId}`, {
      method: "DELETE",
    });
  }

  async resetReconciliationSession(
    sessionId: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/session/${sessionId}/reset`, {
      method: "POST",
    });
  }

  async getReconciliationStatus(
    orgId: string,
    bankSessionId: string,
    bookSessionId: string
  ): Promise<ApiResponse<any>> {
    return this.request(
      `/api/reconciliation/status/${orgId}/${bankSessionId}/${bookSessionId}`
    );
  }

  async prepareReconciliationContext(
    orgId: string,
    bankSessionId: string,
    bookSessionId: string
  ): Promise<ApiResponse<any>> {
    return this.request(
      `/api/reconciliation/prepare/${orgId}/${bankSessionId}/${bookSessionId}`
    );
  }

  async listReconciliationSessions(orgId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/sessions/${orgId}`);
  }

  async getReconciliationWorksheet(
    sessionId: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/session/${sessionId}/worksheet`);
  }

  async saveReconciliationSession(
    sessionId: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/session/${sessionId}/save`, {
      method: "POST",
    });
  }

  async closeReconciliationSession(
    sessionId: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/session/${sessionId}/close`, {
      method: "POST",
    });
  }

  async updateReconciliationSessionBalances(
    sessionId: string,
    payload: {
      bank_open_balance: number;
      book_open_balance: number;
      bank_closing_balance?: number;
      book_closing_balance?: number;
      account_number?: string | null;
      company_name?: string | null;
      company_address?: string | null;
      company_logo_data_url?: string | null;
      prepared_by?: string | null;
      reviewed_by?: string | null;
      currency_code?: string | null;
    }
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/session/${sessionId}/balances`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async startBlankReconciliationPeriod(
    sessionId: string,
    periodMonth: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/session/${sessionId}/start-blank`, {
      method: "POST",
      body: JSON.stringify({ period_month: periodMonth }),
    });
  }

  async reopenReconciliationSession(
    sessionId: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/session/${sessionId}/reopen`, {
      method: "POST",
    });
  }

  async updateTransactionRemovalState(payload: {
    bank_transaction_ids?: string[];
    book_transaction_ids?: string[];
    removed: boolean;
  }): Promise<ApiResponse<any>> {
    return this.request("/api/reconciliation/transactions/removal", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async downloadReconciliationReport(
    orgId: string,
    bankSessionId: string,
    bookSessionId: string
  ): Promise<ApiResponse<Blob>> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/reconciliation/report/${orgId}/${bankSessionId}/${bookSessionId}`,
        {
          headers: this.buildAuthHeaders(),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        return {
          success: false,
          error: this.extractErrorMessage(data, response.status),
          status: response.status,
        };
      }

      return {
        success: true,
        data: await response.blob(),
        status: response.status,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message,
        status: 0,
      };
    }
  }

  // ===== Health =====

  async healthCheck(): Promise<ApiResponse<any>> {
    return this.request("/health");
  }

  async getProcessingJob(jobId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/jobs/${jobId}`);
  }

  async listProcessingJobs(params?: {
    status?: string;
    jobType?: string;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.jobType) search.set("job_type", params.jobType);
    if (params?.limit) search.set("limit", String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return this.request(`/api/jobs${suffix}`);
  }

  async retryProcessingJob(jobId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/jobs/${jobId}/retry`, {
      method: "POST",
    });
  }

  // ===== Organizations =====

  async bootstrapOrg(payload?: {
    name?: string;
    slug?: string;
    email?: string;
  }): Promise<ApiResponse<any>> {
    return this.request("/api/orgs/bootstrap", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  }

  async updateCurrentOrganization(payload: {
    name?: string;
    company_address?: string | null;
    company_logo_data_url?: string | null;
  }): Promise<ApiResponse<any>> {
    return this.request("/api/orgs/current", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async register(payload: {
    name: string;
    email: string;
    password: string;
    organization_name: string;
    organization_slug?: string;
  }): Promise<ApiResponse<any>> {
    return this.request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async login(payload: {
    email: string;
    password: string;
  }): Promise<ApiResponse<any>> {
    return this.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getCurrentSession(): Promise<ApiResponse<any>> {
    return this.request("/api/auth/me");
  }

  async listUsers(): Promise<ApiResponse<any>> {
    return this.request("/api/auth/users");
  }

  async createUser(payload: {
    name: string;
    email: string;
    password: string;
    role: "admin" | "reviewer";
  }): Promise<ApiResponse<any>> {
    return this.request("/api/auth/users", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async changePassword(payload: {
    current_password: string;
    new_password: string;
  }): Promise<ApiResponse<any>> {
    return this.request("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async requestPasswordReset(payload: {
    email: string;
  }): Promise<ApiResponse<any>> {
    return this.request("/api/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async confirmPasswordReset(payload: {
    token: string;
    new_password: string;
  }): Promise<ApiResponse<any>> {
    return this.request("/api/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async listAuditLogs(params?: {
    action?: string;
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const search = new URLSearchParams();
    if (params?.action) search.set("action", params.action);
    if (params?.limit) search.set("limit", String(params.limit));
    const suffix = search.toString() ? `?${search.toString()}` : "";
    return this.request(`/api/audit${suffix}`);
  }
}

export const apiClient = new ApiClient();
