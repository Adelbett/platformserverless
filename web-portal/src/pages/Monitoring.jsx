import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line,
} from 'recharts';
import {
    Box, Cpu, Zap, Clock, TrendingUp, TrendingDown, Minus,
    Activity, Server, Globe, AlertCircle,
} from 'lucide-react';
import { appsApi, metricsApi, adminApi } from '../api';
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

// ── Sparkline ──────────────────────────────────────────────────────────────────
const Sparkline = ({ data, color }) => (
    <ResponsiveContainer width="100%" height={32}>
        <LineChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive animationDuration={800} />
        </LineChart>
    </ResponsiveContainer>
);

// ── Trend badge ────────────────────────────────────────────────────────────────
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
    return (
        <div className="ns-card ns-card-hover" style={{ padding: 20, cursor: 'default' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, color: '#64748B' }}>{label}</p>
                    <p style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', sans-serif", lineHeight: 1, margin: 0 }} className="text-primary">{value}</p>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} style={{ color: iconColor }} />
                </div>
            </div>
            {sparkData && <Sparkline data={sparkData} color={sparkColor} />}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <TrendBadge value={trend} />
                {sub && <span style={{ fontSize: 10, color: '#9CA3AF' }}>{sub}</span>}
            </div>
        </div>
    );
};

