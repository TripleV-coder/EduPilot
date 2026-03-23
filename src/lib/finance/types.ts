export interface PaymentProvider {
    name: string;
    initiatePayment(amount: number, currency: string, email: string, reference: string, metadata: any): Promise<{ paymentUrl: string; transactionId: string }>;
    verifyPayment(transactionId: string): Promise<{ status: 'SUCCESS' | 'FAILED' | 'PENDING'; rawData: any }>;
}

export type SupportedProvider = 'FLUTTERWAVE' | 'PAYSTACK' | 'FEDAPAY';
