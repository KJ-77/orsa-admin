import { fetchAuthSession } from "aws-amplify/auth";

interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
}

class ApiClient {
  private baseURL: string = "";

  constructor(baseURL?: string) {
    this.baseURL = baseURL || "";
  }
  private async request<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      // Only set Content-Type to application/json if we're not uploading a file
      ...(!(options.body instanceof File) && { "Content-Type": "application/json" }),
      ...(options.headers as Record<string, string>),
    };

    // Add authentication token if available
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // If auth fails, continue without token - let the API handle the unauthorized request
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    const fullUrl = this.baseURL ? `${this.baseURL}${url}` : url;

    try {
      const response = await fetch(fullUrl, config);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      throw error;
    }
  }
  async get<T = unknown>(
    url: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: "GET" });
  }

  async post<T = unknown>(
    url: string,
    data?: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: "POST",
      body: data instanceof File ? data : (data ? JSON.stringify(data) : undefined),
    });
  }

  async put<T = unknown>(
    url: string,
    data?: unknown,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = unknown>(
    url: string,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: "DELETE" });
  }
}

// Create a default instance with the API base URL
export const apiClient = new ApiClient(
  "https://rlg7ahwue7.execute-api.eu-west-3.amazonaws.com"
);

// Export the class for custom instances
export { ApiClient };
