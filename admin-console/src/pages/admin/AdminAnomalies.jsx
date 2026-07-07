import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, CheckCircle, ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import { adminApi } from '../../api';

const TYPE_COLOR = { COST: '#F59E0B', TRAFFIC: '#A371F7' };

const AnomalyRow = ({ anomaly, onAcknowledge }) => {
    const [acking, setAcking] = useState(false);
    const color = TYPE_COLOR[anomaly.type] || '#94A3B8';

    const ack = async () => {
        setAcking(true);
        try { await onAcknowledge(anomaly.id); } finally { setAcking(false); }
    };

    return (
        <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: anomaly.acknowledged ? 0.5 : 1 }}
        >
            <td style={{ padding: '12px 20px', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                {new Date(anomaly.detectedAt).toLocaleString()}
            </td>
            <td style={{ padding: '12px 20px' }}>
                <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    color, background: `${color}1F`, border: `1px solid ${color}40`,
                    fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase',
                }}>
                    <TrendingUp size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                    {anomaly.type}
                </span>
            </td>
            <td style={{ padding: '12px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#94A3B8' }}>
                {anomaly.userId}{anomaly.appName ? ` / ${anomaly.appName}` : ''}
            </td>
            <td style={{ padding: '12px 20px', fontSize: 12, color: '#E2E8F0', maxWidth: 420 }}>
                {anomaly.message}
            </td>
            <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                {anomaly.acknowledged ? (
                    <span style={{ fontSize: 11, color: '#10B981', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <CheckCircle size={12} /> Reviewed
                    </span>
                ) : (
                    <button onClick={ack} disabled={acking} style={{
                        padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(16,185,129,0.3)',
                        background: 'rgba(16,185,129,0.1)', color: '#10B981', cursor: acking ? 'not-allowed' : 'pointer',
                        fontSize: 11, fontWeight: 700, opacity: acking ? 0.5 : 1,
                    }}>
                        {acking ? '…' : 'Acknowledge'}
                    </button>
                )}
            </td>
        </motion.tr>
    );
};

const AdminAnomalies = () => {
    const [anomalies, setAnomalies] = useState([]);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = async (p = page) => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminApi.getAnomalies({ page: p, size: 20 });
            setAnomalies(res.data?.content || []);
            setTotalPages(res.data?.totalPages ?? 0);
        } catch (e) {
            setError(e.response?.status ? `HTTP ${e.response.status}` : 'Network error — could not reach the server.');
            setAnomalies([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleAcknowledge = async (id) => {
        await adminApi.acknowledgeAnomaly(id);
        setAnomalies(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    };

    const unreviewed = anomalies.filter(a => !a.acknowledged).length;

    return (
        <div style={{ maxWidth: 1100 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
                <div>
                    <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.18em', textTransform: 'uppercase', color: '#EF4444', margin: '0 0 5px' }}>Admin Console</p>
                    <h1 style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#F1F5F9', margin: 0 }}>Anomalies</h1>
                    <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>
                        Cost and traffic spikes detected automatically, before the client reports them
                        {unreviewed > 0 && <span style={{ color: '#F59E0B', marginLeft: 8 }}><AlertTriangle size={11} style={{ display: 'inline', marginRight: 4 }} />{unreviewed} unreviewed</span>}
                    </p>
                </div>
                <button onClick={() => load(page)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.08)', background: 'transparent', color: '#64748B', cursor: 'pointer', fontSize: 12 }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {error && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20 }}>
                    <p style={{ fontSize: 13, color: '#FCA5A5', margin: 0 }}>{error}</p>
                </div>
            )}

            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['Detected', 'Type', 'Tenant / App', 'Details', ''].map((h, i) => (
                                <th key={i} style={{ padding: '11px 20px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155', textAlign: i === 4 ? 'right' : 'left', background: 'rgba(255,255,255,0.01)' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ padding: 48, textAlign: 'center', color: '#475569' }}>Loading…</td></tr>
                        ) : anomalies.length === 0 ? (
                            <tr>
                                <td colSpan={5} style={{ padding: 52, textAlign: 'center' }}>
                                    <TrendingUp size={32} style={{ display: 'block', margin: '0 auto 12px', color: '#334155' }} />
                                    <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>No anomalies detected.</p>
                                </td>
                            </tr>
                        ) : anomalies.map(a => <AnomalyRow key={a.id} anomaly={a} onAcknowledge={handleAcknowledge} />)}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 16 }}>
                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 6, color: '#64748B', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}>
                        <ChevronLeft size={14} />
                    </button>
                    <span style={{ fontSize: 12, color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>Page {page + 1} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 6, color: '#64748B', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
                        <ChevronRight size={14} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default AdminAnomalies;
