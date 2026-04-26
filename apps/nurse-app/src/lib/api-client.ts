const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });

  failedQueue = [];
};

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'ngrok-skip-browser-warning': 'true',
    ...(options.headers as Record<string, string>),
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Crucial for HttpOnly cookies
    });

    // Handle 401 Unauthorized - trigger refresh
    if (response.status === 401 && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            return apiRequest<T>(endpoint, {
              ...options,
              headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
            });
          })
          .catch((err) => {
            throw err;
          });
      }

      isRefreshing = true;

      try {
        const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!refreshRes.ok) {
          throw new Error('Refresh failed');
        }

        const { token: newToken } = await refreshRes.json();
        localStorage.setItem('token', newToken);
        
        processQueue(null, newToken);
        isRefreshing = false;

        // Retry original request
        return apiRequest<T>(endpoint, options);
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Clear session and redirect to login
        localStorage.removeItem('token');
        if (typeof window !== 'undefined') window.location.href = '/login';
        throw refreshError;
      }
    }

    if (!response.ok) {
      if (response.status === 403) {
        localStorage.removeItem('token');
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || errorData.message || `API Error: ${response.status}`);
      (error as any).status = response.status;
      throw error;
    }

    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  } catch (error) {
    throw error;
  }
}
