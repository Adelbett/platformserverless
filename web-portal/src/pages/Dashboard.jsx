import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import {
    Box, Cpu, Zap, Clock, TrendingUp, TrendingDown, Minus,
    Rocket, ArrowRight, RefreshCw, ChevronUp, ChevronDown,
    ChevronsUpDown, X, ExternalLink, CheckCircle2,
    Activity, Globe, KeyRound, AlertTriangle, CheckCircle, Timer,
    AlertCircle, Server, Terminal, Bell,
} from 'lucide-react';
import { appsApi, logsApi, metricsApi } from '../api';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtReq = v => v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1);

const fmtAgo = (iso) => {
    if (!iso) return '—';
    const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
    if (diff < 60)    return `${diff}s ago`;
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
};

// ── Status badge ───────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const map = {
        RUNNING:   { cls: 'badge-running', dot: '#10B981', pulse: true  },
        IDLE:      { cls: 'badge-idle',    dot: '#F59E0B', pulse: false },
        FAILED:    { cls: 'badge-error',   dot: '#EF4444', pulse: true  },
        DEPLOYING: { cls: 'badge-pending', dot: '#3B82F6', pulse: true  },
    };
    const { cls, dot, pulse } = map[status] || { cls: 'badge-pending', dot: '#3B82F6', pulse: false };
    return (
        <span className={cls}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', ...(pulse ? { animation: 'pulseDot 2s ease-in-out infinite' } : {}) }} />
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

const spark = (scale = 1) => Array.from({ length: 20 }, (_, i) => ({ value: (40 + Math.sin(i * 0.5) * 15 + Math.random() * 10) * scale }));

// ── Trend badge ────────────────────────────────────────────────────────────────

const TrendBadge = ({ value }) => {
    if (value === 0) return <span className="trend-flat" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Minus size={10} /> Stable</span>;
    if (value > 0)   return <span className="trend-up"   style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><TrendingUp size={10} /> +{value}%</span>;
    return                  <span className="trend-down" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><TrendingDown size={10} /> {value}%</span>;
};

// ── KPI Card ───────────────────────────────────────────────────────────────────

const KpiCard = ({ label, value, sub, trend, icon: Icon, iconBg, iconColor, sparkColor, loading, tooltip, onClick, alert }) => {
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
            onClick={onClick}
            style={{ padding: 20, cursor: onClick ? 'pointer' : 'default', border: alert ? '1px solid rgba(239,68,68,0.3)' : undefined }}
        >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6, color: '#64748B' }} title={tooltip}>{label}{tooltip && <span style={{ marginLeft: 4, opacity: 0.5, cursor: 'help' }}>ⓘ</span>}</p>
                    <p style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', sans-serif", lineHeight: 1, margin: 0 }} className="text-primary">{value}</p>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} style={{ color: iconColor }} />
                </div>
            </div>
            <Sparkline data={spark()} color={sparkColor} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <TrendBadge value={trend} />
                {sub && <span style={{ fontSize: 10, color: '#9CA3AF' }}>{sub}</span>}
            </div>
        </motion.div>
    );
};

// ── Quick Deploy Panel ─────────────────────────────────────────────────────────

const QuickDeployPanel = ({ onClose }) => {
    const navigate = useNavigate();
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.07)', flexShrink: 0 }}>
                    <div>
                        <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }} className="text-primary">Quick Deploy</h2>
                        <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">Deploy a new service in seconds</p>
                    </div>
                    <button className="btn-ghost" style={{ width: 32, height: 32, padding: 0 }} onClick={onClose}><X size={16} /></button>
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Rocket size={28} style={{ color: '#00D4FF' }} />
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <h3 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 8px' }} className="text-primary">Ready to deploy?</h3>
                        <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>Use the full deploy form for best experience.</p>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button className="btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn-primary" onClick={() => { onClose(); navigate('/apps/new'); }}>
                            <Rocket size={14} /> Go to Deploy
                        </button>
                    </div>
                </div>
            </motion.div>
        </>
    );
};

