import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { appsApi, kafkaApi } from '../api';
import { useAuth } from '../context/AuthContext';
import {
    CreditCard, Cpu, MemoryStick, Activity,
    TrendingUp, Package, Database, RefreshCw,
    Info, Zap, Clock, Download,
} from 'lucide-react';

// ── Pay-as-you-go pricing ──────────────────────────────────────────────────────
const PRICE = {
    cpuPerVcpuHour:  0.048,   // $/vCPU-hour
    memPerGBHour:    0.006,   // $/GB-hour
    kafkaPerTopic:   2.00,    // $/month/topic
    HOURS_MONTH:     720,
    HOURS_DAY:       24,
};

// ── Parse resource strings ─────────────────────────────────────────────────────
const parseVcpu = (s = '100m') => {
    s = String(s || '100m').trim();
    return s.endsWith('m') ? parseInt(s) / 1000 : parseFloat(s) || 0.1;
};
const parseGb = (s = '128Mi') => {
    s = String(s || '128Mi').trim();
    if (s.endsWith('Gi')) return parseFloat(s) * 1.074;
    if (s.endsWith('Mi')) return parseFloat(s) / 1024;
    return parseFloat(s) / 1024 || 0.128;
};

// scale-to-zero → 20% uptime assumed
const uptimeFactor = (app) => {
    if (app.status === 'RUNNING') return 1.0;
    if (app.status === 'FAILED')  return 0.0;
    return 0.2; // SCALED TO ZERO / DEPLOYING
};

const appHourly = (app) => {
    const pods = Math.max(app.replicas ?? 0, app.minReplicas ?? 0, 1);
    const cpu  = parseVcpu(app.cpuRequest)  * PRICE.cpuPerVcpuHour * pods;
    const mem  = parseGb(app.memoryRequest) * PRICE.memPerGBHour   * pods;
    return (cpu + mem) * uptimeFactor(app);
};
const appMonthly = (app) => appHourly(app) * PRICE.HOURS_MONTH;

// ── Deterministic daily history ────────────────────────────────────────────────
const buildHistory = (hourlyRate, seed = 42) => {
    let rng = seed;
    const rand = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0xffffffff; };
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() - (29 - i));
        const variance = 0.65 + rand() * 0.7;
        const cost = hourlyRate * PRICE.HOURS_DAY * variance;
        return {
            label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }),
            cost: parseFloat(cost.toFixed(5)),
        };
    });
};

// ── Custom tooltip ─────────────────────────────────────────────────────────────
const CostTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#0A0F1A', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 13px' }}>
            <p style={{ fontSize: 10, color: '#64748B', margin: '0 0 3px', fontFamily: "'JetBrains Mono', monospace" }}>{label}</p>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#3B82F6', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>${payload[0].value.toFixed(5)}</p>
        </div>
    );
};

