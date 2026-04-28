import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, LineChart, Line
} from 'recharts';
import {
    Box, Cpu, Zap, Clock, TrendingUp, TrendingDown, Minus,
    Rocket, ArrowRight, RefreshCw, ChevronUp, ChevronDown,
    ChevronsUpDown, X, ExternalLink, CheckCircle2
} from 'lucide-react';
import { appsApi } from '../api';
import { useTheme } from '../context/ThemeContext';

// ── Mock data ──────────────────────────────────────────────────────────────────

const genData = (pts, base, v) =>
    Array.from({ length: pts }, () => ({
        value: Math.max(0, base + (Math.random() - 0.5) * v),
        p95:   Math.max(0, base * 1.3 + (Math.random() - 0.5) * v * 0.5),
    }));

const TIME_RANGES = ['1h', '6h', '24h', '7d'];

const MOCK_APPS = [
    { id: 'api-gateway',   name: 'api-gateway',   status: 'RUNNING', replicas: 3, lastDeploy: '3m ago',  traffic: '4.2k rps', version: 'v2.1.4' },
    { id: 'auth-service',  name: 'auth-service',  status: 'RUNNING', replicas: 2, lastDeploy: '1h ago',  traffic: '890 rps',  version: 'v1.8.2' },
    { id: 'worker-jobs',   name: 'worker-jobs',   status: 'IDLE',    replicas: 1, lastDeploy: '2h ago',  traffic: '12 rps',   version: 'v3.0.1' },
    { id: 'frontend-app',  name: 'frontend-app',  status: 'RUNNING', replicas: 4, lastDeploy: '30m ago', traffic: '2.1k rps', version: 'v5.2.0' },
    { id: 'ml-inference',  name: 'ml-inference',  status: 'ERROR',   replicas: 0, lastDeploy: '4h ago',  traffic: '0 rps',    version: 'v0.9.1' },
    { id: 'data-pipeline', name: 'data-pipeline', status: 'RUNNING', replicas: 2, lastDeploy: '6h ago',  traffic: '340 rps',  version: 'v1.2.0' },
];

const MOCK_ACTIVITY = [
    { id: 1, color: '#10B981', app: 'api-gateway',   msg: 'Deployed v2.1.4 successfully',         time: '3m ago'  },
    { id: 2, color: '#00D4FF', app: 'frontend-app',  msg: 'Scaled up to 4 replicas',              time: '28m ago' },
    { id: 3, color: '#EF4444', app: 'ml-inference',  msg: 'Health check failed — pod restarting', time: '45m ago' },
    { id: 4, color: '#10B981', app: 'auth-service',  msg: 'Deployed v1.8.2 successfully',         time: '1h ago'  },
    { id: 5, color: '#F59E0B', app: 'worker-jobs',   msg: 'Scaled down to 1 replica (idle)',      time: '2h ago'  },
    { id: 6, color: '#10B981', app: 'data-pipeline', msg: 'Pipeline v1.2.0 deployed',             time: '6h ago'  },
];

// ── Status badge ───────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const styles = {
        RUNNING: 'badge-running',
        IDLE:    'badge-idle',
        ERROR:   'badge-error',
        PENDING: 'badge-pending',
    };
    const dotColors = {
        RUNNING: '#10B981',
        IDLE:    '#F59E0B',
        ERROR:   '#EF4444',
        PENDING: '#3B82F6',
    };
    const cls = styles[status] || 'badge-pending';
    const dot = dotColors[status] || '#3B82F6';
    return (
        <span className={cls}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', ...(status === 'RUNNING' || status === 'ERROR' ? { animation: 'pulseDot 2s ease-in-out infinite' } : {}) }} />
            {status || 'PENDING'}
        </span>
    );
};

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
    if (loading) {
        return (
            <div className="ns-card" style={{ padding: 20 }}>
                <div className="skeleton" style={{ height: 12, width: 80, marginBottom: 12 }} />
                <div className="skeleton" style={{ height: 28, width: 60, marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 10, width: 100 }} />
            </div>
        );
    }
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="ns-card ns-card-hover"
            style={{ padding: 20, cursor: 'default' }}
        >
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
        </motion.div>
    );
};

