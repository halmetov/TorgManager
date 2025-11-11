const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface LoginResponse {
  access_token: string;
  token_type: string;
  role: string;
  full_name: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.token = localStorage.getItem("token");
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let message = `HTTP error! status: ${response.status}`;
      try {
        const data = await response.json();
        const detail = (data as any)?.detail;
        if (typeof detail === "string") {
          message = detail;
        } else if (detail) {
          message = JSON.stringify(detail);
        }
      } catch (error) {
        console.error("Failed to parse error response", error);
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json();
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const response = await fetch(`${this.baseUrl}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Invalid credentials");
    }

    const data = await response.json();
    this.token = data.access_token;
    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("full_name", data.full_name);
    return data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("full_name");
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint: string): Promise<void> {
    await this.request(endpoint, { method: "DELETE" });
  }

  // Products
  async getProducts(includeArchived = false) {
    const params = new URLSearchParams();
    if (includeArchived) {
      params.set("include_archived", "true");
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.get(`/products${query}`);
  }

  async searchProducts(query: string, limit = 20) {
    const params = new URLSearchParams({ q: query, limit: limit.toString() });
    return this.get(`/products/search?${params.toString()}`);
  }

  async createProduct(data: any) {
    return this.post("/products", data);
  }

  async updateProduct(id: number, data: any) {
    return this.put(`/products/${id}`, data);
  }

  async archiveProduct(id: number) {
    await this.delete(`/products/${id}`);
  }

  // Incoming
  async createIncoming(data: any) {
    return this.post("/incoming", data);
  }

  // Dispatch
  async createDispatch(data: any) {
    return this.post("/dispatch", data);
  }

  async getDispatches(params?: { status?: string; manager_id?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.status) {
      searchParams.set("status", params.status);
    }
    if (params?.manager_id) {
      searchParams.set("manager_id", params.manager_id.toString());
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return this.get(`/dispatch${query}`);
  }

  async acceptDispatch(id: number) {
    return this.post(`/dispatch/${id}/accept`, {});
  }

  // Shops
  async getShops() {
    return this.get("/shops");
  }

  async getMyShops() {
    return this.get("/shops/me");
  }

  async createShop(data: any) {
    return this.post("/shops", data);
  }

  // Manager inventory
  async getManagerStock() {
    return this.get("/manager/stock");
  }

  // Managers
  async getManagers() {
    return this.get("/managers");
  }

  async createManager(data: any) {
    return this.post("/managers", data);
  }

  async updateManager(id: number, data: any) {
    return this.put(`/managers/${id}`, data);
  }
}

export const api = new ApiClient(API_BASE_URL);
