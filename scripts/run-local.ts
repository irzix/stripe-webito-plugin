import { runPlugin } from '../src/index';
import dotenv from 'dotenv';

dotenv.config();

async function main() {

    const SECRET_KEY = process.env.STRIPE_SECRET;

    const input = {
        hook: 'paymentsCreate',
        data: {
            variables: { SECRET_KEY : SECRET_KEY },
            data: {
                amount: 10,
                gateway: { currency: { code: 'EUR' } },
                order: { ordernumber: 'ORD-LOCAL' },
                callback: 'https://webito.co/callback',
                payment: 987
            }
        }
    };

    const result = await runPlugin(input as any);
    
    console.log('RESULT', JSON.stringify(result, null, 2));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});


