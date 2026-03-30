export interface YooKassaAmount {
  value: string;
  currency: string;
}

export interface PaymentConfirmation {
  type: string;
  confirmation_url?: string;
}

export interface PaymentMethod {
  type: string;
  id?: string;
  saved?: boolean;
  title?: string;
}

export interface Payment {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  paid: boolean;
  amount: YooKassaAmount;
  confirmation?: PaymentConfirmation;
  payment_method?: PaymentMethod;
  created_at: string;
  description?: string;
  captured_at?: string;
  receipt_registration?: string;
  metadata?: Record<string, string>;
  test: boolean;
}

export interface Refund {
  id: string;
  status: "succeeded" | "canceled";
  amount: YooKassaAmount;
  payment_id: string;
  created_at: string;
  description?: string;
}

export interface ReceiptItem {
  description: string;
  quantity: string;
  amount: YooKassaAmount;
  vat_code: number;
}

export interface Receipt {
  id: string;
  type: "payment" | "refund";
  status: string;
  payment_id: string;
  items: ReceiptItem[];
}

export interface AccountInfo {
  account_id: string;
  status: string;
  test: boolean;
  fiscalization_enabled: boolean;
}

export interface YooKassaError {
  type: "error";
  id: string;
  code: string;
  description: string;
  parameter?: string;
}

export interface YooKassaList<T> {
  type: "list";
  items: T[];
  next_cursor?: string;
}
