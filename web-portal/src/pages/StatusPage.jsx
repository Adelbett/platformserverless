import { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Activity } from 'lucide-react';
import { statusApi } from '../api';

const OVERALL_STYLE = {
    OPERATIONAL: { color: '#10B981', label: 'All systems operational', icon: CheckCircle },
    DEGRADED:    { color: '#F59E0B', label: 'Degraded performance',    icon: AlertTriangle },
    OUTAGE:      { color: '#EF4444', label: 'Service outage',          icon: XCircle },
};

const SEVERITY_COLOR = { MINOR: '#F59E0B', MAJOR: '#F97316', CRITICAL: '#EF4444' };

const ComponentRow = ({ c }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0' }}>{c.name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {c.uptimePercent24h != null && (
                <span style={{ fontSize: 12, color: '#64748B', fontFamily: "'JetBrains Mono', monospace" }}>
                    {c.uptimePercent24h.toFixed(2)}% / 24h
                </span>
            )}
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                color: c.status === 'UP' ? '#10B981' : '#EF4444',
                background: c.status === 'UP' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            }}>
                {c.status === 'UP' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                {c.status === 'UP' ? 'Operational' : 'Down'}
            </span>
        </div>
    </div>
);

const IncidentCard = ({ incident }) => (
    <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 12, padding: '16px 20px', marginBottom: 12,
    }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{
                fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                color: SEVERITY_COLOR[incident.severity] || '#94A3B8',
                background: `${SEVERITY_COLOR[incident.severity] || '#94A3B8'}1F`,
                textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>{incident.severity}</span>
            <span style={{ fontSize: 11, color: '#64748B' }}>{incident.status}</span>
        </div>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' }}>{incident.title}</p>
        {incident.description && <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 8px' }}>{incident.description}</p>}
        <p style={{ fontSize: 11, color: '#475569', margin: 0 }}>
            Started {new Date(incident.startedAt).toLocaleString()}
            {incident.resolvedAt && ` · Resolved ${new Date(incident.resolvedAt).toLocaleString()}`}
        </p>
    </div>
);

const StatusPage = () => {
    const [status, setStatus] = useState(null);
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        Promise.all([statusApi.getStatus(), statusApi.getIncidents()])
            .then(([s, i]) => {
                setStatus(s.data);
                setIncidents(i.data || []);
            })
            .catch(() => setError('Unable to load status right now. Please try again shortly.'))
            .finally(() => setLoading(false));
    }, []);

    const overall = status ? OVERALL_STYLE[status.overallStatus] || OVERALL_STYLE.DEGRADED : null;
    const OverallIcon = overall?.icon || Activity;

    return (
        <div style={{ minHeight: '100vh', background: '#0B1120', padding: '48px 20px' }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.18em', textTransform: 'uppercase', color: '#3B82F6', margin: '0 0 8px' }}>
                        PlatformServerless
                    </p>
                    <h1 style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Outfit', sans-serif", color: '#F1F5F9', margin: 0 }}>
                        System Status
                    </h1>
                </div>

                {loading ? (
                    <p style={{ textAlign: 'center', color: '#475569' }}>Loading…</p>
                ) : error ? (
                    <div style={{ textAlign: 'center', color: '#EF4444', fontSize: 14 }}>{error}</div>
                ) : (
                    <>
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                            background: `${overall.color}12`, border: `1px solid ${overall.color}40`,
                            borderRadius: 14, padding: '18px 24px', marginBottom: 28,
                        }}>
                            <OverallIcon size={20} color={overall.color} />
                            <span style={{ fontSize: 16, fontWeight: 700, color: overall.color }}>{overall.label}</span>
                        </div>

                        <div style={{
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
                            borderRadius: 14, overflow: 'hidden', marginBottom: 40,
                        }}>
                            {status.components.map((c, i) => <ComponentRow key={i} c={c} />)}
                        </div>

                        <h2 style={{ fontSize: 15, fontWeight: 800, color: '#F1F5F9', marginBottom: 16 }}>Incident history</h2>
                        {incidents.length === 0 ? (
                            <p style={{ fontSize: 13, color: '#475569' }}>No incidents reported.</p>
                        ) : (
                            incidents.map(inc => <IncidentCard key={inc.id} incident={inc} />)
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default StatusPage;
