import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line,
} from 'recharts';
import {
    Box, Cpu, Zap, TrendingUp, TrendingDown, Minus,
    Activity, Server, Globe, Database, GitBranch,
    Radio, Layers, CheckCircle, XCircle, AlertCircle, RefreshCw,
    ChevronDown, ExternalLink,
} from 'lucide-react';
import { appsApi, metricsApi, adminApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

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

// ── Gauge ring ─────────────────────────────────────────────────────────────────
const GaugeRing = ({ value, max = 100, color, label, sublabel }) => {
    const r = 38, circ = 2 * Math.PI * r;
    const pct = Math.min((value || 0) / max, 1), dash = pct * circ;
    const ring = value > max * 0.9 ? '#F85149' : value > max * 0.75 ? '#E8A838' : color;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div className="gauge-wrap">
                <svg viewBox="0 0 88 88">
                    <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" stroke="rgba(156,163,175,0.18)" />
                    <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" stroke={ring} strokeLinecap="round"
                        strokeDasharray={`${dash} ${circ}`} style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "'Outfit', sans-serif" }} className="text-primary">{value || 0}%</span>
                </div>
            </div>
            <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }} className="text-primary">{label}</p>
                <p style={{ fontSize: 10, margin: '2px 0 0' }} className="text-secondary">{sublabel}</p>
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

// ── Section header ─────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, count, color = '#4A9EF5' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={15} style={{ color }} />
        </div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, margin: 0 }} className="text-primary">{title}</h2>
        {count != null && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${color}15`, color, fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
        )}
    </div>
);

// ── Status pill ────────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
    const col = statusColor(status);
    return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${col}15`, color: col, border: `1px solid ${col}30`, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>
            {status || 'Unknown'}
        </span>
    );
};

