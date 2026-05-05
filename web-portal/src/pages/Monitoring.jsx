import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appsApi, metricsApi } from '../api';

const C = {
    bg:       '#0a0a0a',
    card:     '#111213',
    cardAlt:  '#161718',
    border:   'rgba(255,255,255,0.06)',
    cyan:     '#00c8ff',
    blue:     '#0070f3',
    yellow:   '#e9c349',
    green:    '#4caf8a',
    red:      '#ff5b5b',
    textPri:  '#e8eaed',
    textDim:  '#6b7280',
    textMid:  '#9ca3af',
};

const BAR_HEIGHTS = [40, 45, 55, 70, 85, 60, 50, 40, 45, 65, 75, 60, 80, 90, 55, 45, 35, 65, 70, 80];

const fmtReq = v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1);
const fmtPct = v => `${(v * 100).toFixed(2)}%`;
const fmtMBs = v => v >= 1024 ? `${(v / 1024).toFixed(1)} GB/s` : `${v.toFixed(1)} MB/s`;

const statusColor = (s) => {
    if (s === 'RUNNING') return C.blue;
    if (s === 'SCALING') return C.yellow;
    return C.red;
};

const KpiCard = ({ icon, label, value, sub, subColor }) => (
    <div style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '24px 28px',
        position: 'relative',
        overflow: 'hidden',
        flex: 1,
        minWidth: 160,
    }}>
        <span className="material-symbols-outlined" style={{
            position: 'absolute', top: 12, right: 12,
            fontSize: 52, opacity: 0.07, color: C.textPri,
        }}>{icon}</span>
        <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim, marginBottom: 6 }}>{label}</p>
        <h3 style={{ fontSize: 38, fontWeight: 700, color: C.textPri, margin: 0 }}>{value}</h3>
        {sub && (
            <p style={{ fontSize: 11, marginTop: 10, color: subColor || C.textDim }}>{sub}</p>
        )}
    </div>
);

const NodeBar = ({ label, pct, color }) => (
    <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: C.textPri }}>{label}</span>
            <span style={{ fontSize: 12, color }}>{pct}%</span>
        </div>
        <div style={{ height: 3, background: C.border, borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99 }} />
        </div>
    </div>
);

