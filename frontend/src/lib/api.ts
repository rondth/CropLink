import axios from 'axios';

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to attach the JWT token
// Request from the Frontend to Backend
api.interceptors.request.use(
    (config) => {
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('access_token');

            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token refresh
// Response from the Backend to Frontend
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            
            try {
                const refreshToken = localStorage.getItem('refresh_token');

                if (refreshToken) {
                    const response = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {
                        refresh_token: refreshToken
                    });
                    const { access_token, refresh_token: new_refresh_token } = response.data;
                    localStorage.setItem('access_token', access_token);
                    localStorage.setItem('refresh_token', new_refresh_token);
                    originalRequest.headers.Authorization = `Bearer ${access_token}`;
                    return api(originalRequest); 
                }
            } catch (refreshError) {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
            }
        }
        return Promise.reject(error);
    }
);

// ====== Payment API ======

export interface CreateTransactionRequest {
    listing_id: string;
    quantity: number;
}

export interface CreateTransactionResponse {
    client_secret: string;
    transaction_id: string;
}

export interface Transaction {
    id: string;
    listing_id: string;
    buyer_id: string;
    seller_id: string;
    quantity: number;
    currency: string;
    status: 'pending' | 'completed' | 'cancelled';
    created_at: string;
    payment?: {
        status: 'pending' | 'paid' | 'failed';
        amount: number;
        currency: string;
    }
}

export interface TransactionsResponse {
    transactions: Transaction[];
}

export const createTransaction = async (
    payload: CreateTransactionRequest
): Promise<CreateTransactionResponse> => {
    const response = await api.post<CreateTransactionResponse>('/transactions', payload);
    return response.data;
}

export const getTransactions = async (
    sort: 'asc' | 'desc' = 'desc'
): Promise<TransactionsResponse> => {
    const response = await api.get<TransactionsResponse>('/transactions', { params: { sort }});
    return response.data;
}

export const getTransaction = async (txn_id: string): Promise<Transaction> => {
    const response = await api.get<Transaction>(`/transactions/${txn_id}`);
    return response.data;
}

export const cancelTransaction = async (txn_id: string): Promise<{ status: string }> => {
    const response = await api.post<{ status: string }>(`/transactions/${txn_id}/cancel`);
    return response.data;
}