// ── Platform Health Bar ────────────────────────────────────────────────────────

const HealthBar = ({ apps }) => {
    const running  = apps.filter(a => a.status === 'RUNNING').length;
    const failed   = apps.filter(a => a.status === 'FAILED' || a.status === 'ERROR').length;
    const deploying = apps.filter(a => a.status === 'DEPLOYING').length;
    const idle     = apps.length - running - failed - deploying;

    const items = [
        { label: 'Running',   count: running,   color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
        { label: 'Idle',      count: idle,      color: '#F59E0B', bg: 'rgba(245,158,11,0.1)'  },
        { label: 'Deploying', count: deploying, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)'  },
        { label: 'Failed',    count: failed,    color: '#EF4444', bg: 'rgba(239,68,68,0.1)'   },
    ];

    return (
        <div className="ns-card" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulseDot 2s ease-in-out infinite' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981' }}>Platform Healthy</span>
            </div>
            <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.06)' }} />
            {items.map(({ label, count, color, bg }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color, background: bg, padding: '2px 8px', borderRadius: 999 }}>{count}</span>
                    <span style={{ fontSize: 11, color: '#6B7280' }}>{label}</span>
                </div>
            ))}
        </div>
    );
};

// ── Role Ideas Card ────────────────────────────────────────────────────────────

const ROLE_IDEAS = {
    ADMIN: {
        color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)',
        title: 'Admin — Full Control',
        subtitle: 'Manage the platform infrastructure and users',
        ideas: [
            { icon: Activity, label: 'Global Monitoring', desc: 'All services, pods, nodes across all tenants', path: '/monitoring' },
            { icon: Box,      label: 'All Applications',  desc: 'Every deployed app on the platform',          path: '/apps'       },
            { icon: Zap,      label: 'Kafka Clusters',    desc: 'Manage topics, partitions, eventing',          path: '/kafka'      },
            { icon: Globe,    label: 'Eventing',          desc: 'KafkaSources, Triggers, Brokers',              path: '/eventing'   },
        ],
    },
    MEMBER: {
        color: '#00D4FF', bg: 'rgba(0,212,255,0.06)', border: 'rgba(0,212,255,0.18)',
        title: 'Member — Build & Ship',
        subtitle: 'Deploy and operate the services you have access to',
        ideas: [
            { icon: Rocket,   label: 'Deploy Service',     desc: 'Push a Docker image and get a live URL',       path: '/apps/new'   },
            { icon: Activity, label: 'Monitor Apps',       desc: 'Live metrics: req/sec, latency, error rate',   path: '/monitoring' },
            { icon: Zap,      label: 'Create Kafka Topic', desc: 'Set up event streaming for your services',    path: '/kafka'      },
            { icon: Terminal, label: 'View Logs',          desc: 'Deployment and runtime logs for your apps',    path: '/logs'       },
            { icon: KeyRound, label: 'Check Billing',      desc: 'Your cost breakdown and Excel export',         path: '/billing'    },
        ],
    },
};

