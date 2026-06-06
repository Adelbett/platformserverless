import { useEffect, useMemo, useRef, useState } from 'react';
import { kafkaApi } from '../api';
import { useTheme } from '../context/ThemeContext';

const StatusBadge = ({ lag }) => {
    if (lag === null || lag === undefined) return <span style={{ fontSize: 11, color: '#5A7080' }}>—</span>;
    if (lag === 0)    return <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.1)',  padding: '3px 10px', borderRadius: 999 }}>● HEALTHY</span>;
    if (lag < 100)    return <span style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.1)',  padding: '3px 10px', borderRadius: 999 }}>● WARNING</span>;
    return              <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.1)',   padding: '3px 10px', borderRadius: 999 }}>● ERROR</span>;
};

const KafkaTopics = () => {
    const { dark } = useTheme();
    const [topics,   setTopics]   = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState('');
    const [creating, setCreating] = useState(false);
    const [search,   setSearch]   = useState('');
    const [expanded, setExpanded] = useState({});
    const [form,     setForm]     = useState({ name: '', partitions: 1, replicationFactor: 1, retentionMs: '604800000' });
    const [showForm, setShowForm] = useState(false);

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const load = async () => {
        try {
            setLoading(true); setError('');
            const res = await kafkaApi.list();
            setTopics(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            setError(e?.response?.data?.message || 'Unable to load topics.');
        } finally { setLoading(false); }
    };

    useEffect(() => { load(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.name) return;
        setCreating(true); setError('');
        try {
            await kafkaApi.create({ name: form.name, partitions: Number(form.partitions), replicas: Number(form.replicationFactor), config: `retention.ms=${form.retentionMs}` });
            setForm({ name: '', partitions: 1, replicationFactor: 1, retentionMs: '604800000' });
            setShowForm(false);
            await load();
        } catch (e) { setError(e?.response?.data?.message || 'Unable to create topic.'); }
        finally { setCreating(false); }
    };

    const handleDelete = async (topic) => {
        if (!window.confirm(`Delete topic "${topic.name}"?`)) return;
        try { await kafkaApi.delete(topic.id || topic.name); await load(); }
        catch (e) { setError(e?.response?.data?.message || 'Delete failed.'); }
    };

    const filtered = useMemo(() => {
        const lc = search.toLowerCase();
        return topics.filter(t => t.name?.toLowerCase().includes(lc));
    }, [topics, search]);

    const border    = dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.08)';
    const cardBg    = dark ? '#0D1117' : '#FFFFFF';
    const headColor = '#64748B';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Kafka Topics</h2>
                    <p style={{ fontSize: 12, margin: '3px 0 0' }} className="text-secondary">Manage event streams and monitor consumer lag</p>
                </div>
                <button className="btn-primary" style={{ fontSize: 13 }} onClick={() => setShowForm(s => !s)}>
                    + New Topic
                </button>
            </div>

            {/* Create form */}
            {showForm && (
                <div className="ns-card" style={{ padding: 20 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px' }} className="text-primary">Create Topic</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                        <div>
                            <label style={{ fontSize: 10, color: headColor, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Topic Name *</label>
                            <input className="ns-input" placeholder="e.g. payment-events" value={form.name} onChange={e => set('name', e.target.value)} required />
                        </div>
                        <div>
                            <label style={{ fontSize: 10, color: headColor, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Partitions</label>
                            <input className="ns-input" type="number" min={1} value={form.partitions} onChange={e => set('partitions', e.target.value)} />
                        </div>
                        <div>
                            <label style={{ fontSize: 10, color: headColor, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Replicas</label>
                            <input className="ns-input" type="number" min={1} value={form.replicationFactor} onChange={e => set('replicationFactor', e.target.value)} />
                        </div>
                        <div>
                            <label style={{ fontSize: 10, color: headColor, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>Retention</label>
                            <select className="ns-input" value={form.retentionMs} onChange={e => set('retentionMs', e.target.value)}>
                                <option value="86400000">24h</option>
                                <option value="604800000">7 days</option>
                                <option value="-1">Infinite</option>
                            </select>
                        </div>
                        <button className="btn-primary" type="submit" disabled={creating || !form.name} style={{ whiteSpace: 'nowrap' }}>
                            {creating ? 'Creating...' : 'Create'}
                        </button>
                    </form>
                </div>
            )}

            {/* Error */}
            {error && <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: '#EF4444', fontSize: 13 }}>{error}</div>}

            {/* Table */}
            <div className="ns-card" style={{ overflow: 'hidden' }}>
                {/* Search + count */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: border }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }} className="text-primary">Topics ({filtered.length})</span>
                    <input className="ns-input" style={{ width: 200, height: 32, fontSize: 12 }} placeholder="Search topics..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: border }}>
                            {['TOPIC NAME', 'PARTITIONS', 'REPLICAS', 'LAG', 'MESSAGES', 'STATUS', ''].map(h => (
                                <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: headColor }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>Loading topics...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>No topics found</td></tr>
                        ) : filtered.map((topic) => {
                            const lag      = topic.consumerLag ?? topic.lag ?? null;
                            const messages = topic.messageCount ?? topic.messages ?? topic.offsets ?? null;
                            const retention = topic.config?.['retention.ms'] === '-1' ? 'Infinite'
                                : topic.config?.['retention.ms'] ? `${Math.round(Number(topic.config['retention.ms']) / 3600000)}h` : '168h';

                            return (
                                <>
                                    <tr key={topic.id || topic.name}
                                        onClick={() => setExpanded(e => ({ ...e, [topic.name]: !e[topic.name] }))}
                                        style={{ borderBottom: border, cursor: 'pointer', transition: 'background 150ms' }}
                                        onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <td style={{ padding: '14px 20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 12, color: '#64748B' }}>{expanded[topic.name] ? '▾' : '▸'}</span>
                                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700 }} className="text-primary">{topic.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '14px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} className="text-secondary">{topic.partitions ?? '—'}</td>
                                        <td style={{ padding: '14px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} className="text-secondary">{topic.replicas ?? '—'}</td>
                                        <td style={{ padding: '14px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: lag === 0 ? '#10B981' : lag < 100 ? '#F59E0B' : '#EF4444' }}>
                                            {lag !== null ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: lag === 0 ? '#10B981' : lag < 100 ? '#F59E0B' : '#EF4444', display: 'inline-block' }} />{lag.toLocaleString()}</span> : '—'}
                                        </td>
                                        <td style={{ padding: '14px 20px', fontFamily: "'JetBrains Mono', monospace", fontSize: 13 }} className="text-secondary">
                                            {messages !== null ? Number(messages).toLocaleString() : '—'}
                                        </td>
                                        <td style={{ padding: '14px 20px' }}><StatusBadge lag={lag} /></td>
                                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                            <button onClick={ev => { ev.stopPropagation(); handleDelete(topic); }}
                                                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 13 }}>
                                                🗑
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Expanded detail row */}
                                    {expanded[topic.name] && (
                                        <tr key={`${topic.name}-detail`} style={{ borderBottom: border }}>
                                            <td colSpan={7} style={{ padding: '0 20px 16px 44px' }}>
                                                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 8 }}>
                                                    {[
                                                        { label: 'Retention',  value: retention },
                                                        { label: 'Created',    value: topic.createdAt ? new Date(topic.createdAt).toLocaleString() : '—' },
                                                        { label: 'Topic ID',   value: topic.id || '—' },
                                                    ].map(item => (
                                                        <div key={item.label}>
                                                            <p style={{ fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 2px' }}>{item.label}</p>
                                                            <p style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", margin: 0 }} className="text-primary">{item.value}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default KafkaTopics;
