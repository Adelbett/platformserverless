import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { appsApi, kafkaApi, billingApi, invoiceApi } from '../../api';
import {
    CreditCard, TrendingUp, Users, Cpu, Database,
    RefreshCw, ChevronDown, ChevronRight, DollarSign,
    Activity, Package, Zap, MemoryStick,
} from 'lucide-react';

// ── Pay-as-you-go pricing ──────────────────────────────────────────────────────
const PRICE = {
    cpuPerVcpuHour: 0.048,
    memPerGBHour:   0.006,
    kafkaPerTopic:  2.00,
    HOURS_MONTH:    720,
};

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
const uptimeFactor = (app) => app.status === 'RUNNING' ? 1.0 : app.status === 'FAILED' ? 0.0 : 0.2;
const appHourly = (app) => {
    const pods = Math.max(app.replicas ?? 0, app.minReplicas ?? 0, 1);
    const cpu  = parseVcpu(app.cpuRequest)  * PRICE.cpuPerVcpuHour * pods;
    const mem  = parseGb(app.memoryRequest) * PRICE.memPerGBHour   * pods;
    return (cpu + mem) * uptimeFactor(app);
};

const fmtUsd = (n, d = 4) => `$${Number(n || 0).toFixed(d)}`;
const now       = new Date();
const dayOfMonth = now.getDate();
const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
const hoursElapsed = dayOfMonth * 24 + now.getHours();

// ── Pill ───────────────────────────────────────────────────────────────────────
const Pill = ({ label, color }) => (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, border: `1px solid ${color}30`, background: `${color}10`, color, fontFamily: "'JetBrains Mono', monospace" }}>
        {label}
    </span>
);

