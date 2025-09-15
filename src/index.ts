// plugin.ts

import process from 'process';
import { Stripe } from 'stripe';
import webito, { paymentsCreate_input, paymentsVerify_input } from 'webito-plugin-sdk';

const zeroDecimalCurrencies = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
    "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"
]);

export function toStripeAmount(amount: number, currency: string): { value: number, code: string } {
    const code = currency.toUpperCase();

    const value = zeroDecimalCurrencies.has(code)
        ? Math.round(amount)
        : Math.round(amount * 100);

    return { value, code };
}


export const starter = new webito.WebitoPlugin('starter');

starter.registerHook(
    webito.hooks.paymentsCreate,
    async ({ variables, data }: { variables: { SECRET_KEY: string, auto_tax: boolean }, data: paymentsCreate_input }) => {
        try {

            const stripe = new Stripe(variables.SECRET_KEY);

            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: toStripeAmount(data.amount, data.gateway.currency.code).code,
                            unit_amount: toStripeAmount(data.amount, data.gateway.currency.code).value,
                            product_data: {
                                name: data?.order?.ordernumber || data?.order?._id || data.payment,
                                description: data.order.ordernumber ? `Order: ${data.order.ordernumber}` : `Payment ID: ${data.payment}`
                            },
                        },
                        quantity: 1,
                    },
                ],
                success_url: `${data.callback}`,
                cancel_url: `${data.callback}`,
                automatic_tax: { enabled: variables.auto_tax ? variables.auto_tax : false },
                client_reference_id: String(data.payment),
                metadata: {
                    payment: String(data.payment),
                    ordernumber: data.order.ordernumber ?? '',
                    tenant: data?.order?.tenant ?? ''
                },
            }, {
                idempotencyKey: `pay-${data.payment}`,
            });

            return {
                status: true,
                transaction: {
                    id: session.id,
                    order_number: data.payment,
                    amount: data.amount,
                    currency: data.gateway.currency.code,
                    payment_intent: session.payment_intent ?? null,
                },
                url: session.url,
                redirect_url: session.url
            };

        } catch (error) {
            return { status: false, error: error };
        }
    }
);

starter.registerHook(
    webito.hooks.paymentsVerify,
    async ({ variables, data }: { variables: { SECRET_KEY: string }, data: paymentsVerify_input }) => {
        try {

            const stripe = new Stripe(variables.SECRET_KEY);

            const sessionId =
                data?.payment?.transaction?.id ||
                data?.payment?.transaction?.order_number ||
                data?.payment?.transaction?.sid;

            if (!sessionId) {
                throw new Error("Stripe session id not found");
            }

            const session = await stripe.checkout.sessions.retrieve(sessionId, {
                expand: ['payment_intent', 'total_details.breakdown.discounts', 'total_details.breakdown.taxes']
            });

            const isPaid = session.payment_status === 'paid' || session.status === 'complete';

            const paidAmount = session.amount_total ?? 0;   // همیشه در واحد کوچک (سنت)
            const paidCurrency = (session.currency ?? '').toUpperCase();

            const expected = toStripeAmount(data.payment.amount, data.payment.currency);
            const amountsMatch = paidAmount === expected.value && paidCurrency === expected.code;

            if (isPaid && amountsMatch) {
                const pi = session.payment_intent as Stripe.PaymentIntent | null;

                return {
                    status: true,
                    transaction: {
                        id: session.id,
                        status: 'PAID',
                        amount: paidAmount,
                        currency: paidCurrency,
                        payment_intent: pi?.id ?? null,
                        charge_id: pi?.latest_charge ?? null,
                        receipt_url: (pi?.latest_charge && typeof pi?.latest_charge !== 'string')
                            ? (pi?.latest_charge as any)?.receipt_url ?? null
                            : null,
                        customer: session.customer ?? null,
                    }
                };
            } else {
                return {
                    status: false,
                    error: `Payment not captured or amount mismatch. status=${session.payment_status}, paidAmount=${paidAmount} ${paidCurrency}`
                };
            }

        } catch (error) {
            return { status: false, error: error };
        }
    }
);

export const runPlugin = async (inputData: { hook: string; data: any }) => {
    const result = await starter.executeHook(inputData.hook, inputData.data);
    return result;
};

if (require.main === module) {
    process.stdin.on('data', async (input) => {
        const msg = JSON.parse(input.toString());
        const result: any = await runPlugin(msg);
        starter.response({ status: result?.status, data: result })
    });
}