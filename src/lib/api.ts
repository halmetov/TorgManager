const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
    this.token = localStorage.getItem('token');
  }

  private async handleError(response: Response): Promise<never> {
    let message = `HTTP error! status: ${response.status}`;
    try {
      const errorData = await response.json();
      message = errorData.detail || message;
    } catch {
      // ignore json parse errors
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Invalid credentials');
    }

    const data = await response.json();
    this.token = data.access_token;
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('role', data.role);
    localStorage.setItem('full_name', data.full_name);
    return data;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('full_name');
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async delete(endpoint: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      await this.handleError(response);
    }
  }

  // Products
  async getProducts(q?: string): Promise<any>;
  async getProducts(params: { q?: string; mainOnly?: boolean; isReturn?: boolean }): Promise<any>;
  async getProducts(param?: string | { q?: string; mainOnly?: boolean; isReturn?: boolean } | boolean): Promise<any> {
    const searchParams = new URLSearchParams();

    if (typeof param === 'boolean') {
      searchParams.set('is_return', String(param));
    } else if (typeof param === 'string') {
      if (param) {
        searchParams.set('q', param);
      }
    } else if (param) {
      if (param.q) {
        searchParams.set('q', param.q);
      }
      if (param.isReturn !== undefined) {
        searchParams.set('is_return', String(param.isReturn));
      }
      if (param.mainOnly) {
        searchParams.set('main_only', 'true');
      }
    }

    const query = searchParams.toString();
    const endpoint = `/products${query ? `?${query}` : ''}`;
    return this.get(endpoint);
  }

  async searchProducts(query?: string, options?: { signal?: AbortSignal; mainOnly?: boolean }) {
    const searchParams = new URLSearchParams();
    if (query) {
      searchParams.set('q', query);
    }
    if (options?.mainOnly !== false) {
      searchParams.set('main_only', 'true');
    }

    const endpoint = `/products${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders(),
      signal: options?.signal,
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async createIncoming(data: { items: { product_id: number; quantity: number }[] }) {
    return this.post('/incoming', data);
  }

  async createProduct(data: any) {
    return this.post('/products', data);
  }

  async updateProduct(id: number, data: any) {
    return this.put(`/products/${id}`, data);
  }

  async deleteProduct(id: number) {
    return this.delete(`/products/${id}`);
  }

  // Shops
  async getShops(params?: { managerId?: number }) {
    const searchParams = new URLSearchParams();
    if (params?.managerId !== undefined) {
      searchParams.set('manager_id', String(params.managerId));
    }

    const query = searchParams.toString();
    const endpoint = `/shops${query ? `?${query}` : ''}`;
    return this.get(endpoint);
  }

  async createShop(data: any) {
    return this.post('/shops', data);
  }

  async updateShop(id: number, data: any) {
    return this.put(`/shops/${id}`, data);
  }

  async deleteShop(id: number) {
    return this.delete(`/shops/${id}`);
  }

  async getMyShops() {
    return this.get('/shops/me');
  }

  // Managers
  async getManagers() {
    return this.get('/managers');
  }

  async createManager(data: any) {
    return this.post('/managers', data);
  }

  async updateManager(id: number, data: any) {
    return this.put(`/managers/${id}`, data);
  }

  // Dispatch
  async createDispatch(data: any) {
    return this.post('/dispatch', data);
  }

  async getDispatches() {
    return this.get('/dispatch');
  }

  async getDispatch(id: number) {
    return this.get(`/dispatch/${id}`);
  }

  async acceptDispatch(id: number) {
    return this.post(`/dispatch/${id}/accept`, {});
  }

  // Orders
  async createOrder(data: any) {
    return this.post('/orders', data);
  }

  // Returns
  async createReturn(data: any) {
    return this.post('/returns', data);
  }

  // Manager Products
  async getManagerProducts() {
    return this.get('/products');
  }

  // Reports
  async getProductReport() {
    return this.get('/reports/products');
  }

  async getManagerReport(managerId?: number) {
    if (managerId) {
      return this.get(`/reports/manager/${managerId}`);
    }
    // Default to summary for current user/admin when no ID provided
    return this.get('/reports/manager-summary');
  }

  async getManagerSummaryReport() {
    return this.get('/reports/manager-summary');
  }
}
export const api = new ApiClient(API_BASE_URL);
