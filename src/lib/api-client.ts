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
  private async getAuthToken(): Promise<string | null> {
    try {
      console.log("🔐 Attempting to fetch auth session...");
      const session = await fetchAuthSession();
      console.log("🔐 Full session object:", session);
      console.log("🔐 Session tokens:", session.tokens);

      // Try both access token and ID token
      const accessToken = session.tokens?.accessToken?.toString() || null;
      const idToken = session.tokens?.idToken?.toString() || null;

      console.log(
        "🔐 Access token:",
        accessToken ? "✅ Present" : "❌ Missing"
      );
      console.log("🔐 ID token:", idToken ? "✅ Present" : "❌ Missing");

      // Use ID token first (commonly used for API Gateway), fallback to access token
      const token = idToken || accessToken;

      if (token) {
        console.log(
          "🔐 Using token type:",
          idToken ? "ID Token" : "Access Token"
        );
        console.log("🔐 Token length:", token.length);
        console.log("🔐 Token preview:", token.substring(0, 50) + "...");

        // Verify token format (JWT should have 3 parts separated by dots)
        const tokenParts = token.split(".");
        console.log("🔐 Token parts count:", tokenParts.length);

        if (tokenParts.length === 3) {
          try {
            const payload = JSON.parse(atob(tokenParts[1]));
            console.log("🔐 Token payload:", payload);
            console.log("🔐 Token expires at:", new Date(payload.exp * 1000));
            console.log("🔐 Token issued at:", new Date(payload.iat * 1000));
            console.log("🔐 Current time:", new Date());
            console.log(
              "🔐 Token valid:",
              new Date(payload.exp * 1000) > new Date()
            );
            console.log("🔐 Token audience:", payload.aud);
            console.log("🔐 Token issuer:", payload.iss);
          } catch (e) {
            console.error("🔐 Error parsing token payload:", e);
          }
        }
      } else {
        console.error("🔐 No access token or ID token found in session");
      }

      return token;
    } catch (error) {
      console.error("🔐 Error getting auth token:", error);
      return null;
    }
  }
  private async request<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    console.log("🌐 Starting API request:", options.method || "GET", url);

    const token = await this.getAuthToken();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      console.log("🔐 Authorization header added to request");
      console.log(
        "🔐 Authorization header preview:",
        `Bearer ${token.substring(0, 20)}...`
      );
    } else {
      console.warn(
        "🔐 No token available for request - this will likely result in 401"
      );
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    const fullUrl = this.baseURL ? `${this.baseURL}${url}` : url;
    console.log("🌐 Full request URL:", fullUrl);
    console.log("🌐 Request headers:", headers);
    console.log("🌐 Request config:", config);

    // Test connectivity to the base URL first
    if (this.baseURL && !url.startsWith("http")) {
      try {
        console.log("🌐 Testing connectivity to base URL:", this.baseURL);
        const testResponse = await fetch(this.baseURL, { method: "HEAD" });
        console.log("🌐 Base URL connectivity test:", testResponse.status);
      } catch (connectError) {
        console.error("🌐 Base URL connectivity test failed:", connectError);
        console.error(
          "🌐 This might indicate network/DNS issues with:",
          this.baseURL
        );
      }
    }

    try {
      console.log("🌐 Making fetch request...");
      const response = await fetch(fullUrl, config);

      console.log("🌐 Response received:");
      console.log("🌐 Status:", response.status, response.statusText);
      console.log(
        "🌐 Response headers:",
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        console.error("🚨 API request failed:");
        console.error("🚨 Status:", response.status);
        console.error("🚨 Status text:", response.statusText);
        console.error("🚨 URL:", fullUrl);
        console.error("🚨 Method:", options.method || "GET");
        console.error("🚨 Request headers sent:", headers);

        // Try to get error response body
        try {
          const errorText = await response.text();
          console.error("🚨 Error response body:", errorText);
          // Try to parse as JSON for more details
          try {
            const errorJson = JSON.parse(errorText);
            console.error("🚨 Error response JSON:", errorJson);
          } catch {
            console.log("🚨 Error response is not JSON, raw text:", errorText);
          }
        } catch (e) {
          console.error("🚨 Could not read error response body:", e);
        }
        if (response.status === 401) {
          console.error("🚨 Authentication failed - checking token details");
          if (token) {
            console.error("🚨 Token was present but rejected by server");
            console.error("🚨 Token preview:", token.substring(0, 100) + "...");
          } else {
            console.error("🚨 No token was sent with request");
          }
          // TEMPORARILY DISABLED: Token expired or invalid, redirect to login
          // window.location.href = "/";
          console.error("🚨 Auto-redirect to login disabled for debugging");
          throw new Error("Authentication required");
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ API request successful:");
      console.log("✅ Method:", options.method || "GET");
      console.log("✅ URL:", fullUrl);
      console.log("✅ Response data:", data);

      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      console.error("🚨 API request failed with error:", error);

      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.error("🚨 This appears to be a network connectivity issue");
        console.error("🚨 Please check:");
        console.error("🚨 1. Internet connection");
        console.error("🚨 2. API Gateway URL is correct:", this.baseURL);
        console.error("🚨 3. CORS settings on the API");
        console.error("🚨 4. Firewall/proxy settings");
      }

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
      body: data ? JSON.stringify(data) : undefined,
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
