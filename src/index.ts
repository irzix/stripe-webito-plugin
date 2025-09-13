// plugin.ts

import axios from 'axios';
import process from 'process';
import qs from 'qs';
import { Stripe } from 'stripe';
import webito, { paymentsCreate_input, paymentsVerify_input } from 'webito-plugin-sdk';

const zeroDecimalCurrencies = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
    "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"
]);

export function toStripeAmount(amount: number, currency: string): { value: number, code: string } {
    const code = currency.toUpperCase(); // نرمالایز به uppercase

    const value = zeroDecimalCurrencies.has(code)
        ? Math.round(amount)
        : Math.round(amount * 100);

    return { value, code };
}


const starter = new webito.WebitoPlugin('starter');

starter.registerHook(
    webito.hooks.paymentsCreate,
    async ({ variables, data }: { variables: { SECRET_KEY: string }, data: paymentsCreate_input }) => {
        try {

            const stripe = new Stripe(variables.SECRET_KEY);

            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                line_items: [
                    {
                        price_data: {
                            currency: toStripeAmount(data.amount, data.gateway.currency.code).code,
                            unit_amount: toStripeAmount(data.amount, data.gateway.currency.code).value,
                            product_data: { name: data.order.ordernumber ? `Order: ${data.order.ordernumber}` : `Payment ID: ${data.payment}` },
                        },
                        quantity: 1,
                    },
                ],
                success_url: `${data.callback}?sid={CHECKOUT_SESSION_ID}`,
                cancel_url: `${data.callback}?canceled=1`,
                automatic_tax: { enabled: true }, // اگر Stripe Tax کانفیگ نشده، بردارش
                client_reference_id: String(data.payment), // رفرنس داخلی
                metadata: {
                    paymentId: String(data.payment),
                    orderNumber: data.order.ordernumber ?? '',
                    tenantId: data?.order?.tenantId ?? ''
                },
            }, {
                idempotencyKey: `pay-${data.payment}`,
            });

            return {
                status: true,
                transaction: {
                    id: session.id,               // نکته: همین رو برای verify استفاده می‌کنیم
                    order_number: data.payment,
                    amount: data.amount,
                    currency: data.gateway.currency.code,
                    payment_intent: session.payment_intent ?? null, // اگه خواستی ذخیره کن
                },
                url: session.url,
                redirect_url: session.url
            };

        } catch (error) {
            console.error("2Checkout Payment Error:", error);
            return { status: false, error: error };
        }
    }
);

starter.registerHook(
    webito.hooks.paymentsVerify,
    async ({ variables, data }: { variables: { SECRET_KEY: string }, data: paymentsVerify_input }) => {
        try {

            const stripe = new Stripe(variables.SECRET_KEY);

            // sessionId رو از transaction.id که قبلاً ذخیره کردی برمی‌داریم
            const sessionId =
                data?.payment?.transaction?.id ||
                data?.payment?.transaction?.order_number ||
                data?.payment?.transaction?.sid; // اگر از success_url آوردی

            if (!sessionId) {
                throw new Error("Stripe session id not found");
            }

            // اطلاعات سشن + پیمنت اینتنت
            const session = await stripe.checkout.sessions.retrieve(sessionId, {
                expand: ['payment_intent', 'total_details.breakdown.discounts', 'total_details.breakdown.taxes']
            });

            // وضعیت پرداخت
            const isPaid = session.payment_status === 'paid' || session.status === 'complete';

            // مبلغ/ارز پرداخت‌شده‌ی واقعی از Stripe
            const paidAmount = session.amount_total ?? 0;   // همیشه در واحد کوچک (سنت)
            const paidCurrency = (session.currency ?? '').toUpperCase();

            // مبلغ/ارز مورد انتظار سیستم تو (از رکورد سفارش داخلی‌ات)
            const expected = toStripeAmount(data.payment.amount, data.payment.currency);
            const amountsMatch = paidAmount === expected.value && paidCurrency === expected.code;

            if (isPaid && amountsMatch) {
                // می‌تونی اطلاعات بیشتری هم برگردونی:
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
            console.error("2Checkout Verification Error:", error);
            return { status: false, error: error };
        }
    }
);

const runPlugin = async (inputData: { hook: string; data: any }) => {
    const result = await starter.executeHook(inputData.hook, inputData.data);
    return result;
};

process.stdin.on('data', async (input) => {
    const msg = JSON.parse(input.toString());
    const result: any = await runPlugin(msg);
    starter.response({ status: result?.status, data: result })
});