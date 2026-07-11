import { useEffect, useState } from 'react';
import { adminApi, metricsApi } from '../../api';
import {
    Server, Box, Users, Zap, Globe, AlertTriangle, RefreshCw, ShieldAlert, Radio,
    Database, GitBranch, CheckCircle, XCircle, AlertCircle, Ban, Play, Trash2, Activity,
} from 'lucide-react';

const LOG_LEVEL_COLOR = { INFO: '#4A9EF5', WARN: '#E8A838', ERROR: '#F85149' };

// ── helpers ──────────────────────────────────────────────────────────────
const fmtReq = v => v == null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(1);
const fmtPct = v => v == null ? '—' : `${(v * 100).toFixed(2)}%`;
const fmtBytes = v => {
    if (v == null) return '—';
    const gib = v / (1024 ** 3);
    return gib >= 1 ? `${gib.toFixed(1)} GiB` : `${(v / (1024 ** 2)).toFixed(0)} MiB`;
};

const usageColor = pct => pct == null ? '#5A7080' : pct >= 90 ? '#F85149' : pct >= 75 ? '#E8A838' : '#3FB950';

const ResourceBar = ({ label, usedBytes, totalBytes, percent }) => {
    const pct = percent != null ? percent : (totalBytes ? (usedBytes / totalBytes) * 100 : null);
    return (
        <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#5A7080', marginBottom: 4 }}>
                <span>{label}</span>
                <span>
                    {pct == null ? '—' : `${pct.toFixed(0)}%`}
                    {totalBytes != null && usedBytes != null ? ` (${fmtBytes(usedBytes)} / ${fmtBytes(totalBytes)})` : ''}
                </span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#1F2B3A', overflow: 'hidden' }}>
                <div style={{
                    height: '100%', width: `${Math.min(100, Math.max(0, pct || 0))}%`,
                    background: usageColor(pct), borderRadius: 3, transition: 'width 0.3s',
                }} />
            </div>
        </div>
    );
};

const statusColor = s => ({
    RUNNING: '#3FB950', Running: '#3FB950',
    FAILED: '#F85149', Failed: '#F85149',
    CrashLoopBackOff: '#F85149', Error: '#F85149',
    PENDING: '#E8A838', Pending: '#E8A838', SCALING: '#E8A838',
    SUSPENDED: '#5A7080', IDLE: '#5A7080', SCALED_TO_ZERO: '#5A7080',
}[s] || '#5A7080');

// Wraps a call so a failure surfaces as a labeled error instead of being
// swallowed and rendered as if the data were simply empty.
const describeFailure = (label, err) => ({
    label,
    message: err.response?.status
        ? `HTTP ${err.response.status} — ${err.response.data?.detail || err.response.data?.title || err.message}`
        : `Network error — ${err.message}`,
});

const ErrorBanner = ({ errors }) => errors.length === 0 ? null : (
    <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.25)',
        borderRadius: 10, padding: '14px 18px',
    }}>
        {errors.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertTriangle size={15} color="#F85149" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: '#FCA5A5', margin: 0 }}>
                    <strong>{e.label} unavailable.</strong> {e.message}
                </p>
            </div>
        ))}
    </div>
);