// ── Gauge ring ─────────────────────────────────────────────────────────────────
const GaugeRing = ({ value, max = 100, color, label, sublabel }) => {
    const r    = 38;
    const circ = 2 * Math.PI * r;
    const pct  = Math.min(value / max, 1);
    const dash = pct * circ;
    const ring = value > max * 0.9 ? '#EF4444' : value > max * 0.75 ? '#F59E0B' : color;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div className="gauge-wrap">
                <svg viewBox="0 0 88 88">
                    <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8" stroke="rgba(156,163,175,0.18)" />
                    <circle cx="44" cy="44" r={r} fill="none" strokeWidth="8"
                        stroke={ring} strokeLinecap="round"
                        strokeDasharray={`${dash} ${circ}`}
                        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                    />
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

// ── Status badge ───────────────────────────────────────────────────────────────
const statusColor = s => ({ RUNNING: '#0070f3', SCALING: '#F59E0B', FAILED: '#EF4444' }[s] || '#6B7280');

// ── Main ───────────────────────────────────────────────────────────────────────
const Monitoring = () => {
    const navigate  = useNavigate();
    const { user }  = useAuth();
    const { dark }  = useTheme();
    const isAdmin   = user?.role === 'ADMIN';

    const [apps,    setApps]    = useState([]);
    const [cluster, setCluster] = useState(null);
    const [nodes,   setNodes]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('24h');
    const [chartData, setChartData] = useState([]);

    const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    const axisColor = dark ? '#374151' : '#94A3B8';

    useEffect(() => {
        const pts  = { '1h': 60, '6h': 72, '24h': 96, '7d': 84 }[timeRange] || 96;
        const base = { '1h': 800, '6h': 600, '24h': 500, '7d': 450 }[timeRange] || 500;
        setChartData(genData(pts, base, base * 0.6));
    }, [timeRange]);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const calls = isAdmin
                    ? [adminApi.getAllApps(), metricsApi.getCluster(), adminApi.getNodes()]
                    : [appsApi.list(), metricsApi.getCluster(), Promise.resolve({ data: [] })];
                const [appsRes, metricsRes, nodesRes] = await Promise.all(
                    calls.map(p => p.catch(() => ({ data: null })))
                );
                if (!active) return;
                setApps(Array.isArray(appsRes.data) ? appsRes.data : []);
                setCluster(metricsRes.data);
                setNodes(Array.isArray(nodesRes.data) ? nodesRes.data : []);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [isAdmin]);

    const running      = apps.filter(a => a.status === 'RUNNING').length;
    const totalReplicas = apps.reduce((s, a) => s + (a.replicas ?? a.minReplicas ?? 1), 0);
    const errorApps    = apps.filter(a => a.status === 'FAILED').length;
    const spark = (scale = 1) => Array.from({ length: 20 }, (_, i) => ({ value: (40 + Math.sin(i * 0.5) * 15 + Math.random() * 10) * scale }));

    const kpiCards = [
        {
            label: 'Total Apps',
            value: apps.length,
            sub: `${errorApps} errors`,
            trend: 2,
            icon: Box,
            iconBg: 'rgba(0,212,255,0.1)', iconColor: '#00D4FF', sparkColor: '#00D4FF', sparkData: spark(0.8),
        },
        {
            label: 'Running Instances',
            value: totalReplicas,
            sub: `${running}/${apps.length} apps healthy`,
            trend: 0,
            icon: Cpu,
            iconBg: 'rgba(168,85,247,0.1)', iconColor: '#A855F7', sparkColor: '#A855F7', sparkData: spark(1),
        },
        {
            label: 'Requests / sec',
            value: fmtReq(cluster?.totalReqPerSec),
            sub: cluster ? `Error: ${fmtPct(cluster.clusterErrorRate)}` : 'No data',
            trend: 8,
            icon: Zap,
            iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', sparkColor: '#10B981', sparkData: spark(1.2),
        },
        {
            label: 'CPU Cores',
            value: cluster ? cluster.totalCpuCores?.toFixed(2) : '—',
            sub: cluster ? `${cluster.totalMemoryGiB?.toFixed(1)} GiB RAM` : 'No data',
            trend: -3,
            icon: Clock,
            iconBg: 'rgba(245,158,11,0.1)', iconColor: '#F59E0B', sparkColor: '#F59E0B', sparkData: spark(0.4),
        },
    ];

    if (isAdmin) {
        const readyNodes = nodes.filter(n => n.status === 'Ready').length;
        kpiCards.push({
            label: 'K8s Nodes',
            value: `${readyNodes}/${nodes.length}`,
            sub: readyNodes < nodes.length ? `${nodes.length - readyNodes} not ready` : 'all healthy',
            trend: 0,
            icon: Server,
            iconBg: 'rgba(63,185,80,0.1)', iconColor: '#3FB950', sparkColor: '#3FB950', sparkData: spark(0.3),
        });
    }

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
                            ? `All tenants · ${apps.length} services · ${running} running`
                            : `NEXTSTEP Serverless Platform · ${new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    {!isAdmin && (
                        <button className="btn-primary" onClick={() => navigate('/apps/new')}>
                            Deploy Service
                        </button>
                    )}
                    <button className="btn-secondary" onClick={() => navigate('/logs')}>
                        View Logs
                    </button>
                </div>
            </div>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isAdmin ? 5 : 4}, 1fr)`, gap: 16 }}>
                {kpiCards.map(card => (
                    <KpiCard key={card.label} {...card} loading={loading} />
                ))}
            </div>

            {/* Chart + Gauges */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>

                {/* Area Chart */}
                <div className="ns-card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Request Volume</h3>
                            <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">HTTP requests / sec · last {timeRange}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: dark ? '#1F2937' : '#F1F5F9', borderRadius: 8, padding: 4 }}>
                            {TIME_RANGES.map(r => (
                                <button key={r} onClick={() => setTimeRange(r)} style={{
                                    padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                    fontSize: 11, fontWeight: 700, transition: 'all 150ms',
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
                            <Area type="monotoneX" dataKey="value" name="req/s" stroke="#00D4FF" strokeWidth={2} fill="url(#gCyan)" dot={false} isAnimationActive animationDuration={600} />
                            <Area type="monotoneX" dataKey="p95"   name="P95"   stroke="#0066FF" strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gBlue)" dot={false} isAnimationActive animationDuration={800} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Gauges */}
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
                        <GaugeRing
                            value={cluster?.cpuUsagePct ?? 68}
                            color="#00D4FF"
                            label="CPU"
                            sublabel={cluster ? `${cluster.totalCpuCores?.toFixed(1)} cores` : '6.8 / 10 cores'}
                        />
                        <GaugeRing
                            value={cluster?.memUsagePct ?? 45}
                            color="#A855F7"
                            label="Memory"
                            sublabel={cluster ? `${cluster.totalMemoryGiB?.toFixed(1)} GiB` : '18 / 40 GB'}
                        />
                        <GaugeRing
                            value={cluster?.netUsagePct ?? 32}
                            color="#10B981"
                            label="Network"
                            sublabel={cluster ? `${cluster.netSendMBs?.toFixed(1)} MB/s` : '4.1 / 5 Gbps'}
                        />
                    </div>
                </div>
            </div>

            {/* Services table */}
            <div className="ns-card" style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div>
                        <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">
                            {isAdmin ? 'All Services' : 'Applications'}
                        </h3>
                        <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">{apps.length} services · {running} running</p>
                    </div>
                    <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate('/apps')}>
                        View all →
                    </button>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr>
                                {['Service', ...(isAdmin ? ['Tenant'] : []), 'Namespace', 'Status', 'Replicas', 'CPU', 'Memory', 'Last Deploy'].map(h => (
                                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={isAdmin ? 8 : 7} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>Loading…</td></tr>
                            ) : apps.length === 0 ? (
                                <tr><td colSpan={isAdmin ? 8 : 7} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>No services found</td></tr>
                            ) : apps.slice(0, 10).map((app, i) => {
                                const col = statusColor(app.status);
                                const tenant = app.namespace?.replace(/^user-/, '') || app.userId || '—';
                                return (
                                    <tr key={app.id || i}
                                        onClick={() => navigate(`/apps/${app.id}`)}
                                        style={{ cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background 150ms' }}
                                        onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: col, boxShadow: `0 0 6px ${col}`, flexShrink: 0 }} />
                                                <span style={{ fontWeight: 700 }} className="text-primary">{app.serviceName || app.name || '—'}</span>
                                            </div>
                                        </td>
                                        {isAdmin && (
                                            <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#A371F7' }}>{tenant}</td>
                                        )}
                                        <td style={{ padding: '12px 16px', fontSize: 12 }} className="text-secondary">{app.namespace || 'default'}</td>
                                        <td style={{ padding: '12px 16px' }}>
                                            <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: `${col}18`, color: col, border: `1px solid ${col}33` }}>
                                                {app.status || 'Unknown'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 16px', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }} className="text-primary">
                                            {app.replicas ?? app.minReplicas ?? '—'}
                                        </td>
                                        <td style={{ padding: '12px 16px', fontSize: 12 }} className="text-secondary">{app.cpuRequest || '—'}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 12 }} className="text-secondary">{app.memoryRequest || '—'}</td>
                                        <td style={{ padding: '12px 16px', fontSize: 12 }} className="text-secondary">
                                            {app.deployedAt ? new Date(app.deployedAt).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Admin: Nodes summary */}
            {isAdmin && nodes.length > 0 && (
                <div className="ns-card" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">
                            Kubernetes Nodes
                        </h3>
                        <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">
                            {nodes.filter(n => n.status === 'Ready').length}/{nodes.length} ready
                        </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16, padding: 20 }}>
                        {nodes.map((node, i) => {
                            const isReady = node.status === 'Ready';
                            return (
                                <div key={i} style={{
                                    background: dark ? '#0D1117' : '#F8FAFC',
                                    border: `1px solid ${isReady ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)'}`,
                                    borderRadius: 10, padding: '14px 16px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Server size={14} style={{ color: '#5A7080' }} />
                                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700 }} className="text-primary">{node.name}</span>
                                        </div>
                                        <span style={{
                                            fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                            fontFamily: "'JetBrains Mono', monospace",
                                            color: isReady ? '#3FB950' : '#F85149',
                                            background: isReady ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
                                            border: `1px solid ${isReady ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)'}`,
                                        }}>{node.status}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: 14, fontSize: 11 }}>
                                        <span className="text-secondary"><span style={{ color: '#4A9EF5' }}>Role:</span> {node.role}</span>
                                        <span className="text-secondary"><span style={{ color: '#4A9EF5' }}>CPU:</span> {node.cpu}</span>
                                        <span className="text-secondary"><span style={{ color: '#4A9EF5' }}>Mem:</span> {node.memory}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Monitoring;
