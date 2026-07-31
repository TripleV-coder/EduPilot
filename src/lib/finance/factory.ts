import { PaymentProvider, SupportedProvider } from './types';
import { FlutterwaveProvider } from './providers/flutterwave';
import { PaystackProvider } from './providers/paystack';
import { FedaPayProvider } from './providers/fedapay';
import { MomoProvider } from './providers/momo';

export class PaymentProviderFactory {
    static getProvider(type: SupportedProvider): PaymentProvider {
        switch (type) {
            case 'FLUTTERWAVE':
                return new FlutterwaveProvider();
            case 'PAYSTACK':
                return new PaystackProvider();
            case 'FEDAPAY':
                return new FedaPayProvider();
            case 'MOMO':
                return new MomoProvider();
            default:
                throw new Error(`Unsupported provider: ${type}`);
        }
    }
}
