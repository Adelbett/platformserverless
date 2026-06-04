import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line,
} from 'recharts';
import {
    Box, Cpu, Zap, Clock, TrendingUp, TrendingDown, Minus,
    Activity, Server, Globe, Users, Database, GitBranch,
    Radio, Layers, CheckCircle, XCircle, AlertCircle, RefreshCw,
} from 'lucide-react';
import { appsApi, metricsApi, adminApi, eventingApi, kafkaApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ── helpers ────────────────────────────────────────────────────────────────────
const genData = (pts, base, v) =>
    Array.from({ length: pts }, (_, i) => {
        const d = new Date();
        d.setMinutes(d.getMinutes() - (pts - i));
        return {
            label: d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }),
            value: Math.max(0, base + (Math.random() - 0.5) * v),
            p95:   Math.max(0, base * 1.3 + (Math.random() - 0.5) * v * 0.4),
        };
    });

const fmtReq = v => v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1);
const fmtPct = v => v == null ? '—' : `${(v * 100).toFixed(2)}%`;
const TIME_RANGES = ['1h', '6h', '24h', '7d'];

const statusColor = s => ({
    RUNNING: '#3FB950', Running: '#3FB950',
    FAILED:  '#F85149', Failed: '#F85149',
    SCALING: '#E8A838', Pending: '#E8A838',
    Succeeded: '#4A9EF5',
}[s] || '#5A7080');

// ── Sparkline ──────────────────────────────────────────────────────────────────
const Sparkline = ({ data, color }) => (
    <ResponsiveContainer width="100%" height={32}>
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive animationDuration={800} />
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
    const spark = sparkData || Array.from({ length: 20 }, (_, i) => ({ value: 40 + Math.sin(i * 0.5) * 15 + Math.random() * 10 }));
    return (
        <div className="ns-card ns-card-hover" style={{ padding: 20, cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, color: '#64748B' }}>{label}</p>
                    <p style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', sans-serif", lineHeight: 1, margin: 0 }} className="text-primary">{value ?? '—'}</p>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} style={{ color: iconColor }} />
                </div>
            </div>
            <Sparkline data={spark} color={sparkColor} />
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
    const pct = Math.min(value / max, 1), dash = pct * circ;
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
                    <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "'Outfit', sans-serif" }} className="text-primary">{value}%</span>
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
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
                </p>
            ))}
        </div>
    );
};

// ── Section header ─────────────────────────────────────────────────────────────
const SectionHeader = ({ icon: Icon, title, count, color = '#4A9EF5' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(pod.phase), boxShadow: `0 0 5px ${statusColor(pod.phase)}`, flexShrink: 0 }} />
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
            {pod.ready
                ? <CheckCircle size={14} style={{ color: '#3FB950' }} />
                : <XCircle    size={14} style={{ color: '#F85149' }} />}
        </td>
    </tr>
);