const StatCard = ({ label, value, icon: Icon, color = '#00D4FF' }) => (
    <div style={{
        background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12,
        padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
    }}>
        <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <Icon size={20} style={{ color }} />
        </div>
        <div>
            <div style={{ fontSize: 11, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#DDE6F0' }}>{value ?? '—'}</div>
        </div>
    </div>
);

const StatusPill = ({ status }) => {
    const col = statusColor(status);
    return (
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${col}15`, color: col, border: `1px solid ${col}30`, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>
            {status || 'Unknown'}
        </span>
    );
};

const SectionHeader = ({ icon: Icon, title, count, color = '#4A9EF5' }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={15} style={{ color }} />
        </div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, margin: 0, color: '#DDE6F0' }}>{title}</h2>
        {count != null && (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${color}15`, color, fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
        )}
    </div>
);

const NodeCard = ({ node }) => {
    const isReady = node.status === 'Ready';
    return (
        <div style={{
            background: '#0D1117', border: `1px solid ${isReady ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)'}`,
            borderRadius: 12, padding: '18px 22px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Server size={16} style={{ color: '#5A7080' }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#DDE6F0' }}>{node.name}</span>
                </div>
                <StatusPill status={node.status} />
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: '#5A7080' }}><span style={{ color: '#4A9EF5' }}>Role:</span> {node.role}</div>
                <div style={{ fontSize: 12, color: '#5A7080' }}><span style={{ color: '#4A9EF5' }}>CPU cores:</span> {node.cpu}</div>
                <div style={{ fontSize: 12, color: '#5A7080' }}><span style={{ color: '#4A9EF5' }}>Memory cap:</span> {node.memory}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ResourceBar label="CPU usage" percent={node.cpuUsagePercent} />
                <ResourceBar label="Memory" usedBytes={node.memoryUsedBytes} totalBytes={node.memoryTotalBytes} />
                <ResourceBar label="Disk (/)" usedBytes={node.diskUsedBytes} totalBytes={node.diskTotalBytes} />
            </div>
        </div>
    );
};

const componentStatusColor = (status) => ({ HEALTHY: '#3FB950', DEGRADED: '#E8A838', UNKNOWN: '#5A7080' }[status] || '#5A7080');

const SystemComponentCard = ({ component }) => {
    const color = componentStatusColor(component.status);
    return (
        <div style={{ background: '#0D1117', border: `1px solid ${color}30`, borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#DDE6F0' }}>{component.namespace}</span>
                <span style={{ fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", padding: '3px 10px', borderRadius: 20, color, background: `${color}18`, border: `1px solid ${color}30` }}>
                    {component.status}
                </span>
            </div>
            <div style={{ fontSize: 12, color: '#5A7080' }}>{component.readyPods}/{component.totalPods} pods ready</div>
        </div>
    );
};

const EventRow = ({ event }) => (
    <tr style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
        <td style={{ padding: '10px 20px', fontSize: 11, color: '#5A7080', whiteSpace: 'nowrap' }}>{event.lastSeen ? new Date(event.lastSeen).toLocaleString() : '—'}</td>
        <td style={{ padding: '10px 20px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#F85149', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', fontFamily: "'JetBrains Mono', monospace" }}>{event.reason}</span>
        </td>
        <td style={{ padding: '10px 20px', fontSize: 12, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{event.kind}/{event.involvedObject}</td>
        <td style={{ padding: '10px 20px', fontSize: 11, color: '#5A7080' }}>{event.namespace}</td>
        <td style={{ padding: '10px 20px', fontSize: 12, color: '#DDE6F0', maxWidth: 420 }}>{event.message}</td>
        <td style={{ padding: '10px 20px', fontSize: 11, color: '#5A7080', textAlign: 'right' }}>×{event.count}</td>
    </tr>
);

const PodRow = ({ pod }) => (
    <tr style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
        <td style={{ padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusColor(pod.phase), boxShadow: `0 0 5px ${statusColor(pod.phase)}` }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: '#DDE6F0' }}>{pod.name}</span>
            </div>
        </td>
        <td style={{ padding: '10px 16px', fontSize: 11, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{pod.namespace}</td>
        <td style={{ padding: '10px 16px' }}><StatusPill status={pod.phase} /></td>
        <td style={{ padding: '10px 16px', fontSize: 11, color: '#5A7080' }}>{pod.nodeName || '—'}</td>
        <td style={{ padding: '10px 16px', fontSize: 11, textAlign: 'center' }}>
            {pod.restarts > 0 ? <span style={{ color: '#E8A838', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{pod.restarts}</span> : <span style={{ color: '#3FB950' }}>0</span>}
        </td>
        <td style={{ padding: '10px 16px' }}>{pod.ready ? <CheckCircle size={14} style={{ color: '#3FB950' }} /> : <XCircle size={14} style={{ color: '#F85149' }} />}</td>
    </tr>
);

// ── Main ─────────────────────────────────────────────────────────────────
const TABS = [
    { id: 'pods',     label: 'Pods',        color: '#4A9EF5' },
    { id: 'apps',     label: 'Apps',        color: '#00D4FF' },
    { id: 'knative',  label: 'Knative',     color: '#A371F7' },
    { id: 'kafka',    label: 'Kafka',       color: '#E8A838' },
    { id: 'eventing', label: 'Eventing',    color: '#3FB950' },
    { id: 'logs',     label: 'Logs',        color: '#9B6FD8' },
];

const POLL_INTERVAL_MS = 20000; // Pods/Apps/Knative refresh automatically; Kafka/Eventing are lower-churn

const ClusterManagement = () => {
    const [activeTab, setActiveTab] = useState('pods');
    const [loading,   setLoading]   = useState(true);
    const [errors,    setErrors]    = useState([]);

    const [stats,            setStats]            = useState(null);
    const [cluster,           setCluster]          = useState(null);
    const [nodes,             setNodes]            = useState([]);
    const [namespaces,        setNamespaces]       = useState([]);
    const [systemComponents,  setSystemComponents] = useState([]);
    const [events,            setEvents]           = useState([]);
    const [alerts,            setAlerts]           = useState([]);
    const [pods,              setPods]             = useState([]);
    const [apps,              setApps]             = useState([]);
    const [knSvcs,            setKnSvcs]           = useState([]);
    const [kafkaBrokers,      setKafkaBrokers]     = useState([]);
    const [topics,            setTopics]           = useState([]);
    const [sources,           setSources]          = useState([]);
    const [triggers,          setTriggers]         = useState([]);
    const [logs,              setLogs]             = useState([]);
    const [logsLoaded,        setLogsLoaded]       = useState(false);
    const [logsError,         setLogsError]        = useState(null);

    // namespace/status filters (client-side, shared pattern across tabs)
    const [podNsFilter,     setPodNsFilter]     = useState('');
    const [podStatusFilter, setPodStatusFilter] = useState('');
    const [appTenantFilter, setAppTenantFilter] = useState('');
    const [logAppFilter,    setLogAppFilter]    = useState('');
    const [logLevelFilter,  setLogLevelFilter]  = useState('');
    const [logSearch,       setLogSearch]       = useState('');

    const [actingOn, setActingOn] = useState(null); // app id currently being suspended/restored/deleted

    const load = (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        const failures = [];
        const fail = (label) => (err) => { failures.push(describeFailure(label, err)); return { data: null }; };

        Promise.all([
            adminApi.getStats().catch(fail('Platform stats')),
            metricsApi.getCluster().catch(fail('Cluster metrics')),
            adminApi.getNodes().catch(fail('Kubernetes nodes')),
            adminApi.getNamespaces().catch(fail('Tenant namespaces')),
            adminApi.getSystemComponents().catch(fail('System components')),
            adminApi.getClusterEvents().catch(fail('Cluster events')),
            adminApi.getActiveAlerts().catch(fail('Active alerts')),
            adminApi.getPods().catch(fail('Pods')),
            adminApi.getAllApps().catch(fail('Applications')),
            adminApi.getKnativeServices().catch(fail('Knative services')),
            adminApi.getKafkaBrokers().catch(fail('Kafka brokers')),
            adminApi.getAllTopics().catch(fail('Kafka topics')),
            adminApi.getAllSources().catch(fail('KafkaSources')),
            adminApi.getAllTriggers().catch(fail('Triggers')),
        ]).then(([s, cl, n, ns, sc, ev, al, pd, ap, kn, kb, tp, src, trg]) => {
            setStats(s.data);
            setCluster(cl.data);
            setNodes(Array.isArray(n.data) ? n.data : []);
            setNamespaces(Array.isArray(ns.data) ? ns.data : []);
            setSystemComponents(Array.isArray(sc.data) ? sc.data : []);
            setEvents(Array.isArray(ev.data) ? ev.data : []);
            setAlerts(Array.isArray(al.data) ? al.data : []);
            setPods(Array.isArray(pd.data) ? pd.data : []);
            setApps(Array.isArray(ap.data) ? ap.data : []);
            setKnSvcs(Array.isArray(kn.data) ? kn.data : []);
            setKafkaBrokers(Array.isArray(kb.data) ? kb.data : []);
            setTopics(Array.isArray(tp.data) ? tp.data : []);
            setSources(Array.isArray(src.data) ? src.data : []);
            setTriggers(Array.isArray(trg.data) ? trg.data : []);
            setErrors(failures);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { load(true); }, []);

    // Auto-refresh: Pods/Apps/Knative change fast, so a single shared poll
    // covers all three tabs — Kafka/Eventing/Overview are refreshed by it
    // too since it's one combined call, but that's fine at this volume.
    useEffect(() => {
        const id = setInterval(() => load(false), POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, []);

    // Logs are loaded lazily (first time the tab is opened) and not polled —
    // a log stream doesn't need to auto-refresh the way live pod/app state does.
    const loadLogs = () => {
        setLogsError(null);
        adminApi.getAllLogs()
            .then(res => { setLogs(Array.isArray(res.data) ? res.data : []); setLogsLoaded(true); })
            .catch(err => { setLogsError(describeFailure('Logs', err)); setLogsLoaded(true); });
    };

    useEffect(() => {
        if (activeTab === 'logs' && !logsLoaded) loadLogs();
    }, [activeTab, logsLoaded]);

    // ── App actions (reuse the exact endpoints that already trigger the
    // AdminAuditLog SUSPEND_APP/RESTORE_APP/FORCE_DELETE_APP entries) ──
    const runAppAction = async (app, action) => {
        setActingOn(app.id);
        try {
            if (action === 'suspend') await adminApi.suspendApp(app.id);
            if (action === 'restore') await adminApi.restoreApp(app.id);
            if (action === 'delete') await adminApi.forceDelete(app.id);
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

    const runTopicDelete = async (topic) => {
        if (!window.confirm(`Permanently delete Kafka topic "${topic.name}"? This cannot be undone.`)) return;
        setActingOn(topic.id);
        try {
            await adminApi.deleteTopic(topic.id);
            load(false);
        } finally {
            setActingOn(null);
        }
    };

    const podNamespaces = [...new Set(pods.map(p => p.namespace))].sort();
    const filteredPods = pods
        .filter(p => !podNsFilter || p.namespace === podNsFilter)
        .filter(p => !podStatusFilter || p.phase === podStatusFilter)
        .sort((a, b) => {
            const errRank = p => (p.phase === 'Failed' || p.restarts > 0) ? 0 : p.phase === 'Pending' ? 1 : 2;
            return errRank(a) - errRank(b);
        });

    const appTenants = [...new Set(apps.map(a => a.userId).filter(Boolean))].sort();
    const filteredApps = apps.filter(a => !appTenantFilter || a.userId === appTenantFilter);

    const logAppNames = [...new Set(logs.map(l => l.appName).filter(Boolean))].sort();
    const filteredLogs = logs
        .filter(l => !logAppFilter || l.appName === logAppFilter)
        .filter(l => !logLevelFilter || l.type === logLevelFilter)
        .filter(l => !logSearch || l.message?.toLowerCase().includes(logSearch.toLowerCase()));

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />)}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#4A9EF5', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 6px' }}>Admin Console</p>
                    <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, color: '#DDE6F0', margin: 0 }}>Cluster Management</h1>
                    <p style={{ color: '#5A7080', fontSize: 14, marginTop: 4 }}>
                        {apps.length} apps · {pods.length} pods · {nodes.length} nodes · {topics.length} kafka topics
                    </p>
                </div>
                <button onClick={() => load(true)} style={{
                    display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 9,
                    border: '1px solid #1F2B3A', background: 'transparent', color: '#5A7080', cursor: 'pointer', fontSize: 12,
                }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            <ErrorBanner errors={errors} />

            {/* Platform stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <StatCard label="Total Users"       value={stats?.totalUsers}                       icon={Users}    color="#4A9EF5" />
                <StatCard label="Total Apps"        value={stats?.totalApps}                        icon={Box}      color="#00D4FF" />
                <StatCard label="Running Apps"      value={stats?.runningApps}                      icon={Activity} color="#3FB950" />
                <StatCard label="Req / sec"         value={fmtReq(cluster?.totalReqPerSec)}          icon={Radio}    color="#10B981" />
                <StatCard label="Kafka Topics"      value={stats?.totalTopics}                      icon={Zap}      color="#E8A838" />
                <StatCard label="Active Namespaces" value={stats?.activeNamespaces}                 icon={Globe}    color="#A371F7" />
            </div>

            {/* Critical system components */}
            <div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#DDE6F0', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldAlert size={16} style={{ color: '#5A7080' }} /> Critical System Components
                </h2>
                <p style={{ color: '#5A7080', fontSize: 12, marginBottom: 14 }}>
                    knative-serving, knative-eventing, kourier-system, kafka — if any of these go down, every tenant is affected
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                    {systemComponents.map((c, i) => <SystemComponentCard key={i} component={c} />)}
                </div>
            </div>

            {/* Active Alertmanager alerts */}
            <div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#DDE6F0', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldAlert size={16} style={{ color: '#5A7080' }} /> Active Alerts ({alerts.length})
                </h2>
                <p style={{ color: '#5A7080', fontSize: 12, marginBottom: 14 }}>
                    Live from Alertmanager — rules defined in k8s/monitoring/alert-rules.yaml
                </p>
                {alerts.length === 0 ? (
                    <div style={{ color: '#5A7080', fontSize: 13, padding: 20, background: '#0D1117', borderRadius: 12, border: '1px solid #1F2B3A', marginBottom: 24 }}>
                        No active alerts
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                        {alerts.map((a, i) => {
                            const sevColor = { critical: '#F85149', warning: '#E8A838', none: '#5A7080' }[a.severity] || '#4A9EF5';
                            return (
                                <div key={i} style={{
                                    background: '#0D1117', border: `1px solid ${sevColor}30`, borderRadius: 10,
                                    padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12,
                                }}>
                                    <span style={{
                                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                        background: `${sevColor}15`, color: sevColor, border: `1px solid ${sevColor}30`,
                                        fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', flexShrink: 0, marginTop: 2,
                                    }}>{a.severity}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: '#DDE6F0' }}>
                                            {a.alertName} {a.namespace ? <span style={{ color: '#5A7080', fontWeight: 400 }}>· {a.namespace}</span> : null}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#5A7080', marginTop: 2 }}>{a.summary || a.description}</div>
                                    </div>
                                    <div style={{ fontSize: 11, color: '#5A7080', flexShrink: 0, whiteSpace: 'nowrap' }}>
                                        since {a.startsAt ? new Date(a.startsAt).toLocaleString() : '—'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Recent warning events */}
            <div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#DDE6F0', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Radio size={16} style={{ color: '#5A7080' }} /> Recent Warning Events ({events.length})
                </h2>
                <p style={{ color: '#5A7080', fontSize: 12, marginBottom: 14 }}>
                    OOMKilled, ImagePullBackOff, CrashLoopBackOff, and other Warning events across all namespaces
                </p>
                <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
                    {events.length === 0 ? (
                        <div style={{ color: '#5A7080', fontSize: 13, padding: 24, textAlign: 'center' }}>No warning events — cluster is quiet</div>
                    ) : (
                        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                    {['Last Seen', 'Reason', 'Object', 'Namespace', 'Message', 'Count'].map(h => (
                                        <th key={h} style={{ padding: '10px 20px', textAlign: h === 'Count' ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>{events.map((e, i) => <EventRow key={i} event={e} />)}</tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Nodes */}
            <div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#DDE6F0', marginBottom: 14 }}>Kubernetes Nodes ({nodes.length})</h2>
                {nodes.length === 0 ? (
                    <div style={{ color: '#5A7080', fontSize: 13, padding: 20, background: '#0D1117', borderRadius: 12, border: '1px solid #1F2B3A' }}>No nodes available</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                        {nodes.map((n, i) => <NodeCard key={i} node={n} />)}
                    </div>
                )}
            </div>

            {/* Tenant namespaces */}
            <div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#DDE6F0', marginBottom: 14 }}>Tenant Namespaces ({namespaces.length})</h2>
                <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
                    {namespaces.length === 0 ? (
                        <div style={{ color: '#5A7080', fontSize: 13, padding: 24, textAlign: 'center' }}>No tenant namespaces found</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                {['Namespace', 'Tenant', 'Apps', 'CPU', 'Memory', 'Req/sec', 'Status'].map(h => (
                                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                ))}
                            </tr></thead>
                            <tbody>
                                {namespaces.map((ns, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                        <td style={{ padding: '12px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#4A9EF5' }}>{ns.name}</td>
                                        <td style={{ padding: '12px 20px', fontSize: 13, color: '#DDE6F0' }}>{ns.tenant}</td>
                                        <td style={{ padding: '12px 20px', fontSize: 13, color: '#DDE6F0' }}>{ns.appCount}</td>
                                        <td style={{ padding: '12px 20px', fontSize: 13, color: '#DDE6F0' }}>{ns.cpuCores != null ? `${ns.cpuCores.toFixed(2)} cores` : '—'}</td>
                                        <td style={{ padding: '12px 20px', fontSize: 13, color: '#DDE6F0' }}>{fmtBytes(ns.memoryBytes)}</td>
                                        <td style={{ padding: '12px 20px', fontSize: 13, color: '#DDE6F0' }}>{fmtReq(ns.reqPerSec)}</td>
                                        <td style={{ padding: '12px 20px' }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#3FB950', background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.2)', fontFamily: "'JetBrains Mono', monospace" }}>{ns.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div>
                <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #1F2B3A', marginBottom: 20 }}>
                    {TABS.map(tab => {
                        const count = { pods: pods.length, apps: apps.length, knative: knSvcs.length, kafka: topics.length, eventing: sources.length + triggers.length }[tab.id];
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                                padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                background: 'transparent', borderBottom: `2px solid ${activeTab === tab.id ? tab.color : 'transparent'}`,
                                color: activeTab === tab.id ? tab.color : '#64748B', display: 'flex', alignItems: 'center', gap: 7,
                            }}>
                                {tab.label}
                                <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: activeTab === tab.id ? `${tab.color}18` : 'rgba(100,116,139,0.1)', color: activeTab === tab.id ? tab.color : '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* ── Pods tab ── */}
                {activeTab === 'pods' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <select value={podNsFilter} onChange={e => setPodNsFilter(e.target.value)} style={{ background: '#0D1117', border: '1px solid #1F2B3A', color: '#DDE6F0', borderRadius: 8, padding: '7px 12px', fontSize: 12 }}>
                                <option value="">All namespaces</option>
                                {podNamespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                            </select>
                            <select value={podStatusFilter} onChange={e => setPodStatusFilter(e.target.value)} style={{ background: '#0D1117', border: '1px solid #1F2B3A', color: '#DDE6F0', borderRadius: 8, padding: '7px 12px', fontSize: 12 }}>
                                <option value="">All statuses</option>
                                {['Running', 'Pending', 'Failed', 'Succeeded'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="ns-card" style={{ overflow: 'hidden', background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                    {['Pod Name', 'Namespace', 'Phase', 'Node', 'Restarts', 'Ready'].map(h => (
                                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>
                                    {filteredPods.length === 0
                                        ? <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>No pods match the current filters</td></tr>
                                        : filteredPods.map((p, i) => <PodRow key={i} pod={p} />)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Apps tab ── */}
                {activeTab === 'apps' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <select value={appTenantFilter} onChange={e => setAppTenantFilter(e.target.value)} style={{ background: '#0D1117', border: '1px solid #1F2B3A', color: '#DDE6F0', borderRadius: 8, padding: '7px 12px', fontSize: 12, width: 220 }}>
                            <option value="">All tenants</option>
                            {appTenants.map(t => <option key={t} value={t}>{t}</option>)}
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
                )}

                {/* ── Knative tab ── */}
                {activeTab === 'knative' && (
                    <div className="ns-card" style={{ overflow: 'hidden', background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12 }}>
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
                                        <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: '#DDE6F0' }}>{s.name}</td>
                                        <td style={{ padding: '10px 16px', fontSize: 11, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{s.namespace}</td>
                                        <td style={{ padding: '10px 16px', fontSize: 12, color: '#5A7080' }}>{s.tenant}</td>
                                        <td style={{ padding: '10px 16px' }} title={s.statusMessage || undefined}>
                                            {s.ready === 'True' ? <CheckCircle size={14} style={{ color: '#3FB950' }} />
                                                : s.ready === 'False' ? <XCircle size={14} style={{ color: '#F85149' }} />
                                                : <AlertCircle size={14} style={{ color: '#E8A838' }} />}
                                        </td>
                                        <td style={{ padding: '10px 16px', fontSize: 11, color: '#4A9EF5', fontFamily: "'JetBrains Mono', monospace", maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.url || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ── Kafka tab ── */}
                {activeTab === 'kafka' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <SectionHeader icon={Database} title="Brokers" count={kafkaBrokers.length} color="#E8A838" />
                        <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                    {['Pod', 'Namespace', 'Phase', 'Node', 'Restarts', 'Ready'].map(h => (
                                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>{kafkaBrokers.length === 0 ? <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No brokers found</td></tr> : kafkaBrokers.map((b, i) => <PodRow key={i} pod={b} />)}</tbody>
                            </table>
                        </div>

                        <SectionHeader icon={Zap} title="Topics" count={topics.length} color="#E8A838" />
                        <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                    {['Topic Name', 'Partitions', 'Replicas', 'Tenant', 'Created', ''].map(h => (
                                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>
                                    {topics.length === 0 ? <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No topics</td></tr>
                                    : topics.map((t, i) => (
                                        <tr key={t.id || i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                            <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#E8A838' }}>{t.name}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#5A7080' }}>{t.partitions ?? 1}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#5A7080' }}>{t.replicas ?? 1}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{t.userId || '—'}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 11, color: '#5A7080' }}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
                                            <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                                <button disabled={actingOn === t.id} onClick={() => runTopicDelete(t)} title="Force delete topic"
                                                    style={{ padding: 6, borderRadius: 6, border: '1px solid rgba(248,81,73,0.3)', background: 'rgba(248,81,73,0.1)', color: '#F85149', cursor: 'pointer' }}>
                                                    <Trash2 size={12} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p style={{ fontSize: 11, color: '#5A7080', margin: 0 }}>
                            Consumer group lag is not shown — no backend endpoint computes it yet.
                        </p>
                    </div>
                )}

                {/* ── Eventing tab ── */}
                {activeTab === 'eventing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <SectionHeader icon={Radio} title="KafkaSources" count={sources.length} color="#3FB950" />
                        <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                    {['Name', 'Topic', 'Consumer Group', 'Tenant', 'Ready', 'Created'].map(h => (
                                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>
                                    {sources.length === 0 ? <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No KafkaSources</td></tr>
                                    : sources.map((s, i) => (
                                        <tr key={s.id || i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                            <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: '#DDE6F0' }}>{s.name}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 11, color: '#E8A838', fontFamily: "'JetBrains Mono', monospace" }}>{s.kafkaTopicId}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 11, color: '#5A7080' }}>{s.consumerGroup}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{s.userId}</td>
                                            <td style={{ padding: '10px 16px' }}>{s.ready ? <CheckCircle size={14} style={{ color: '#3FB950' }} /> : <XCircle size={14} style={{ color: '#F85149' }} />}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 11, color: '#5A7080' }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <SectionHeader icon={GitBranch} title="Triggers" count={triggers.length} color="#3FB950" />
                        <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                    {['Name', 'Filter Type', 'Subscriber', 'Broker', 'Tenant', 'Ready'].map(h => (
                                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{h}</th>
                                    ))}
                                </tr></thead>
                                <tbody>
                                    {triggers.length === 0 ? <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>No Triggers</td></tr>
                                    : triggers.map((t, i) => (
                                        <tr key={t.id || i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                            <td style={{ padding: '10px 16px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700, color: '#DDE6F0' }}>{t.name}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 11, color: '#5A7080' }}>{t.filterType || '—'}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 11, color: '#4A9EF5' }}>{t.subscriberName}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 11, color: '#5A7080' }}>{t.brokerName}</td>
                                            <td style={{ padding: '10px 16px', fontSize: 12, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{t.userId}</td>
                                            <td style={{ padding: '10px 16px' }}>{t.ready ? <CheckCircle size={14} style={{ color: '#3FB950' }} /> : <XCircle size={14} style={{ color: '#F85149' }} />}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ── Logs tab ── */}
                {activeTab === 'logs' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                                placeholder="Search message…"
                                value={logSearch}
                                onChange={e => setLogSearch(e.target.value)}
                                style={{ background: '#0D1117', border: '1px solid #1F2B3A', color: '#DDE6F0', borderRadius: 8, padding: '7px 12px', fontSize: 12, width: 220 }}
                            />
                            <select value={logAppFilter} onChange={e => setLogAppFilter(e.target.value)} style={{ background: '#0D1117', border: '1px solid #1F2B3A', color: '#DDE6F0', borderRadius: 8, padding: '7px 12px', fontSize: 12 }}>
                                <option value="">All apps</option>
                                {logAppNames.map(a => <option key={a} value={a}>{a}</option>)}
                            </select>
                            <select value={logLevelFilter} onChange={e => setLogLevelFilter(e.target.value)} style={{ background: '#0D1117', border: '1px solid #1F2B3A', color: '#DDE6F0', borderRadius: 8, padding: '7px 12px', fontSize: 12 }}>
                                <option value="">All levels</option>
                                {['INFO', 'WARN', 'ERROR'].map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                            <button onClick={loadLogs} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid #1F2B3A', background: 'transparent', color: '#5A7080', cursor: 'pointer', fontSize: 12, marginLeft: 'auto' }}>
                                <RefreshCw size={12} /> Refresh
                            </button>
                        </div>

                        {logsError && (
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.25)', borderRadius: 10, padding: '12px 16px' }}>
                                <AlertTriangle size={15} color="#F85149" style={{ flexShrink: 0, marginTop: 1 }} />
                                <p style={{ fontSize: 13, color: '#FCA5A5', margin: 0 }}><strong>{logsError.label} unavailable.</strong> {logsError.message}</p>
                            </div>
                        )}

                        <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
                            {!logsLoaded ? (
                                <div style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>Loading logs…</div>
                            ) : filteredLogs.length === 0 ? (
                                <div style={{ padding: 32, textAlign: 'center', color: '#64748B' }}>No logs match the current filters</div>
                            ) : (
                                <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead><tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                            {['Time', 'Level', 'App', 'Tenant', 'Message'].map(h => (
                                                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', position: 'sticky', top: 0, background: '#0D1117' }}>{h}</th>
                                            ))}
                                        </tr></thead>
                                        <tbody>
                                            {filteredLogs.map((l, i) => (
                                                <tr key={l.id || i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                                    <td style={{ padding: '8px 16px', fontSize: 11, color: '#5A7080', whiteSpace: 'nowrap' }}>{l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'}</td>
                                                    <td style={{ padding: '8px 16px' }}>
                                                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: LOG_LEVEL_COLOR[l.type] || '#5A7080', background: `${LOG_LEVEL_COLOR[l.type] || '#5A7080'}18`, fontFamily: "'JetBrains Mono', monospace" }}>{l.type}</span>
                                                    </td>
                                                    <td style={{ padding: '8px 16px', fontSize: 12, color: '#DDE6F0', fontFamily: "'JetBrains Mono', monospace" }}>{l.appName || '—'}</td>
                                                    <td style={{ padding: '8px 16px', fontSize: 11, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>{l.userId || '—'}</td>
                                                    <td style={{ padding: '8px 16px', fontSize: 12, color: '#DDE6F0' }}>{l.message}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClusterManagement;
