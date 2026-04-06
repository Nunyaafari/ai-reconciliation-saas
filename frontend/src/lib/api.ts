// API configuration and client

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? "http://localhost:8000" 
    : "http://reconciliation_api:8000");

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

  private extractErrorMessage(data: any, status: number): string {
    if (!data) return `HTTP ${status}`;
    return data.error || data.detail || data.message || `HTTP ${status}`;
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
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
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
    source: "bank" | "book"
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${this.baseUrl}/api/uploads/create-session/${orgId}?source=${source}`,
        {
          method: "POST",
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
        }
      );

      const data = await this.readResponseBody(response);

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
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
      amount: string;
    },
    saveAsFingerprint: boolean = true
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${this.baseUrl}/api/uploads/confirm-mapping/${sessionId}?save_as_fingerprint=${saveAsFingerprint}`,
        {
          method: "POST",
          headers: {
            // FormData will set Content-Type automatically
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
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

  // ===== Health =====

  async healthCheck(): Promise<ApiResponse<any>> {
    return this.request("/health");
  }
}

export const apiClient = new ApiClient();
