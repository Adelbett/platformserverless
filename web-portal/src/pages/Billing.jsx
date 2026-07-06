import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AreaChart, Area,
    XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { appsApi, kafkaApi, billingApi, paymentApi } from '../api';
import { useAuth } from '../context/AuthContext';
import {
    CreditCard, Cpu, MemoryStick,
    TrendingUp, Package, Database, RefreshCw,
    Info, Zap, Clock, Download, Trash2, Plus, CheckCircle, XCircle, AlertCircle,
} from 'lucide-react';

const PRICE = {
    cpuPerVcpuHour: 0.048,
    memPerGBHour:   0.006,
    kafkaPerTopic:  2.00,
    HOURS_MONTH:    720,
};

const parseVcpu = (s = '100m') => {
    s = String(s || '100m').trim();
    return s.endsWith('m') ? parseInt(s) / 1000 : parseFloat(s) || 0.1;
};
const parseGb = (s = '128Mi') => {
    s = String(s || '128Mi').trim();
    if (s.endsWith('Gi')) return parseFloat(s) * 1.074;
    if (s.endsWith('Mi')) return parseFloat(s) / 1024;
    return parseFloat(s) / 1024 || 0.128;
};
const uptimeFactor = (app) =>
    app.status === 'RUNNING' ? 1.0 : app.status === 'FAILED' ? 0.0 : 0.2;
const appHourly = (app) => {
    const pods = Math.max(app.minReplicas ?? 0, 1);
    return (parseVcpu(app.cpuRequest) * PRICE.cpuPerVcpuHour +
            parseGb(app.memoryRequest) * PRICE.memPerGBHour) * pods * uptimeFactor(app);
};

const fmtUsd = (n, d = 4) => `$${Number(n || 0).toFixed(d)}`;
const now        = new Date();
const dayOfMonth = now.getDate();
const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const hoursElapsed = (dayOfMonth - 1) * 24 + now.getHours() + 1;

const CostTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#0A0F1A', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 13px' }}>
            <p style={{ fontSize: 10, color: '#64748B', margin: '0 0 3px', fontFamily: "'JetBrains Mono', monospace" }}>{label}</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#3B82F6', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>{fmtUsd(payload[0].value, 5)}</p>
        </div>
    );
};

