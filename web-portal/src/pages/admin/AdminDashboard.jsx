import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../api';
import { Users, Box, Zap, Globe, Server, Activity, AlertCircle } from 'lucide-react';

const StatCard = ({ label, value, icon: Icon, color = '#00D4FF', subtitle }) => (
    <div style={{
        background: '#0D1117', border: `1px solid ${color}20`,
        borderRadius: 12, padding: '20px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
    }}>
        <div style={{
            width: 48, height: 48, borderRadius: 12, flexShrink: 0,
            background: `${color}18`, border: `1px solid ${color}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <Icon size={22} style={{ color }} />
        </div>
        <div>
            <div style={{ fontSize: 11, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#DDE6F0', lineHeight: 1 }}>{value ?? '—'}</div>
            {subtitle && <div style={{ fontSize: 11, color: '#5A7080', marginTop: 4 }}>{subtitle}</div>}
        </div>
    </div>
);

const NodeRow = ({ node }) => {
    const isReady = node.status === 'Ready';
    return (
        <tr style={{ borderBottom: '1px solid rgba(31,43,58,0.5)' }}>
            <td style={{ padding: '12px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#DDE6F0' }}>{node.name}</td>
            <td style={{ padding: '12px 20px' }}>
                <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: isReady ? '#3FB950' : '#F85149',
                    background: isReady ? 'rgba(63,185,80,0.1)' : 'rgba(248,81,73,0.1)',
                    border: `1px solid ${isReady ? 'rgba(63,185,80,0.2)' : 'rgba(248,81,73,0.2)'}`,
                }}>{node.status}</span>
            </td>
            <td style={{ padding: '12px 20px', fontSize: 12, color: '#5A7080' }}>{node.role}</td>
            <td style={{ padding: '12px 20px', fontSize: 12, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace" }}>{node.cpu}</td>
            <td style={{ padding: '12px 20px', fontSize: 12, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace" }}>{node.memory}</td>
        </tr>
    );
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats]   = useState(null);
    const [nodes, setNodes]   = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            adminApi.getStats().catch(() => ({ data: null })),
            adminApi.getNodes().catch(() => ({ data: [] })),
        ]).then(([s, n]) => {
            setStats(s.data);
            setNodes(Array.isArray(n.data) ? n.data : []);
        }).finally(() => setLoading(false));
    }, []);

    if (loading) return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 90, borderRadius: 12 }} />
            ))}
        </div>
    );

    const readyNodes = nodes.filter(n => n.status === 'Ready').length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 32 }}>
            {/* Header */}
            <div>
                <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#4A9EF5', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 8 }}>
                    Admin Console
                </p>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 700, color: '#DDE6F0', margin: 0 }}>
                    Platform Overview
                </h1>
                <p style={{ color: '#5A7080', fontSize: 14, marginTop: 6 }}>
                    Global health and utilization across all tenants
                </p>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                <StatCard label="Total Users"       value={stats?.totalUsers}       icon={Users}    color="#4A9EF5" />
                <StatCard label="Total Apps"        value={stats?.totalApps}        icon={Box}      color="#00D4FF" />
                <StatCard label="Running Apps"      value={stats?.runningApps}      icon={Activity} color="#3FB950"
                    subtitle={stats?.totalApps ? `${Math.round((stats.runningApps / stats.totalApps) * 100)}% healthy` : undefined} />
                <StatCard label="Kafka Topics"      value={stats?.totalTopics}      icon={Zap}      color="#E8A838" />
                <StatCard label="Active Namespaces" value={stats?.activeNamespaces} icon={Globe}    color="#A371F7" />
                <StatCard label="K8s Nodes"         value={`${readyNodes}/${nodes.length}`} icon={Server} color="#3FB950"
                    subtitle={readyNodes < nodes.length ? `${nodes.length - readyNodes} not ready` : 'all healthy'} />
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                    { label: 'Manage Users',    path: '/admin/users',   color: '#4A9EF5' },
                    { label: 'All Applications',path: '/apps',          color: '#00D4FF' },
                    { label: 'Cluster Info',    path: '/admin/cluster', color: '#A371F7' },
                    { label: 'All Logs',        path: '/logs',          color: '#E8A838' },
                ].map(({ label, path, color }) => (
                    <button key={path} onClick={() => navigate(path)} style={{
                        padding: '10px 20px', borderRadius: 8, border: `1px solid ${color}30`,
                        background: `${color}10`, color, cursor: 'pointer',
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700,
                        transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${color}20`}
                    onMouseLeave={e => e.currentTarget.style.background = `${color}10`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Nodes table */}
            {nodes.length > 0 && (
                <div>
                    <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: '#DDE6F0', marginBottom: 14 }}>
                        Kubernetes Nodes
                    </h2>
                    <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #1F2B3A' }}>
                                    {['Name', 'Status', 'Role', 'CPU', 'Memory'].map(h => (
                                        <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {nodes.map((n, i) => <NodeRow key={i} node={n} />)}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
