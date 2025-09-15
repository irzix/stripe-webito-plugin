import { toStripeAmount } from '../src/index';

describe('toStripeAmount', () => {
    it('باید برای ارز غیر صفر (USD) مقدار را در 100 ضرب کند و گرد کند', () => {
        expect(toStripeAmount(10, 'usd')).toEqual({ value: 1000, code: 'USD' });
        expect(toStripeAmount(10.239, 'USD')).toEqual({ value: 1024, code: 'USD' });
    });

    it('باید برای ارز صفر (JPY) مقدار را رُند کند بدون ضرب در 100', () => {
        expect(toStripeAmount(10, 'jpy')).toEqual({ value: 10, code: 'JPY' });
        expect(toStripeAmount(10.6, 'JPY')).toEqual({ value: 11, code: 'JPY' });
    });
});


