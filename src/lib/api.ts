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
    let errorData: any = null;
    try {
      errorData = await response.json();
      message = errorData.detail || message;
    } catch {
      // ignore json parse errors
    }
    const error = new Error(message) as Error & { status?: number; data?: any };
    error.status = response.status;
    if (errorData !== null) {
      error.data = errorData;
    }
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

  async searchProducts(query?: string, options?: { signal?: AbortSignal }) {
    const endpoint = `${this.baseUrl}/products${query ? `?q=${encodeURIComponent(query)}` : ''}`;
    const response = await fetch(endpoint, {
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

  async adjustShopDebt(shopId: number, data: { amount: number }) {
    return this.post(`/shops/${shopId}/adjust-debt`, data);
  }

  // Managers
  async getManagers() {
    return this.get('/managers');
  }

  async getManagersList() {
    return this.getManagers();
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
  async createShopOrder(data: any) {
    return this.post('/shop-orders', data);
  }

  async getShopOrders() {
    return this.get('/shop-orders');
  }

  async getShopOrderDetail(id: number) {
    return this.get(`/shop-orders/${id}`);
  }

  // Manager stock
  async getManagerStock() {
    return this.get('/manager/stock');
  }

  // Returns
  async createReturn(data: { items: { product_id: number; quantity: number }[] }) {
    return this.post('/returns', data);
  }

  async getReturns() {
    return this.get('/returns');
  }

  async getReturnDetail(id: number) {
    return this.get(`/returns/${id}`);
  }

  async createShopReturn(data: { shop_id: number; items: { product_id: number; quantity: number }[] }) {
    return this.post('/shop-returns', data);
  }

  async getShopReturns() {
    return this.get('/shop-returns');
  }

  async getShopReturnDetail(id: number) {
    return this.get(`/shop-returns/${id}`);
  }

  async createManagerReturn(data: { items: { product_id: number; quantity: number }[] }) {
    return this.post('/manager-returns', data);
  }

  async getManagerReturns() {
    return this.get('/manager-returns');
  }

  async getManagerReturnDetail(id: number) {
    return this.get(`/manager-returns/${id}`);
  }

  async getDriverDailyBalance() {
    return this.get('/driver/daily-balance');
  }

  async createDriverDailyReport(data: {
    cash_amount: number;
    card_amount: number;
    other_expenses: number;
    other_details: string;
  }) {
    return this.post('/driver/daily-report', data);
  }

  async getDriverDailyReports(params: { start_date?: string; end_date?: string; manager_id?: number }) {
    const searchParams = new URLSearchParams();

    if (params.start_date) {
      searchParams.set('start_date', params.start_date);
    }
    if (params.end_date) {
      searchParams.set('end_date', params.end_date);
    }
    if (params.manager_id !== undefined) {
      searchParams.set('manager_id', String(params.manager_id));
    }

    const query = searchParams.toString();
    return this.get(`/reports/driver-daily${query ? `?${query}` : ''}`);
  }

  // Manager Products
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

  async getManagerDailyReport(date: string) {
    const params = new URLSearchParams();
    params.set('date', date);
    return this.get(`/reports/manager/daily?${params.toString()}`);
  }

  async getAdminDailyReport(managerId: number, date: string) {
    const params = new URLSearchParams();
    params.set('manager_id', String(managerId));
    params.set('date', date);
    return this.get(`/reports/admin/daily?${params.toString()}`);
  }

  async getAdminShopPeriodReport(shopId: number, dateFrom: string, dateTo: string) {
    const params = new URLSearchParams();
    params.set('shop_id', String(shopId));
    params.set('date_from', dateFrom);
    params.set('date_to', dateTo);
    return this.get(`/reports/admin/shop-period?${params.toString()}`);
  }
}
export const api = new ApiClient(API_BASE_URL);