const MetricCard = ({ label, value, sub, color, icon: Icon, highlight }) => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: highlight ? `${color}10` : 'rgba(255,255,255,0.02)', border: `1px solid ${highlight ? color + '40' : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} color={color} />
            </div>
        </div>
        <p style={{ fontSize: 22, fontWeight: 900, color: highlight ? color : '#F1F5F9', margin: '0 0 3px', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em' }}>{value}</p>
        <p style={{ fontSize: 10, color: '#334155', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>{sub}</p>
    </motion.div>
);

// ── Stripe card element style ──────────────────────────────────────────────
const CARD_STYLE = {
    style: {
        base: {
            color: '#F1F5F9', fontSize: '14px', fontFamily: "'JetBrains Mono', monospace",
            '::placeholder': { color: '#475569' },
            iconColor: '#3B82F6',
        },
        invalid: { color: '#EF4444', iconColor: '#EF4444' },
    },
};

// ── Add Card Form (needs Stripe Elements context) ──────────────────────────
const AddCardForm = ({ onSuccess, onCancel }) => {
    const stripe   = useStripe();
    const elements = useElements();
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState(null);

    const submit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setSaving(true);
        setError(null);
        try {
            const { data } = await paymentApi.createSetupIntent();
            const result = await stripe.confirmCardSetup(data.clientSecret, {
                payment_method: { card: elements.getElement(CardElement) },
            });
            if (result.error) { setError(result.error.message); }
            else               { onSuccess(); }
        } catch (err) {
            setError('Failed to save card. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.04)' }}>
                <CardElement options={CARD_STYLE} />
            </div>
            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#EF4444' }}>
                    <XCircle size={14} /> {error}
                </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" disabled={saving || !stripe}
                    style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
                    {saving ? 'Saving…' : 'Save Card'}
                </button>
                <button type="button" onClick={onCancel}
                    style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94A3B8', cursor: 'pointer', fontSize: 13 }}>
                    Cancel
                </button>
            </div>
        </form>
    );
};

// ── Pay Invoice Form ───────────────────────────────────────────────────────
const PayInvoiceForm = ({ amount, methods, onSuccess }) => {
    const stripe              = useStripe();
    const elements            = useElements();
    const [selectedMethod, setSelectedMethod] = useState(methods[0]?.id || 'new');
    const [paying, setPaying] = useState(false);
    const [error,  setError]  = useState(null);
    const [done,   setDone]   = useState(false);

    const pay = async (e) => {
        e.preventDefault();
        setPaying(true); setError(null);
        try {
            if (selectedMethod !== 'new') {
                const { data } = await paymentApi.pay({
                    amount,
                    paymentMethodId: selectedMethod,
                    description: `Platform invoice — ${new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' })}`,
                });
                if (data.status === 'succeeded') { setDone(true); onSuccess(data); }
                else setError(`Payment status: ${data.status}`);
            } else {
                // new card flow
                const { data: intentData } = await paymentApi.pay({
                    amount,
                    description: `Platform invoice — ${new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' })}`,
                });
                const result = await stripe.confirmCardPayment(intentData.clientSecret, {
                    payment_method: { card: elements.getElement(CardElement) },
                });
                if (result.error) setError(result.error.message);
                else { setDone(true); onSuccess(result.paymentIntent); }
            }
        } catch { setError('Payment failed. Please try again.'); }
        finally   { setPaying(false); }
    };

    if (done) return (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle size={40} style={{ color: '#10B981', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontSize: 16, fontWeight: 700, color: '#10B981', margin: 0 }}>Payment successful!</p>
            <p style={{ fontSize: 12, color: '#475569', margin: '6px 0 0' }}>{fmtUsd(amount, 2)} charged</p>
        </div>
    );

    return (
        <form onSubmit={pay} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {methods.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {methods.map(m => (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1px solid ${selectedMethod === m.id ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer', background: selectedMethod === m.id ? 'rgba(59,130,246,0.07)' : 'transparent' }}>
                            <input type="radio" name="method" value={m.id} checked={selectedMethod === m.id} onChange={() => setSelectedMethod(m.id)} style={{ accentColor: '#3B82F6' }} />
                            <CreditCard size={14} style={{ color: '#3B82F6' }} />
                            <span style={{ fontSize: 13, color: '#F1F5F9' }}>{m.brand?.toUpperCase()} •••• {m.last4}</span>
                            <span style={{ fontSize: 11, color: '#475569', marginLeft: 'auto' }}>{m.expMonth}/{m.expYear}</span>
                        </label>
                    ))}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: `1px solid ${selectedMethod === 'new' ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.08)'}`, cursor: 'pointer' }}>
                        <input type="radio" name="method" value="new" checked={selectedMethod === 'new'} onChange={() => setSelectedMethod('new')} style={{ accentColor: '#3B82F6' }} />
                        <Plus size={14} style={{ color: '#94A3B8' }} />
                        <span style={{ fontSize: 13, color: '#94A3B8' }}>Use a new card</span>
                    </label>
                </div>
            )}
            {(selectedMethod === 'new' || methods.length === 0) && (
                <div style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.04)' }}>
                    <CardElement options={CARD_STYLE} />
                </div>
            )}
            {error && <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#EF4444', alignItems: 'center' }}><XCircle size={13} />{error}</div>}
            <button type="submit" disabled={paying || !stripe}
                style={{ padding: '12px', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: 14, opacity: paying ? 0.6 : 1 }}>
                {paying ? 'Processing…' : `Pay ${fmtUsd(amount, 2)}`}
            </button>
        </form>
    );
};

