import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Ban, Play, AlertTriangle, RefreshCw, CreditCard } from 'lucide-react';
import { adminApi, invoiceApi } from '../../api';

const ClientRow = ({ client, onSuspend, onRestore }) => {
    const [loading, setLoading] = useState(false);

    const handleToggle = async () => {
        if (loading) return;
        const action = client.suspended ? onRestore : onSuspend;
        const confirm = window.confirm(
            client.suspended
                ? `Restore all services for ${client.username}?`
                : `Suspend ALL services for ${client.username}? They will receive 503 errors.`
        );
        if (!confirm) return;
        setLoading(true);
        try {
            await action(client.id);
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            <td style={{ padding: '14px 20px' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{client.username}</p>
                <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>{client.email}</p>
            </td>
            <td style={{ padding: '14px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#64748B' }}>
                {client.namespace}
            </td>
            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: client.appCount === 0 ? '#475569' : '#3B82F6',
                }}>
                    {client.appCount}
                    {client.suspendedApps > 0 && (
                        <span style={{ color: '#EF4444', marginLeft: 4 }}>({client.suspendedApps} suspended)</span>
                    )}
                </span>
            </td>
            <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                {client.suspended ? (
                    <span style={{
                        fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                        color: '#EF4444', background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        fontFamily: "'JetBrains Mono', monospace",
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>SUSPENDED</span>
                ) : (
                    <span style={{
                        fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                        color: '#10B981', background: 'rgba(16,185,129,0.12)',
                        border: '1px solid rgba(16,185,129,0.25)',
                        fontFamily: "'JetBrains Mono', monospace",
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>ACTIVE</span>
                )}
            </td>
            <td style={{ padding: '14px 20px', fontSize: 11, color: '#475569' }}>
                {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '—'}
            </td>
            <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                <button
                    onClick={handleToggle}
                    disabled={loading}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 8,
                        border: `1px solid ${client.suspended ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.25)'}`,
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: 700, fontSize: 12, opacity: loading ? 0.5 : 1,
                        background: client.suspended ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
                        color: client.suspended ? '#10B981' : '#EF4444',
                    }}
                >
                    {loading
                        ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                        : client.suspended
                            ? <><Play size={13} /> Restore</>
                            : <><Ban size={13} /> Suspend</>
                    }
                </button>
            </td>
        </motion.tr>
    );
};

const AdminClients = () => {
    const [clients,          setClients]          = useState([]);
    const [overdueInvoices,  setOverdueInvoices]  = useState([]);
    const [loading,          setLoading]          = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getClients();
            setClients(res.data || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        invoiceApi.adminOverdue().then(r => setOverdueInvoices(r.data || [])).catch(() => {});
    }, []);

    const handleSuspend = async (id) => {
        await adminApi.suspendClient(id);
        setClients(prev => prev.map(c => c.id === id ? { ...c, suspended: true, suspendedApps: c.appCount } : c));
    };

    const handleRestore = async (id) => {
        await adminApi.restoreClient(id);
        setClients(prev => prev.map(c => c.id === id ? { ...c, suspended: false, suspendedApps: 0 } : c));
    };

    const handleSuspendApp = async (appId, invoiceId) => {
        await invoiceApi.suspend(appId);
        setOverdueInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, status: 'SUSPENDED' } : i));
    };

    const suspendedCount = clients.filter(c => c.suspended).length;

    return (
        <div style={{ maxWidth: 1100 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
                <div>
                    <p style={{
                        fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                        letterSpacing: '0.18em', textTransform: 'uppercase',
                        color: '#EF4444', margin: '0 0 5px',
                    }}>Admin Console</p>
                    <h1 style={{
                        fontSize: 26, fontWeight: 900, fontFamily: "'Outfit', sans-serif",
                        color: '#F1F5F9', margin: 0, letterSpacing: '-0.02em',
                    }}>Client Management</h1>
                    <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>
                        {clients.length} client{clients.length !== 1 ? 's' : ''}
                        {suspendedCount > 0 && (
                            <span style={{ color: '#EF4444', marginLeft: 8 }}>
                                <AlertTriangle size={11} style={{ display: 'inline', marginRight: 4 }} />
                                {suspendedCount} suspended
                            </span>
                        )}
                    </p>
                </div>
                <button onClick={load} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 16px', borderRadius: 9,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'transparent', color: '#64748B',
                    cursor: 'pointer', fontSize: 12,
                }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Overdue invoices banner */}
            {overdueInvoices.filter(i => i.status !== 'SUSPENDED' && i.status !== 'PAID').length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <CreditCard size={14} color="#EF4444" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#FCA5A5' }}>Overdue Invoices — Services at risk</span>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {['Service', 'Client', 'Amount', 'Due Date', 'Status', ''].map((h, i) => (
                                <th key={i} style={{ padding: '9px 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#334155', textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                            ))}
                        </tr></thead>
                        <tbody>
                            {overdueInvoices.filter(i => i.status !== 'SUSPENDED' && i.status !== 'PAID').map(inv => (
                                <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                    <td style={{ padding: '11px 16px', fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>{inv.appName}</td>
                                    <td style={{ padding: '11px 16px', fontSize: 11, color: '#64748B' }}>{inv.userId}</td>
                                    <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#F1F5F9' }}>${Number(inv.amountUsd).toFixed(2)}</td>
                                    <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 11, color: '#EF4444', fontWeight: 700 }}>{inv.dueDate}</td>
                                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 8px', borderRadius: 999 }}>
                                            🔴 {inv.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                                        <button onClick={() => handleSuspendApp(inv.appId, inv.id)}
                                            style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Ban size={11} /> Suspend
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Warning banner */}
            {suspendedCount > 0 && (
                <div style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                }}>
                    <AlertTriangle size={16} color="#EF4444" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: 13, color: '#FCA5A5', margin: 0 }}>
                        <strong>{suspendedCount} client account{suspendedCount !== 1 ? 's' : ''}</strong> currently suspended — all their services return 503.
                    </p>
                </div>
            )}

            {/* Table */}
            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['Client', 'Namespace', 'Apps', 'Status', 'Joined', ''].map((h, i) => (
                                <th key={i} style={{
                                    padding: '11px 20px', fontSize: 9, fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.1em',
                                    color: '#334155', textAlign: i >= 2 && i <= 3 ? 'center' : i === 5 ? 'right' : 'left',
                                    background: 'rgba(255,255,255,0.01)',
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#475569' }}>
                                    Loading…
                                </td>
                            </tr>
                        ) : clients.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 52, textAlign: 'center' }}>
                                    <Users size={32} style={{ display: 'block', margin: '0 auto 12px', color: '#334155' }} />
                                    <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>No client accounts yet.</p>
                                </td>
                            </tr>
                        ) : clients.map(c => (
                            <ClientRow
                                key={c.id}
                                client={c}
                                onSuspend={handleSuspend}
                                onRestore={handleRestore}
                            />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminClients;
