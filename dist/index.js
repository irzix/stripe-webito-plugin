"use strict";
// plugin.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPlugin = exports.toStripeAmount = exports.zeroDecimalCurrencies = void 0;
const process_1 = __importDefault(require("process"));
const stripe_1 = require("stripe");
const webito_plugin_sdk_1 = __importDefault(require("webito-plugin-sdk"));
exports.zeroDecimalCurrencies = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
    "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"
]);
function toStripeAmount(amount, currency) {
    const code = currency.toUpperCase();
    const value = exports.zeroDecimalCurrencies.has(code)
        ? Math.round(amount)
        : Math.round(amount * 100);
    return { value, code };
}
exports.toStripeAmount = toStripeAmount;
const starter = new webito_plugin_sdk_1.default.WebitoPlugin('starter');
starter.registerHook(webito_plugin_sdk_1.default.hooks.paymentsCreate, async ({ variables, data }) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const stripe = new stripe_1.Stripe(variables.SECRET_KEY);
        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [
                {
                    price_data: {
                        currency: toStripeAmount(data.amount, data.gateway.currency.code).code,
                        unit_amount: toStripeAmount(data.amount, data.gateway.currency.code).value,
                        product_data: {
                            name: ((_a = data === null || data === void 0 ? void 0 : data.order) === null || _a === void 0 ? void 0 : _a.ordernumber) || ((_b = data === null || data === void 0 ? void 0 : data.order) === null || _b === void 0 ? void 0 : _b._id) || data.payment,
                            description: ((_c = data === null || data === void 0 ? void 0 : data.order) === null || _c === void 0 ? void 0 : _c.ordernumber) ? `Order: ${data.order.ordernumber}` : `Payment ID: ${data.payment}`
                        },
                    },
                    quantity: 1,
                },
            ],
            success_url: `${data.callback}`,
            cancel_url: `${data.callback}`,
            automatic_tax: { enabled: (variables === null || variables === void 0 ? void 0 : variables.auto_tax) || false },
            client_reference_id: String(data.payment),
            metadata: {
                payment: String(data.payment),
                ordernumber: (_e = (_d = data === null || data === void 0 ? void 0 : data.order) === null || _d === void 0 ? void 0 : _d.ordernumber) !== null && _e !== void 0 ? _e : '',
                tenant: (_g = (_f = data === null || data === void 0 ? void 0 : data.gateway) === null || _f === void 0 ? void 0 : _f.tenant) !== null && _g !== void 0 ? _g : ''
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
                payment_intent: (_h = session.payment_intent) !== null && _h !== void 0 ? _h : null,
            },
            url: session.url,
        };
    }
    catch (error) {
        return { status: false, error: error, payload: data, hook: 'verify' };
    }
});
starter.registerHook(webito_plugin_sdk_1.default.hooks.paymentsVerify, async ({ variables, data }) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    try {
        const stripe = new stripe_1.Stripe(variables.SECRET_KEY);
        const sessionId = ((_b = (_a = data === null || data === void 0 ? void 0 : data.payment) === null || _a === void 0 ? void 0 : _a.transaction) === null || _b === void 0 ? void 0 : _b.id) ||
            ((_d = (_c = data === null || data === void 0 ? void 0 : data.payment) === null || _c === void 0 ? void 0 : _c.transaction) === null || _d === void 0 ? void 0 : _d.order_number) ||
            ((_f = (_e = data === null || data === void 0 ? void 0 : data.payment) === null || _e === void 0 ? void 0 : _e.transaction) === null || _f === void 0 ? void 0 : _f.sid);
        if (!sessionId) {
            throw new Error("Stripe session id not found");
        }
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['payment_intent', 'total_details.breakdown.discounts', 'total_details.breakdown.taxes']
        });
        const isPaid = session.payment_status === 'paid' || session.status === 'complete';
        const paidAmount = (_g = session.amount_total) !== null && _g !== void 0 ? _g : 0; // همیشه در واحد کوچک (سنت)
        const paidCurrency = ((_h = session.currency) !== null && _h !== void 0 ? _h : '').toUpperCase();
        const expected = toStripeAmount(data.payment.amount, data.gateway.currency.code);
        const amountsMatch = paidAmount === expected.value && paidCurrency === expected.code;
        if (isPaid && amountsMatch) {
            const pi = session.payment_intent;
            return {
                status: true,
                transaction: {
                    id: session.id,
                    status: 'PAID',
                    amount: paidAmount,
                    currency: paidCurrency,
                    payment_intent: (_j = pi === null || pi === void 0 ? void 0 : pi.id) !== null && _j !== void 0 ? _j : null,
                    charge_id: (_k = pi === null || pi === void 0 ? void 0 : pi.latest_charge) !== null && _k !== void 0 ? _k : null,
                    receipt_url: ((pi === null || pi === void 0 ? void 0 : pi.latest_charge) && typeof (pi === null || pi === void 0 ? void 0 : pi.latest_charge) !== 'string')
                        ? (_m = (_l = pi === null || pi === void 0 ? void 0 : pi.latest_charge) === null || _l === void 0 ? void 0 : _l.receipt_url) !== null && _m !== void 0 ? _m : null
                        : null,
                    customer: (_o = session.customer) !== null && _o !== void 0 ? _o : null,
                }
            };
        }
        else {
            return {
                status: false,
                error: `Payment not captured or amount mismatch. status=${session.payment_status}, paidAmount=${paidAmount} ${paidCurrency}`
            };
        }
    }
    catch (error) {
        return { status: false, error: error, payload: data, hook: 'verify' };
    }
});
const runPlugin = async (inputData) => {
    const result = await starter.executeHook(inputData.hook, inputData.data);
    return result;
};
exports.runPlugin = runPlugin;
process_1.default.stdin.on('data', async (input) => {
    const msg = JSON.parse(input.toString());
    const result = await (0, exports.runPlugin)(msg);
    starter.response({ status: result === null || result === void 0 ? void 0 : result.status, data: result });
});