// ── Payment Tab ────────────────────────────────────────────────────────────
const PaymentTab = ({ mtdCost }) => {
    const [stripePromise, setStripePromise] = useState(null);
    const [methods,   setMethods]   = useState([]);
    const [txHistory, setTxHistory] = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [showAddCard, setShowAddCard] = useState(false);
    const [showPayNow,  setShowPayNow]  = useState(false);

    useEffect(() => {
        paymentApi.getConfig().then(({ data }) => {
            if (data.publishableKey && !data.publishableKey.includes('REPLACE_ME')) {
                setStripePromise(loadStripe(data.publishableKey));
            }
        }).catch(() => {});
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [mRes, tRes] = await Promise.allSettled([
                paymentApi.listMethods(),
                paymentApi.getTransactions(),
            ]);
            if (mRes.status === 'fulfilled') setMethods(mRes.value.data || []);
            if (tRes.status === 'fulfilled') setTxHistory(tRes.value.data || []);
        } finally { setLoading(false); }
    };

    const removeMethod = async (id) => {
        await paymentApi.deleteMethod(id);
        setMethods(prev => prev.filter(m => m.id !== id));
    };

    const statusIcon = (s) => {
        if (s === 'succeeded') return <CheckCircle size={13} style={{ color: '#10B981' }} />;
        if (s === 'failed')    return <XCircle     size={13} style={{ color: '#EF4444' }} />;
        return                        <AlertCircle size={13} style={{ color: '#F59E0B' }} />;
    };
    const statusColor = (s) => s === 'succeeded' ? '#10B981' : s === 'failed' ? '#EF4444' : '#F59E0B';

    if (!stripePromise) return (
        <div style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
            <CreditCard size={32} style={{ display: 'block', margin: '0 auto 12px', color: '#334155' }} />
            <p style={{ fontSize: 13, margin: 0 }}>Stripe not configured.</p>
            <p style={{ fontSize: 11, margin: '6px 0 0', color: '#334155' }}>
                Set <code style={{ color: '#3B82F6' }}>STRIPE_SECRET_KEY</code> and <code style={{ color: '#3B82F6' }}>STRIPE_PUBLISHABLE_KEY</code> in your deployment.
            </p>
        </div>
    );

    return (
        <Elements stripe={stripePromise}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Balance + Pay Now */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 14, padding: '20px 22px' }}>
                        <p style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px', fontFamily: "'JetBrains Mono', monospace" }}>Amount due this month</p>
                        <p style={{ fontSize: 34, fontWeight: 900, color: '#3B82F6', margin: '0 0 4px', fontFamily: "'Outfit', sans-serif" }}>{fmtUsd(mtdCost, 2)}</p>
                        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>{new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '20px 22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ fontSize: 11, color: '#475569', margin: '0 0 6px' }}>Pay your current invoice instantly with a saved card or a new card.</p>
                        </div>
                        <button onClick={() => setShowPayNow(v => !v)}
                            style={{ padding: '10px 0', borderRadius: 8, border: 'none', background: '#3B82F6', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                            {showPayNow ? 'Cancel' : '💳 Pay Now'}
                        </button>
                    </div>
                </div>

                {showPayNow && (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 14, padding: '20px 22px' }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: '0 0 16px' }}>Pay Invoice — {fmtUsd(mtdCost, 2)}</h4>
                        <PayInvoiceForm amount={mtdCost} methods={methods} onSuccess={() => { setShowPayNow(false); loadData(); }} />
                    </div>
                )}

                {/* Saved payment methods */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <CreditCard size={14} style={{ color: '#3B82F6' }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>Payment Methods</span>
                            <span style={{ fontSize: 11, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>{methods.length} saved</span>
                        </div>
                        <button onClick={() => setShowAddCard(v => !v)}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(59,130,246,0.35)', background: showAddCard ? 'rgba(59,130,246,0.15)' : 'transparent', color: '#3B82F6', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            <Plus size={12} /> Add Card
                        </button>
                    </div>

                    {showAddCard && (
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <AddCardForm onSuccess={() => { setShowAddCard(false); loadData(); }} onCancel={() => setShowAddCard(false)} />
                        </div>
                    )}

                    <div style={{ padding: methods.length === 0 && !showAddCard ? 32 : 0 }}>
                        {loading ? (
                            <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 12 }}>Loading…</div>
                        ) : methods.length === 0 && !showAddCard ? (
                            <div style={{ textAlign: 'center', color: '#475569', fontSize: 12 }}>
                                <CreditCard size={24} style={{ display: 'block', margin: '0 auto 8px', color: '#334155' }} />
                                No payment methods saved
                            </div>
                        ) : methods.map(m => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <div style={{ width: 40, height: 26, borderRadius: 5, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CreditCard size={14} style={{ color: '#3B82F6' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{m.brand?.toUpperCase()} •••• {m.last4}</p>
                                    <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>Expires {m.expMonth}/{m.expYear}</p>
                                </div>
                                <button onClick={() => removeMethod(m.id)}
                                    style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: '#EF4444', cursor: 'pointer', fontSize: 11 }}>
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Transaction history */}
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>Transaction History</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {['Date', 'Description', 'Card', 'Amount', 'Status'].map((h, i) => (
                                <th key={h} style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#334155', textAlign: i >= 3 ? 'right' : 'left' }}>{h}</th>
                            ))}
                        </tr></thead>
                        <tbody>
                            {txHistory.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', fontSize: 12, color: '#475569' }}>No transactions yet</td></tr>
                            ) : txHistory.map(tx => (
                                <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                    <td style={{ padding: '11px 16px', fontSize: 11, color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
                                        {new Date(tx.createdAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td style={{ padding: '11px 16px', fontSize: 12, color: '#94A3B8' }}>{tx.description || '—'}</td>
                                    <td style={{ padding: '11px 16px', fontSize: 11, color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
                                        {tx.cardBrand && tx.cardLast4 ? `${tx.cardBrand.toUpperCase()} ••${tx.cardLast4}` : '—'}
                                    </td>
                                    <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#F1F5F9', fontFamily: "'JetBrains Mono', monospace" }}>
                                        {fmtUsd(tx.amount, 2)}
                                    </td>
                                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: statusColor(tx.status), background: `${statusColor(tx.status)}12`, border: `1px solid ${statusColor(tx.status)}25`, padding: '2px 8px', borderRadius: 999 }}>
                                            {statusIcon(tx.status)} {tx.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

            </div>
        </Elements>
    );
};

const Billing = () => {
    const { user } = useAuth();
    const [apps,       setApps]       = useState([]);
    const [topics,     setTopics]     = useState([]);
    const [history,    setHistory]    = useState(null); // from backend
    const [loading,    setLoading]    = useState(true);
    const [tab,        setTab]        = useState('overview');
    const [realData,   setRealData]   = useState(false); // true when backend returned history

    const load = async () => {
        setLoading(true);
        try {
            const [ar, kr, hr] = await Promise.allSettled([
                appsApi.list(),
                kafkaApi.list(),
                billingApi.getMyBilling(),
            ]);
            if (ar.status === 'fulfilled') setApps(ar.value.data || []);
            if (kr.status === 'fulfilled') setTopics(kr.value.data || []);
            if (hr.status === 'fulfilled') {
                setHistory(hr.value.data);
                setRealData(true);
            }
        } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const handleExport = async () => {
        try {
            const res = await billingApi.exportExcel();
            const url = URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `billing-${now.toISOString().slice(0,10)}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed', e);
        }
    };

    // ── Current-rate calculations from live app data ───────────────────────────
    const enriched = useMemo(() => apps.map(a => ({
        ...a,
        vcpu:    parseVcpu(a.cpuRequest),
        ramGb:   parseGb(a.memoryRequest),
        uptime:  uptimeFactor(a),
        hourly:  appHourly(a),
    })), [apps]);

    const totalHourly    = enriched.reduce((s, a) => s + a.hourly, 0);
    const totalKafkaMo   = topics.length * PRICE.kafkaPerTopic;
    const totalKafkaH    = totalKafkaMo / PRICE.HOURS_MONTH;
    const totalHourlyAll = totalHourly + totalKafkaH;

    // Prefer real backend data when available
    const mtdCost       = realData ? (history?.mtdCost ?? 0) : totalHourlyAll * hoursElapsed;
    const projectedEOM  = realData ? (history?.projectedMonthly ?? 0) : totalHourlyAll * daysInMonth * 24;
    const totalVcpu     = enriched.reduce((s, a) => s + a.vcpu * Math.max(a.minReplicas ?? 0, 1), 0);
    const totalRamGb    = enriched.reduce((s, a) => s + a.ramGb * Math.max(a.minReplicas ?? 0, 1), 0);

    // Daily chart — real data if available, otherwise estimate from current rate
    const chartData = useMemo(() => {
        if (realData && history?.dailyHistory?.length) {
            return history.dailyHistory.map(d => ({
                label: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
                cost: d.cost,
            }));
        }
        // Fallback: single point for today
        return [{ label: now.toLocaleDateString('en', { month: 'short', day: 'numeric' }), cost: mtdCost }];
    }, [realData, history, mtdCost]);

    // Per-app breakdown — prefer real history, fall back to live rate
    const perAppData = useMemo(() => {
        if (realData && history?.perApp?.length) return history.perApp;
        return enriched.map(a => ({
            appId: a.id,
            serviceName: a.serviceName || a.name,
            namespace: a.namespace,
            mtdCost: a.hourly * hoursElapsed,
            projectedMonthly: a.hourly * PRICE.HOURS_MONTH,
        }));
    }, [realData, history, enriched]);

    const pieData = [
        { name: 'CPU',    value: enriched.reduce((s, a) => s + a.vcpu * PRICE.cpuPerVcpuHour * Math.max(a.minReplicas ?? 0, 1) * a.uptime * PRICE.HOURS_MONTH, 0), color: '#3B82F6' },
        { name: 'Memory', value: enriched.reduce((s, a) => s + a.ramGb * PRICE.memPerGBHour  * Math.max(a.minReplicas ?? 0, 1) * a.uptime * PRICE.HOURS_MONTH, 0), color: '#8B5CF6' },
        { name: 'Kafka',  value: totalKafkaMo, color: '#F59E0B' },
    ].filter(d => d.value > 0);

    const totalMonthly = enriched.reduce((s, a) => s + a.hourly * PRICE.HOURS_MONTH, 0) + totalKafkaMo;

    const TABS = [
        { key: 'overview',  label: 'Overview'    },
        { key: 'breakdown', label: 'Per Service'  },
        { key: 'invoice',   label: 'This Month'  },
        { key: 'payment',   label: '💳 Payment'  },
    ];

    return (
        <div style={{ maxWidth: 1100 }}>
            {/* Header */}
            <div style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.18em', textTransform: 'uppercase', color: '#3B82F6', margin: '0 0 5px' }}>
                    Pay as you go
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#F1F5F9', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                            Usage & Billing
                        </h1>
                        <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                            {realData
                                ? <span style={{ color: '#10B981' }}>● Real data from billing history</span>
                                : <span style={{ color: '#F59E0B' }}>● Estimated from current resources — history accumulates hourly</span>}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
                            {now.toLocaleDateString('en', { month: 'long', year: 'numeric' })} · day {dayOfMonth}/{daysInMonth}
                        </span>
                        <button onClick={load} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                        <button onClick={handleExport} style={{ height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)', color: '#10B981', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                            <Download size={13} /> Export Excel
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, marginBottom: 22, width: 'fit-content' }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', background: tab === t.key ? 'rgba(255,255,255,0.1)' : 'transparent', color: tab === t.key ? '#F1F5F9' : '#475569', transition: 'all 0.15s' }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══ OVERVIEW ══ */}
            {tab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px,1fr))', gap: 12 }}>
                        <MetricCard highlight label="Cost so far"         value={fmtUsd(mtdCost, 4)}              sub={`${hoursElapsed}h elapsed`}                                    color="#3B82F6" icon={CreditCard} />
                        <MetricCard           label="Projected this month" value={fmtUsd(projectedEOM, 4)}        sub="at current rate"                                               color="#8B5CF6" icon={TrendingUp} />
                        <MetricCard           label="Rate right now"       value={`${fmtUsd(totalHourlyAll, 5)}/h`} sub="live consumption"                                           color="#10B981" icon={Zap}        />
                        <MetricCard           label="vCPU allocated"       value={totalVcpu.toFixed(2)}            sub={`${apps.length} service${apps.length !== 1 ? 's' : ''}`}     color="#06B6D4" icon={Cpu}        />
                        <MetricCard           label="RAM allocated"        value={`${totalRamGb.toFixed(2)} GiB`}  sub="across all pods"                                             color="#A855F7" icon={MemoryStick} />
                        <MetricCard           label="Kafka topics"         value={topics.length}                   sub={`${fmtUsd(totalKafkaMo, 2)}/mo`}                             color="#F59E0B" icon={Database}   />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14 }}>
                        {/* Area chart */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: '0 0 2px', fontFamily: "'Outfit', sans-serif" }}>
                                        Daily Cost {realData ? '— Real History' : '— Accumulating…'}
                                    </p>
                                    <p style={{ fontSize: 10, color: '#475569', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                                        {realData ? `${chartData.length} days recorded` : 'Snapshots saved every hour — graph fills over time'}
                                    </p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: 18, fontWeight: 900, color: '#3B82F6', margin: 0, fontFamily: "'Outfit', sans-serif" }}>{fmtUsd(projectedEOM, 4)}</p>
                                    <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>projected/mo</p>
                                </div>
                            </div>
                            {chartData.length < 2 ? (
                                <div style={{ height: 155, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                    <RefreshCw size={18} color="#334155" />
                                    <p style={{ fontSize: 11, color: '#475569', margin: 0, textAlign: 'center' }}>
                                        Billing snapshots are saved every hour.<br />
                                        The chart will appear after a few hours.
                                    </p>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height={155}>
                                    <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.28} />
                                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}    />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#334155' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                                        <YAxis tick={{ fontSize: 9, fill: '#334155' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(3)}`} />
                                        <Tooltip content={<CostTooltip />} />
                                        <Area type="monotone" dataKey="cost" stroke="#3B82F6" strokeWidth={2} fill="url(#cg)" dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Pie */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 18px', display: 'flex', flexDirection: 'column' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: '0 0 12px', fontFamily: "'Outfit', sans-serif" }}>Cost breakdown</p>
                            {totalMonthly === 0 ? (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>No consumption yet</div>
                            ) : (
                                <>
                                    <ResponsiveContainer width="100%" height={100}>
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={26} outerRadius={44} dataKey="value" stroke="none">
                                                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                            </Pie>
                                            <Tooltip formatter={v => fmtUsd(v, 5)} contentStyle={{ background: '#0A0F1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                                        {pieData.map(d => (
                                            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                                                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{d.name}</span>
                                                </div>
                                                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: d.color, fontWeight: 600 }}>{fmtUsd(d.value, 4)}</span>
                                            </div>
                                        ))}
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 7, display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9' }}>Total/mo</span>
                                            <span style={{ fontSize: 12, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#F1F5F9' }}>{fmtUsd(totalMonthly, 4)}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Pricing info */}
                    <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <Info size={14} style={{ color: '#3B82F6', flexShrink: 0, marginTop: 1 }} />
                        <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.7 }}>
                            <strong style={{ color: '#F1F5F9' }}>Pay-as-you-go:</strong>
                            <span style={{ marginLeft: 10, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6' }}>${PRICE.cpuPerVcpuHour}/vCPU-h</span>
                            <span style={{ margin: '0 6px', color: '#334155' }}>·</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8B5CF6' }}>${PRICE.memPerGBHour}/GiB-h</span>
                            <span style={{ margin: '0 6px', color: '#334155' }}>·</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B' }}>${PRICE.kafkaPerTopic}/topic/mo</span>
                            <span style={{ marginLeft: 10, color: '#475569' }}>Scale-to-zero services billed at 20% when idle.</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ PER SERVICE ══ */}
            {tab === 'breakdown' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['Service', 'Status', 'vCPU', 'RAM', 'Uptime', 'Cost MTD', '$/month'].map((h, i) => (
                                        <th key={h} style={{ padding: '11px 16px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155', textAlign: i >= 5 ? 'right' : 'left', background: 'rgba(255,255,255,0.01)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
                                        <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 10px', color: '#334155' }} />Loading…
                                    </td></tr>
                                ) : perAppData.length === 0 ? (
                                    <tr><td colSpan={7} style={{ padding: 52, textAlign: 'center' }}>
                                        <Package size={30} style={{ display: 'block', margin: '0 auto 12px', color: '#334155' }} />
                                        <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>No services deployed.</p>
                                    </td></tr>
                                ) : perAppData.map((item, i) => {
                                    const app = enriched.find(a => a.id === item.appId || (a.serviceName || a.name) === item.serviceName);
                                    const isDeleted   = item.deleted === true;
                                    const statusColor = isDeleted ? '#EF4444' : app?.status === 'RUNNING' ? '#10B981' : app?.status === 'FAILED' ? '#EF4444' : '#6B7280';
                                    return (
                                        <motion.tr key={item.appId || i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                                            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: "'Outfit', sans-serif" }}>{item.serviceName}</p>
                                                <p style={{ fontSize: 9, margin: '2px 0 0', color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>{item.namespace}</p>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                {isDeleted
                                                    ? <span style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', padding: '2px 8px', borderRadius: 999 }}>✕ DELETED</span>
                                                    : app && <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, background: `${statusColor}12`, border: `1px solid ${statusColor}30`, padding: '2px 8px', borderRadius: 999 }}>● {app.status}</span>
                                                }
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#06B6D4' }}>
                                                {app ? app.vcpu.toFixed(3) : '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#A855F7' }}>
                                                {app ? `${app.ramGb.toFixed(3)} GiB` : '—'}
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                                                        <div style={{ height: '100%', width: `${(app?.uptime ?? 0.2) * 100}%`, background: (app?.uptime ?? 0) === 1 ? '#10B981' : '#F59E0B', borderRadius: 99 }} />
                                                    </div>
                                                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{((app?.uptime ?? 0.2) * 100).toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6' }}>
                                                {fmtUsd(item.mtdCost, 5)}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#F1F5F9' }}>
                                                {fmtUsd(item.projectedMonthly, 4)}
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Kafka */}
                    {topics.length > 0 && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Database size={14} color="#F59E0B" />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', fontFamily: "'Outfit', sans-serif" }}>Kafka Topics</span>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 900, color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>{fmtUsd(totalKafkaMo, 2)}/mo</span>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {topics.map(t => (
                                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '11px 16px', fontSize: 12, fontWeight: 700, color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>{t.name}</td>
                                            <td style={{ padding: '11px 16px', fontSize: 11, color: '#94A3B8' }}>{t.partitions ?? '—'} partitions</td>
                                            <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B' }}>{fmtUsd(PRICE.kafkaPerTopic, 2)}/mo</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ══ PAYMENT ══ */}
            {tab === 'payment' && <PaymentTab mtdCost={mtdCost} />}

            {/* ══ THIS MONTH ══ */}
            {tab === 'invoice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, overflow: 'hidden' }}>
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 4px' }}>Invoice · Pay as you go</p>
                                <p style={{ fontSize: 18, fontWeight: 900, color: '#F1F5F9', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
                                    {now.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: 10, color: '#475569', margin: '0 0 4px', fontFamily: "'JetBrains Mono', monospace" }}>
                                    {user?.username} · day {dayOfMonth}/{daysInMonth}
                                </p>
                                <span style={{ fontSize: 11, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '3px 10px', borderRadius: 999, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                                    IN PROGRESS
                                </span>
                            </div>
                        </div>
                        <div style={{ padding: '16px 24px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        {['Description', 'Hours', 'Unit Price', 'Amount'].map((h, i, a) => (
                                            <th key={h} style={{ padding: '8px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#334155', textAlign: i === a.length - 1 ? 'right' : 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {perAppData.map(item => {
                                        const app = enriched.find(a => a.id === item.appId || (a.serviceName || a.name) === item.serviceName);
                                        return (
                                            <tr key={item.appId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <td style={{ padding: '10px 0' }}>
                                                    <p style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', margin: 0 }}>{item.serviceName}</p>
                                                    <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
                                                        {app ? `${app.vcpu.toFixed(3)} vCPU · ${app.ramGb.toFixed(3)} GiB · ${((app.uptime) * 100).toFixed(0)}% uptime` : item.namespace}
                                                    </p>
                                                </td>
                                                <td style={{ padding: '10px 0', fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8', fontSize: 11 }}>
                                                    {hoursElapsed}h
                                                </td>
                                                <td style={{ padding: '10px 0', fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8', fontSize: 11 }}>
                                                    {app ? fmtUsd(app.hourly, 6) : '—'}/h
                                                </td>
                                                <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#F1F5F9', fontWeight: 600 }}>
                                                    {fmtUsd(item.mtdCost, 5)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {topics.map(t => (
                                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '10px 0' }}>
                                                <p style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B', margin: 0 }}>{t.name}</p>
                                                <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0' }}>Kafka topic</p>
                                            </td>
                                            <td style={{ padding: '10px 0', fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8', fontSize: 11 }}>{hoursElapsed}h</td>
                                            <td style={{ padding: '10px 0', fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8', fontSize: 11 }}>{fmtUsd(PRICE.kafkaPerTopic / PRICE.HOURS_MONTH, 6)}/h</td>
                                            <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B', fontWeight: 600 }}>
                                                {fmtUsd((PRICE.kafkaPerTopic / PRICE.HOURS_MONTH) * hoursElapsed, 5)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                        <td colSpan={3} style={{ padding: '14px 0', fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
                                            <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                                            {realData ? 'Real billing history' : 'Estimated'} · {dayOfMonth} days ({hoursElapsed}h)
                                        </td>
                                        <td style={{ padding: '14px 0', textAlign: 'right', fontSize: 14, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6' }}>{fmtUsd(mtdCost, 5)}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} style={{ padding: '4px 0 14px', fontSize: 12, color: '#475569' }}>Projected end-of-month</td>
                                        <td style={{ padding: '4px 0 14px', textAlign: 'right', fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: '#8B5CF6', fontWeight: 700 }}>{fmtUsd(projectedEOM, 4)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Billing;
