"use strict";
// plugin.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toStripeAmount = void 0;
var process_1 = __importDefault(require("process"));
var stripe_1 = require("stripe");
var webito_plugin_sdk_1 = __importDefault(require("webito-plugin-sdk"));
var zeroDecimalCurrencies = new Set([
    "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
    "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"
]);
function toStripeAmount(amount, currency) {
    var code = currency.toUpperCase(); // نرمالایز به uppercase
    var value = zeroDecimalCurrencies.has(code)
        ? Math.round(amount)
        : Math.round(amount * 100);
    return { value: value, code: code };
}
exports.toStripeAmount = toStripeAmount;
var starter = new webito_plugin_sdk_1.default.WebitoPlugin('starter');
starter.registerHook(webito_plugin_sdk_1.default.hooks.paymentsCreate, function (_a) {
    var variables = _a.variables, data = _a.data;
    return __awaiter(void 0, void 0, void 0, function () {
        var stripe, session, error_1;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 2, , 3]);
                    stripe = new stripe_1.Stripe(variables.SECRET_KEY);
                    return [4 /*yield*/, stripe.checkout.sessions.create({
                            mode: 'payment',
                            line_items: [
                                {
                                    price_data: {
                                        currency: toStripeAmount(data.amount, data.gateway.currency.code).code,
                                        unit_amount: toStripeAmount(data.amount, data.gateway.currency.code).value,
                                        product_data: { name: data.order.ordernumber ? "Order: ".concat(data.order.ordernumber) : "Payment ID: ".concat(data.payment) },
                                    },
                                    quantity: 1,
                                },
                            ],
                            success_url: "".concat(data.callback),
                            cancel_url: "".concat(data.callback),
                            // automatic_tax: { enabled: true }, // اگر Stripe Tax کانفیگ نشده، بردارش
                            client_reference_id: String(data.payment),
                            metadata: {
                                paymentId: String(data.payment),
                                orderNumber: (_b = data.order.ordernumber) !== null && _b !== void 0 ? _b : '',
                                tenantId: (_d = (_c = data === null || data === void 0 ? void 0 : data.order) === null || _c === void 0 ? void 0 : _c.tenantId) !== null && _d !== void 0 ? _d : ''
                            },
                        }, {
                            idempotencyKey: "pay-".concat(data.payment),
                        })];
                case 1:
                    session = _f.sent();
                    return [2 /*return*/, {
                            status: true,
                            transaction: {
                                id: session.id,
                                order_number: data.payment,
                                amount: data.amount,
                                currency: data.gateway.currency.code,
                                payment_intent: (_e = session.payment_intent) !== null && _e !== void 0 ? _e : null, // اگه خواستی ذخیره کن
                            },
                            url: session.url,
                            redirect_url: session.url
                        }];
                case 2:
                    error_1 = _f.sent();
                    return [2 /*return*/, { status: false, error: error_1 }];
                case 3: return [2 /*return*/];
            }
        });
    });
});
starter.registerHook(webito_plugin_sdk_1.default.hooks.paymentsVerify, function (_a) {
    var variables = _a.variables, data = _a.data;
    return __awaiter(void 0, void 0, void 0, function () {
        var stripe, sessionId, session, isPaid, paidAmount, paidCurrency, expected, amountsMatch, pi, error_2;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        return __generator(this, function (_q) {
            switch (_q.label) {
                case 0:
                    _q.trys.push([0, 2, , 3]);
                    stripe = new stripe_1.Stripe(variables.SECRET_KEY);
                    sessionId = ((_c = (_b = data === null || data === void 0 ? void 0 : data.payment) === null || _b === void 0 ? void 0 : _b.transaction) === null || _c === void 0 ? void 0 : _c.id) ||
                        ((_e = (_d = data === null || data === void 0 ? void 0 : data.payment) === null || _d === void 0 ? void 0 : _d.transaction) === null || _e === void 0 ? void 0 : _e.order_number) ||
                        ((_g = (_f = data === null || data === void 0 ? void 0 : data.payment) === null || _f === void 0 ? void 0 : _f.transaction) === null || _g === void 0 ? void 0 : _g.sid);
                    if (!sessionId) {
                        throw new Error("Stripe session id not found");
                    }
                    return [4 /*yield*/, stripe.checkout.sessions.retrieve(sessionId, {
                            expand: ['payment_intent', 'total_details.breakdown.discounts', 'total_details.breakdown.taxes']
                        })];
                case 1:
                    session = _q.sent();
                    isPaid = session.payment_status === 'paid' || session.status === 'complete';
                    paidAmount = (_h = session.amount_total) !== null && _h !== void 0 ? _h : 0;
                    paidCurrency = ((_j = session.currency) !== null && _j !== void 0 ? _j : '').toUpperCase();
                    expected = toStripeAmount(data.payment.amount, data.payment.currency);
                    amountsMatch = paidAmount === expected.value && paidCurrency === expected.code;
                    if (isPaid && amountsMatch) {
                        pi = session.payment_intent;
                        return [2 /*return*/, {
                                status: true,
                                transaction: {
                                    id: session.id,
                                    status: 'PAID',
                                    amount: paidAmount,
                                    currency: paidCurrency,
                                    payment_intent: (_k = pi === null || pi === void 0 ? void 0 : pi.id) !== null && _k !== void 0 ? _k : null,
                                    charge_id: (_l = pi === null || pi === void 0 ? void 0 : pi.latest_charge) !== null && _l !== void 0 ? _l : null,
                                    receipt_url: ((pi === null || pi === void 0 ? void 0 : pi.latest_charge) && typeof (pi === null || pi === void 0 ? void 0 : pi.latest_charge) !== 'string')
                                        ? (_o = (_m = pi === null || pi === void 0 ? void 0 : pi.latest_charge) === null || _m === void 0 ? void 0 : _m.receipt_url) !== null && _o !== void 0 ? _o : null
                                        : null,
                                    customer: (_p = session.customer) !== null && _p !== void 0 ? _p : null,
                                }
                            }];
                    }
                    else {
                        return [2 /*return*/, {
                                status: false,
                                error: "Payment not captured or amount mismatch. status=".concat(session.payment_status, ", paidAmount=").concat(paidAmount, " ").concat(paidCurrency)
                            }];
                    }
                    return [3 /*break*/, 3];
                case 2:
                    error_2 = _q.sent();
                    return [2 /*return*/, { status: false, error: error_2 }];
                case 3: return [2 /*return*/];
            }
        });
    });
});
var runPlugin = function (inputData) { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, starter.executeHook(inputData.hook, inputData.data)];
            case 1:
                result = _a.sent();
                return [2 /*return*/, result];
        }
    });
}); };
process_1.default.stdin.on('data', function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var msg, result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                msg = JSON.parse(input.toString());
                return [4 /*yield*/, runPlugin(msg)];
            case 1:
                result = _a.sent();
                starter.response({ status: result === null || result === void 0 ? void 0 : result.status, data: result });
                return [2 /*return*/];
        }
    });
}); });