const Monitoring = () => {
    const navigate = useNavigate();
    const [apps, setApps]               = useState([]);
    const [clusterMetrics, setCluster]  = useState(null);
    const [loading, setLoading]         = useState(true);
    const [clock, setClock]             = useState(() => new Date().toISOString().substring(11, 19));
    const activeRef                     = useRef(true);

    useEffect(() => {
        activeRef.current = true;
        const id = setInterval(() => setClock(new Date().toISOString().substring(11, 19)), 1000);
        return () => { activeRef.current = false; clearInterval(id); };
    }, []);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const [appsRes, metricsRes] = await Promise.all([
                    appsApi.list().catch(() => ({ data: [] })),
                    metricsApi.getCluster().catch(() => ({ data: null })),
                ]);
                if (!active) return;
                setApps(Array.isArray(appsRes.data) ? appsRes.data : []);
                setCluster(metricsRes.data);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const runningCount = useMemo(() => apps.filter(a => a.status === 'RUNNING').length, [apps]);
    const zeroCount    = useMemo(() => apps.filter(a => a.status === 'SCALED_TO_ZERO' || a.status === 'PENDING').length, [apps]);

    return (
        <div style={{ minHeight: '100vh', background: C.bg, padding: '32px 36px', boxSizing: 'border-box' }}>

            {/* ── Header ─────────────────────────────────────────────── */}
            <div style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: 16,
                padding: '36px 40px',
                marginBottom: 32,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                flexWrap: 'wrap',
                gap: 20,
                position: 'relative',
                overflow: 'hidden',
            }}>
                <div style={{
                    position: 'absolute', inset: 0,
                    background: `linear-gradient(135deg, rgba(0,112,243,0.08) 0%, transparent 60%)`,
                    pointerEvents: 'none',
                }} />
                <div style={{ position: 'relative' }}>
                    <span style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: C.blue, display: 'block', marginBottom: 8 }}>
                        Realtime Monitor
                    </span>
                    <h2 style={{ fontSize: 30, fontWeight: 700, color: C.textPri, margin: 0 }}>Global Command Node</h2>
                    <p style={{ color: C.textDim, marginTop: 8, maxWidth: 480, lineHeight: 1.6, fontSize: 13 }}>
                        Cluster synchronization active. All Kafka pipelines operating within nominal latency parameters.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 12, position: 'relative' }}>
                    <button
                        onClick={() => navigate('/apps/new')}
                        style={{
                            padding: '10px 22px', borderRadius: 8, background: C.blue,
                            color: '#fff', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer',
                            boxShadow: `0 0 18px rgba(0,112,243,0.35)`,
                        }}
                    >
                        Deploy New Service
                    </button>
                    <button
                        onClick={() => navigate('/logs')}
                        style={{
                            padding: '10px 22px', borderRadius: 8,
                            background: C.cardAlt, color: C.textPri,
                            fontWeight: 700, fontSize: 13, border: `1px solid ${C.border}`, cursor: 'pointer',
                        }}
                    >
                        Export Logs
                    </button>
                </div>
            </div>

            {/* ── KPI Row ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
                <KpiCard
                    icon="package_2"
                    label="Total Apps"
                    value={loading ? '…' : apps.length}
                    sub={`Running: ${runningCount}  ·  Scale-to-zero: ${zeroCount}`}
                    subColor={C.blue}
                />
                <KpiCard
                    icon="cloud_done"
                    label="Active Services"
                    value={loading ? '…' : runningCount}
                    sub="↑ Stable"
                    subColor={C.green}
                />
                <KpiCard
                    icon="conversion_path"
                    label="Req / sec"
                    value={loading ? '…' : clusterMetrics ? fmtReq(clusterMetrics.totalReqPerSec) : '—'}
                    sub={clusterMetrics ? `Error rate: ${fmtPct(clusterMetrics.clusterErrorRate)}` : 'No data'}
                    subColor={clusterMetrics && clusterMetrics.clusterErrorRate > 0.05 ? C.red : C.green}
                />
                <KpiCard
                    icon="speed"
                    label="Net Throughput"
                    value={loading ? '…' : clusterMetrics ? fmtMBs(clusterMetrics.netSendMBs + clusterMetrics.netRecvMBs) : '—'}
                    sub={clusterMetrics ? `↑ ${fmtMBs(clusterMetrics.netSendMBs)}  ↓ ${fmtMBs(clusterMetrics.netRecvMBs)}` : 'No data'}
                    subColor={C.cyan}
                />
            </div>

            {/* ── Cluster Metrics ─────────────────────────────────────── */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, marginBottom: 32, overflow: 'hidden' }}>
                <div style={{
                    padding: '16px 28px', borderBottom: `1px solid ${C.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="material-symbols-outlined" style={{ color: C.blue, fontSize: 20 }}>query_stats</span>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textPri }}>
                            Cluster Metrics
                        </span>
                    </div>
                    <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim }}>
                        Status: <span style={{ color: clusterMetrics ? C.green : C.yellow }}>
                            {clusterMetrics ? 'Connected' : 'Awaiting Prometheus'}
                        </span>
                    </span>
                </div>

                {clusterMetrics ? (
                    <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                        {Object.entries(clusterMetrics).slice(0, 4).map(([k, v]) => (
                            <div key={k} style={{ flex: 1, minWidth: 150, padding: '24px 28px', borderRight: `1px solid ${C.border}` }}>
                                <p style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{k}</p>
                                <p style={{ fontSize: 26, fontWeight: 700, color: C.textPri }}>{typeof v === 'number' ? v.toFixed(2) : String(v)}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 36, color: C.textDim }}>data_alert</span>
                        <p style={{ color: C.textMid, fontSize: 13, fontWeight: 500 }}>No metrics available.</p>
                        <p style={{ color: C.textDim, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                            Waiting for telemetry stream from the control plane.
                        </p>
                    </div>
                )}
            </div>

            {/* ── Telemetry Chart + Node Distribution ─────────────────── */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>

                {/* Chart */}
                <div style={{
                    flex: 3, minWidth: 280,
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: '28px 32px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                        <h4 style={{ fontSize: 16, fontWeight: 700, color: C.textPri, margin: 0 }}>Real-time Telemetry</h4>
                        <div style={{ display: 'flex', gap: 16 }}>
                            {[['CPU', C.blue], ['Memory', C.yellow], ['Network', C.textDim]].map(([l, c]) => (
                                <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: c }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />
                                    {l}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Bar chart */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 160, padding: '0 4px' }}>
                        {BAR_HEIGHTS.map((h, i) => (
                            <div key={i} style={{
                                flex: 1,
                                height: `${h}%`,
                                background: `rgba(0,112,243,0.2)`,
                                borderRadius: '3px 3px 0 0',
                                transition: 'background 0.2s',
                                cursor: 'default',
                            }} />
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                        {['08:00', '10:00', '12:00', '14:00', '16:00'].map(t => (
                            <span key={t} style={{ fontSize: 10, color: C.textDim, letterSpacing: '0.05em' }}>{t}</span>
                        ))}
                    </div>
                </div>

                {/* Node Distribution */}
                <div style={{
                    flex: 1, minWidth: 200,
                    background: C.card, border: `1px solid ${C.border}`, borderRadius: 14,
                    padding: '28px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}>
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textDim, marginBottom: 24 }}>
                            Node Distribution
                        </p>
                        <NodeBar label="US-East-1"    pct={82} color={C.blue} />
                        <NodeBar label="EU-Central-1" pct={45} color={C.yellow} />
                        <NodeBar label="AP-South-1"   pct={12} color={C.textDim} />
                    </div>
                    <p style={{ fontSize: 9, color: C.textDim, letterSpacing: '0.12em', textTransform: 'uppercase', lineHeight: 1.8, textAlign: 'center', marginTop: 24 }}>
                        Sovereign Cloud Intelligence System<br />Active Sync Since 2026.04.12
                    </p>
                </div>
            </div>

            {/* ── Recent Activities Table ──────────────────────────────── */}
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: 80 }}>
                <div style={{
                    padding: '20px 28px', borderBottom: `1px solid ${C.border}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <h4 style={{ fontSize: 16, fontWeight: 700, color: C.textPri, margin: 0 }}>Recent Activities</h4>
                    <button
                        onClick={() => navigate('/logs')}
                        style={{ background: 'none', border: 'none', color: C.blue, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}
                    >
                        View All Logs
                    </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.25)' }}>
                            {['Service Identifier', 'Namespace', 'Status', 'Last Sync'].map((h, i) => (
                                <th key={h} style={{
                                    padding: '12px 28px',
                                    fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                                    textTransform: 'uppercase', color: C.textDim,
                                    textAlign: i === 3 ? 'right' : 'left',
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={4} style={{ padding: '32px 28px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>
                                    Loading…
                                </td>
                            </tr>
                        ) : apps.length === 0 ? (
                            <tr>
                                <td colSpan={4} style={{ padding: '32px 28px', textAlign: 'center', color: C.textDim, fontSize: 13 }}>
                                    No applications found.
                                </td>
                            </tr>
                        ) : apps.slice(0, 6).map(app => (
                            <tr
                                key={app.id}
                                style={{ borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}
                                onClick={() => navigate(`/apps/${app.name || app.id}`)}
                            >
                                <td style={{ padding: '14px 28px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: statusColor(app.status),
                                            boxShadow: `0 0 8px ${statusColor(app.status)}`,
                                            flexShrink: 0,
                                        }} />
                                        <span style={{ fontSize: 13, fontWeight: 600, color: C.textPri }}>
                                            {app.serviceName || app.name || 'Service'}
                                        </span>
                                    </div>
                                </td>
                                <td style={{ padding: '14px 28px', fontSize: 13, color: C.textMid }}>
                                    {app.namespace || 'default'}
                                </td>
                                <td style={{ padding: '14px 28px' }}>
                                    <span style={{
                                        padding: '3px 10px', borderRadius: 4,
                                        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                                        background: `${statusColor(app.status)}18`,
                                        color: statusColor(app.status),
                                        border: `1px solid ${statusColor(app.status)}33`,
                                    }}>
                                        {app.status || 'Unknown'}
                                    </span>
                                </td>
                                <td style={{ padding: '14px 28px', fontSize: 12, color: C.textDim, textAlign: 'right' }}>
                                    {app.updatedAt ? 'Recently' : 'N/A'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Floating Status Bar ──────────────────────────────────── */}
            <div style={{
                position: 'fixed', bottom: 28, right: 28, zIndex: 50,
                background: 'rgba(17,18,19,0.85)',
                backdropFilter: 'blur(12px)',
                border: `1px solid rgba(255,255,255,0.1)`,
                borderRadius: 999,
                padding: '10px 24px',
                display: 'flex', alignItems: 'center', gap: 14,
                boxShadow: `0 0 20px rgba(0,112,243,0.18)`,
            }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.blue, boxShadow: `0 0 8px ${C.blue}`, flexShrink: 0 }} />
                <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.textPri }}>System Stable</span>
                <span style={{ width: 1, height: 14, background: C.border }} />
                <span style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textDim }}>99.99% Uptime</span>
                <span style={{ width: 1, height: 14, background: C.border }} />
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: C.cyan }}>{clock} UTC</span>
            </div>
        </div>
    );
};

export default Monitoring;
