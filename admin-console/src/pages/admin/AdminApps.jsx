import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import { Box, RefreshCw, AlertTriangle, Play, Ban, Trash2 } from 'lucide-react';

const statusColor = s => ({
    RUNNING: '#3FB950', Running: '#3FB950',
    FAILED: '#F85149', Failed: '#F85149',
    CrashLoopBackOff: '#F85149', Error: '#F85149',
    PENDING: '#E8A838', Pending: '#E8A838', SCALING: '#E8A838',
    SUSPENDED: '#5A7080', IDLE: '#5A7080', SCALED_TO_ZERO: '#5A7080',
}[s] || '#5A7080');

const StatusPill = ({ status }) => {
    const col = statusColor(status);
    return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${col}15`, color: col, border: `1px solid ${col}30`, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>
            {status || 'Unknown'}
        </span>
    );
};

const describeFailure = (label, err) => ({
    label,
    message: err.response?.status
        ? `HTTP ${err.response.status} — ${err.response.data?.detail || err.response.data?.title || err.message}`
        : `Network error — ${err.message}`,
});

const POLL_INTERVAL_MS = 20000;

const AdminApps = () => {
    const [apps,    setApps]    = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState(null);
    const [tenantFilter, setTenantFilter] = useState('');
    const [actingOn, setActingOn] = useState(null);

    const load = (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        setError(null);
        adminApi.getAllApps()
            .then(res => setApps(Array.isArray(res.data) ? res.data : []))
            .catch(err => setError(describeFailure('Applications', err)))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(true); }, []);

    useEffect(() => {
        const id = setInterval(() => load(false), POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, []);

    // Reuses the exact endpoints that already trigger the AdminAuditLog
    // SUSPEND_APP/RESTORE_APP/FORCE_DELETE_APP entries.
    const runAppAction = async (app, action) => {
        setActingOn(app.id);
        try {
            if (action === 'suspend') await adminApi.suspendApp(app.id);
            if (action === 'restore') await adminApi.restoreApp(app.id);
            if (action === 'delete')  await adminApi.forceDelete(app.id);
            load(false);
        } finally {
            setActingOn(null);
        }
    };

    const handleAppAction = (app, action) => {
        const verb = action === 'suspend' ? 'Suspend' : action === 'restore' ? 'Restore' : 'Permanently delete';
        const confirmed = window.confirm(`${verb} "${app.serviceName || app.imageName}" (tenant: ${app.userId})?`);
        if (confirmed) runAppAction(app, action);
    };

    const tenants = [...new Set(apps.map(a => a.userId).filter(Boolean))].sort();
    const filteredApps = apps.filter(a => !tenantFilter || a.userId === tenantFilter);

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 12 }} />)}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 6px' }}>Admin Console</p>
                    <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, color: '#DDE6F0', margin: 0 }}>Applications</h1>
                    <p style={{ color: '#5A7080', fontSize: 14, marginTop: 4 }}>{apps.length} applications across all tenants</p>
                </div>
                <button onClick={() => load(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9,
                    border: '1px solid #1F2B3A', background: 'transparent', color: '#5A7080', cursor: 'pointer', fontSize: 12,
                }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {error && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.25)', borderRadius: 10, padding: '14px 18px' }}>
                    <AlertTriangle size={15} color="#F85149" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 13, color: '#FCA5A5', margin: 0 }}><strong>{error.label} unavailable.</strong> {error.message}</p>
                </div>
            )}

            <select value={tenantFilter} onChange={e => setTenantFilter(e.target.value)} style={{ background: '#0D1117', border: '1px solid #1F2B3A', color: '#DDE6F0', borderRadius: 8, padding: '7px 12px', fontSize: 12, width: 220 }}>
                <option value="">All tenants</option>
                {tenants.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                        {['Service', 'Tenant', 'Namespace', 'Image', 'Status', 'URL', ''].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                        ))}
                    </tr></thead>
                    <tbody>
                        {filteredApps.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>No applications</td></tr>
                        ) : filteredApps.map((app, i) => (
                            <tr key={app.id || i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                <td style={{ padding: '10px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(app.status), boxShadow: `0 0 5px ${statusColor(app.status)}` }} />
                                        <span style={{ fontWeight: 700, fontSize: 12, color: '#DDE6F0' }}>{app.serviceName || app.imageName}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '10px 16px', fontSize: 11, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{app.userId}</td>
                                <td style={{ padding: '10px 16px', fontSize: 11, color: '#5A7080' }}>{app.namespace}</td>
                                <td style={{ padding: '10px 16px', fontSize: 11, color: '#4A9EF5', fontFamily: "'JetBrains Mono', monospace", maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.imageName}:{app.imageTag}</td>
                                <td style={{ padding: '10px 16px' }}><StatusPill status={app.status} /></td>
                                <td style={{ padding: '10px 16px', fontSize: 11, color: '#5A7080', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.url || '—'}</td>
                                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                        {app.status === 'SUSPENDED' ? (
                                            <button disabled={actingOn === app.id} onClick={() => handleAppAction(app, 'restore')} title="Restore"
                                                style={{ padding: 6, borderRadius: 6, border: '1px solid rgba(63,185,80,0.3)', background: 'rgba(63,185,80,0.1)', color: '#3FB950', cursor: 'pointer' }}>
                                                <Play size={12} />
                                            </button>
                                        ) : (
                                            <button disabled={actingOn === app.id} onClick={() => handleAppAction(app, 'suspend')} title="Suspend"
                                                style={{ padding: 6, borderRadius: 6, border: '1px solid rgba(232,168,56,0.3)', background: 'rgba(232,168,56,0.1)', color: '#E8A838', cursor: 'pointer' }}>
                                                <Ban size={12} />
                                            </button>
                                        )}
                                        <button disabled={actingOn === app.id} onClick={() => handleAppAction(app, 'delete')} title="Force delete"
                                            style={{ padding: 6, borderRadius: 6, border: '1px solid rgba(248,81,73,0.3)', background: 'rgba(248,81,73,0.1)', color: '#F85149', cursor: 'pointer' }}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminApps;
