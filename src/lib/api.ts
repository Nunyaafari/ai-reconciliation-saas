// API configuration and client

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
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

  // ===== Upload Routes =====

  async createUploadSession(
    orgId: string,
    file: File,
    source: "bank" | "book"
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${this.baseUrl}/api/uploads/create-session/${orgId}?source=${source}`,
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

  async extractData(sessionId: string, file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${this.baseUrl}/api/uploads/extract/${sessionId}`,
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

  async startExtractionJob(
    sessionId: string,
    file: File
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${this.baseUrl}/api/uploads/extract-async/${sessionId}`,
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

  async confirmMapping(
    sessionId: string,
    file: File,
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
    formData.append("file", file);
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
    return this.request(`/api/reconciliation/match/${orgId}`, {
      method: "POST",
      body: JSON.stringify({
        bank_transaction_ids: bankTransactionIds,
        book_transaction_ids: bookTransactionIds,
        confidence_score: confidenceScore,
      }),
    });
  }

  async approveMatch(matchId: string, notes?: string): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/match/${matchId}/approve`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
  }

  async rejectMatch(matchId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/match/${matchId}`, {
      method: "DELETE",
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

  async listReconciliationSessions(orgId: string): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/sessions/${orgId}`);
  }

  async closeReconciliationSession(
    sessionId: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/session/${sessionId}/close`, {
      method: "POST",
    });
  }

  async reopenReconciliationSession(
    sessionId: string
  ): Promise<ApiResponse<any>> {
    return this.request(`/api/reconciliation/session/${sessionId}/reopen`, {
      method: "POST",
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
