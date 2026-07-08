import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import { Server, Cpu, MemoryStick, Box, Users, Zap, Globe, AlertTriangle, RefreshCw, ShieldAlert, Radio } from 'lucide-react';

// Wraps a call so a failure surfaces as a labeled error instead of being
// swallowed and rendered as if the data were simply empty.
const describeFailure = (label, err) => ({
    label,
    message: err.response?.status
        ? `HTTP ${err.response.status} — ${err.response.data?.detail || err.response.data?.title || err.message}`
        : `Network error — ${err.message}`,
});

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
                <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                    padding: '3px 10px', borderRadius: 20,
                    color: isReady ? '#3FB950' : '#F85149',
                    background: isReady ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
                    border: `1px solid ${isReady ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)'}`,
                }}>
                    {node.status}
                </span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: '#5A7080' }}>
                    <span style={{ color: '#4A9EF5' }}>Role:</span> {node.role}
                </div>
                <div style={{ fontSize: 12, color: '#5A7080' }}>
                    <span style={{ color: '#4A9EF5' }}>CPU:</span> {node.cpu}
                </div>
                <div style={{ fontSize: 12, color: '#5A7080' }}>
                    <span style={{ color: '#4A9EF5' }}>Memory:</span> {node.memory}
                </div>
            </div>
        </div>
    );
};

const componentStatusColor = (status) => ({
    HEALTHY: '#3FB950',
    DEGRADED: '#E8A838',
    UNKNOWN: '#5A7080',
}[status] || '#5A7080');

const SystemComponentCard = ({ component }) => {
    const color = componentStatusColor(component.status);
    return (
        <div style={{
            background: '#0D1117', border: `1px solid ${color}30`,
            borderRadius: 12, padding: '16px 20px',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: '#DDE6F0' }}>{component.namespace}</span>
                <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                    padding: '3px 10px', borderRadius: 20, color, background: `${color}18`, border: `1px solid ${color}30`,
                }}>
                    {component.status}
                </span>
            </div>
            <div style={{ fontSize: 12, color: '#5A7080' }}>
                {component.readyPods}/{component.totalPods} pods ready
            </div>
        </div>
    );
};

const EventRow = ({ event }) => (
    <tr style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
        <td style={{ padding: '10px 20px', fontSize: 11, color: '#5A7080', whiteSpace: 'nowrap' }}>
            {event.lastSeen ? new Date(event.lastSeen).toLocaleString() : '—'}
        </td>
        <td style={{ padding: '10px 20px' }}>
            <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                color: '#F85149', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)',
                fontFamily: "'JetBrains Mono', monospace",
            }}>{event.reason}</span>
        </td>
        <td style={{ padding: '10px 20px', fontSize: 12, color: '#A371F7', fontFamily: "'JetBrains Mono', monospace" }}>
            {event.kind}/{event.involvedObject}
        </td>
        <td style={{ padding: '10px 20px', fontSize: 11, color: '#5A7080' }}>{event.namespace}</td>
        <td style={{ padding: '10px 20px', fontSize: 12, color: '#DDE6F0', maxWidth: 420 }}>{event.message}</td>
        <td style={{ padding: '10px 20px', fontSize: 11, color: '#5A7080', textAlign: 'right' }}>×{event.count}</td>
    </tr>
);