// ── Main ───────────────────────────────────────────────────────────────────────
const Monitoring = () => {
    const navigate  = useNavigate();
    const { user }  = useAuth();
    const { dark }  = useTheme();
    const isAdmin   = user?.role === 'ADMIN';

    const [loading,   setLoading]   = useState(true);
    const [refreshing,setRefreshing]= useState(false);
    const [timeRange, setTimeRange] = useState('24h');
    const [chartData, setChartData] = useState([]);
    const [activeTab, setActiveTab] = useState('pods'); // pods | kafka | knative | eventing | apps

    // data
    const [overview,  setOverview]  = useState(null);
    const [apps,      setApps]      = useState([]);
    const [cluster,   setCluster]   = useState(null);
    const [nodes,     setNodes]     = useState([]);
    const [pods,      setPods]      = useState([]);
    const [knSvcs,    setKnSvcs]    = useState([]);
    const [kafkaBrokers, setKafkaBrokers] = useState([]);
    const [topics,    setTopics]    = useState([]);
    const [sources,   setSources]   = useState([]);
    const [triggers,  setTriggers]  = useState([]);

    const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    const axisColor = dark ? '#374151' : '#94A3B8';

    useEffect(() => {
        const pts  = { '1h': 60, '6h': 72, '24h': 96, '7d': 84 }[timeRange] || 96;
        const base = { '1h': 800, '6h': 600, '24h': 500, '7d': 450 }[timeRange] || 500;
        setChartData(genData(pts, base, base * 0.6));
    }, [timeRange]);

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
                setApps(Array.isArray(appsRes.data) ? appsRes.data : []);
                setCluster(metricsRes.data);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { loadData(); }, [isAdmin]);

    // SSE — cluster metrics temps réel toutes les 10s
    useEffect(() => {
        const token = localStorage.getItem('token');
        const es = new EventSource(`/api/metrics/cluster/stream?token=${token}`);
        es.onmessage = (e) => {
            try { setCluster(JSON.parse(e.data)); } catch {}
        };
        es.onerror = () => es.close();
        return () => es.close();
    }, []);

    const refresh = () => { setRefreshing(true); loadData(); };

    const running = apps.filter(a => a.status === 'RUNNING').length;
    const totalReplicas = apps.reduce((s, a) => s + (a.replicas ?? a.minReplicas ?? 1), 0);

    // ── KPI data ───────────────────────────────────────────────────────
    const kpiCards = isAdmin ? [
        { label: 'Total Users',    value: overview?.totalUsers ?? '—',  sub: '',                                   trend: 0,  icon: Users,    iconBg: 'rgba(74,158,245,0.1)',  iconColor: '#4A9EF5', sparkColor: '#4A9EF5' },
        { label: 'Total Apps',     value: overview?.totalApps ?? apps.length, sub: `${overview?.failedApps ?? 0} failed`, trend: 2, icon: Box, iconBg: 'rgba(0,212,255,0.1)', iconColor: '#00D4FF', sparkColor: '#00D4FF' },
        { label: 'Running Apps',   value: overview?.runningApps ?? running, sub: `${running}/${apps.length} healthy`, trend: 0, icon: Activity, iconBg: 'rgba(63,185,80,0.1)', iconColor: '#3FB950', sparkColor: '#3FB950' },
        { label: 'Running Pods',   value: overview?.runningPods ?? '—', sub: `${overview?.totalPods ?? '?'} total`, trend: 0, icon: Layers,  iconBg: 'rgba(168,85,247,0.1)', iconColor: '#A855F7', sparkColor: '#A855F7' },
        { label: 'Kafka Topics',   value: overview?.totalTopics ?? topics.length, sub: `${sources.length} sources`, trend: 0, icon: Zap, iconBg: 'rgba(232,168,56,0.1)', iconColor: '#E8A838', sparkColor: '#E8A838' },
        { label: 'Knative Svcs',   value: knSvcs.length,               sub: `${overview?.tenantNamespaces ?? 0} namespaces`, trend: 0, icon: Globe,   iconBg: 'rgba(163,113,247,0.1)', iconColor: '#A371F7', sparkColor: '#A371F7' },
        { label: 'Req / sec',      value: fmtReq(cluster?.totalReqPerSec), sub: cluster ? `Error: ${fmtPct(cluster.clusterErrorRate)}` : 'No data', trend: 8, icon: Radio, iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', sparkColor: '#10B981' },
        { label: 'K8s Nodes',      value: `${nodes.filter(n => n.status === 'Ready').length}/${nodes.length}`, sub: `${overview?.pendingPods ?? 0} pending pods`, trend: 0, icon: Server, iconBg: 'rgba(63,185,80,0.1)', iconColor: '#3FB950', sparkColor: '#3FB950' },
    ] : [
        { label: 'Total Apps',     value: apps.length,    sub: `${apps.filter(a=>a.status==='FAILED').length} errors`, trend: 2, icon: Box,      iconBg: 'rgba(0,212,255,0.1)',  iconColor: '#00D4FF', sparkColor: '#00D4FF' },
        { label: 'Running Instances', value: totalReplicas, sub: `${running}/${apps.length} healthy`,                 trend: 0, icon: Cpu,      iconBg: 'rgba(168,85,247,0.1)', iconColor: '#A855F7', sparkColor: '#A855F7' },
        { label: 'Requests / sec', value: fmtReq(cluster?.totalReqPerSec), sub: cluster ? `Error: ${fmtPct(cluster.clusterErrorRate)}` : 'No data', trend: 8, icon: Zap, iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', sparkColor: '#10B981' },
        { label: 'CPU Cores',      value: cluster ? cluster.totalCpuCores?.toFixed(2) : '—', sub: cluster ? `${cluster.totalMemoryGiB?.toFixed(1)} GiB RAM` : 'No data', trend: -3, icon: Clock, iconBg: 'rgba(245,158,11,0.1)', iconColor: '#F59E0B', sparkColor: '#F59E0B' },
    ];

    // ── Pods grouped by namespace ──────────────────────────────────────
    const podsByNs = pods.reduce((acc, p) => {
        const ns = p.namespace || 'default';
        if (!acc[ns]) acc[ns] = [];
        acc[ns].push(p);
        return acc;
    }, {});

    const TABS = isAdmin ? [
        { id: 'pods',     label: 'Pods',            count: pods.length,       color: '#4A9EF5' },
        { id: 'kafka',    label: 'Kafka',           count: topics.length,     color: '#E8A838' },
        { id: 'knative',  label: 'Knative',         count: knSvcs.length,     color: '#A371F7' },
        { id: 'eventing', label: 'Eventing',        count: sources.length + triggers.length, color: '#3FB950' },
        { id: 'apps',     label: 'Apps / Users',    count: apps.length,       color: '#00D4FF' },
    ] : [];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#4A9EF5', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 6px' }}>
                        {isAdmin ? 'Admin Console' : 'Realtime Monitor'}
                    </p>
                    <h2 style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">
                        {isAdmin ? 'Global Monitoring' : 'System Overview'}
                    </h2>
                    <p style={{ fontSize: 12, margin: '4px 0 0' }} className="text-secondary">
                        {isAdmin
                            ? `${apps.length} services · ${pods.length} pods · ${nodes.length} nodes · ${topics.length} kafka topics`
                            : `NEXTSTEP Serverless Platform · ${new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button className="btn-secondary" onClick={refresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                    {!isAdmin && <button className="btn-primary" onClick={() => navigate('/apps/new')}>Deploy Service</button>}
                    <button className="btn-secondary" onClick={() => navigate('/logs')}>View Logs</button>
                </div>
            </div>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isAdmin ? 4 : 4}, 1fr)`, gap: 16 }}>
                {kpiCards.slice(0, isAdmin ? 8 : 4).map(card => (
                    <KpiCard key={card.label} {...card} loading={loading} />
                ))}
            </div>

            {/* Chart + Gauges */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
                <div className="ns-card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Request Volume</h3>
                            <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">HTTP requests / sec · last {timeRange}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: dark ? '#1F2937' : '#F1F5F9', borderRadius: 8, padding: 4 }}>
                            {TIME_RANGES.map(r => (
                                <button key={r} onClick={() => setTimeRange(r)} style={{
                                    padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                    background: timeRange === r ? (dark ? '#111827' : '#FFFFFF') : 'transparent',
                                    color: timeRange === r ? '#00D4FF' : '#64748B',
                                    boxShadow: timeRange === r ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                                }}>{r}</button>
                            ))}
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gCyan" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.22} />
                                    <stop offset="100%" stopColor="#00D4FF" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#0066FF" stopOpacity={0.1} />
                                    <stop offset="100%" stopColor="#0066FF" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(chartData.length / 6)} />
                            <YAxis tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v} />
                            <Tooltip content={<ChartTooltip />} />
                            <Area type="monotoneX" dataKey="value" name="req/s" stroke="#00D4FF" strokeWidth={2} fill="url(#gCyan)" dot={false} />
                            <Area type="monotoneX" dataKey="p95"   name="P95"   stroke="#0066FF" strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gBlue)" dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {isAdmin ? (
                <div className="ns-card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Resources</h3>
                            <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">Cluster · live</p>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.1)', padding: '3px 10px', borderRadius: 999 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulseDot 2s ease-in-out infinite' }} />
                            Live
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center' }}>
                        <GaugeRing value={cluster?.cpuUsagePct ?? 0} color="#00D4FF" label="CPU"     sublabel={cluster ? `${cluster.totalCpuCores?.toFixed(1)} cores` : '—'} />
                        <GaugeRing value={cluster?.memUsagePct ?? 0} color="#A855F7" label="Memory"  sublabel={cluster ? `${cluster.totalMemoryGiB?.toFixed(1)} GiB`  : '—'} />
                        <GaugeRing value={Math.min(100, Math.round((cluster?.netSendMBs ?? 0) / 10))} color="#10B981" label="Network" sublabel={cluster ? `${cluster.netSendMBs?.toFixed(1)} MB/s` : '—'} />
                    </div>
                </div>
                ) : (
                <div className="ns-card" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Your applications</p>
                        <p style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#00D4FF', margin: '8px 0' }}>{apps.length}</p>
                        <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>{running} running · {apps.length - running} idle</p>
                    </div>
                </div>
                )}
            </div>

            {/* ── ADMIN ONLY: detailed tabs ─────────────────────────── */}
            {isAdmin && (
                <>
                    {/* Nodes summary bar */}
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
                                    color: activeTab === tab.id ? tab.color : '#64748B',
                                    transition: 'all 150ms', display: 'flex', alignItems: 'center', gap: 7,
                                }}>
                                    {tab.label}
                                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: activeTab === tab.id ? `${tab.color}18` : 'rgba(100,116,139,0.1)', color: activeTab === tab.id ? tab.color : '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* ── Tab: Pods ── */}
                        {activeTab === 'pods' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Pod stats row */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                                    {[
                                        { label: 'Total Pods',   value: overview?.totalPods ?? pods.length,   color: '#4A9EF5' },
                                        { label: 'Running',      value: overview?.runningPods ?? pods.filter(p=>p.phase==='Running').length, color: '#3FB950' },
                                        { label: 'Pending',      value: overview?.pendingPods ?? pods.filter(p=>p.phase==='Pending').length, color: '#E8A838' },
                                        { label: 'Failed',       value: overview?.failedPods  ?? pods.filter(p=>p.phase==='Failed').length,  color: '#F85149' },
                                    ].map(s => (
                                        <div key={s.label} style={{ background: dark ? '#0D1117' : '#F8FAFC', border: `1px solid ${s.color}20`, borderRadius: 10, padding: '14px 18px', textAlign: 'center' }}>
                                            <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: s.color }}>{s.value}</div>
                                            <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>{s.label}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pods by namespace */}
                                {Object.entries(podsByNs).map(([ns, nsPods]) => (
                                    <div key={ns} className="ns-card" style={{ overflow: 'hidden' }}>
                                        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${dark ? '#1F2B3A' : '#E2E8F0'}`, display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#A371F7' }}>{ns}</span>
                                            <span style={{ fontSize: 10, color: '#64748B' }}>{nsPods.length} pods</span>
                                            <span style={{ fontSize: 10, color: '#3FB950', marginLeft: 'auto' }}>
                                                {nsPods.filter(p => p.phase === 'Running').length} running
                                            </span>
                                        </div>
                                        <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: `1px solid ${dark ? '#1F2B3A' : '#E2E8F0'}` }}>
                                                        {['Pod Name', 'Namespace', 'Phase', 'Node', 'Restarts', 'Ready'].map(h => (
                                                            <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {nsPods.map((pod, i) => <PodRow key={i} pod={pod} />)}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}

                                {pods.length === 0 && !loading && (
                                    <div style={{ padding: 40, textAlign: 'center', color: '#64748B', fontSize: 13 }}>No pods found</div>
                                )}
                            </div>
                        )}

                        {/* ── Tab: Kafka ── */}
                        {activeTab === 'kafka' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <SectionHeader icon={Database} title="Kafka Brokers" count={kafkaBrokers.length} color="#E8A838" />
                                {kafkaBrokers.length === 0 ? (
                                    <div style={{ padding: '20px', background: dark ? '#0D1117' : '#F8FAFC', borderRadius: 10, border: '1px solid #1F2B3A', color: '#64748B', fontSize: 12 }}>
                                        No Kafka broker pods found — check labels <code style={{ color: '#E8A838' }}>strimzi.io/kind=Kafka</code>
                                    </div>
                                ) : (
                                    <div className="ns-card" style={{ overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                                {['Pod', 'Namespace', 'Phase', 'Node', 'Restarts', 'Ready'].map(h => (
                                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                                ))}
                                            </tr></thead>
                                            <tbody>{kafkaBrokers.map((b, i) => <PodRow key={i} pod={b} />)}</tbody>
                                        </table>
                                    </div>
                                )}

                                <SectionHeader icon={Zap} title="Kafka Topics" count={topics.length} color="#E8A838" />
                                <div className="ns-card" style={{ overflow: 'hidden' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                            {['Topic Name', 'Partitions', 'Retention (days)', 'Tenant', 'Created'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {topics.length === 0 ? (
                                                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No topics</td></tr>
                                            ) : topics.map((t, i) => (
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

                        {/* ── Tab: Knative ── */}
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
                                            {knSvcs.length === 0 ? (
                                                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No Knative services found</td></tr>
                                            ) : knSvcs.map((s, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                                    <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }} className="text-primary">{s.name}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{s.namespace}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 12 }} className="text-secondary">{s.tenant}</td>
                                                    <td style={{ padding: '10px 16px' }}>
                                                        {s.ready === 'True'
                                                            ? <CheckCircle size={14} style={{ color: '#3FB950' }} />
                                                            : <AlertCircle size={14} style={{ color: '#E8A838' }} />}
                                                    </td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, color: '#4A9EF5', fontFamily: "'JetBrains Mono', monospace", maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {s.url || '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── Tab: Eventing ── */}
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
                                            {sources.length === 0 ? (
                                                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No KafkaSources</td></tr>
                                            ) : sources.map((s, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                                    <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }} className="text-primary">{s.name}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, color: '#E8A838', fontFamily: "'JetBrains Mono', monospace" }}>{s.kafkaTopicId}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{s.consumerGroup}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{s.userId}</td>
                                                    <td style={{ padding: '10px 16px' }}>
                                                        {s.ready ? <CheckCircle size={14} style={{ color: '#3FB950' }} /> : <XCircle size={14} style={{ color: '#F85149' }} />}
                                                    </td>
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
                                            {triggers.length === 0 ? (
                                                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No Triggers</td></tr>
                                            ) : triggers.map((t, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                                    <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }} className="text-primary">{t.name}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{t.filterType || '—'}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, color: '#4A9EF5' }}>{t.subscriberName}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{t.brokerName}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 12, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{t.userId}</td>
                                                    <td style={{ padding: '10px 16px' }}>
                                                        {t.active ? <CheckCircle size={14} style={{ color: '#3FB950' }} /> : <XCircle size={14} style={{ color: '#F85149' }} />}
                                                    </td>
                                                    <td style={{ padding: '10px 16px' }}>
                                                        {t.ready ? <CheckCircle size={14} style={{ color: '#3FB950' }} /> : <XCircle size={14} style={{ color: '#F85149' }} />}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ── Tab: Apps / Users ── */}
                        {activeTab === 'apps' && (
                            <div className="ns-card" style={{ overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                        {['Service', 'Tenant', 'Namespace', 'Status', 'Replicas', 'CPU', 'Memory', 'Image', 'Deployed'].map(h => (
                                            <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                        ))}
                                    </tr></thead>
                                    <tbody>
                                        {apps.length === 0 ? (
                                            <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>No applications</td></tr>
                                        ) : apps.map((app, i) => {
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
                                                    <td style={{ padding: '10px 16px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }} className="text-primary">
                                                        {app.replicas ?? app.minReplicas ?? '—'} / {app.maxReplicas ?? '—'}
                                                    </td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{app.cpuRequest || '—'}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">{app.memoryRequest || '—'}</td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#4A9EF5', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {app.imageName}:{app.imageTag}
                                                    </td>
                                                    <td style={{ padding: '10px 16px', fontSize: 11 }} className="text-secondary">
                                                        {app.deployedAt ? new Date(app.deployedAt).toLocaleDateString() : '—'}
                                                    </td>
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

            {/* ── CLIENT: simple services table ── */}
            {!isAdmin && (
                <div className="ns-card" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Applications</h3>
                        <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">{apps.length} services · {running} running</p>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            {['Service', 'Status', 'Replicas', 'CPU', 'Memory', 'Deployed'].map(h => (
                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B' }}>{h}</th>
                            ))}
                        </tr></thead>
                        <tbody>
                            {loading ? <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>Loading…</td></tr>
                            : apps.length === 0 ? <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>No services found</td></tr>
                            : apps.map((app, i) => (
                                <tr key={i} onClick={() => navigate(`/apps/${app.id}`)} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(app.status), boxShadow: `0 0 5px ${statusColor(app.status)}` }} />
                                            <span style={{ fontWeight: 700 }} className="text-primary">{app.serviceName || app.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}><StatusPill status={app.status} /></td>
                                    <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }} className="text-primary">{app.replicas ?? app.minReplicas ?? '—'}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 12 }} className="text-secondary">{app.cpuRequest || '—'}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 12 }} className="text-secondary">{app.memoryRequest || '—'}</td>
                                    <td style={{ padding: '12px 16px', fontSize: 12 }} className="text-secondary">{app.deployedAt ? new Date(app.deployedAt).toLocaleDateString() : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default Monitoring;
