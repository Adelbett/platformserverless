import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import { Server, Cpu, MemoryStick, Box, Users, Zap, Globe } from 'lucide-react';

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

const ClusterManagement = () => {
    const [stats,      setStats]      = useState(null);
    const [nodes,      setNodes]      = useState([]);
    const [namespaces, setNamespaces] = useState([]);
    const [loading,    setLoading]    = useState(true);

    useEffect(() => {
        Promise.all([
            adminApi.getStats().catch(() => ({ data: null })),
            adminApi.getNodes().catch(() => ({ data: [] })),
            adminApi.getNamespaces().catch(() => ({ data: [] })),
        ]).then(([s, n, ns]) => {
            setStats(s.data);
            setNodes(Array.isArray(n.data) ? n.data : []);
            setNamespaces(Array.isArray(ns.data) ? ns.data : []);
        }).finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
            ))}
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 32 }}>
            <div>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 700, color: '#DDE6F0', margin: 0 }}>
                    Cluster Management
                </h1>
                <p style={{ color: '#5A7080', fontSize: 14, marginTop: 4 }}>Infrastructure overview — nodes, namespaces, tenants</p>
            </div>

            {/* Platform stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                <StatCard label="Total Users"       value={stats?.totalUsers}       icon={Users}  color="#4A9EF5" />
                <StatCard label="Total Apps"        value={stats?.totalApps}        icon={Box}    color="#00D4FF" />
                <StatCard label="Running Apps"      value={stats?.runningApps}      icon={Box}    color="#3FB950" />
                <StatCard label="Kafka Topics"      value={stats?.totalTopics}      icon={Zap}    color="#E8A838" />
                <StatCard label="Active Namespaces" value={stats?.activeNamespaces} icon={Globe}  color="#A371F7" />
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
