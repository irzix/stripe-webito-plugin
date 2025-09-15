import { runPlugin } from '../src/index';
import { Stripe } from 'stripe';

jest.mock('stripe', () => {
    const create = jest.fn();
    const sessions = { create };
    const checkout = { sessions } as any;
    const accounts = { list: jest.fn().mockResolvedValue([]) } as any;
    const StripeMock = jest.fn().mockImplementation(() => ({ checkout, accounts }));
    return { Stripe: StripeMock };
});

describe('paymentsCreate', () => {
    const SECRET_KEY = 'sk_test_123';

    const baseData: any = {
        variables: { SECRET_KEY },
        data: {
            amount: 10,
            gateway: { currency: { code: 'USD' } },
            order: { ordernumber: 'ORD-1', tenantId: 't1' },
            callback: 'https://webito.co/callback',
            payment: 555
        }
    };

    it('باید سشن استرایپ را با amount و currency صحیح بسازد و url برگرداند', async () => {
        (Stripe as any).mockImplementation(() => ({
            checkout: { sessions: { create: jest.fn().mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test/s/1', payment_intent: 'pi_1' }) } },
            accounts: { list: jest.fn().mockResolvedValue([]) }
        }));

        const result: any = await runPlugin({ hook: 'paymentsCreate', data: baseData });

        expect(result.status).toBe(true);
        expect(result.url).toBe('https://stripe.test/s/1');

        const calledWith = (Stripe as any).mock.results[0].value.checkout.sessions.create.mock.calls[0][0];
        expect(calledWith.mode).toBe('payment');
        expect(calledWith.line_items[0].price_data.currency).toBe('USD');
        expect(calledWith.line_items[0].price_data.unit_amount).toBe(1000);
        expect(calledWith.client_reference_id).toBe(String(baseData.data.payment));
    });
});


