import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line,
} from 'recharts';
import {
    Box, Cpu, Zap, TrendingUp, TrendingDown, Minus,
    Activity, Server, RefreshCw,
    ChevronDown, ExternalLink,
} from 'lucide-react';
import { appsApi } from '../api';
import { openSseStream } from '../api/sse';
import { useTheme } from '../context/ThemeContext';

// Admin-level cluster monitoring (all tenants, pods, Knative, Kafka, eventing,
// logs) lives entirely in admin-console now — this page is client-only.

// ── helpers ────────────────────────────────────────────────────────────────────
const fmtReq = v => v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1);
const fmtPct = v => v == null ? '—' : `${(v * 100).toFixed(2)}%`;
const fmtMs  = v => v == null ? '—' : v < 1 ? `${(v * 1000).toFixed(0)}µs` : `${v.toFixed(0)}ms`;

const statusColor = s => ({
    RUNNING: '#3FB950', Running: '#3FB950',
    FAILED:  '#F85149', Failed:  '#F85149',
    SCALING: '#E8A838', Pending: '#E8A838',
    Succeeded: '#4A9EF5',
    IDLE: '#5A7080', SCALED_TO_ZERO: '#5A7080',
}[s] || '#5A7080');

// ── Sparkline ──────────────────────────────────────────────────────────────────
const Sparkline = ({ data, color }) => (
    <ResponsiveContainer width="100%" height={32}>
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
    </ResponsiveContainer>
);

// ── Trend ──────────────────────────────────────────────────────────────────────
const TrendBadge = ({ value }) => {
    if (value === 0) return <span className="trend-flat" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Minus size={10} /> Stable</span>;
    if (value > 0)   return <span className="trend-up"   style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><TrendingUp size={10} /> +{value}%</span>;
    return                  <span className="trend-down" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><TrendingDown size={10} /> {value}%</span>;
};

// ── KPI Card ───────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, trend, icon: Icon, iconBg, iconColor, sparkColor, sparkData, loading }) => {
    if (loading) return (
        <div className="ns-card" style={{ padding: 20 }}>
            <div className="skeleton" style={{ height: 12, width: 80, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 28, width: 60, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 10, width: 100 }} />
        </div>
    );
    const sp = sparkData || Array.from({ length: 20 }, (_, i) => ({ value: 40 + Math.sin(i * 0.5) * 15 + Math.random() * 10 }));
    return (
        <div className="ns-card ns-card-hover" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                    <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, color: '#64748B' }}>{label}</p>
                    <p style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', sans-serif", lineHeight: 1, margin: 0 }} className="text-primary">{value ?? '—'}</p>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} style={{ color: iconColor }} />
                </div>
            </div>
            <Sparkline data={sp} color={sparkColor} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <TrendBadge value={trend ?? 0} />
                {sub && <span style={{ fontSize: 10, color: '#9CA3AF' }}>{sub}</span>}
            </div>
        </div>
    );
};

// ── Chart tooltip ──────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
            <p style={{ color: '#9CA3AF', marginBottom: 6 }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, fontWeight: 600, margin: '2px 0' }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
                </p>
            ))}
        </div>
    );
};

