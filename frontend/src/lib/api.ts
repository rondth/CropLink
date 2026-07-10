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
            } catch {
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

// ====== Messaging API ======

export interface ConversationListing {
    id: string;
    crop_name: string;
    photo_url: string | null;
}

export interface ConversationParticipant {
    user_id: string;
    name: string | null;
    profile_picture_url: string | null;
}

export interface ConversationLastMessage {
    content: string;
    created_at: string;
}

export interface Conversation {
    id: string;
    listing: ConversationListing | null;
    other_participant: ConversationParticipant | null;
    last_message: ConversationLastMessage | null;
    unread_count: number;
}

export interface ConversationRecord {
    id: string;
    listing_id: string;
    buyer_id: string;
    seller_id: string;
    last_message_at: string | null;
}

export interface ConversationDetail {
    id: string;
    listing: ConversationListing | null;
    other_participant: ConversationParticipant | null;
}

export interface Message {
    id: string;
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    read_at: string | null;
    client_msg_id?: string | null;
}

export const getConversations = async (): Promise<Conversation[]> => {
    const response = await api.get<Conversation[]>('/conversations');
    return response.data;
}

export const createConversation = async (listing_id: string): Promise<ConversationRecord> => {
    const response = await api.post<ConversationRecord>('/conversations', { listing_id });
    return response.data;
}

export const getConversation = async (conversationId: string): Promise<ConversationDetail> => {
    const response = await api.get<ConversationDetail>(`/conversations/${conversationId}`);
    return response.data;
}

export const getMessages = async (
    conversationId: string,
    params: { limit?: number; before?: string; after?: string } = {}
): Promise<Message[]> => {
    const response = await api.get<Message[]>(`/conversations/${conversationId}/messages`, {
        params: { limit: params.limit ?? 50, before: params.before, after: params.after },
    });
    return response.data;
}

export const sendMessage = async (
    conversationId: string,
    content: string,
    clientMsgId: string
): Promise<Message> => {
    const response = await api.post<Message>(`/conversations/${conversationId}/messages`, {
        content,
        client_msg_id: clientMsgId,
    });
    return response.data;
}

export const markConversationRead = async (conversationId: string): Promise<{ marked_count: number }> => {
    const response = await api.patch<{ marked_count: number }>(`/conversations/${conversationId}/read`);
    return response.data;
}

export const getUnreadMessageCount = async (): Promise<number> => {
    const response = await api.get<{ total: number }>('/conversations/unread-count');
    return response.data.total;
}

// ====== Notifications API ======

export interface MessageNotification {
    conversation_id: string;
    other_participant: ConversationParticipant | null;
    preview: string;
    unread_count: number;
    last_message_at: string | null;
}

export const getMessageNotifications = async (): Promise<MessageNotification[]> => {
    const response = await api.get<MessageNotification[]>('/notifications/messages');
    return response.data;
}