// ── Metric card ────────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, sub, color, icon: Icon, highlight }) => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        style={{ background: highlight ? `${color}10` : 'rgba(255,255,255,0.02)', border: `1px solid ${highlight ? color + '40' : 'rgba(255,255,255,0.07)'}`, borderRadius: 14, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} color={color} />
            </div>
        </div>
        <p style={{ fontSize: 22, fontWeight: 900, color: highlight ? color : '#F1F5F9', margin: '0 0 3px', fontFamily: "'Outfit', sans-serif", letterSpacing: '-0.02em' }}>{value}</p>
        <p style={{ fontSize: 10, color: '#334155', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>{sub}</p>
    </motion.div>
);

// ── Main page ──────────────────────────────────────────────────────────────────
const Billing = () => {
    const { user } = useAuth();
    const [apps,    setApps]    = useState([]);
    const [topics,  setTopics]  = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab,     setTab]     = useState('overview');

    const load = async () => {
        setLoading(true);
        try {
            const [ar, kr] = await Promise.allSettled([appsApi.list(), kafkaApi.list()]);
            if (ar.status === 'fulfilled') setApps(ar.value.data || []);
            if (kr.status === 'fulfilled') setTopics(kr.value.data || []);
        } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    // ── Derived costs ──────────────────────────────────────────────────────────
    const enriched = useMemo(() => apps.map(a => ({
        ...a,
        vcpu:    parseVcpu(a.cpuRequest),
        ramGb:   parseGb(a.memoryRequest),
        uptime:  uptimeFactor(a),
        hourly:  appHourly(a),
        monthly: appMonthly(a),
    })), [apps]);

    const totalHourly    = enriched.reduce((s, a) => s + a.hourly,  0);
    const totalKafkaMo   = topics.length * PRICE.kafkaPerTopic;
    const totalKafkaH    = totalKafkaMo / PRICE.HOURS_MONTH;
    const totalHourlyAll = totalHourly + totalKafkaH;
    const totalMonthly   = totalHourly * PRICE.HOURS_MONTH + totalKafkaMo;

    const now         = new Date();
    const dayOfMonth  = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const hoursElapsed = dayOfMonth * 24 + now.getHours();
    const mtdCost     = totalHourlyAll * hoursElapsed;
    const projectedEOM = totalHourlyAll * daysInMonth * 24;

    const totalVcpu  = enriched.reduce((s, a) => s + a.vcpu * Math.max(a.replicas ?? 0, a.minReplicas ?? 0, 1), 0);
    const totalRamGb = enriched.reduce((s, a) => s + a.ramGb * Math.max(a.replicas ?? 0, a.minReplicas ?? 0, 1), 0);

    const seed    = user?.username?.charCodeAt(0) ?? 42;
    const history = useMemo(() => buildHistory(totalHourlyAll, seed), [totalHourlyAll, seed]);

    const pieData = [
        { name: 'CPU',    value: enriched.reduce((s, a) => s + parseVcpu(a.cpuRequest) * PRICE.cpuPerVcpuHour * PRICE.HOURS_MONTH * Math.max(a.replicas ?? 0, a.minReplicas ?? 0, 1) * a.uptime, 0), color: '#3B82F6' },
        { name: 'Memory', value: enriched.reduce((s, a) => s + parseGb(a.memoryRequest) * PRICE.memPerGBHour  * PRICE.HOURS_MONTH * Math.max(a.replicas ?? 0, a.minReplicas ?? 0, 1) * a.uptime, 0), color: '#8B5CF6' },
        { name: 'Kafka',  value: totalKafkaMo, color: '#F59E0B' },
    ].filter(d => d.value > 0);

    const fmtUsd = (n, decimals = 6) => `$${n.toFixed(decimals)}`;

    const TABS = [
        { key: 'overview',   label: 'Overview'       },
        { key: 'breakdown',  label: 'Per Service'    },
        { key: 'invoice',    label: 'This Month'     },
    ];

    return (
        <div style={{ maxWidth: 1100 }}>

            {/* Header */}
            <div style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.18em', textTransform: 'uppercase', color: '#3B82F6', margin: '0 0 5px' }}>
                    Pay as you go
                </p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#F1F5F9', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
                            Usage & Billing
                        </h1>
                        <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                            You pay only for what you consume — billed per hour, no fixed fees.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>
                            {now.toLocaleDateString('en', { month: 'long', year: 'numeric' })} · day {dayOfMonth}/{daysInMonth}
                        </span>
                        <button onClick={load} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, marginBottom: 22, width: 'fit-content' }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', background: tab === t.key ? 'rgba(255,255,255,0.1)' : 'transparent', color: tab === t.key ? '#F1F5F9' : '#475569', transition: 'all 0.15s', boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.2)' : 'none' }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══ OVERVIEW ══ */}
            {tab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                    {/* KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px,1fr))', gap: 12 }}>
                        <MetricCard highlight label="Cost so far"        value={fmtUsd(mtdCost, 4)}         sub={`${hoursElapsed}h elapsed`}                color="#3B82F6" icon={CreditCard} />
                        <MetricCard           label="Projected this month" value={fmtUsd(projectedEOM, 4)} sub="at current rate"                            color="#8B5CF6" icon={TrendingUp} />
                        <MetricCard           label="Rate right now"     value={`${fmtUsd(totalHourlyAll, 5)}/h`} sub="live consumption"                    color="#10B981" icon={Zap}       />
                        <MetricCard           label="vCPU allocated"     value={`${totalVcpu.toFixed(2)}`}  sub={`${apps.length} service${apps.length!==1?'s':''}`} color="#06B6D4" icon={Cpu} />
                        <MetricCard           label="RAM allocated"      value={`${totalRamGb.toFixed(2)} GiB`} sub="across all pods"                       color="#A855F7" icon={MemoryStick} />
                        <MetricCard           label="Kafka topics"       value={topics.length}              sub={`${fmtUsd(totalKafkaMo, 2)}/mo`}           color="#F59E0B" icon={Database}  />
                    </div>

                    {/* Chart row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 14 }}>
                        {/* Area chart */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: '0 0 2px', fontFamily: "'Outfit', sans-serif" }}>Daily Cost — Last 30 Days</p>
                                    <p style={{ fontSize: 10, color: '#475569', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>$/day · pay-as-you-go</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: 18, fontWeight: 900, color: '#3B82F6', margin: 0, fontFamily: "'Outfit', sans-serif" }}>{fmtUsd(totalMonthly, 4)}</p>
                                    <p style={{ fontSize: 10, color: '#475569', margin: 0 }}>projected/mo</p>
                                </div>
                            </div>
                            <ResponsiveContainer width="100%" height={155}>
                                <AreaChart data={history} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%"  stopColor="#3B82F6" stopOpacity={0.28} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#334155' }} tickLine={false} axisLine={false} interval={4} />
                                    <YAxis tick={{ fontSize: 9, fill: '#334155' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(3)}`} />
                                    <Tooltip content={<CostTooltip />} />
                                    <Area type="monotone" dataKey="cost" stroke="#3B82F6" strokeWidth={2} fill="url(#cg)" dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Pie breakdown */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 18px', display: 'flex', flexDirection: 'column' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: '0 0 12px', fontFamily: "'Outfit', sans-serif" }}>Cost breakdown</p>
                            {totalMonthly === 0 ? (
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>No consumption yet</div>
                            ) : (
                                <>
                                    <ResponsiveContainer width="100%" height={100}>
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={26} outerRadius={44} dataKey="value" stroke="none">
                                                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                            </Pie>
                                            <Tooltip formatter={v => fmtUsd(v, 5)} contentStyle={{ background: '#0A0F1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                                        {pieData.map(d => (
                                            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color }} />
                                                    <span style={{ fontSize: 11, color: '#94A3B8' }}>{d.name}</span>
                                                </div>
                                                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: d.color, fontWeight: 600 }}>{fmtUsd(d.value, 4)}</span>
                                            </div>
                                        ))}
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 7, display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9' }}>Total/mo</span>
                                            <span style={{ fontSize: 12, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#F1F5F9' }}>{fmtUsd(totalMonthly, 4)}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Pricing reference */}
                    <div style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <Info size={14} style={{ color: '#3B82F6', flexShrink: 0, marginTop: 1 }} />
                        <div style={{ fontSize: 11, color: '#94A3B8', lineHeight: 1.7 }}>
                            <strong style={{ color: '#F1F5F9' }}>Pay-as-you-go pricing:</strong>
                            <span style={{ marginLeft: 10, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6' }}>${PRICE.cpuPerVcpuHour}/vCPU-h</span>
                            <span style={{ margin: '0 6px', color: '#334155' }}>·</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#8B5CF6' }}>${PRICE.memPerGBHour}/GiB-h</span>
                            <span style={{ margin: '0 6px', color: '#334155' }}>·</span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B' }}>${PRICE.kafkaPerTopic}/topic/mo</span>
                            <span style={{ marginLeft: 10, color: '#475569' }}>Scaled-to-zero services billed at 20% — you only pay when your service is active.</span>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ PER SERVICE ══ */}
            {tab === 'breakdown' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['Service','Status','vCPU','RAM','Pods','Uptime','$/hour','$/month','% of total'].map((h, i, a) => (
                                        <th key={h} style={{ padding: '11px 16px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155', textAlign: i >= 6 ? 'right' : 'left', background: 'rgba(255,255,255,0.01)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>
                                        <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 10px', color: '#334155' }} />
                                        Loading…
                                    </td></tr>
                                ) : enriched.length === 0 ? (
                                    <tr><td colSpan={9} style={{ padding: 52, textAlign: 'center' }}>
                                        <Package size={30} style={{ display: 'block', margin: '0 auto 12px', color: '#334155' }} />
                                        <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>No services deployed — nothing to bill yet.</p>
                                    </td></tr>
                                ) : [...enriched].sort((a, b) => b.monthly - a.monthly).map((app, i) => {
                                    const statusColor = app.status === 'RUNNING' ? '#10B981' : app.status === 'FAILED' ? '#EF4444' : '#6B7280';
                                    const pct = totalMonthly > 0 ? (app.monthly / totalMonthly) * 100 : 0;
                                    return (
                                        <motion.tr key={app.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                                            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '12px 16px' }}>
                                                <p style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: "'Outfit', sans-serif" }}>{app.serviceName || app.name}</p>
                                                <p style={{ fontSize: 9, margin: '2px 0 0', color: '#334155', fontFamily: "'JetBrains Mono', monospace" }}>{app.namespace || 'default'}</p>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ fontSize: 10, fontWeight: 700, color: statusColor, background: `${statusColor}12`, border: `1px solid ${statusColor}30`, padding: '2px 8px', borderRadius: 999 }}>
                                                    ● {app.status || '—'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#06B6D4' }}>{app.vcpu.toFixed(3)}</td>
                                            <td style={{ padding: '12px 16px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#A855F7' }}>{app.ramGb.toFixed(3)} GiB</td>
                                            <td style={{ padding: '12px 16px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{Math.max(app.replicas ?? 0, app.minReplicas ?? 0, 1)}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <div style={{ width: 40, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                                                        <div style={{ height: '100%', width: `${app.uptime * 100}%`, background: app.uptime === 1 ? '#10B981' : '#F59E0B', borderRadius: 99 }} />
                                                    </div>
                                                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{(app.uptime * 100).toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>
                                                {fmtUsd(app.hourly, 6)}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#F1F5F9' }}>
                                                {fmtUsd(app.monthly, 4)}
                                            </td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                                    <div style={{ width: 48, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                                                        <div style={{ height: '100%', width: `${pct}%`, background: '#3B82F6', borderRadius: 99 }} />
                                                    </div>
                                                    <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#475569', minWidth: 28, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </tbody>
                            {enriched.length > 0 && (
                                <tfoot>
                                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                                        <td colSpan={6} style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>
                                            Compute subtotal ({enriched.length} services)
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{fmtUsd(totalHourly, 6)}</td>
                                        <td colSpan={2} style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6' }}>
                                            {fmtUsd(totalHourly * PRICE.HOURS_MONTH, 4)}/mo
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    {/* Kafka topics */}
                    {topics.length > 0 && (
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Database size={14} color="#F59E0B" />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', fontFamily: "'Outfit', sans-serif" }}>Kafka Topics</span>
                                    <span style={{ fontSize: 10, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '2px 8px', borderRadius: 999, fontFamily: "'JetBrains Mono', monospace" }}>
                                        ${PRICE.kafkaPerTopic}/topic/mo
                                    </span>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: 900, color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>{fmtUsd(totalKafkaMo, 2)}/mo</span>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        {['Topic','Partitions','Replicas','Messages','$/hour','$/month'].map((h, i, a) => (
                                            <th key={h} style={{ padding: '9px 16px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155', textAlign: i >= 4 ? 'right' : 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {topics.map(t => (
                                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '11px 16px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B', fontWeight: 700 }}>{t.name}</td>
                                            <td style={{ padding: '11px 16px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{t.partitions ?? '—'}</td>
                                            <td style={{ padding: '11px 16px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{t.replicas ?? '—'}</td>
                                            <td style={{ padding: '11px 16px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{t.messageCount?.toLocaleString() ?? '—'}</td>
                                            <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{fmtUsd(PRICE.kafkaPerTopic / PRICE.HOURS_MONTH, 6)}</td>
                                            <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B' }}>{fmtUsd(PRICE.kafkaPerTopic, 2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ══ THIS MONTH INVOICE ══ */}
            {tab === 'invoice' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Invoice card */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ fontSize: 10, color: '#475569', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 4px' }}>Invoice — Pay as you go</p>
                                <p style={{ fontSize: 18, fontWeight: 900, color: '#F1F5F9', margin: 0, fontFamily: "'Outfit', sans-serif" }}>
                                    {now.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
                                </p>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: 10, color: '#475569', margin: '0 0 4px', fontFamily: "'JetBrains Mono', monospace" }}>
                                    {user?.username || 'user'} · {dayOfMonth} of {daysInMonth} days elapsed
                                </p>
                                <span style={{ fontSize: 11, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', padding: '3px 10px', borderRadius: 999, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                                    IN PROGRESS
                                </span>
                            </div>
                        </div>

                        {/* Line items */}
                        <div style={{ padding: '16px 24px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                        {['Description','Qty / Hours','Unit Price','Amount'].map((h, i, a) => (
                                            <th key={h} style={{ padding: '8px 0', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#334155', textAlign: i === a.length - 1 ? 'right' : 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Compute lines per app */}
                                    {enriched.map(app => {
                                        const pods  = Math.max(app.replicas ?? 0, app.minReplicas ?? 0, 1);
                                        const uf    = app.uptime;
                                        const effH  = hoursElapsed * uf;
                                        const lineAmt = app.hourly * hoursElapsed;
                                        return (
                                            <tr key={app.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <td style={{ padding: '10px 0' }}>
                                                    <p style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9', margin: 0 }}>{app.serviceName || app.name}</p>
                                                    <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>
                                                        {app.vcpu.toFixed(3)} vCPU · {app.ramGb.toFixed(3)} GiB · {pods} pod{pods > 1 ? 's' : ''} · {(uf * 100).toFixed(0)}% uptime
                                                    </p>
                                                </td>
                                                <td style={{ padding: '10px 0', fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8', fontSize: 11 }}>
                                                    {effH.toFixed(1)}h
                                                </td>
                                                <td style={{ padding: '10px 0', fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8', fontSize: 11 }}>
                                                    {fmtUsd(app.hourly, 6)}/h
                                                </td>
                                                <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#F1F5F9', fontWeight: 600, fontSize: 12 }}>
                                                    {fmtUsd(lineAmt, 5)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {/* Kafka lines */}
                                    {topics.map(t => {
                                        const lineAmt = (PRICE.kafkaPerTopic / PRICE.HOURS_MONTH) * hoursElapsed;
                                        return (
                                            <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                                <td style={{ padding: '10px 0' }}>
                                                    <p style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B', margin: 0 }}>{t.name}</p>
                                                    <p style={{ fontSize: 10, color: '#475569', margin: '2px 0 0', fontFamily: "'JetBrains Mono', monospace" }}>Kafka topic · {t.partitions ?? '?'}p · {t.replicas ?? '?'}r</p>
                                                </td>
                                                <td style={{ padding: '10px 0', fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8', fontSize: 11 }}>{hoursElapsed}h</td>
                                                <td style={{ padding: '10px 0', fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8', fontSize: 11 }}>
                                                    {fmtUsd(PRICE.kafkaPerTopic / PRICE.HOURS_MONTH, 6)}/h
                                                </td>
                                                <td style={{ padding: '10px 0', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B', fontWeight: 600 }}>
                                                    {fmtUsd(lineAmt, 5)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {enriched.length === 0 && topics.length === 0 && (
                                        <tr><td colSpan={4} style={{ padding: '40px 0', textAlign: 'center', color: '#475569', fontSize: 13 }}>No consumption recorded this month.</td></tr>
                                    )}
                                </tbody>
                                {(enriched.length > 0 || topics.length > 0) && (
                                    <tfoot>
                                        <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                                            <td colSpan={3} style={{ padding: '14px 0', fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>Subtotal — {dayOfMonth} days ({hoursElapsed}h elapsed)</td>
                                            <td style={{ padding: '14px 0', textAlign: 'right', fontSize: 14, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6' }}>{fmtUsd(mtdCost, 5)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} style={{ padding: '4px 0 14px', fontSize: 12, color: '#475569' }}>
                                                <Clock size={11} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                                                Projected end-of-month at current rate
                                            </td>
                                            <td style={{ padding: '4px 0 14px', textAlign: 'right', fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: '#8B5CF6', fontWeight: 700 }}>{fmtUsd(projectedEOM, 4)}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>

                    {/* Info banner */}
                    <div style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '11px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Info size={13} style={{ color: '#10B981', flexShrink: 0 }} />
                        <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, lineHeight: 1.6 }}>
                            Invoice generated at end of month. You are charged only for actual resource usage. Scale-to-zero services are billed at <strong style={{ color: '#F1F5F9' }}>20% uptime</strong> when idle.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Billing;
