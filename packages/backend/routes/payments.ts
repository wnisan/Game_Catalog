import express, { Request } from 'express';
import Stripe from 'stripe';
import { authenticateToken } from '../middleware/auth.js';
import { getUserBalance, addToBalance } from '../database.js';

const router = express.Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
    throw new Error('STRIPE_SECRET_KEY is not set');
}
const stripe = new Stripe(stripeSecret);

router.post('/create-topup-intent', authenticateToken, async (req: Request<Record<string, never>, unknown, { amount?: unknown }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const amount = Number(req.body.amount);
        if (Number.isNaN(amount) || amount < 1 || amount > 10000) {
            return res.status(400).json({ error: 'Amount must be between $1 and $10,000' });
        }

        const amountCents = Math.round(amount * 100);
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: 'usd',
            payment_method_types: ['card'],
            metadata: {
                userId: String(req.user.id),
                type: 'balance_topup',
            },
        });

        return res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err: unknown) {
        console.error('Stripe error:', err instanceof Error ? err.message : 'Unknown error');
        return res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

router.post('/confirm-topup', authenticateToken, async (req: Request<Record<string, never>, unknown, { paymentIntentId?: unknown }>, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const paymentIntentId = typeof req.body.paymentIntentId === 'string' ? req.body.paymentIntentId : '';
        if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });

        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (intent.status !== 'succeeded') {
            return res.status(400).json({ error: `Payment not completed (status: ${intent.status})` });
        }

        if (intent.metadata.userId !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });

        const amountDollars = intent.amount / 100;
        const newBalance = await addToBalance(req.user.id, amountDollars);
        return res.json({ balance: newBalance });
    } catch (err: unknown) {
        console.error('Confirm topup error:', err instanceof Error ? err.message : 'Unknown error');
        return res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

router.get('/balance', authenticateToken, async (req, res) => {
    try {
        if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
        const balance = await getUserBalance(req.user.id);
        return res.json({ balance });
    } catch {
        return res.status(500).json({ error: 'Failed to get balance' });
    }
});

export default router;
