import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, RefreshCw, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { adminApi } from '../../api';

const ACTIONS = [
    'SUSPEND_CLIENT', 'RESTORE_CLIENT', 'SUSPEND_APP', 'RESTORE_APP',
    'FORCE_DELETE_APP', 'FORCE_DELETE_TOPIC', 'UPDATE_QUOTA', 'SCALE_APP',
];

const ACTION_COLOR = (action) => {
    if (action?.startsWith('FORCE_DELETE')) return '#EF4444';
    if (action?.startsWith('SUSPEND')) return '#F59E0B';
    if (action?.startsWith('RESTORE')) return '#10B981';
    return '#3B82F6';
};

const inputStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 8,
    color: '#F1F5F9',
    fontSize: 12,
    padding: '7px 10px',
    fontFamily: "'JetBrains Mono', monospace",
};

const LogRow = ({ entry }) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}
            onClick={() => setExpanded(v => !v)}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            <td style={{ padding: '12px 20px', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>
                {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '—'}
            </td>
            <td style={{ padding: '12px 20px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{entry.actorUsername}</p>
            </td>
            <td style={{ padding: '12px 20px' }}>
                <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    color: ACTION_COLOR(entry.action),
                    background: `${ACTION_COLOR(entry.action)}1F`,
                    border: `1px solid ${ACTION_COLOR(entry.action)}40`,
                    fontFamily: "'JetBrains Mono', monospace",
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>{entry.action}</span>
            </td>
            <td style={{ padding: '12px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#94A3B8' }}>
                {entry.targetType} / {entry.targetId}
            </td>
            <td style={{ padding: '12px 20px', fontSize: 11, color: '#475569' }}>{entry.ipAddress || '—'}</td>
            <td style={{ padding: '12px 20px', fontSize: 11, color: '#64748B', textAlign: 'right' }}>
                {expanded ? 'Hide' : 'Details'}
            </td>
            {expanded && (
                <td colSpan={6} style={{ display: 'none' }} />
            )}
        </motion.tr>
    );
};

const AdminAuditLog = () => {
    const [entries, setEntries] = useState([]);
    const [totalPages, setTotalPages] = useState(0);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({ action: '', targetId: '', actorUserId: '' });

    const load = async (p = page) => {
        setLoading(true);
        setError(null);
        try {
            const params = { page: p, size: 20 };
            if (filters.action) params.action = filters.action;
            if (filters.targetId) params.targetId = filters.targetId;
            if (filters.actorUserId) params.actorUserId = filters.actorUserId;
            const res = await adminApi.getAuditLog(params);
            setEntries(res.data?.content || []);
            setTotalPages(res.data?.totalPages ?? 0);
        } catch (e) {
            setError(e.response?.status
                ? `Failed to load audit log (HTTP ${e.response.status}). Try refreshing.`
                : 'Failed to reach the server. Check your connection and retry.');
            setEntries([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(0); setPage(0); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{ maxWidth: 1100 }}>
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
                    }}>Audit Log</h1>
                    <p style={{ fontSize: 12, color: '#475569', margin: '4px 0 0' }}>
                        Every suspend, restore, and force-delete action, traced.
                    </p>
                </div>
                <button onClick={() => load(page)} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 16px', borderRadius: 9,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'transparent', color: '#64748B',
                    cursor: 'pointer', fontSize: 12,
                }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {error && (
                <div style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                }}>
                    <p style={{ fontSize: 13, color: '#FCA5A5', margin: 0 }}>{error}</p>
                </div>
            )}

            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
                <Filter size={13} color="#475569" />
                <select
                    value={filters.action}
                    onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}
                    style={inputStyle}
                >
                    <option value="">All actions</option>
                    {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <input
                    placeholder="Target ID"
                    value={filters.targetId}
                    onChange={e => setFilters(f => ({ ...f, targetId: e.target.value }))}
                    style={{ ...inputStyle, width: 180 }}
                />
                <input
                    placeholder="Actor (username)"
                    value={filters.actorUserId}
                    onChange={e => setFilters(f => ({ ...f, actorUserId: e.target.value }))}
                    style={{ ...inputStyle, width: 180 }}
                />
            </div>

            <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, overflow: 'hidden',
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                            {['When', 'Actor', 'Action', 'Target', 'IP', ''].map((h, i) => (
                                <th key={i} style={{
                                    padding: '11px 20px', fontSize: 9, fontWeight: 700,
                                    textTransform: 'uppercase', letterSpacing: '0.1em',
                                    color: '#334155', textAlign: i === 5 ? 'right' : 'left',
                                    background: 'rgba(255,255,255,0.01)',
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#475569' }}>Loading…</td></tr>
                        ) : entries.length === 0 ? (
                            <tr>
                                <td colSpan={6} style={{ padding: 52, textAlign: 'center' }}>
                                    <ScrollText size={32} style={{ display: 'block', margin: '0 auto 12px', color: '#334155' }} />
                                    <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>No matching admin actions recorded.</p>
                                </td>
                            </tr>
                        ) : entries.map(entry => <LogRow key={entry.id} entry={entry} />)}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 16 }}>
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 6, color: '#64748B', cursor: page === 0 ? 'not-allowed' : 'pointer', opacity: page === 0 ? 0.4 : 1 }}
                    ><ChevronLeft size={14} /></button>
                    <span style={{ fontSize: 12, color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
                        Page {page + 1} / {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                        disabled={page >= totalPages - 1}
                        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 6, color: '#64748B', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', opacity: page >= totalPages - 1 ? 0.4 : 1 }}
                    ><ChevronRight size={14} /></button>
                </div>
            )}
        </div>
    );
};

export default AdminAuditLog;