// ── Gauge ring ─────────────────────────────────────────────────────────────────

const GaugeRing = ({ value, max = 100, color, label, sublabel }) => {
    const r     = 38;
    const circ  = 2 * Math.PI * r;
    const pct   = Math.min(value / max, 1);
    const dash  = pct * circ;
    const crit  = value > max * 0.9;
    const warn  = value > max * 0.75;
    const ring  = crit ? '#EF4444' : warn ? '#F59E0B' : color;

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

// ── Tooltip ────────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <p style={{ color: '#9CA3AF', marginBottom: 6 }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, fontWeight: 600, margin: '2px 0' }}>
                    {p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}
                </p>
            ))}
        </div>
    );
};

// ── Quick Deploy Panel ─────────────────────────────────────────────────────────

const QuickDeployPanel = ({ onClose }) => {
    const [form, setForm]      = useState({ name: '', image: '', port: '8080', replicas: 1 });
    const [busy, setBusy]      = useState(false);
    const [done, setDone]      = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const deploy = async () => {
        setBusy(true);
        await new Promise(r => setTimeout(r, 1800));
        setBusy(false); setDone(true);
    };

    return (
        <>
            <div className="slide-over-overlay" onClick={onClose} />
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                className="slide-over-panel"
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
                    <div>
                        <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, fontFamily: "'Outfit', sans-serif" }} className="text-primary">Quick Deploy</h2>
                        <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">Deploy a new service in seconds</p>
                    </div>
                    <button className="btn-ghost" style={{ width: 32, height: 32, padding: 0 }} onClick={onClose}><X size={16} /></button>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
                    {done ? (
                        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16, textAlign: 'center' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <CheckCircle2 size={32} style={{ color: '#10B981' }} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: 17, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: '0 0 6px' }} className="text-primary">{form.name || 'Service'} deployed!</h3>
                                <p style={{ fontSize: 13 }} className="text-secondary">Your service is being provisioned and will be live in ~30s.</p>
                            </div>
                            <button className="btn-secondary" style={{ marginTop: 8 }} onClick={onClose}>Close</button>
                        </motion.div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {[
                                { label: 'Service Name', key: 'name', placeholder: 'e.g. my-api-service', mono: false },
                                { label: 'Docker Image', key: 'image', placeholder: 'nginx:latest', mono: true },
                            ].map(f => (
                                <div key={f.key}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, color: '#64748B' }}>{f.label}</label>
                                    <input className="ns-input" style={f.mono ? { fontFamily: "'JetBrains Mono', monospace", fontSize: 12 } : {}}
                                        placeholder={f.placeholder} value={form[f.key]} onChange={e => set(f.key, e.target.value)} />
                                </div>
                            ))}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, color: '#64748B' }}>Port</label>
                                    <input className="ns-input" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} placeholder="8080" value={form.port} onChange={e => set('port', e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, color: '#64748B' }}>Replicas</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <button className="btn-secondary" style={{ width: 36, height: 36, padding: 0 }} onClick={() => set('replicas', Math.max(1, form.replicas - 1))}>−</button>
                                        <span style={{ flex: 1, textAlign: 'center', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 16 }} className="text-primary">{form.replicas}</span>
                                        <button className="btn-secondary" style={{ width: 36, height: 36, padding: 0 }} onClick={() => set('replicas', Math.min(10, form.replicas + 1))}>+</button>
                                    </div>
                                </div>
                            </div>
                            <div style={{ padding: 14, borderRadius: 10, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
                                <p style={{ fontSize: 11, fontWeight: 700, color: '#00D4FF', margin: '0 0 4px' }}>Deployment Preview</p>
                                <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", margin: 0, color: '#9CA3AF' }}>
                                    {form.image || '<image>'} → {form.name || '<name>'} × {form.replicas}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {!done && (
                    <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', gap: 12, flexShrink: 0 }}>
                        <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
                        <button className="btn-primary" style={{ flex: 1 }} disabled={busy || !form.name || !form.image} onClick={deploy}>
                            {busy ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Deploying…</> : <><Rocket size={14} /> Deploy Now</>}
                        </button>
                    </div>
                )}
            </motion.div>
        </>
    );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────

const Dashboard = () => {
    const navigate = useNavigate();
    const { dark } = useTheme();

    const [apps,       setApps]       = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [timeRange,  setTimeRange]  = useState('24h');
    const [chartData,  setChartData]  = useState([]);
    const [deployOpen, setDeployOpen] = useState(false);
    const [sortField,  setSortField]  = useState('name');
    const [sortDir,    setSortDir]    = useState('asc');

    const gridColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
    const axisColor = dark ? '#374151' : '#94A3B8';

    useEffect(() => {
        const pts  = { '1h': 60, '6h': 72, '24h': 96, '7d': 84 }[timeRange] || 96;
        const base = { '1h': 800, '6h': 600, '24h': 500, '7d': 450 }[timeRange] || 500;
        const labels = Array.from({ length: pts }, (_, i) => {
            const d = new Date();
            d.setMinutes(d.getMinutes() - (pts - i));
            return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
        });
        setChartData(genData(pts, base, base * 0.6).map((r, i) => ({ ...r, label: labels[i] })));
    }, [timeRange]);

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            try {
                const res = await appsApi.list().catch(() => ({ data: [] }));
                if (!active) return;
                const data = Array.isArray(res.data) && res.data.length > 0 ? res.data : MOCK_APPS;
                setApps(data);
            } catch { if (active) setApps(MOCK_APPS); }
            finally   { if (active) setLoading(false); }
        };
        load();
        return () => { active = false; };
    }, []);

    const displayApps  = apps.length > 0 ? apps : MOCK_APPS;
    const running      = displayApps.filter(a => a.status === 'RUNNING').length;
    const totalReplicas = displayApps.reduce((s, a) => s + (a.replicas ?? a.minReplicas ?? 1), 0);
    const spark = (scale = 1) => Array.from({ length: 20 }, (_, i) => ({ value: (40 + Math.sin(i * 0.5) * 15 + Math.random() * 10) * scale }));

    const kpiCards = [
        { label: 'Total Apps',         value: displayApps.length, sub: `${displayApps.filter(a=>a.status==='ERROR').length} errors`,    trend: 2,  icon: Box,   iconBg: 'rgba(0,212,255,0.1)',   iconColor: '#00D4FF', sparkColor: '#00D4FF', sparkData: spark(0.8) },
        { label: 'Running Instances',  value: totalReplicas,       sub: `${running}/${displayApps.length} apps healthy`,                 trend: 0,  icon: Cpu,   iconBg: 'rgba(168,85,247,0.1)',  iconColor: '#A855F7', sparkColor: '#A855F7', sparkData: spark(1)   },
        { label: 'Requests / sec',     value: '4.2k',              sub: 'avg last 5 min',                                               trend: 8,  icon: Zap,   iconBg: 'rgba(16,185,129,0.1)',  iconColor: '#10B981', sparkColor: '#10B981', sparkData: spark(1.2) },
        { label: 'Avg Latency',        value: '32ms',              sub: 'P95: 87ms',                                                    trend: -3, icon: Clock, iconBg: 'rgba(245,158,11,0.1)',  iconColor: '#F59E0B', sparkColor: '#F59E0B', sparkData: spark(0.4) },
    ];

    const toggleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const sortedApps = [...displayApps].sort((a, b) => {
        const va = String(a[sortField] ?? ''), vb = String(b[sortField] ?? '');
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <ChevronsUpDown size={11} style={{ color: '#9CA3AF' }} />;
        return sortDir === 'asc' ? <ChevronUp size={11} style={{ color: '#00D4FF' }} /> : <ChevronDown size={11} style={{ color: '#00D4FF' }} />;
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 24 }}>

            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">System Overview</h2>
                    <p style={{ fontSize: 12, margin: '4px 0 0' }} className="text-secondary">
                        NEXTSTEP Serverless Platform · {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <button className="btn-primary" onClick={() => setDeployOpen(true)}>
                    <Rocket size={15} /> Quick Deploy
                </button>
            </div>

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {kpiCards.map((card, i) => (
                    <motion.div key={card.label} style={{ animationDelay: `${i * 60}ms` }}>
                        <KpiCard {...card} loading={loading} />
                    </motion.div>
                ))}
            </div>

            {/* Chart + Gauges row */}
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
                                }}>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={190}>
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
                        <GaugeRing value={68} color="#00D4FF" label="CPU"     sublabel="6.8 / 10 cores" />
                        <GaugeRing value={45} color="#A855F7" label="Memory"  sublabel="18 / 40 GB"     />
                        <GaugeRing value={82} color="#10B981" label="Network" sublabel="4.1 / 5 Gbps"   />
                    </div>
                </div>
            </div>

            {/* Table + Activity Feed */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

                {/* Applications Table */}
                <div className="ns-card" style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Applications</h3>
                            <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">{displayApps.length} services · {running} running</p>
                        </div>
                        <button className="btn-ghost" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => navigate('/apps')}>
                            View all <ArrowRight size={13} />
                        </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>
                                    {[
                                        { label: 'App Name',    field: 'name'       },
                                        { label: 'Status',      field: 'status'     },
                                        { label: 'Replicas',    field: 'replicas'   },
                                        { label: 'Last Deploy', field: 'lastDeploy' },
                                        { label: 'Traffic',     field: 'traffic'    },
                                    ].map(col => (
                                        <th key={col.field}
                                            onClick={() => toggleSort(col.field)}
                                            style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B', borderBottom: '1px solid rgba(0,0,0,0.07)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
                                        >
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                                {col.label} <SortIcon field={col.field} />
                                            </span>
                                        </th>
                                    ))}
                                    <th style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {sortedApps.map((app, i) => (
                                    <motion.tr
                                        key={app.id || i}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                        onClick={() => navigate(`/apps/${app.id || app.serviceName}`)}
                                        style={{ cursor: 'pointer', transition: 'background 150ms' }}
                                        onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: '#00D4FF', flexShrink: 0 }}>
                                                    {(app.name || app.serviceName || 'A').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }} className="text-primary">{app.name || app.serviceName}</p>
                                                    {app.version && <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#9CA3AF', margin: '1px 0 0' }}>{app.version}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                            <StatusBadge status={app.status || 'PENDING'} />
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700 }} className="text-primary">
                                            {app.replicas ?? app.minReplicas ?? '—'}
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', fontSize: 12 }} className="text-secondary">
                                            {app.lastDeploy || app.deployedAt || '—'}
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} className="text-secondary">
                                            {app.traffic || '—'}
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                            <button onClick={e => { e.stopPropagation(); navigate(`/apps/${app.id || app.serviceName}`); }}
                                                className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }}>
                                                <ExternalLink size={12} />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="ns-card" style={{ overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Activity</h3>
                        <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">Recent platform events</p>
                    </div>
                    <div>
                        {MOCK_ACTIVITY.map((ev, i) => (
                            <motion.div
                                key={ev.id}
                                initial={{ opacity: 0, x: 8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background 150ms' }}
                                onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ width: 3, minHeight: 40, borderRadius: 2, background: ev.color, flexShrink: 0, marginTop: 2 }} />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 11.5, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", margin: 0, color: '#00D4FF' }}>{ev.app}</p>
                                    <p style={{ fontSize: 11, margin: '3px 0 0', lineHeight: 1.4 }} className="text-secondary">{ev.msg}</p>
                                    <p style={{ fontSize: 10, margin: '4px 0 0', color: '#9CA3AF' }}>{ev.time}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Quick Deploy panel */}
            <AnimatePresence>
                {deployOpen && <QuickDeployPanel onClose={() => setDeployOpen(false)} />}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;
