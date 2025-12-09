
export interface TransactionItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

export interface Transaction {
  id: string;
  storeName: string;
  items: TransactionItem[];
  totalAmount: number;
  date: string;
  category: string;
  type: 'expense' | 'income';
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'expense' | 'income';
}

export interface UserProfile {
  name: string;
  avatarUrl: string;
  pin: string;
  googleSheetId?: string;
  googleSheetName?: string;
  googleEmail?: string;     // Added
  googlePhotoUrl?: string;  // Added
}

export type ToastType = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

export interface AIConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
}