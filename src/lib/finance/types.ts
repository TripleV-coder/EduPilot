export interface PaymentProvider {
    name: string;
    initiatePayment(amount: number, currency: string, email: string, reference: string, metadata: Record<string, unknown>): Promise<{ paymentUrl: string; transactionId: string }>;
    verifyPayment(transactionId: string): Promise<{ status: 'SUCCESS' | 'FAILED' | 'PENDING'; rawData: unknown }>;
}

export type SupportedProvider = 'FLUTTERWAVE' | 'PAYSTACK' | 'FEDAPAY' | 'MOMO';
