import { PaymentProvider, SupportedProvider } from './types';
import { FlutterwaveProvider } from './providers/flutterwave';
import { PaystackProvider } from './providers/paystack';

export class PaymentProviderFactory {
    static getProvider(type: SupportedProvider): PaymentProvider {
        switch (type) {
            case 'FLUTTERWAVE':
                return new FlutterwaveProvider();
            case 'PAYSTACK':
                return new PaystackProvider();
            case 'FEDAPAY':
                throw new Error('FedaPay not implemented yet');
            default:
                throw new Error(`Unsupported provider: ${type}`);
        }
    }
}