// ── Pod row ────────────────────────────────────────────────────────────────────
const PodRow = ({ pod }) => (
    <tr style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
        <td style={{ padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(pod.phase), boxShadow: `0 0 5px ${statusColor(pod.phase)}` }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700 }} className="text-primary">{pod.name}</span>
            </div>
        </td>
        <td style={{ padding: '10px 16px', fontSize: 11, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{pod.namespace}</td>
        <td style={{ padding: '10px 16px' }}><StatusPill status={pod.phase} /></td>
        <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{pod.nodeName || '—'}</td>
        <td style={{ padding: '10px 16px', fontSize: 11, textAlign: 'center' }}>
            {pod.restarts > 0
                ? <span style={{ color: '#E8A838', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{pod.restarts}</span>
                : <span style={{ color: '#3FB950' }}>0</span>}
        </td>
        <td style={{ padding: '10px 16px' }}>
            {pod.ready ? <CheckCircle size={14} style={{ color: '#3FB950' }} /> : <XCircle size={14} style={{ color: '#F85149' }} />}
        </td>
    </tr>
);

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
    const esRef      = useRef(null);
    const timerRef   = useRef(null);
    const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    const axisColor = dark ? '#374151' : '#94A3B8';

    useEffect(() => {
        if (!appId) return;
        const token = localStorage.getItem('token');
        if (esRef.current) esRef.current.close();
        if (timerRef.current) clearTimeout(timerRef.current);
        setReqHistory([]); setLatHistory([]); setErrHistory([]); setCpuHistory([]);
        setNoData(false);

        // After 6s without data, assume app is scaled to zero
        timerRef.current = setTimeout(() => setNoData(true), 6000);

        const es = new EventSource(`/api/metrics/apps/${appId}/stream?token=${token}`);
        esRef.current = es;
        es.onmessage = (e) => {
            try {
                const m = JSON.parse(e.data);
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
        };
        es.onerror = () => es.close();
        return () => { es.close(); clearTimeout(timerRef.current); };
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
    const { user }   = useAuth();
    const { dark }   = useTheme();
    const isAdmin    = user?.role === 'ADMIN';

    const [loading,    setLoading]    = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab,  setActiveTab]  = useState('pods');
    const [selectedApp, setSelectedApp] = useState(null);

    const [apps,         setApps]         = useState([]);
    const [cluster,      setCluster]      = useState(null);
    const [nodes,        setNodes]        = useState([]);
    const [pods,         setPods]         = useState([]);
    const [knSvcs,       setKnSvcs]       = useState([]);
    const [kafkaBrokers, setKafkaBrokers] = useState([]);
    const [topics,       setTopics]       = useState([]);
    const [sources,      setSources]      = useState([]);
    const [triggers,     setTriggers]     = useState([]);
    const [overview,     setOverview]     = useState(null);

    const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    const axisColor = dark ? '#374151' : '#94A3B8';

    const loadData = async () => {
        try {
            if (isAdmin) {
                const [ovRes, appsRes, metricsRes, nodesRes, podsRes, knRes, brokersRes, topicsRes, srcRes, trgRes] =
                    await Promise.all([
                        adminApi.getClusterOverview().catch(() => ({ data: null })),
                        adminApi.getAllApps().catch(() => ({ data: [] })),
                        metricsApi.getCluster().catch(() => ({ data: null })),
                        adminApi.getNodes().catch(() => ({ data: [] })),
                        adminApi.getPods().catch(() => ({ data: [] })),
                        adminApi.getKnativeServices().catch(() => ({ data: [] })),
                        adminApi.getKafkaBrokers().catch(() => ({ data: [] })),
                        adminApi.getAllTopics().catch(() => ({ data: [] })),
                        adminApi.getAllSources().catch(() => ({ data: [] })),
                        adminApi.getAllTriggers().catch(() => ({ data: [] })),
                    ]);
                setOverview(ovRes.data);
                setApps(Array.isArray(appsRes.data) ? appsRes.data : []);
                setCluster(metricsRes.data);
                setNodes(Array.isArray(nodesRes.data) ? nodesRes.data : []);
                setPods(Array.isArray(podsRes.data) ? podsRes.data : []);
                setKnSvcs(Array.isArray(knRes.data) ? knRes.data : []);
                setKafkaBrokers(Array.isArray(brokersRes.data) ? brokersRes.data : []);
                setTopics(Array.isArray(topicsRes.data) ? topicsRes.data : []);
                setSources(Array.isArray(srcRes.data) ? srcRes.data : []);
                setTriggers(Array.isArray(trgRes.data) ? trgRes.data : []);
            } else {
                const [appsRes, metricsRes] = await Promise.all([
                    appsApi.list().catch(() => ({ data: [] })),
                    metricsApi.getCluster().catch(() => ({ data: null })),
                ]);
                const raw = Array.isArray(appsRes.data) ? appsRes.data : [];
                const appList = raw.filter((a, idx, arr) => arr.findIndex(b => b.id === a.id) === idx);
                setApps(appList);
                setCluster(metricsRes.data);
                if (!selectedApp && appList.length > 0) setSelectedApp(appList[0].id);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(); }, [isAdmin]);

    // SSE cluster metrics
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        const es = new EventSource(`/api/metrics/cluster/stream?token=${token}`);
        es.onmessage = (e) => { try { setCluster(JSON.parse(e.data)); } catch {} };
        es.onerror = () => es.close();
        return () => es.close();
    }, []);

    const refresh = () => { setRefreshing(true); loadData(); };

    const running = apps.filter(a => a.status === 'RUNNING').length;
    const totalReplicas = pods.filter(p => p.phase === 'Running').length || running;

    const kpiCards = isAdmin ? [
        { label: 'Total Users',    value: overview?.totalUsers ?? '—',                          trend: 0,  icon: Box,      iconBg: 'rgba(74,158,245,0.1)',  iconColor: '#4A9EF5', sparkColor: '#4A9EF5' },
        { label: 'Total Apps',     value: overview?.totalApps ?? apps.length, sub: `${overview?.failedApps ?? 0} failed`, trend: 2, icon: Activity, iconBg: 'rgba(0,212,255,0.1)', iconColor: '#00D4FF', sparkColor: '#00D4FF' },
        { label: 'Running Apps',   value: overview?.runningApps ?? running,   sub: `${running}/${apps.length} healthy`,  trend: 0, icon: CheckCircle, iconBg: 'rgba(63,185,80,0.1)', iconColor: '#3FB950', sparkColor: '#3FB950' },
        { label: 'Running Pods',   value: overview?.runningPods ?? '—',       sub: `${overview?.totalPods ?? '?'} total`, trend: 0, icon: Layers, iconBg: 'rgba(168,85,247,0.1)', iconColor: '#A855F7', sparkColor: '#A855F7' },
        { label: 'Kafka Topics',   value: overview?.totalTopics ?? topics.length, sub: `${sources.length} sources`,       trend: 0, icon: Zap, iconBg: 'rgba(232,168,56,0.1)', iconColor: '#E8A838', sparkColor: '#E8A838' },
        { label: 'Knative Svcs',   value: knSvcs.length,                      sub: `${overview?.tenantNamespaces ?? 0} namespaces`, trend: 0, icon: Globe, iconBg: 'rgba(163,113,247,0.1)', iconColor: '#A371F7', sparkColor: '#A371F7' },
        { label: 'Req / sec',      value: fmtReq(cluster?.totalReqPerSec),    sub: cluster ? `Error: ${fmtPct(cluster.clusterErrorRate)}` : 'No data', trend: 8, icon: Radio, iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', sparkColor: '#10B981' },
        { label: 'K8s Nodes',      value: `${nodes.filter(n => n.status === 'Ready').length}/${nodes.length}`, sub: `${overview?.pendingPods ?? 0} pending pods`, trend: 0, icon: Server, iconBg: 'rgba(63,185,80,0.1)', iconColor: '#3FB950', sparkColor: '#3FB950' },
    ] : [
        { label: 'Your Apps',         value: apps.length,        sub: `${apps.filter(a=>a.status==='FAILED').length} errors`, trend: 2, icon: Box,         iconBg: 'rgba(0,212,255,0.1)',  iconColor: '#00D4FF', sparkColor: '#00D4FF' },
        { label: 'Running Instances', value: running,            sub: `${running}/${apps.length} healthy`,                     trend: 0, icon: Cpu,         iconBg: 'rgba(168,85,247,0.1)', iconColor: '#A855F7', sparkColor: '#A855F7' },
        { label: 'Requests / sec',    value: fmtReq(cluster?.totalReqPerSec), sub: cluster ? `Error: ${fmtPct(cluster.clusterErrorRate)}` : 'No data', trend: 8, icon: Zap, iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', sparkColor: '#10B981' },
        { label: 'CPU Cores',         value: cluster ? cluster.totalCpuCores?.toFixed(2) : '—', sub: cluster ? `${cluster.totalMemoryGiB?.toFixed(1)} GiB RAM` : 'No data', trend: -3, icon: Server, iconBg: 'rgba(245,158,11,0.1)', iconColor: '#F59E0B', sparkColor: '#F59E0B' },
    ];

    const podsByNs = pods.reduce((acc, p) => {
        const ns = p.namespace || 'default';
        if (!acc[ns]) acc[ns] = [];
        acc[ns].push(p);
        return acc;
    }, {});

    const TABS = isAdmin ? [
        { id: 'pods',     label: 'Pods',         count: pods.length,                       color: '#4A9EF5' },
        { id: 'kafka',    label: 'Kafka',         count: topics.length,                     color: '#E8A838' },
        { id: 'knative',  label: 'Knative',       count: knSvcs.length,                     color: '#A371F7' },
        { id: 'eventing', label: 'Eventing',      count: sources.length + triggers.length,  color: '#3FB950' },
        { id: 'apps',     label: 'Apps / Users',  count: apps.length,                       color: '#00D4FF' },
    ] : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#4A9EF5', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 6px' }}>
                        {isAdmin ? 'Admin Console' : 'Observability'}
                    </p>
                    <h2 style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">
                        {isAdmin ? 'Global Monitoring' : 'App Monitoring'}
                    </h2>
                    <p style={{ fontSize: 12, margin: '4px 0 0' }} className="text-secondary">
                        {isAdmin
                            ? `${apps.length} services · ${pods.length} pods · ${nodes.length} nodes · ${topics.length} kafka topics`
                            : 'Live metrics per application — select an app to inspect'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button className="btn-secondary" onClick={refresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                    {!isAdmin && <button className="btn-primary" onClick={() => navigate('/apps/new')}>Deploy Service</button>}
                </div>
            </div>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isAdmin ? 4 : 4}, 1fr)`, gap: 16 }}>
                {kpiCards.map(card => (
                    <KpiCard key={card.label} {...card} loading={loading} />
                ))}
            </div>

            {/* ── DEVELOPER VIEW ── */}
            {!isAdmin && (
                <>
                    {/* Cluster overview + Gauges */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
                        {/* Cluster req/s chart */}
                        <div className="ns-card" style={{ padding: 20 }}>
                            <div style={{ marginBottom: 14 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }} className="text-primary">Cluster Request Volume</h3>
                                <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">HTTP req/sec across all your services · live SSE</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#00D4FF', margin: 0 }}>{fmtReq(cluster?.totalReqPerSec)}</p>
                                    <p style={{ fontSize: 10, color: '#64748B', margin: '2px 0 0' }}>req / sec</p>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#EF4444', margin: 0 }}>{cluster ? `${(cluster.clusterErrorRate * 100).toFixed(2)}%` : '—'}</p>
                                    <p style={{ fontSize: 10, color: '#64748B', margin: '2px 0 0' }}>error rate</p>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <p style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#10B981', margin: 0 }}>{running}</p>
                                    <p style={{ fontSize: 10, color: '#64748B', margin: '2px 0 0' }}>running apps</p>
                                </div>
                            </div>
                        </div>

                        {/* Gauges */}
                        <div className="ns-card" style={{ padding: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                                <h3 style={{ fontSize: 13, fontWeight: 800, margin: 0 }} className="text-primary">Cluster Resources</h3>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '3px 10px', borderRadius: 999 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulseDot 2s ease-in-out infinite' }} /> Live
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: 12, justifyContent: 'space-around' }}>
                                <GaugeRing value={cluster?.cpuUsagePct ?? 0} color="#00D4FF" label="CPU"    sublabel={cluster ? `${cluster.totalCpuCores?.toFixed(1)} cores` : '—'} />
                                <GaugeRing value={cluster?.memUsagePct ?? 0} color="#A855F7" label="Memory" sublabel={cluster ? `${cluster.totalMemoryGiB?.toFixed(1)} GiB`  : '—'} />
                            </div>
                        </div>
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
                </>
            )}

            {/* ── ADMIN VIEW ── */}
            {isAdmin && (
                <>
                    {/* Nodes */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                        {nodes.map((node, i) => {
                            const isReady = node.status === 'Ready';
                            return (
                                <div key={i} style={{ background: dark ? '#0D1117' : '#F8FAFC', border: `1px solid ${isReady ? 'rgba(63,185,80,0.25)' : 'rgba(248,81,73,0.25)'}`, borderRadius: 10, padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Server size={13} style={{ color: '#5A7080' }} />
                                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }} className="text-primary">{node.name}</span>
                                        </div>
                                        <StatusPill status={node.status} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                                        <span className="text-secondary"><span style={{ color: '#4A9EF5' }}>Role:</span> {node.role}</span>
                                        <span className="text-secondary"><span style={{ color: '#4A9EF5' }}>CPU:</span> {node.cpu}</span>
                                        <span className="text-secondary"><span style={{ color: '#4A9EF5' }}>Mem:</span> {node.memory}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Tabs */}
                    <div>
                        <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${dark ? '#1F2B3A' : '#E2E8F0'}`, marginBottom: 20 }}>
                            {TABS.map(tab => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                                    padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                    background: 'transparent', borderBottom: `2px solid ${activeTab === tab.id ? tab.color : 'transparent'}`,
                                    color: activeTab === tab.id ? tab.color : '#64748B', transition: 'all 150ms',
                                    display: 'flex', alignItems: 'center', gap: 7,
                                }}>
                                    {tab.label}
                                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: activeTab === tab.id ? `${tab.color}18` : 'rgba(100,116,139,0.1)', color: activeTab === tab.id ? tab.color : '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {activeTab === 'pods' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                    {[
                                        { label: 'Total Pods', value: overview?.totalPods ?? pods.length, color: '#4A9EF5' },
                                        { label: 'Running',    value: overview?.runningPods ?? pods.filter(p=>p.phase==='Running').length, color: '#3FB950' },
                                        { label: 'Pending',    value: overview?.pendingPods ?? pods.filter(p=>p.phase==='Pending').length, color: '#E8A838' },
                                        { label: 'Failed',     value: overview?.failedPods  ?? pods.filter(p=>p.phase==='Failed').length,  color: '#F85149' },
                                    ].map(s => (
                                        <div key={s.label} style={{ background: dark ? '#0D1117' : '#F8FAFC', border: `1px solid ${s.color}20`, borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: s.color }}>{s.value}</div>
                                            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>
                                {Object.entries(podsByNs).map(([ns, nsPods]) => (
                                    <div key={ns} className="ns-card" style={{ overflow: 'hidden' }}>
                                        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${dark ? '#1F2B3A' : '#E2E8F0'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#A371F7' }}>{ns}</span>
                                            <span style={{ fontSize: 10, color: '#64748B' }}>{nsPods.length} pods</span>
                                            <span style={{ fontSize: 10, color: '#3FB950', marginLeft: 'auto' }}>{nsPods.filter(p => p.phase === 'Running').length} running</span>
                                        </div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead><tr style={{ borderBottom: `1px solid ${dark ? '#1F2B3A' : '#E2E8F0'}` }}>
                                                {['Pod Name', 'Namespace', 'Phase', 'Node', 'Restarts', 'Ready'].map(h => (
                                                    <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                                ))}
                                            </tr></thead>
                                            <tbody>{nsPods.map((pod, i) => <PodRow key={i} pod={pod} />)}</tbody>
                                        </table>
                                    </div>
                                ))}
                                {pods.length === 0 && !loading && <div style={{ padding: 40, textAlign: 'center', color: '#64748B', fontSize: 13 }}>No pods found</div>}
                            </div>
                        )}

                        {activeTab === 'kafka' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <SectionHeader icon={Database} title="Kafka Brokers" count={kafkaBrokers.length} color="#E8A838" />
                                <div className="ns-card" style={{ overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                            {['Pod', 'Namespace', 'Phase', 'Node', 'Restarts', 'Ready'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>{kafkaBrokers.length === 0 ? <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No brokers found</td></tr> : kafkaBrokers.map((b, i) => <PodRow key={i} pod={b} />)}</tbody>
                                    </table>
                                </div>
                                <SectionHeader icon={Zap} title="Kafka Topics" count={topics.length} color="#E8A838" />
                                <div className="ns-card" style={{ overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                            {['Topic Name', 'Partitions', 'Retention (days)', 'Tenant', 'Created'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {topics.length === 0 ? <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No topics</td></tr>
                                            : topics.map((t, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                                    <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#E8A838' }}>{t.name}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 12 }} className="text-secondary">{t.partitions ?? 1}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 12 }} className="text-secondary">{t.retentionDays ?? 7}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{t.userId || '—'}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'knative' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <SectionHeader icon={Globe} title="Knative Services" count={knSvcs.length} color="#A371F7" />
                                <div className="ns-card" style={{ overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                            {['Service Name', 'Namespace', 'Tenant', 'Ready', 'URL'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {knSvcs.length === 0 ? <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No Knative services found</td></tr>
                                            : knSvcs.map((s, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                                    <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }} className="text-primary">{s.name}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{s.namespace}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 12 }} className="text-secondary">{s.tenant}</td>
                                                    <td style={{ padding: '10px 16px' }}>{s.ready === 'True' ? <CheckCircle size={14} style={{ color: '#3FB950' }} /> : <AlertCircle size={14} style={{ color: '#E8A838' }} />}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, color: '#4A9EF5', fontFamily: "'JetBrains Mono', monospace", maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'eventing' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <SectionHeader icon={Radio} title="KafkaSources" count={sources.length} color="#3FB950" />
                                <div className="ns-card" style={{ overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                            {['Name', 'Topic', 'Consumer Group', 'Tenant', 'Ready', 'Created'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {sources.length === 0 ? <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No KafkaSources</td></tr>
                                            : sources.map((s, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                                    <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }} className="text-primary">{s.name}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, color: '#E8A838', fontFamily: "'JetBrains Mono', monospace" }}>{s.kafkaTopicId}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{s.consumerGroup}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{s.userId}</td>
                                                    <td style={{ padding: '10px 16px' }}>{s.ready ? <CheckCircle size={14} style={{ color: '#3FB950' }} /> : <XCircle size={14} style={{ color: '#F85149' }} />}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <SectionHeader icon={GitBranch} title="Triggers" count={triggers.length} color="#3FB950" />
                                <div className="ns-card" style={{ overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                            {['Name', 'Filter Type', 'Subscriber', 'Broker', 'Tenant', 'Active', 'Ready'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {triggers.length === 0 ? <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No Triggers</td></tr>
                                            : triggers.map((t, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                                    <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }} className="text-primary">{t.name}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{t.filterType || '—'}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, color: '#4A9EF5' }}>{t.subscriberName}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{t.brokerName}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{t.userId}</td>
                                                    <td style={{ padding: '10px 16px' }}>{t.active ? <CheckCircle size={14} style={{ color: '#3FB950' }} /> : <XCircle size={14} style={{ color: '#F85149' }} />}</td>
                                                    <td style={{ padding: '10px 16px' }}>{t.ready ? <CheckCircle size={14} style={{ color: '#3FB950' }} /> : <XCircle size={14} style={{ color: '#F85149' }} />}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {activeTab === 'apps' && (
                            <div className="ns-card" style={{ overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                        {['Service', 'Tenant', 'Namespace', 'Status', 'Replicas', 'CPU', 'Memory', 'Image', 'Deployed'].map(h => (
                                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {apps.length === 0 ? <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>No applications</td></tr>
                                        : apps.map((app, i) => {
                                            const tenant = app.namespace?.replace(/^user-/, '') || app.userId || '—';
                                            return (
                                                <tr key={i}
                                                    onClick={() => navigate(`/apps/${app.id}`)}
                                                    style={{ borderBottom: '1px solid rgba(31,43,58,0.5)', cursor: 'pointer', transition: 'background 150ms' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                                >
                                                    <td style={{ padding: '10px 16px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(app.status), boxShadow: `0 0 5px ${statusColor(app.status)}` }} />
                                                            <span style={{ fontWeight: 700, fontSize: 13 }} className="text-primary">{app.serviceName || app.name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{tenant}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{app.namespace}</td>
                                                    <td style={{ padding: '10px 16px' }}><StatusPill status={app.status} /></td>
                                                    <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }} className="text-primary">{app.replicas ?? app.minReplicas ?? '—'} / {app.maxReplicas ?? '—'}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{app.cpuRequest || '—'}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{app.memoryRequest || '—'}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#4A9EF5', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.imageName}:{app.imageTag}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{app.deployedAt ? new Date(app.deployedAt).toLocaleDateString() : '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default Monitoring;