const RoleIdeasCard = ({ role, navigate }) => {
    const cfg = ROLE_IDEAS[role] || ROLE_IDEAS.MEMBER;
    return (
        <div className="ns-card" style={{ padding: 24, border: `1px solid ${cfg.border}`, background: cfg.bg }}>
            <div style={{ marginBottom: 16 }}>
                <span style={{ display: 'inline-block', fontSize: 9, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace", padding: '3px 8px', borderRadius: 4, marginBottom: 8, color: cfg.color, background: `${cfg.color}18` }}>{role || 'MEMBER'}</span>
                <h3 style={{ fontSize: 15, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: '0 0 4px' }} className="text-primary">{cfg.title}</h3>
                <p style={{ fontSize: 12, margin: 0, color: '#9CA3AF' }}>{cfg.subtitle}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {cfg.ideas.map(idea => {
                    const Icon = idea.icon;
                    return (
                        <motion.button
                            key={idea.path}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate(idea.path)}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', textAlign: 'left' }}
                        >
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: `${cfg.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={16} style={{ color: cfg.color }} />
                            </div>
                            <div>
                                <p style={{ fontSize: 12, fontWeight: 700, margin: '0 0 3px' }} className="text-primary">{idea.label}</p>
                                <p style={{ fontSize: 11, margin: 0, lineHeight: 1.4, color: '#6B7280' }}>{idea.desc}</p>
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────────

const Dashboard = () => {
    const navigate = useNavigate();
    const { dark } = useTheme();
    const { user } = useAuth();
    const { notifications } = useNotifications();

    const [apps,        setApps]       = useState([]);
    const [logs,        setLogs]       = useState([]);
    const [clusterMetrics, setCluster] = useState(null);
    const [loading,     setLoading]    = useState(true);
    const [deployOpen,  setDeployOpen] = useState(false);
    const [sortField,   setSortField]  = useState('name');
    const [sortDir,     setSortDir]    = useState('asc');

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            try {
                const [appsRes, metricsRes] = await Promise.all([
                    appsApi.list().catch(() => ({ data: [] })),
                    metricsApi.getCluster().catch(() => ({ data: null })),
                ]);
                if (!active) return;
                setApps(Array.isArray(appsRes.data) ? appsRes.data : []);
                setCluster(metricsRes.data);
                if (user?.username) {
                    const logsRes = await logsApi.getByUser(user.username).catch(() => ({ data: [] }));
                    if (active) setLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
                }
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => { active = false; };
    }, [user?.username]);

    const running    = apps.filter(a => a.status === 'RUNNING').length;
    const failedApps = apps.filter(a => a.status === 'FAILED' || a.status === 'ERROR');
    const totalReplicas = apps.reduce((s, a) => s + (a.replicas ?? 0), 0);
    const lastDeploy = apps.reduce((l, a) => {
        if (!a.deployedAt) return l;
        return !l || new Date(a.deployedAt) > new Date(l) ? a.deployedAt : l;
    }, null);

    const kpiCards = [
        { label: 'Total Apps',   value: apps.length,   sub: `${running} running · ${failedApps.length} failed`,             trend: 2,  icon: Box,           iconBg: 'rgba(0,212,255,0.1)',   iconColor: '#00D4FF', sparkColor: '#00D4FF', tooltip: 'Total applications deployed on the platform.' },
        { label: 'Apps Running', value: running,        sub: `${apps.length - running} scaled to zero`,                      trend: 0,  icon: CheckCircle,   iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', sparkColor: '#10B981', tooltip: 'Apps with status RUNNING.' },
        { label: 'Apps Failed',  value: failedApps.length, sub: failedApps.length > 0 ? failedApps.map(a => a.name || a.serviceName).join(', ') : 'All good', trend: 0, icon: AlertTriangle, iconBg: failedApps.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', iconColor: failedApps.length > 0 ? '#EF4444' : '#10B981', sparkColor: '#EF4444', tooltip: 'Apps in error state.', alert: failedApps.length > 0 },
        { label: 'Running Pods', value: totalReplicas,  sub: 'Active pods in Kubernetes',                                    trend: 0,  icon: Cpu,           iconBg: 'rgba(168,85,247,0.1)', iconColor: '#A855F7', sparkColor: '#A855F7', tooltip: 'Pods currently running. 0 = scaled to zero (wakes on first request).' },
        { label: 'Req / sec',    value: fmtReq(clusterMetrics?.totalReqPerSec), sub: clusterMetrics ? `Error: ${(clusterMetrics.clusterErrorRate * 100).toFixed(2)}%` : 'No data', trend: 8, icon: Zap, iconBg: 'rgba(16,185,129,0.1)', iconColor: '#10B981', sparkColor: '#10B981', tooltip: 'Total HTTP requests/sec across all running apps.' },
        { label: 'Last Deploy',  value: fmtAgo(lastDeploy), sub: lastDeploy ? new Date(lastDeploy).toLocaleDateString() : '—', trend: 0, icon: Timer, iconBg: 'rgba(245,158,11,0.1)', iconColor: '#F59E0B', sparkColor: '#F59E0B', tooltip: 'Time since most recent deployment.' },
    ];

    const toggleSort = (field) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };
    const sortedApps = [...apps].sort((a, b) => {
        const va = String(a[sortField] ?? ''), vb = String(b[sortField] ?? '');
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    const SortIcon = ({ field }) => {
        if (sortField !== field) return <ChevronsUpDown size={11} style={{ color: '#9CA3AF' }} />;
        return sortDir === 'asc' ? <ChevronUp size={11} style={{ color: '#00D4FF' }} /> : <ChevronDown size={11} style={{ color: '#00D4FF' }} />;
    };

    // recent notifs for activity feed
    const recentActivity = logs.slice(0, 8);

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 24 }}>

            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 4px' }}>Home</p>
                    <h2 style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">
                        Welcome back, {(user?.username || 'User').split('@')[0]} 👋
                    </h2>
                    <p style={{ fontSize: 12, margin: '4px 0 0' }} className="text-secondary">
                        NEXTSTEP Serverless Platform · {new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                </div>
                <button className="btn-primary" onClick={() => setDeployOpen(true)}>
                    <Rocket size={15} /> Quick Deploy
                </button>
            </div>

            {/* Suspension banner */}
            {user?.suspended && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)' }}
                >
                    <AlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0 }} />
                    <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#FCA5A5', margin: '0 0 2px' }}>Votre compte est suspendu</p>
                        <p style={{ fontSize: 12, color: '#F87171', margin: 0 }}>
                            Vos services ne sont plus accessibles. Veuillez contacter le support pour régulariser votre situation.
                        </p>
                    </div>
                </motion.div>
            )}

            {/* Alert banner — shown only if apps failed */}
            {failedApps.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}
                >
                    <AlertCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#EF4444' }}>
                            {failedApps.length} app{failedApps.length > 1 ? 's' : ''} in error state
                        </p>
                        <p style={{ fontSize: 11, margin: '2px 0 0', color: '#9CA3AF' }}>
                            {failedApps.map(a => a.name || a.serviceName).join(', ')}
                        </p>
                    </div>
                    <button className="btn-ghost" style={{ fontSize: 12, color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => navigate('/apps')}>
                        View Apps <ArrowRight size={13} />
                    </button>
                </motion.div>
            )}

            {/* Platform health bar */}
            {!loading && <HealthBar apps={apps} />}

            {/* KPI Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
                {kpiCards.map((card, i) => (
                    <motion.div key={card.label} style={{ animationDelay: `${i * 60}ms` }}>
                        <KpiCard {...card} loading={loading} />
                    </motion.div>
                ))}
            </div>

            {/* Apps Table + Activity Feed */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>

                {/* Applications Table */}
                <div className="ns-card" style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Your Applications</h3>
                            <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">{apps.length} services · {totalReplicas} pod{totalReplicas !== 1 ? 's' : ''} active</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate('/monitoring')}>
                                <Activity size={13} /> Monitoring
                            </button>
                            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate('/apps')}>
                                View all <ArrowRight size={13} />
                            </button>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr>
                                    {[
                                        { label: 'App Name',    field: 'name'       },
                                        { label: 'Status',      field: 'status'     },
                                        { label: 'Pods',        field: 'replicas'   },
                                        { label: 'Last Deploy', field: 'deployedAt' },
                                        { label: 'Req / sec',   field: 'reqPerSec'  },
                                    ].map(col => (
                                        <th key={col.field}
                                            onClick={() => toggleSort(col.field)}
                                            style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#64748B', borderBottom: '1px solid rgba(0,0,0,0.07)', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }}
                                        >
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{col.label} <SortIcon field={col.field} /></span>
                                        </th>
                                    ))}
                                    <th style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)' }} />
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>Loading…</td></tr>
                                ) : sortedApps.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center' }}>
                                            <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>No applications deployed yet</p>
                                            <button className="btn-primary" style={{ marginTop: 12, fontSize: 12 }} onClick={() => navigate('/apps/new')}>Deploy your first app</button>
                                        </td>
                                    </tr>
                                ) : sortedApps.map((app, i) => (
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
                                                <div style={{ width: 28, height: 28, borderRadius: 7, background: app.status === 'FAILED' ? 'rgba(239,68,68,0.1)' : 'rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: app.status === 'FAILED' ? '#EF4444' : '#00D4FF', flexShrink: 0 }}>
                                                    {(app.name || app.serviceName || 'A').slice(0, 2).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }} className="text-primary">{app.name || app.serviceName}</p>
                                                        {app.deployedAt && (new Date() - new Date(app.deployedAt)) < 3600000 && (
                                                            <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#10B981', padding: '1px 6px', borderRadius: 999 }}>NEW</span>
                                                        )}
                                                    </div>
                                                    {app.imageName && <p style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: '#9CA3AF', margin: '1px 0 0' }}>{app.imageName}:{app.imageTag || 'latest'}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                            <StatusBadge status={app.status || 'PENDING'} />
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} className="text-primary">
                                            {(app.replicas ?? 0) === 0
                                                ? <span style={{ color: '#6B7280', fontStyle: 'italic', fontSize: 11 }}>scaled to zero</span>
                                                : `${app.replicas} pod${app.replicas !== 1 ? 's' : ''}`}
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', fontSize: 12 }} className="text-secondary">
                                            {fmtAgo(app.deployedAt)}
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }} className="text-secondary">
                                            {app.status === 'RUNNING' && clusterMetrics?.totalReqPerSec
                                                ? fmtReq(clusterMetrics.totalReqPerSec / Math.max(1, running))
                                                : '—'}
                                        </td>
                                        <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                            {app.url && (
                                                <a href={app.url.startsWith('http') ? app.url : `http://${app.url}`} target="_blank" rel="noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 8px', borderRadius: 6, background: 'rgba(0,212,255,0.08)', color: '#00D4FF', border: 'none', cursor: 'pointer', textDecoration: 'none' }}>
                                                    <ExternalLink size={12} />
                                                </a>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Activity Feed */}
                <div className="ns-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 800, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Activity Feed</h3>
                            <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">Recent deployment events</p>
                        </div>
                        <button className="btn-ghost" style={{ fontSize: 11 }} onClick={() => navigate('/logs')}>
                            All logs <ArrowRight size={12} />
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {recentActivity.length === 0 ? (
                            <p style={{ padding: '20px', fontSize: 12, color: '#6B7280', textAlign: 'center' }}>No activity yet</p>
                        ) : recentActivity.map((ev, i) => {
                            const typeColors = { DEPLOYMENT_SUCCESS: '#10B981', DEPLOYMENT_FAIL: '#EF4444', DEPLOYMENT_START: '#00D4FF', DELETE: '#F59E0B', UPDATE: '#A855F7', KAFKA_WIRED: '#F59E0B' };
                            const color = typeColors[ev.type] || '#6B7280';
                            return (
                                <motion.div
                                    key={ev.id}
                                    initial={{ opacity: 0, x: 8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 20px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}
                                >
                                    <div style={{ width: 3, minHeight: 38, borderRadius: 2, background: color, flexShrink: 0, marginTop: 2 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", margin: 0, color: '#00D4FF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.appName || ev.appId?.slice(0, 8) || 'platform'}</p>
                                        <p style={{ fontSize: 11, margin: '3px 0 0', lineHeight: 1.4 }} className="text-secondary">{ev.message}</p>
                                        <p style={{ fontSize: 10, margin: '4px 0 0', color: '#9CA3AF' }}>{fmtAgo(ev.createdAt)}</p>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Role-based suggestions */}
            <RoleIdeasCard role={user?.role} navigate={navigate} />

            {/* Quick Deploy panel */}
            <AnimatePresence>
                {deployOpen && <QuickDeployPanel onClose={() => setDeployOpen(false)} />}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;