// ── Status pill ────────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
    const col = statusColor(status);
    return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${col}15`, color: col, border: `1px solid ${col}30`, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>
            {status || 'Unknown'}
        </span>
    );
};

// ── App Selector ───────────────────────────────────────────────────────────────
const AppSelector = ({ apps, selected, onChange }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const { dark } = useTheme();

    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const sel = apps.find(a => a.id === selected);

    return (
        <div ref={ref} style={{ position: 'relative', minWidth: 240 }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.05)', cursor: 'pointer', width: '100%', fontFamily: "'JetBrains Mono', monospace" }}
            >
                {sel ? (
                    <>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(sel.status), flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, flex: 1, textAlign: 'left' }} className="text-primary">{sel.name || sel.serviceName}</span>
                    </>
                ) : (
                    <span style={{ fontSize: 13, color: '#64748B', flex: 1, textAlign: 'left' }}>Select an application…</span>
                )}
                <ChevronDown size={14} style={{ color: '#64748B', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms', flexShrink: 0 }} />
            </button>

            {open && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, width: '100%', background: dark ? '#111827' : '#fff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 100, overflow: 'hidden' }}>
                    {apps.length === 0 ? (
                        <div style={{ padding: '12px 16px', fontSize: 12, color: '#64748B' }}>No apps found</div>
                    ) : apps.map(app => (
                        <div key={app.id} onClick={() => { onChange(app.id); setOpen(false); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', background: app.id === selected ? 'rgba(0,212,255,0.07)' : 'transparent', transition: 'background 150ms' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,212,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = app.id === selected ? 'rgba(0,212,255,0.07)' : 'transparent'}
                        >
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(app.status), flexShrink: 0 }} />
                            <div>
                                <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }} className="text-primary">{app.name || app.serviceName}</p>
                                {app.imageName && <p style={{ fontSize: 10, margin: 0, color: '#9CA3AF', fontFamily: "'JetBrains Mono', monospace" }}>{app.imageName}:{app.imageTag || 'latest'}</p>}
                            </div>
                            <StatusPill status={app.status} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── App Metrics Panel (SSE) ────────────────────────────────────────────────────
const AppMetricsPanel = ({ appId, dark }) => {
    const [reqHistory,  setReqHistory]  = useState([]);
    const [latHistory,  setLatHistory]  = useState([]);
    const [errHistory,  setErrHistory]  = useState([]);
    const [cpuHistory,  setCpuHistory]  = useState([]);
    const [lastMetric,  setLastMetric]  = useState(null);
    const [noData,      setNoData]      = useState(false);
    const timerRef   = useRef(null);
    const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    const axisColor = dark ? '#374151' : '#94A3B8';

    useEffect(() => {
        if (!appId) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        setReqHistory([]); setLatHistory([]); setErrHistory([]); setCpuHistory([]);
        setNoData(false);

        // After 6s without data, assume app is scaled to zero
        timerRef.current = setTimeout(() => setNoData(true), 6000);

        const close = openSseStream(`/api/metrics/apps/${appId}/stream`, {
            onMessage: (data) => {
                try {
                    const m = JSON.parse(data);
                    clearTimeout(timerRef.current);
                    setNoData(false);
                    setLastMetric(m);
                    const ts = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const push = (setter, key) => setter(prev => [...prev.slice(-59), { t: ts, value: m[key] ?? 0 }]);
                    push(setReqHistory,  'requestsPerSecond');
                    push(setLatHistory,  'avgLatencyMs');
                    push(setErrHistory,  'errorRate');
                    push(setCpuHistory,  'cpuUsage');
                } catch {}
            },
        });
        return () => { close(); clearTimeout(timerRef.current); };
    }, [appId]);

    const charts = [
        { title: 'Requests / sec', data: reqHistory, dataKey: 'value', color: '#00D4FF', gradId: 'gReq', fmt: v => `${v.toFixed(2)} req/s`, sub: fmtReq(lastMetric?.requestsPerSecond) },
        { title: 'Avg Latency',    data: latHistory, dataKey: 'value', color: '#A855F7', gradId: 'gLat', fmt: v => `${v.toFixed(0)}ms`,     sub: fmtMs(lastMetric?.avgLatencyMs) },
        { title: 'Error Rate',     data: errHistory, dataKey: 'value', color: '#EF4444', gradId: 'gErr', fmt: v => `${(v*100).toFixed(2)}%`, sub: fmtPct(lastMetric?.errorRate) },
        { title: 'CPU Usage',      data: cpuHistory, dataKey: 'value', color: '#10B981', gradId: 'gCpu', fmt: v => `${v.toFixed(1)}%`,       sub: lastMetric ? `${lastMetric.cpuUsage?.toFixed(1)}%` : '—' },
    ];

    if (noData || reqHistory.length === 0) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {charts.map(c => (
                    <div key={c.title} className="ns-card" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
                        <div style={{ textAlign: 'center' }}>
                            {noData ? (
                                <>
                                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(90,112,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                        <span style={{ fontSize: 18 }}>💤</span>
                                    </div>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#5A7080', margin: '0 0 4px' }}>{c.title}</p>
                                    <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>App scaled to zero — no metrics</p>
                                    <p style={{ fontSize: 10, color: '#4A5568', margin: '4px 0 0' }}>Metrics appear when app receives traffic</p>
                                </>
                            ) : (
                                <>
                                    <div style={{ width: 20, height: 20, border: `2px solid ${c.color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                                    <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>Connecting to {c.title}…</p>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {charts.map(c => (
                <div key={c.title} className="ns-card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div>
                            <h4 style={{ fontSize: 13, fontWeight: 800, margin: 0 }} className="text-primary">{c.title}</h4>
                            <p style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: '4px 0 0', color: c.color }}>{c.sub}</p>
                        </div>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, animation: 'pulseDot 2s ease-in-out infinite' }} />
                    </div>
                    <ResponsiveContainer width="100%" height={110}>
                        <AreaChart data={c.data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                            <defs>
                                <linearGradient id={c.gradId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={c.color} stopOpacity={0.2} />
                                    <stop offset="100%" stopColor={c.color} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                            <XAxis dataKey="t" tick={{ fill: axisColor, fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.floor(c.data.length / 4)} />
                            <YAxis tick={{ fill: axisColor, fontSize: 9 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTooltip />} formatter={v => [c.fmt(v), c.title]} />
                            <Area type="monotoneX" dataKey={c.dataKey} stroke={c.color} strokeWidth={2} fill={`url(#${c.gradId})`} dot={false} isAnimationActive={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            ))}
        </div>
    );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const Monitoring = () => {
    const navigate   = useNavigate();
    const { dark }   = useTheme();

    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedApp, setSelectedApp] = useState(null);

    const [apps,    setApps]    = useState([]);

    const loadData = async () => {
        try {
            const appsRes = await appsApi.list().catch(() => ({ data: [] }));
            const raw = Array.isArray(appsRes.data) ? appsRes.data : [];
            const appList = raw.filter((a, idx, arr) => arr.findIndex(b => b.id === a.id) === idx);
            setApps(appList);
            if (!selectedApp && appList.length > 0) setSelectedApp(appList[0].id);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const refresh = () => { setRefreshing(true); loadData(); };

    const running = apps.filter(a => a.status === 'RUNNING').length;

    const suspended  = apps.filter(a => a.status === 'SUSPENDED').length;
    const scaledZero = apps.filter(a => a.status === 'SCALED_TO_ZERO' || a.status === 'IDLE').length;

    const kpiCards = [
        { label: 'Your Apps',         value: apps.length,        sub: `${apps.filter(a=>a.status==='FAILED').length} errors`, trend: 2, icon: Box,         iconBg: 'rgba(0,212,255,0.1)',  iconColor: '#00D4FF', sparkColor: '#00D4FF' },
        { label: 'Running Instances', value: running,            sub: `${running}/${apps.length} healthy`,                     trend: 0, icon: Cpu,         iconBg: 'rgba(168,85,247,0.1)', iconColor: '#A855F7', sparkColor: '#A855F7' },
        { label: 'Scaled to Zero',    value: scaledZero,         sub: 'idle, no cost',                                         trend: 0, icon: Zap,         iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', sparkColor: '#10B981' },
        { label: 'Suspended',         value: suspended,          sub: suspended > 0 ? 'action needed' : 'none',                trend: 0, icon: Server,      iconBg: 'rgba(245,158,11,0.1)', iconColor: '#F59E0B', sparkColor: '#F59E0B' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#4A9EF5', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 6px' }}>
                        Observability
                    </p>
                    <h2 style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">
                        App Monitoring
                    </h2>
                    <p style={{ fontSize: 12, margin: '4px 0 0' }} className="text-secondary">
                        Live metrics per application — select an app to inspect
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button className="btn-secondary" onClick={refresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                    <button className="btn-primary" onClick={() => navigate('/apps/new')}>Deploy Service</button>
                </div>
            </div>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {kpiCards.map(card => (
                    <KpiCard key={card.label} {...card} loading={loading} />
                ))}
            </div>

            {/* Per-app metrics */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <div>
                        <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0 }} className="text-primary">Per-App Metrics</h3>
                        <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">Real-time metrics for the selected application</p>
                    </div>
                    <AppSelector apps={apps} selected={selectedApp} onChange={setSelectedApp} />
                    {selectedApp && (() => {
                        const app = apps.find(a => a.id === selectedApp);
                        return app?.url ? (
                            <a href={app.url.startsWith('http') ? app.url : `http://${app.url}`} target="_blank" rel="noreferrer"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#00D4FF', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(0,212,255,0.3)', background: 'rgba(0,212,255,0.05)' }}>
                                <ExternalLink size={13} /> Open App
                            </a>
                        ) : null;
                    })()}
                </div>

                {selectedApp ? (
                    <AppMetricsPanel appId={selectedApp} dark={dark} />
                ) : (
                    <div className="ns-card" style={{ padding: 48, textAlign: 'center' }}>
                        <Activity size={32} style={{ color: '#64748B', margin: '0 auto 12px' }} />
                        <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Select an application above to view live metrics</p>
                    </div>
                )}
            </div>

            {/* Services table */}
            <div className="ns-card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }} className="text-primary">All Services</h3>
                    <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">{apps.length} services · {running} running</p>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        {['Service', 'Status', 'Pods', 'CPU', 'Memory', 'Deployed', ''].map(h => (
                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B' }}>{h}</th>
                        ))}
                    </tr></thead>
                    <tbody>
                        {loading ? <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>Loading…</td></tr>
                        : apps.length === 0 ? <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>No services found</td></tr>
                        : apps.map((app, i) => (
                            <tr key={i}
                                onClick={() => navigate(`/apps/${app.id}`)}
                                style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer', background: app.id === selectedApp ? (dark ? 'rgba(0,212,255,0.04)' : 'rgba(0,212,255,0.03)') : 'transparent', transition: 'background 150ms' }}
                                onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)'}
                                onMouseLeave={e => e.currentTarget.style.background = app.id === selectedApp ? (dark ? 'rgba(0,212,255,0.04)' : 'rgba(0,212,255,0.03)') : 'transparent'}
                            >
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(app.status), boxShadow: `0 0 5px ${statusColor(app.status)}` }} />
                                        <span style={{ fontWeight: 700 }} className="text-primary">{app.serviceName || app.name}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '12px 16px' }}><StatusPill status={app.status} /></td>
                                <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }} className="text-primary">
                                    {(app.replicas ?? 0) === 0 ? <span style={{ color: '#6B7280', fontStyle: 'italic', fontSize: 11 }}>zero</span> : app.replicas}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: 12 }} className="text-secondary">{app.cpuRequest || '—'}</td>
                                <td style={{ padding: '12px 16px', fontSize: 12 }} className="text-secondary">{app.memoryRequest || '—'}</td>
                                <td style={{ padding: '12px 16px', fontSize: 12 }} className="text-secondary">{app.deployedAt ? new Date(app.deployedAt).toLocaleDateString() : '—'}</td>
                                <td style={{ padding: '12px 16px' }}>
                                    <button
                                        onClick={e => { e.stopPropagation(); setSelectedApp(app.id); }}
                                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(0,212,255,0.3)', background: app.id === selectedApp ? 'rgba(0,212,255,0.15)' : 'transparent', color: '#00D4FF', cursor: 'pointer' }}
                                    >
                                        {app.id === selectedApp ? '● Viewing' : 'Monitor'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Monitoring;