const ClusterManagement = () => {
    const [stats,      setStats]      = useState(null);
    const [nodes,      setNodes]      = useState([]);
    const [namespaces, setNamespaces] = useState([]);
    const [systemComponents, setSystemComponents] = useState([]);
    const [events,     setEvents]     = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [errors,     setErrors]     = useState([]);

    const load = () => {
        setLoading(true);
        setErrors([]);
        const failures = [];

        Promise.all([
            adminApi.getStats().catch(err => { failures.push(describeFailure('Platform stats', err)); return { data: null }; }),
            adminApi.getNodes().catch(err => { failures.push(describeFailure('Kubernetes nodes', err)); return { data: [] }; }),
            adminApi.getNamespaces().catch(err => { failures.push(describeFailure('Tenant namespaces', err)); return { data: [] }; }),
            adminApi.getSystemComponents().catch(err => { failures.push(describeFailure('System components', err)); return { data: [] }; }),
            adminApi.getClusterEvents().catch(err => { failures.push(describeFailure('Cluster events', err)); return { data: [] }; }),
        ]).then(([s, n, ns, sc, ev]) => {
            setStats(s.data);
            setNodes(Array.isArray(n.data) ? n.data : []);
            setNamespaces(Array.isArray(ns.data) ? ns.data : []);
            setSystemComponents(Array.isArray(sc.data) ? sc.data : []);
            setEvents(Array.isArray(ev.data) ? ev.data : []);
            setErrors(failures);
        }).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
            ))}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                    <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, color: '#DDE6F0', margin: 0 }}>
                        Cluster Management
                    </h1>
                    <p style={{ color: '#5A7080', fontSize: 14, marginTop: 4 }}>Infrastructure overview — nodes, namespaces, tenants</p>
                </div>
                <button onClick={load} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '9px 16px', borderRadius: 9,
                    border: '1px solid #1F2B3A', background: 'transparent',
                    color: '#5A7080', cursor: 'pointer', fontSize: 12,
                }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {errors.length > 0 && (
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
            )}

            {/* Platform stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <StatCard label="Total Users"       value={stats?.totalUsers}       icon={Users}  color="#4A9EF5" />
                <StatCard label="Total Apps"        value={stats?.totalApps}        icon={Box}    color="#00D4FF" />
                <StatCard label="Running Apps"      value={stats?.runningApps}      icon={Box}    color="#3FB950" />
                <StatCard label="Kafka Topics"      value={stats?.totalTopics}      icon={Zap}    color="#E8A838" />
                <StatCard label="Active Namespaces" value={stats?.activeNamespaces} icon={Globe}  color="#A371F7" />
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

            {/* Recent cluster warning events */}
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
                        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                        {['Last Seen', 'Reason', 'Object', 'Namespace', 'Message', 'Count'].map(h => (
                                            <th key={h} style={{ padding: '10px 20px', textAlign: h === 'Count' ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.map((e, i) => <EventRow key={i} event={e} />)}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Nodes */}
            <div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#DDE6F0', marginBottom: 14 }}>
                    Kubernetes Nodes ({nodes.length})
                </h2>
                {nodes.length === 0 ? (
                    <div style={{ color: '#5A7080', fontSize: 13, padding: 20, background: '#0D1117', borderRadius: 12, border: '1px solid #1F2B3A' }}>
                        No nodes available
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                        {nodes.map((n, i) => <NodeCard key={i} node={n} />)}
                    </div>
                )}
            </div>

            {/* Tenant namespaces */}
            <div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#DDE6F0', marginBottom: 14 }}>
                    Tenant Namespaces ({namespaces.length})
                </h2>
                <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
                    {namespaces.length === 0 ? (
                        <div style={{ color: '#5A7080', fontSize: 13, padding: 24, textAlign: 'center' }}>No tenant namespaces found</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                    {['Namespace', 'Tenant', 'Apps', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {namespaces.map((ns, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
                                        <td style={{ padding: '12px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#4A9EF5' }}>{ns.name}</td>
                                        <td style={{ padding: '12px 20px', fontSize: 13, color: '#DDE6F0' }}>{ns.tenant}</td>
                                        <td style={{ padding: '12px 20px', fontSize: 13, color: '#DDE6F0' }}>{ns.appCount}</td>
                                        <td style={{ padding: '12px 20px' }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, color: '#3FB950', background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.2)', fontFamily: "'JetBrains Mono', monospace" }}>
                                                {ns.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ClusterManagement;
