import { useState, useEffect } from 'react';
import { eventApi, eventingApi, kafkaApi, appsApi } from '../api';
import { useTheme } from '../context/ThemeContext';
import { Zap, Database, GitBranch, Box, RefreshCw, Plus, ChevronRight } from 'lucide-react';

// ── Pipeline visual ──────────────────────────────────────────────────────────

const PipelineNode = ({ icon: Icon, label, sublabel, color, status }) => (
    <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 90,
    }}>
        <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: `${color}18`,
            border: `1.5px solid ${color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
        }}>
            <Icon size={20} color={color} />
            {status && (
                <span style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 10, height: 10, borderRadius: '50%',
                    background: status === 'READY' ? '#10B981' : status === 'FAILED' ? '#EF4444' : '#F59E0B',
                    border: '2px solid #0D1117',
                }} />
            )}
        </div>
        <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 700, margin: 0, color: '#DDE6F0', fontFamily: "'JetBrains Mono', monospace", maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
            {sublabel && <p style={{ fontSize: 10, margin: '2px 0 0', color: '#5A7080' }}>{sublabel}</p>}
        </div>
    </div>
);

const Arrow = () => (
    <div style={{ display: 'flex', alignItems: 'center', color: '#3A4A5A', flexShrink: 0 }}>
        <div style={{ width: 24, height: 1, background: '#3A4A5A' }} />
        <ChevronRight size={12} />
    </div>
);

const Pipeline = ({ source, triggers, topics, apps }) => {
    const topic = topics.find(t => t.id === source.kafkaTopicId);
    return (
        <div style={{
            background: '#0D1117', border: '1px solid #1F2B3A',
            borderRadius: 12, padding: '20px 24px', marginBottom: 16,
        }}>
            <div style={{ fontSize: 11, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", marginBottom: 16 }}>
                Pipeline — <span style={{ color: '#DDE6F0' }}>{source.name}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <PipelineNode
                    icon={Database}
                    label={topic?.name || source.kafkaTopicId}
                    sublabel={topic ? `${topic.partitions}p` : 'topic'}
                    color="#F59E0B"
                    status="READY"
                />
                <Arrow />
                <PipelineNode
                    icon={Zap}
                    label="KafkaSource"
                    sublabel={source.namespace}
                    color="#8B5CF6"
                    status="READY"
                />
                <Arrow />
                <PipelineNode
                    icon={Box}
                    label="Broker"
                    sublabel="default"
                    color="#00D4FF"
                />
                {triggers.map(trigger => {
                    const app = apps.find(a => a.url === trigger.action || a.serviceName === trigger.action);
                    return (
                        <div key={trigger.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Arrow />
                            <PipelineNode
                                icon={GitBranch}
                                label={trigger.filter || 'trigger'}
                                sublabel="filter"
                                color="#10B981"
                                status={trigger.active ? 'READY' : 'FAILED'}
                            />
                            <Arrow />
                            <PipelineNode
                                icon={Box}
                                label={app?.name || trigger.action?.split('/').pop() || 'service'}
                                sublabel={app?.status || 'RUNNING'}
                                color="#0066FF"
                                status={app?.status || 'READY'}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── Publish form ─────────────────────────────────────────────────────────────

const PublishForm = () => {
    const [form, setForm]         = useState({ type: 'order.created', appId: '', data: '{\n  "orderId": "test-001",\n  "userId": "user-123",\n  "amount": 49.99\n}' });
    const [publishing, setPublishing] = useState(false);
    const [status, setStatus]     = useState('');
    const [history, setHistory]   = useState([]);

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handlePublish = async (e) => {
        e.preventDefault();
        setStatus(''); setPublishing(true);
        try {
            const payload = { type: form.type, appId: form.appId || undefined, data: JSON.parse(form.data) };
            await eventApi.publish(payload);
            setHistory(h => [{ time: new Date().toLocaleTimeString([], { hour12: false }), type: payload.type }, ...h].slice(0, 6));
            setStatus('ok');
        } catch {
            setStatus('err');
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #1F2B3A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={15} color="#9B6FD8" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#DDE6F0', fontFamily: "'Outfit', sans-serif" }}>Publish CloudEvent</span>
            </div>
            <form onSubmit={handlePublish} style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 10, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Event Type</div>
                        <input value={form.type} onChange={e => set('type', e.target.value)}
                            style={{ width: '100%', background: '#161B22', border: '1px solid #1F2B3A', color: '#DDE6F0', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: 'none' }} />
                    </div>
                    <div>
                        <div style={{ fontSize: 10, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>App ID (optional)</div>
                        <input value={form.appId} onChange={e => set('appId', e.target.value)} placeholder="optional"
                            style={{ width: '100%', background: '#161B22', border: '1px solid #1F2B3A', color: '#DDE6F0', padding: '8px 12px', borderRadius: 8, fontSize: 13, fontFamily: "'JetBrains Mono', monospace", outline: 'none' }} />
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: 10, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Payload JSON</div>
                    <textarea value={form.data} onChange={e => set('data', e.target.value)} rows={6}
                        style={{ width: '100%', background: '#161B22', border: '1px solid #1F2B3A', color: '#DDE6F0', padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", outline: 'none', resize: 'vertical' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button type="submit" className="btn-primary" style={{ padding: '8px 18px', fontSize: 13 }} disabled={publishing}>
                        {publishing ? 'Sending...' : '► Publish Event'}
                    </button>
                    {status === 'ok' && <span style={{ fontSize: 12, color: '#10B981' }}>✓ Event published</span>}
                    {status === 'err' && <span style={{ fontSize: 12, color: '#EF4444' }}>✗ Failed to publish</span>}
                </div>
            </form>

            {history.length > 0 && (
                <div style={{ borderTop: '1px solid #1F2B3A', padding: '10px 18px' }}>
                    <div style={{ fontSize: 10, color: '#5A7080', fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Recent</div>
                    {history.map((h, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#A8B8C8', padding: '3px 0', fontFamily: "'JetBrains Mono', monospace" }}>
                            <span style={{ color: '#10B981' }}>{h.type}</span>
                            <span>{h.time}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Main page ────────────────────────────────────────────────────────────────

const Eventing = () => {
    const { dark } = useTheme();
    const [sources, setSources]   = useState([]);
    const [triggers, setTriggers] = useState([]);
    const [topics, setTopics]     = useState([]);
    const [apps, setApps]         = useState([]);
    const [loading, setLoading]   = useState(true);
    const [tab, setTab]           = useState('pipelines');

    const load = async () => {
        setLoading(true);
        try {
            const [sr, tr, tpc, ap] = await Promise.allSettled([
                eventingApi.listSources(),
                eventingApi.listTriggers(),
                kafkaApi.list(),
                appsApi.list(),
            ]);
            if (sr.status === 'fulfilled') setSources(sr.value.data || []);
            if (tr.status === 'fulfilled') setTriggers(tr.value.data || []);
            if (tpc.status === 'fulfilled') setTopics(tpc.value.data || []);
            if (ap.status === 'fulfilled') setApps(ap.value.data || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const TABS = [
        { key: 'pipelines', label: 'Pipelines' },
        { key: 'publish',   label: 'Publish Event' },
    ];

    return (
        <div style={{ maxWidth: 1100 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0, fontFamily: "'Outfit', sans-serif" }} className="text-primary">Eventing</h2>
                    <p style={{ fontSize: 11, margin: '3px 0 0' }} className="text-secondary">Kafka → KafkaSource → Broker → Trigger → Service</p>
                </div>
                <button onClick={load} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#5A7080', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2, background: dark ? '#111827' : '#F1F5F9', borderRadius: 8, padding: 3, marginBottom: 20, width: 'fit-content' }}>
                {TABS.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        padding: '7px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        background: tab === t.key ? (dark ? '#1F2937' : '#FFFFFF') : 'transparent',
                        color: tab === t.key ? (dark ? '#F9FAFB' : '#0F172A') : '#9CA3AF',
                        transition: 'all 150ms',
                    }}>{t.label}</button>
                ))}
            </div>

            {/* Pipelines tab */}
            {tab === 'pipelines' && (
                <div>
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 40, color: '#5A7080', fontSize: 13 }}>Loading pipelines...</div>
                    ) : sources.length === 0 ? (
                        <div style={{ background: '#0D1117', border: '1px dashed #1F2B3A', borderRadius: 12, padding: 40, textAlign: 'center' }}>
                            <Zap size={32} color="#3A4A5A" style={{ marginBottom: 12 }} />
                            <p style={{ color: '#DDE6F0', fontWeight: 700, margin: '0 0 6px', fontSize: 14 }}>Aucun pipeline créé</p>
                            <p style={{ color: '#5A7080', fontSize: 12, margin: 0 }}>
                                Les pipelines sont créés automatiquement quand tu déploies une app avec Kafka activé dans <strong style={{ color: '#4A9EF5' }}>/apps/new → Kafka Trigger</strong>
                            </p>
                        </div>
                    ) : (
                        sources.map(source => (
                            <Pipeline
                                key={source.id}
                                source={source}
                                triggers={triggers.filter(t => t.kafkaSourceId === source.id)}
                                topics={topics}
                                apps={apps}
                            />
                        ))
                    )}

                    {/* Stats row */}
                    {!loading && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20 }}>
                            {[
                                { label: 'KafkaSources', value: sources.length, color: '#8B5CF6' },
                                { label: 'Triggers',     value: triggers.length, color: '#10B981' },
                                { label: 'Topics',       value: topics.length,   color: '#F59E0B' },
                                { label: 'Services',     value: apps.filter(a => a.status === 'RUNNING').length, color: '#00D4FF' },
                            ].map(s => (
                                <div key={s.label} style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: 10, padding: '14px 18px' }}>
                                    <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: s.color, fontFamily: "'Outfit', sans-serif" }}>{s.value}</p>
                                    <p style={{ fontSize: 11, margin: '3px 0 0', color: '#5A7080' }}>{s.label}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Publish tab */}
            {tab === 'publish' && (
                <div style={{ maxWidth: 600 }}>
                    <PublishForm />
                </div>
            )}
        </div>
    );
};

export default Eventing;
