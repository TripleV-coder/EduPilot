import { PaymentProvider, SupportedProvider } from './types';
import { FlutterwaveProvider } from './providers/flutterwave';

export class PaymentProviderFactory {
    static getProvider(type: SupportedProvider): PaymentProvider {
        switch (type) {
            case 'FLUTTERWAVE':
                return new FlutterwaveProvider();
            case 'PAYSTACK':
                // return new PaystackProvider(); // TODO
                throw new Error('Paystack not implemented yet');
            case 'FEDAPAY':
                throw new Error('Fedapay not implemented yet');
            default:
                throw new Error(`Unsupported provider: ${type}`);
        }
    }
}
