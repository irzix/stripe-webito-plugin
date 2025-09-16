import { runPlugin } from '../index';
import { Stripe } from 'stripe';

jest.mock('stripe', () => {
    const retrieve = jest.fn();
    const sessions = { retrieve };
    const checkout = { sessions } as any;
    const accounts = { list: jest.fn().mockResolvedValue([]) } as any;
    const StripeMock = jest.fn().mockImplementation(() => ({ checkout, accounts }));
    return { Stripe: StripeMock };
});

describe('paymentsVerify', () => {
    const SECRET_KEY = '';

    const baseData: any = {
        variables: { SECRET_KEY },
        data: {
            gateway: { currency: { code: 'EUR' } },
            payment: {
                transaction: { id: 'cs_test_1' },
                amount: 10,
                currency: 'EUR',
            }
        }
    };

    afterEach(() => {
        // جلوگیری از لیک شدن لیسنر stdin که در index.js اضافه می‌شود
        try { (process.stdin as any)?.removeAllListeners?.('data'); } catch {}
    });

    it('status=true', async () => {
        const mockRetrieve = (Stripe as any).mock.instances[0]?.checkout.sessions.retrieve || (Stripe as any).mock.results[0]?.value.checkout.sessions.retrieve;
        if (typeof mockRetrieve !== 'function') {
            // دسترسی مستقیم به ماک ساخته شده
            (Stripe as any).mockImplementation(() => ({
                checkout: { sessions: { retrieve: jest.fn().mockResolvedValue({
                    id: 'cs_test_1',
                    payment_status: 'paid',
                    status: 'complete',
                    amount_total: 1000,
                    currency: 'EUR',
                    payment_intent: { id: 'pi_123', latest_charge: 'ch_123' }
                }) } }
            }));
        } else {
            mockRetrieve.mockResolvedValue({
                id: 'cs_test_1',
                payment_status: 'paid',
                status: 'complete',
                amount_total: 1000,
                currency: 'EUR',
                payment_intent: { id: 'pi_123', latest_charge: 'ch_123' }
            });
        }

        const result: any = await runPlugin({ hook: 'paymentsVerify', data: baseData });
        expect(result.status).toBe(true);
        expect(result.transaction?.status).toBe('PAID');
        expect(result.transaction?.amount).toBe(1000);
        expect(result.transaction?.currency).toBe('EUR');
    });

    it('status=false', async () => {
        (Stripe as any).mockImplementation(() => ({
            checkout: { sessions: { retrieve: jest.fn().mockResolvedValue({
                id: 'cs_test_1',
                payment_status: 'paid',
                status: 'complete',
                amount_total: 999,
                currency: 'EUR',
                payment_intent: { id: 'pi_123', latest_charge: 'ch_123' }
            }) } }
        }));

        const result: any = await runPlugin({ hook: 'paymentsVerify', data: baseData });
        expect(result.status).toBe(false);
        expect(String(result.error)).toContain('amount mismatch');
    });
});


