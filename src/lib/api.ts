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
      throw new Error(`HTTP error! status: ${response.status}`);
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
      const error = await response.json();
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
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
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async delete(endpoint: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  // Products
  async getProducts(isReturn?: boolean) {
    const params = isReturn !== undefined ? `?is_return=${isReturn}` : '';
    return this.get(`/products${params}`);
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
  async getShops() {
    return this.get('/shops');
  }

  async createShop(data: any) {
    return this.post('/shops', data);
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