// ── KPI card ──────────────────────────────────────────────────────────────────
const KPI = ({ label, value, sub, color, icon: Icon, highlight }) => (
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

// ── Client row (collapsible) ───────────────────────────────────────────────────
const ClientRow = ({ client, rank, totalRevenue }) => {
    const [open, setOpen] = useState(false);
    const pct = totalRevenue > 0 ? (client.mtdCost / totalRevenue) * 100 : 0;
    const statusColor = client.mtdCost > 5 ? '#10B981' : client.mtdCost > 0 ? '#F59E0B' : '#6B7280';

    return (
        <>
            <motion.tr
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: rank * 0.03 }}
                onClick={() => setOpen(o => !o)}
                style={{ cursor: 'pointer', borderBottom: open ? 'none' : '1px solid rgba(255,255,255,0.04)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
                {/* Rank */}
                <td style={{ padding: '13px 14px', width: 36 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: rank < 3 ? ['rgba(245,158,11,0.15)', 'rgba(156,163,175,0.1)', 'rgba(180,120,60,0.12)'][rank] : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: rank < 3 ? ['#F59E0B', '#9CA3AF', '#B47C3C'][rank] : '#475569' }}>
                        {rank + 1}
                    </div>
                </td>
                {/* Client */}
                <td style={{ padding: '13px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `hsl(${(client.userId?.charCodeAt(0) ?? 65) * 37 % 360}, 55%, 35%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', fontFamily: "'Outfit', sans-serif", flexShrink: 0 }}>
                            {(client.userId || 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: "'Outfit', sans-serif" }}>{client.userId || 'unknown'}</p>
                            <p style={{ fontSize: 10, margin: '2px 0 0', color: '#475569', fontFamily: "'JetBrains Mono', monospace" }}>{client.apps.length} service{client.apps.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                </td>
                {/* Namespaces */}
                <td style={{ padding: '13px 10px' }}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {[...new Set(client.apps.map(a => a.namespace).filter(Boolean))].slice(0, 3).map(ns => (
                            <Pill key={ns} label={ns} color="#06B6D4" />
                        ))}
                    </div>
                </td>
                {/* Running / total */}
                <td style={{ padding: '13px 10px' }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                        {client.apps.map(a => (
                            <div key={a.id} title={`${a.serviceName}: ${a.status}`} style={{ width: 8, height: 8, borderRadius: 2, background: a.status === 'RUNNING' ? '#10B981' : a.status === 'FAILED' ? '#EF4444' : '#6B7280' }} />
                        ))}
                    </div>
                </td>
                {/* MTD cost */}
                <td style={{ padding: '13px 10px', textAlign: 'right' }}>
                    <p style={{ fontSize: 13, fontWeight: 900, color: statusColor, margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>{fmtUsd(client.mtdCost, 4)}</p>
                    <p style={{ fontSize: 9, color: '#475569', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>this month</p>
                </td>
                {/* Projected */}
                <td style={{ padding: '13px 10px', textAlign: 'right' }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#8B5CF6', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>{fmtUsd(client.projected, 4)}</p>
                    <p style={{ fontSize: 9, color: '#475569', margin: 0 }}>projected</p>
                </td>
                {/* % share */}
                <td style={{ padding: '13px 14px', width: 100 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                            <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: '#3B82F6', borderRadius: 99, transition: 'width 0.5s' }} />
                        </div>
                        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#475569', minWidth: 30, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                    </div>
                </td>
                {/* Expand */}
                <td style={{ padding: '13px 10px', textAlign: 'center', color: '#475569' }}>
                    {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </td>
            </motion.tr>

            {/* ── Expanded: per-service table ── */}
            {open && (
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td colSpan={8} style={{ padding: '0 14px 14px 60px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        {['Service', 'Status', 'vCPU', 'RAM', 'Pods', 'Uptime', '$/h', '$/mo', 'MTD'].map((h, i) => (
                                            <th key={h} style={{ padding: '8px 12px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155', textAlign: i >= 6 ? 'right' : 'left' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {client.enriched.map(app => (
                                        <tr key={app.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '9px 12px' }}>
                                                <p style={{ fontSize: 11, fontWeight: 600, color: '#F1F5F9', margin: 0 }}>{app.serviceName || app.name}</p>
                                                <p style={{ fontSize: 9, color: '#334155', margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>{app.namespace}</p>
                                            </td>
                                            <td style={{ padding: '9px 12px' }}>
                                                <Pill label={app.status || '—'} color={app.status === 'RUNNING' ? '#10B981' : app.status === 'FAILED' ? '#EF4444' : '#6B7280'} />
                                            </td>
                                            <td style={{ padding: '9px 12px', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#06B6D4' }}>{app.vcpu.toFixed(3)}</td>
                                            <td style={{ padding: '9px 12px', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#A855F7' }}>{app.ramGb.toFixed(2)} GiB</td>
                                            <td style={{ padding: '9px 12px', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{Math.max(app.replicas ?? 0, app.minReplicas ?? 0, 1)}</td>
                                            <td style={{ padding: '9px 12px', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{(app.uptime * 100).toFixed(0)}%</td>
                                            <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{fmtUsd(app.hourly, 6)}</td>
                                            <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#F1F5F9', fontWeight: 700 }}>{fmtUsd(app.hourly * PRICE.HOURS_MONTH, 4)}</td>
                                            <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6', fontWeight: 700 }}>{fmtUsd(app.hourly * hoursElapsed, 5)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
                                        <td colSpan={6} style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#94A3B8' }}>Subtotal</td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{fmtUsd(client.hourlyRate, 6)}</td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#8B5CF6', fontWeight: 700 }}>{fmtUsd(client.projected, 4)}</td>
                                        <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6', fontWeight: 900 }}>{fmtUsd(client.mtdCost, 4)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

// ── Main ───────────────────────────────────────────────────────────────────────
const AdminBilling = () => {
    const [apps,        setApps]        = useState([]);
    const [topics,      setTopics]      = useState([]);
    const [adminBilling, setAdminBilling] = useState(null); // real backend data
    const [loading,     setLoading]     = useState(true);
    const [tab,         setTab]         = useState('clients');
    const [generating,  setGenerating]  = useState(false);
    const [generateMsg, setGenerateMsg] = useState(null);

    const handleGenerateInvoices = async () => {
        if (!window.confirm('Generate monthly invoices now, for all clients? This is normally done automatically on the 1st of each month.')) return;
        setGenerating(true);
        setGenerateMsg(null);
        try {
            await invoiceApi.generate();
            setGenerateMsg({ ok: true, text: 'Invoices generated successfully.' });
        } catch (err) {
            setGenerateMsg({ ok: false, text: err.response?.data?.detail || (err.response?.status ? `HTTP ${err.response.status}` : 'Network error — check your connection.') });
        } finally {
            setGenerating(false);
        }
    };

    const load = async () => {
        setLoading(true);
        try {
            const [ar, kr, br] = await Promise.allSettled([
                appsApi.list(),
                kafkaApi.list(),
                billingApi.getAdminBilling(),
            ]);
            if (ar.status === 'fulfilled') setApps(ar.value.data || []);
            if (kr.status === 'fulfilled') setTopics(kr.value.data || []);
            if (br.status === 'fulfilled') setAdminBilling(br.value.data);
        } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    // ── Group apps by userId ───────────────────────────────────────────────────
    const clients = useMemo(() => {
        const map = {};
        apps.forEach(app => {
            const key = app.userId || app.namespace || 'unknown';
            if (!map[key]) map[key] = { userId: key, apps: [] };
            map[key].apps.push(app);
        });

        return Object.values(map).map(c => {
            const enriched = c.apps.map(a => ({
                ...a,
                vcpu:   parseVcpu(a.cpuRequest),
                ramGb:  parseGb(a.memoryRequest),
                uptime: uptimeFactor(a),
                hourly: appHourly(a),
            }));
            const hourlyRate = enriched.reduce((s, a) => s + a.hourly, 0);
            const mtdCost    = hourlyRate * hoursElapsed;
            const projected  = hourlyRate * daysInMonth * 24;
            return { ...c, enriched, hourlyRate, mtdCost, projected };
        }).sort((a, b) => b.mtdCost - a.mtdCost);
    }, [apps]);

    // ── Platform totals ────────────────────────────────────────────────────────
    const totalHourly    = adminBilling?.platformHourlyRate  ?? clients.reduce((s, c) => s + c.hourlyRate, 0);
    const totalKafkaMo   = topics.length * PRICE.kafkaPerTopic;
    const totalKafkaH    = totalKafkaMo / PRICE.HOURS_MONTH;
    const totalMtdCost   = adminBilling?.platformMtdCost     ?? (totalHourly + totalKafkaH) * hoursElapsed;
    const totalProjected = adminBilling?.platformProjected   ?? (totalHourly + totalKafkaH) * daysInMonth * 24;
    const totalMonthly   = totalHourly * PRICE.HOURS_MONTH + totalKafkaMo;

    // Use real per-client data from backend when available
    const clientsData = adminBilling?.clients?.length
        ? adminBilling.clients.map(c => ({
            userId:      c.userId,
            apps:        apps.filter(a => a.userId === c.userId),
            enriched:    apps.filter(a => a.userId === c.userId).map(a => ({
                ...a, vcpu: parseVcpu(a.cpuRequest), ramGb: parseGb(a.memoryRequest),
                uptime: uptimeFactor(a), hourly: appHourly(a),
            })),
            hourlyRate:  c.hourlyRate,
            mtdCost:     c.mtdCost,
            projected:   c.projectedMonthly,
          }))
        : clients;

    // Real platform daily history
    const platformDailyHistory = adminBilling?.platformDailyHistory ?? [];

    // ── Bar chart data — top 10 clients by projected ───────────────────────────
    const barData = clientsData.slice(0, 10).map(c => ({
        name: (c.userId || 'unknown').slice(0, 10),
        mtd:  parseFloat(c.mtdCost.toFixed(5)),
        projected: parseFloat(c.projected.toFixed(5)),
    }));

    // ── Pie — breakdown by client ──────────────────────────────────────────────
    const PIE_COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6'];
    const pieData = clientsData.slice(0, 7).map((c, i) => ({
        name: c.userId,
        value: parseFloat(c.projected.toFixed(5)),
        color: PIE_COLORS[i % PIE_COLORS.length],
    }));
    if (clientsData.length > 7) {
        const rest = clientsData.slice(7).reduce((s, c) => s + c.projected, 0);
        pieData.push({ name: 'Others', value: parseFloat(rest.toFixed(5)), color: '#475569' });
    }

    const TABS = [
        { key: 'clients',  label: 'Per Client'    },
        { key: 'summary',  label: 'Revenue Charts' },
        { key: 'kafka',    label: 'Kafka Revenue'  },
    ];

    return (
        <div style={{ maxWidth: 1200 }}>
            {/* Header */}
            <div style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.18em', textTransform: 'uppercase', color: '#EF4444', margin: '0 0 5px' }}>Admin · Revenue Dashboard</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
                    <div>
                        <h1 style={{ fontSize: 26, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#F1F5F9', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Billing Overview</h1>
                        <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                            What each client owes · {now.toLocaleDateString('en', { month: 'long', year: 'numeric' })} · day {dayOfMonth}/{daysInMonth}
                        </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button onClick={handleGenerateInvoices} disabled={generating} style={{
                            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 8,
                            border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.1)',
                            color: '#3B82F6', cursor: generating ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 700,
                            opacity: generating ? 0.6 : 1,
                        }}>
                            <Zap size={13} style={{ animation: generating ? 'spin 1s linear infinite' : 'none' }} />
                            {generating ? 'Generating…' : 'Generate Monthly Invoices'}
                        </button>
                        <button onClick={load} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                    </div>
                </div>
                {generateMsg && (
                    <p style={{ fontSize: 12, margin: '10px 0 0', color: generateMsg.ok ? '#10B981' : '#EF4444' }}>
                        {generateMsg.text}
                    </p>
                )}
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px,1fr))', gap: 12, marginBottom: 22 }}>
                <KPI highlight label="Platform MTD"     value={fmtUsd(totalMtdCost, 4)}       sub={`${hoursElapsed}h elapsed`}         color="#3B82F6" icon={DollarSign} />
                <KPI           label="End-of-month est." value={fmtUsd(totalProjected, 4)}   sub="at current rate"                    color="#8B5CF6" icon={TrendingUp} />
                <KPI           label="Run rate / hour"   value={`${fmtUsd(totalHourly + totalKafkaH, 5)}/h`} sub="live"              color="#10B981" icon={Zap}        />
                <KPI           label="Active clients"    value={clients.length}                sub={`${apps.length} service${apps.length!==1?'s':''}`} color="#06B6D4" icon={Users} />
                <KPI           label="Kafka revenue"     value={fmtUsd(totalKafkaMo, 2)}       sub={`${topics.length} topics/mo`}       color="#F59E0B" icon={Database}  />
                <KPI           label="Avg / client"      value={fmtUsd(clients.length ? totalMtdCost / clients.length : 0, 4)} sub="this month" color="#EC4899" icon={Activity} />
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 3, marginBottom: 20, width: 'fit-content' }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{ fontSize: 12, fontWeight: 600, padding: '7px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', background: tab === t.key ? 'rgba(255,255,255,0.1)' : 'transparent', color: tab === t.key ? '#F1F5F9' : '#475569', transition: 'all 0.15s' }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══ PER CLIENT ══ */}
            {tab === 'clients' && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                {['#', 'Client', 'Namespaces', 'Services', 'Cost MTD', 'Projected/mo', '% Revenue', ''].map((h, i) => (
                                    <th key={i} style={{ padding: '11px 14px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155', textAlign: i >= 4 ? 'right' : 'left', background: 'rgba(255,255,255,0.01)' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ padding: 52, textAlign: 'center', color: '#475569' }}>
                                    <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px', color: '#334155' }} />
                                    Loading client data…
                                </td></tr>
                            ) : clients.length === 0 ? (
                                <tr><td colSpan={8} style={{ padding: 52, textAlign: 'center' }}>
                                    <Package size={30} style={{ display: 'block', margin: '0 auto 12px', color: '#334155' }} />
                                    <p style={{ color: '#475569', fontSize: 13, margin: 0 }}>No deployments found.</p>
                                </td></tr>
                            ) : clients.map((c, i) => (
                                <ClientRow key={c.userId} client={c} rank={i} totalRevenue={totalMtdCost} />
                            ))}
                        </tbody>
                        {clients.length > 0 && (
                            <tfoot>
                                <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', background: 'rgba(59,130,246,0.04)' }}>
                                    <td colSpan={4} style={{ padding: '14px 14px', fontSize: 13, fontWeight: 700, color: '#94A3B8' }}>
                                        Platform Total · {clients.length} clients · {apps.length} services · {topics.length} topics
                                    </td>
                                    <td style={{ padding: '14px 14px', textAlign: 'right', fontSize: 14, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6' }}>
                                        {fmtUsd(totalMtdCost, 4)}
                                    </td>
                                    <td style={{ padding: '14px 14px', textAlign: 'right', fontSize: 14, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#8B5CF6' }}>
                                        {fmtUsd(totalProjected, 4)}
                                    </td>
                                    <td style={{ padding: '14px 14px', textAlign: 'right', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#475569' }}>100%</td>
                                    <td />
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}

            {/* ══ REVENUE CHARTS ══ */}
            {tab === 'summary' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14 }}>
                        {/* Bar chart — top clients */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 20px' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px', fontFamily: "'Outfit', sans-serif" }}>Top clients by projected revenue</p>
                            <p style={{ fontSize: 10, color: '#475569', margin: '0 0 16px', fontFamily: "'JetBrains Mono', monospace" }}>MTD (blue) vs projected end-of-month (purple)</p>
                            {barData.length === 0 ? (
                                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>No data</div>
                            ) : (
                                <ResponsiveContainer width="100%" height={160}>
                                    <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#334155' }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 9, fill: '#334155' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v.toFixed(2)}`} />
                                        <Tooltip
                                            contentStyle={{ background: '#0A0F1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
                                            formatter={(v, name) => [fmtUsd(v, 4), name === 'mtd' ? 'MTD cost' : 'Projected/mo']}
                                        />
                                        <Bar dataKey="mtd"       fill="#3B82F6" radius={[4,4,0,0]} maxBarSize={22} />
                                        <Bar dataKey="projected" fill="#8B5CF6" radius={[4,4,0,0]} maxBarSize={22} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* Pie — revenue share */}
                        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '18px 18px' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: '0 0 14px', fontFamily: "'Outfit', sans-serif" }}>Revenue share</p>
                            {totalProjected === 0 ? (
                                <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155', fontSize: 12 }}>No data</div>
                            ) : (
                                <>
                                    <ResponsiveContainer width="100%" height={100}>
                                        <PieChart>
                                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={26} outerRadius={44} dataKey="value" stroke="none">
                                                {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                            </Pie>
                                            <Tooltip formatter={v => fmtUsd(v, 4)} contentStyle={{ background: '#0A0F1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                                        {pieData.map(d => (
                                            <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: d.color }} />
                                                    <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{(d.name || '').slice(0, 12)}</span>
                                                </div>
                                                <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: d.color, fontWeight: 700 }}>{fmtUsd(d.value, 4)}</span>
                                            </div>
                                        ))}
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 7, display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: '#F1F5F9' }}>Total/mo</span>
                                            <span style={{ fontSize: 12, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#F1F5F9' }}>{fmtUsd(totalProjected, 4)}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Summary invoice table */}
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                        <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', margin: 0, fontFamily: "'Outfit', sans-serif" }}>Monthly Invoice Summary</p>
                            <span style={{ fontSize: 11, color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>
                                {now.toLocaleDateString('en', { month: 'long', year: 'numeric' })} · IN PROGRESS
                            </span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    {['Client', 'Services', 'vCPU-h', 'GiB-h', 'Cost MTD', 'Run Rate/h', 'Projected/mo'].map((h, i) => (
                                        <th key={h} style={{ padding: '9px 16px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155', textAlign: i >= 4 ? 'right' : 'left' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {clients.map(c => {
                                    const vcpuH  = c.enriched.reduce((s, a) => s + a.vcpu * Math.max(a.replicas ?? 0, a.minReplicas ?? 0, 1) * a.uptime * hoursElapsed, 0);
                                    const gibH   = c.enriched.reduce((s, a) => s + a.ramGb * Math.max(a.replicas ?? 0, a.minReplicas ?? 0, 1) * a.uptime * hoursElapsed, 0);
                                    return (
                                        <tr key={c.userId} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '11px 16px', fontSize: 12, fontWeight: 700, color: '#F1F5F9', fontFamily: "'Outfit', sans-serif" }}>{c.userId}</td>
                                            <td style={{ padding: '11px 16px', fontSize: 11, color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{c.apps.length}</td>
                                            <td style={{ padding: '11px 16px', fontSize: 11, color: '#06B6D4', fontFamily: "'JetBrains Mono', monospace" }}>{vcpuH.toFixed(2)}</td>
                                            <td style={{ padding: '11px 16px', fontSize: 11, color: '#A855F7', fontFamily: "'JetBrains Mono', monospace" }}>{gibH.toFixed(2)}</td>
                                            <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6' }}>{fmtUsd(c.mtdCost, 4)}</td>
                                            <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>{fmtUsd(c.hourlyRate, 6)}</td>
                                            <td style={{ padding: '11px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#8B5CF6' }}>{fmtUsd(c.projected, 4)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)', background: 'rgba(59,130,246,0.04)' }}>
                                    <td colSpan={4} style={{ padding: '13px 16px', fontSize: 13, fontWeight: 800, color: '#F1F5F9' }}>
                                        PLATFORM TOTAL — {clients.length} clients
                                    </td>
                                    <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 15, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6' }}>
                                        {fmtUsd(totalMtdCost, 4)}
                                    </td>
                                    <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: '#94A3B8' }}>
                                        {fmtUsd(totalHourly + totalKafkaH, 6)}
                                    </td>
                                    <td style={{ padding: '13px 16px', textAlign: 'right', fontSize: 15, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#8B5CF6' }}>
                                        {fmtUsd(totalProjected, 4)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* ══ KAFKA REVENUE ══ */}
            {tab === 'kafka' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Database size={16} color="#F59E0B" />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', fontFamily: "'Outfit', sans-serif" }}>
                                {topics.length} Kafka topic{topics.length !== 1 ? 's' : ''} · ${PRICE.kafkaPerTopic}/topic/month
                            </span>
                        </div>
                        <span style={{ fontSize: 16, fontWeight: 900, color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>
                            {fmtUsd(totalKafkaMo, 2)}/mo
                        </span>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['Topic', 'Partitions', 'Replicas', 'Messages', 'MTD', '$/month'].map((h, i) => (
                                        <th key={h} style={{ padding: '11px 16px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#334155', textAlign: i >= 4 ? 'right' : 'left', background: 'rgba(255,255,255,0.01)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#475569' }}>Loading…</td></tr>
                                ) : topics.length === 0 ? (
                                    <tr><td colSpan={6} style={{ padding: 52, textAlign: 'center' }}>
                                        <Database size={28} style={{ display: 'block', margin: '0 auto 12px', color: '#334155' }} />
                                        <p style={{ color: '#475569', margin: 0, fontSize: 13 }}>No Kafka topics.</p>
                                    </td></tr>
                                ) : topics.map(t => {
                                    const topicMtd = (PRICE.kafkaPerTopic / PRICE.HOURS_MONTH) * hoursElapsed;
                                    return (
                                        <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#F59E0B', fontFamily: "'JetBrains Mono', monospace" }}>{t.name}</td>
                                            <td style={{ padding: '12px 16px', fontSize: 11, color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{t.partitions ?? '—'}</td>
                                            <td style={{ padding: '12px 16px', fontSize: 11, color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{t.replicas ?? '—'}</td>
                                            <td style={{ padding: '12px 16px', fontSize: 11, color: '#94A3B8', fontFamily: "'JetBrains Mono', monospace" }}>{t.messageCount?.toLocaleString() ?? '—'}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6', fontWeight: 700 }}>{fmtUsd(topicMtd, 5)}</td>
                                            <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B' }}>{fmtUsd(PRICE.kafkaPerTopic, 2)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {topics.length > 0 && (
                                <tfoot>
                                    <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                                        <td colSpan={4} style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#94A3B8' }}>
                                            Total · {topics.length} topics
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#3B82F6' }}>
                                            {fmtUsd((PRICE.kafkaPerTopic / PRICE.HOURS_MONTH) * hoursElapsed * topics.length, 4)}
                                        </td>
                                        <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", color: '#F59E0B' }}>
                                            {fmtUsd(totalKafkaMo, 2)}/mo
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminBilling;
