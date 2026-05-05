import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api } from '../../services/api';
import './TopUpModal.css';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const PRESET_AMOUNTS = [5, 10, 20, 50, 100];


const CheckoutForm: React.FC<{ amount: number; onSuccess: () => void; onCancel: () => void }> = ({
    amount, onSuccess, onCancel,
}) => {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setLoading(true);
        setError('');

        const { error: submitErr } = await elements.submit();
        if (submitErr) { setError(submitErr.message || 'Ошибка'); setLoading(false); return; }

  
        const result = await stripe.confirmPayment({
            elements,
            confirmParams: { return_url: window.location.href },
            redirect: 'if_required',
        });

        if (result.error) {
            setError(result.error.message || 'Платеж не удался');
            setLoading(false);
        } else {
            onSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} className="tum-form">
            <PaymentElement />
            {error && <div className="tum-error">{error}</div>}
            <div className="tum-actions">
                <button type="button" className="tum-cancel" onClick={onCancel} disabled={loading}>
                    Отмена
                </button>
                <button type="submit" className="tum-pay" disabled={!stripe || loading}>
                    {loading ? 'Обработка...' : `Оплатить $${amount.toFixed(2)}`}
                </button>
            </div>
        </form>
    );
};


interface TopUpModalProps {
    onClose: () => void;
    onSuccess: (newBalance: number) => void;
}

const TopUpModal: React.FC<TopUpModalProps> = ({ onClose, onSuccess }) => {
    const [amount, setAmount] = useState<number>(10);
    const [customAmount, setCustomAmount] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [paymentIntentId, setPaymentIntentId] = useState('');
    const [step, setStep] = useState<'select' | 'pay' | 'done'>('select');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const finalAmount = customAmount ? parseFloat(customAmount) : amount;

    const handleProceed = async () => {
        if (!finalAmount || finalAmount < 1) return setError('Минимальная сумма — $1');
        if (finalAmount > 10000) return setError('Максимальная сумма — $10,000');
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/payments/create-topup-intent', { amount: finalAmount });
            setClientSecret(res.data.clientSecret);
            setPaymentIntentId(res.data.clientSecret.split('_secret_')[0]);
            setStep('pay');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Не удалось инициализировать платеж');
        } finally {
            setLoading(false);
        }
    };

    const handleSuccess = async () => {
        setStep('done');
        try {
            const res = await api.post('/payments/confirm-topup', { paymentIntentId });
            onSuccess(res.data.balance);
        } catch {
            try {
                const res = await api.get('/payments/balance');
                onSuccess(res.data.balance);
            } catch {
                onSuccess(0);
            }
        }
    };

    return (
        <div className="tum-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="tum-modal">
                <div className="tum-header">
                    <h2 className="tum-title">Пополнить баланс</h2>
                    <button className="tum-close" onClick={onClose}>✕</button>
                </div>

                {step === 'select' && (
                    <div className="tum-body">
                        <p className="tum-label">Выберите сумму</p>
                        <div className="tum-presets">
                            {PRESET_AMOUNTS.map(a => (
                                <button
                                    key={a}
                                    className={`tum-preset ${!customAmount && amount === a ? 'tum-preset-active' : ''}`}
                                    onClick={() => { setAmount(a); setCustomAmount(''); }}
                                >
                                    ${a}
                                </button>
                            ))}
                        </div>
                        <div className="tum-custom-row">
                            <span className="tum-dollar">$</span>
                            <input
                                className="tum-custom-input"
                                type="number"
                                min="1"
                                max="10000"
                                step="0.01"
                                placeholder="Сумма пополнения"
                                value={customAmount}
                                onChange={e => setCustomAmount(e.target.value)}
                            />
                        </div>
                        {error && <div className="tum-error">{error}</div>}
                        <button
                            className="tum-pay"
                            onClick={handleProceed}
                            disabled={loading || !finalAmount || finalAmount < 1}
                        >
                            {loading ? 'Загрузка...' : `Продолжить — $${(finalAmount || 0).toFixed(2)}`}
                        </button>
                    </div>
                )}

                {step === 'pay' && clientSecret && (
                    <div className="tum-body">
                        <p className="tum-amount-display">Добавляем <strong>${finalAmount.toFixed(2)}</strong> к вашему балансу</p>
                        <Elements
                            stripe={stripePromise}
                            options={{
                                clientSecret,
                                appearance: {
                                    theme: 'night',
                                    variables: {
                                        colorPrimary: '#58a6ff',
                                        colorBackground: '#0d1117',
                                        colorText: '#e6edf3',
                                        borderRadius: '8px',
                                    },
                                },
                            }}
                        >
                            <CheckoutForm
                                amount={finalAmount}
                                onSuccess={handleSuccess}
                                onCancel={() => setStep('select')}
                            />
                        </Elements>
                    </div>
                )}

                {step === 'done' && (
                    <div className="tum-body tum-done">
                        <div className="tum-check">✓</div>
                        <p className="tum-done-text">Платеж успешно выполнен!</p>
                        <p className="tum-done-sub">${finalAmount.toFixed(2)} добавлено к вашему балансу.</p>
                        <button className="tum-pay" onClick={onClose}>Закрыть</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TopUpModal;
