import express from 'express';
import Stripe from 'stripe';
import { authenticateToken } from '../middleware/auth.js';
import { getUserBalance, addToBalance } from '../database.js';

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /payments/create-topup-intent
router.post('/create-topup-intent', authenticateToken, async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || isNaN(amount) || amount < 1 || amount > 10000) {
            return res.status(400).json({ error: 'Amount must be between $1 and $10,000' });
        }

        const amountCents = Math.round(parseFloat(amount) * 100);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountCents,
            currency: 'usd',
            payment_method_types: ['card'],
            metadata: {
                userId: String(req.user.id),
                type: 'balance_topup',
            },
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
        console.error('Stripe error:', err.message);
        res.status(500).json({ error: 'Failed to create payment intent' });
    }
});

// POST /payments/confirm-topup
// Вызывается после успешной оплаты зачисляет баланс
router.post('/confirm-topup', authenticateToken, async (req, res) => {
    try {
        const { paymentIntentId } = req.body;
        if (!paymentIntentId) return res.status(400).json({ error: 'paymentIntentId required' });

        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (intent.status !== 'succeeded') {
            return res.status(400).json({ error: `Payment not completed (status: ${intent.status})` });
        }

        if (intent.metadata.userId !== String(req.user.id)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const amountDollars = intent.amount / 100;
        const newBalance = await addToBalance(req.user.id, amountDollars);

        res.json({ balance: newBalance });
    } catch (err) {
        console.error('Confirm topup error:', err.message);
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

// GET /payments/balance
router.get('/balance', authenticateToken, async (req, res) => {
    try {
        const balance = await getUserBalance(req.user.id);
        res.json({ balance });
    } catch {
        res.status(500).json({ error: 'Failed to get balance' });
    }
});

export default router;
