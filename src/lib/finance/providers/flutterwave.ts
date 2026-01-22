import { PaymentProvider } from '../types';

export class FlutterwaveProvider implements PaymentProvider {
    name = 'FLUTTERWAVE';

    async initiatePayment(amount: number, currency: string, email: string, reference: string, metadata: any) {
        // Simulation
        return {
            paymentUrl: `https://checkout.flutterwave.com/pay/${reference}`,
            transactionId: `FLW-${Date.now()}-${Math.floor(Math.random() * 1000)}`
        };
    }

    async verifyPayment(transactionId: string) {
        // Simulation
        return {
            status: 'SUCCESS' as const,
            rawData: { status: 'successful', amount: 1000, currency: 'XOF', tx_ref: 'RX1' }
        };
    }
}
