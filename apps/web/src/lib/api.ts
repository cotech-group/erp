const API_URL = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001/api/v1';

interface ApiResponse<T> {
  data: T;
  meta: { total?: number; page?: number; limit?: number; nextCursor?: string; timestamp: string };
}

interface ApiError {
  error: { code: string; message: string; details?: unknown };
  meta: { traceId?: string; timestamp: string };
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      if (typeof window !== 'undefined') localStorage.setItem('token', token);
    } else {
      if (typeof window !== 'undefined') localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    const token = this.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, { ...options, headers });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiError | null;
      throw new Error(body?.error?.message || `API error ${res.status}`);
    }

    return res.json() as Promise<ApiResponse<T>>;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }

  patch<T>(path: string, body?: unknown) {
    return this.request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
  }

  async login(email: string, password: string) {
    const res = await this.post<{ accessToken: string; refreshToken: string; expiresIn: number }>(
      '/auth/login',
      { email, password },
    );
    this.setToken(res.data.accessToken);
    if (typeof window !== 'undefined') {
      localStorage.setItem('refreshToken', res.data.refreshToken);
    }
    return res.data;
  }

  logout() {
    this.post('/auth/logout').catch(() => {});
    this.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('refreshToken');
    }
  }
}

export const api = new ApiClient();
export type { ApiResponse, ApiError };
