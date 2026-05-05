import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { appsApi, kafkaApi } from '../api';
import { useToast } from '../components/Toast';
const AddIcon          = () => <span style={{ fontSize: '14px' }}>+</span>;
const DeleteOutlineIcon = () => <span style={{ fontSize: '14px' }}>🗑</span>;
const CheckCircleIcon   = () => <span style={{ fontSize: '14px', color: '#3FB950' }}>✓</span>;
const RocketLaunchIcon  = () => <span style={{ fontSize: '14px' }}>🚀</span>;
const ContentCopyIcon   = () => <span style={{ fontSize: '13px' }}>⧉</span>;

const TABS = ['Basic Config', 'Scale & Resources', 'Environment Variables', 'Kafka Trigger'];

const SectionCard = ({ children }) => (
    <div style={{
        background: '#0D1117',
        border: '1px solid #1F2B3A',
        borderRadius: '12px',
        padding: '24px',
    }}>{children}</div>
);

const Label = ({ children }) => (
    <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px',
        fontWeight: 500,
        color: '#5A7080',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: '6px',
    }}>{children}</div>
);

const Input = ({ value, onChange, placeholder, type = 'text', style = {} }) => (
    <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
            width: '100%',
            background: '#161B22',
            border: '1px solid #1F2B3A',
            color: '#DDE6F0',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '14px',
            fontFamily: "'Syne', sans-serif",
            outline: 'none',
            transition: 'border-color 0.15s',
            ...style,
        }}
        onFocus={e => e.target.style.borderColor = '#4A9EF5'}
        onBlur={e => e.target.style.borderColor = '#1F2B3A'}
    />
);

const SliderRow = ({ label, value, min, max, onChange, hint }) => (
    <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <Label>{label}</Label>
            <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '13px',
                fontWeight: 600,
                color: '#4A9EF5',
                background: 'rgba(74,158,245,0.1)',
                padding: '2px 10px',
                borderRadius: '6px',
            }}>{value}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={onChange}
            style={{
                width: '100%',
                accentColor: '#4A9EF5',
                height: '4px',
                cursor: 'pointer',
            }}
        />
        {hint && <div style={{ fontSize: '11px', color: '#5A7080', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>{hint}</div>}
    </div>
);

const PillSelector = ({ options, value, onChange }) => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {options.map(opt => (
            <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                style={{
                    padding: '6px 16px',
                    borderRadius: '20px',
                    border: `1px solid ${value === opt ? '#4A9EF5' : '#1F2B3A'}`,
                    background: value === opt ? 'rgba(74,158,245,0.12)' : 'transparent',
                    color: value === opt ? '#4A9EF5' : '#5A7080',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '13px',
                    fontWeight: value === opt ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                }}
            >{opt}</button>
        ))}
    </div>
);

const DeployApp = () => {
    const navigate = useNavigate();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState(0);
    const [deploying, setDeploying] = useState(false);
    const [imageValidated, setImageValidated] = useState(false);
    const [showYaml, setShowYaml] = useState(false);

    const [kafkaTopics, setKafkaTopics] = useState([]);

    useEffect(() => {
        kafkaApi.list().then(r => setKafkaTopics(Array.isArray(r.data) ? r.data : [])).catch(() => {});
    }, []);

    const [form, setForm] = useState({
        appName: '',
        namespace: 'default',
        image: '',
        port: '8080',
        description: '',
        minReplicas: 0,
        maxReplicas: 5,
        cpuRequest: '100m',
        cpuLimit: '500m',
        memoryRequest: '128Mi',
        memoryLimit: '512Mi',
        envVars: [{ key: '', value: '', secret: false }],
        kafkaEnabled: false,
        kafkaTopic: '',
        consumerGroup: '',
        filterType: 'exact',
        filterEventType: 'order.created',
    });

    const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

    const addEnvVar = () => set('envVars', [...form.envVars, { key: '', value: '', secret: false }]);
    const removeEnvVar = (i) => set('envVars', form.envVars.filter((_, idx) => idx !== i));
    const updateEnvVar = (i, field, val) => {
        const next = [...form.envVars];
        next[i] = { ...next[i], [field]: val };
        set('envVars', next);
    };

    const handleDeploy = async () => {
        if (!form.appName || !form.image) {
            toast.error('Validation Error', 'App name and Docker image are required.');
            return;
        }
        setDeploying(true);
        try {
            const imageParts = form.image.split(':');
            const imageName = imageParts[0];
            const imageTag = imageParts.length > 1 ? imageParts.slice(1).join(':') : 'latest';
            const response = await appsApi.create({
                name: form.appName,
                imageName,
                imageTag,
                port: parseInt(form.port, 10),
                namespace: form.namespace,
                description: form.description,
                minReplicas: form.minReplicas,
                maxReplicas: form.maxReplicas,
                cpuRequest: form.cpuRequest,
                memoryRequest: form.memoryRequest,
                envVars: form.envVars.reduce((acc, item) => {
                    if (item.key) acc[item.key] = item.value;
                    return acc;
                }, {}),
                kafkaEnabled:    form.kafkaEnabled,
                kafkaTopicId:    form.kafkaEnabled ? form.kafkaTopic : undefined,
                consumerGroup:   form.kafkaEnabled ? (form.consumerGroup || `${form.appName}-group`) : undefined,
                filterEventType: form.kafkaEnabled ? (form.filterType !== 'none' ? form.filterEventType : undefined) : undefined,
            });
            toast.success('Deployment initiated', `${form.appName} is being deployed to the cluster.`);
                setTimeout(() => navigate(`/apps/${response.data?.id || form.appName}`), 1000);
        } catch (err) {
            const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Unknown error';
            toast.error('Deployment failed', msg);
        } finally {
            setDeploying(false);
        }
    };

    const yamlPreview = `apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: ${form.appName || '<name>'}
  namespace: ${form.namespace}
spec:
  template:
    spec:
      containers:
        - image: ${form.image || '<image>'}
          ports:
            - containerPort: ${form.port}
          resources:
            requests:
              cpu: ${form.cpuRequest}
              memory: ${form.memoryRequest}
            limits:
              cpu: ${form.cpuLimit}
              memory: ${form.memoryLimit}`;

    return (
        <div style={{ maxWidth: '1200px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: '24px',
                    fontWeight: 700,
                    color: '#DDE6F0',
                    marginBottom: '4px',
                }}>Deploy New Application</h1>
                <p style={{ color: '#5A7080', fontSize: '14px' }}>
                    Configure and deploy a container to the Knative cluster
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '65% 35%', gap: '20px', alignItems: 'start' }}>

                {/* Left — form */}
                <div>
                    {/* Tabs */}
                    <div style={{
                        display: 'flex',
                        background: '#0D1117',
                        border: '1px solid #1F2B3A',
                        borderRadius: '10px',
                        padding: '4px',
                        marginBottom: '20px',
                        gap: '2px',
                    }}>
                        {TABS.map((tab, i) => (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(i)}
                                style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    borderRadius: '7px',
                                    border: 'none',
                                    background: activeTab === i ? '#161B22' : 'transparent',
                                    color: activeTab === i ? '#DDE6F0' : '#5A7080',
                                    fontFamily: "'Syne', sans-serif",
                                    fontSize: '13px',
                                    fontWeight: activeTab === i ? 600 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                    whiteSpace: 'nowrap',
                                }}
                            >{tab}</button>
                        ))}
                    </div>

                    {/* Tab 1 — Basic Config */}
                    {activeTab === 0 && (
                        <SectionCard>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <Label>App Name *</Label>
                                    <Input
                                        value={form.appName}
                                        onChange={e => set('appName', e.target.value)}
                                        placeholder="order-processor"
                                    />
                                    {form.appName && (
                                        <div style={{ fontSize: '11px', color: '#5A7080', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                                            URL: {form.appName}.{form.namespace}.nextstep.com
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <Label>Namespace</Label>
                                    <Input
                                        value={form.namespace}
                                        onChange={e => set('namespace', e.target.value)}
                                        placeholder="default"
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <Label>Docker Image *</Label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <Input
                                        value={form.image}
                                        onChange={e => { set('image', e.target.value); setImageValidated(false); }}
                                        placeholder="adelbettaieb/order-processor:v1"
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        className="btn-glass"
                                        style={{ padding: '10px 16px', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}
                                        onClick={() => { if (form.image) setImageValidated(true); }}
                                    >
                                        {imageValidated ? (
                                            <><CheckCircleIcon style={{ fontSize: '14px', color: '#3FB950' }} /> Valid</>
                                        ) : 'Validate'}
                                    </button>
                                </div>
                                <div style={{ fontSize: '11px', color: '#5A7080', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                                    Must be available on Docker Hub or configured registry
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <Label>Container Port *</Label>
                                    <Input
                                        type="number"
                                        value={form.port}
                                        onChange={e => set('port', e.target.value)}
                                        placeholder="8080"
                                    />
                                </div>
                                <div>
                                    <Label>Description</Label>
                                    <Input
                                        value={form.description}
                                        onChange={e => set('description', e.target.value)}
                                        placeholder="Brief description..."
                                    />
                                </div>
                            </div>
                        </SectionCard>
                    )}

                    {/* Tab 2 — Scale & Resources */}
                    {activeTab === 1 && (
                        <SectionCard>
                            <SliderRow
                                label="Min Replicas"
                                value={form.minReplicas}
                                min={0} max={5}
                                onChange={e => set('minReplicas', Number(e.target.value))}
                                hint={form.minReplicas === 0 ? '0 enables scale-to-zero (no cost at idle)' : 'Always-on: min instances running'}
                            />
                            <SliderRow
                                label="Max Replicas"
                                value={form.maxReplicas}
                                min={1} max={20}
                                onChange={e => set('maxReplicas', Number(e.target.value))}
                                hint="Maximum instances during traffic spikes"
                            />

                            <div style={{ height: '1px', background: '#1F2B3A', margin: '20px 0' }} />

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <Label>CPU Request</Label>
                                    <Input value={form.cpuRequest} onChange={e => set('cpuRequest', e.target.value)} placeholder="100m" />
                                </div>
                                <div>
                                    <Label>CPU Limit</Label>
                                    <Input value={form.cpuLimit} onChange={e => set('cpuLimit', e.target.value)} placeholder="500m" />
                                </div>
                                <div>
                                    <Label>Memory Request</Label>
                                    <Input value={form.memoryRequest} onChange={e => set('memoryRequest', e.target.value)} placeholder="128Mi" />
                                </div>
                                <div>
                                    <Label>Memory Limit</Label>
                                    <Input value={form.memoryLimit} onChange={e => set('memoryLimit', e.target.value)} placeholder="512Mi" />
                                </div>
                            </div>
                        </SectionCard>
                    )}

                    {/* Tab 3 — Environment Variables */}
                    {activeTab === 2 && (
                        <SectionCard>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <Label>Environment Variables</Label>
                                <button type="button" className="btn-glass" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={addEnvVar}>
                                    <AddIcon style={{ fontSize: '14px' }} /> Add Variable
                                </button>
                            </div>

                            {/* Table header */}
                            <div style={{
                                display: 'grid', gridTemplateColumns: '1fr 1fr 70px 36px',
                                gap: '8px', marginBottom: '8px',
                                padding: '0 4px',
                            }}>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#5A7080', textTransform: 'uppercase', letterSpacing: '0.08em' }}>KEY</span>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#5A7080', textTransform: 'uppercase', letterSpacing: '0.08em' }}>VALUE</span>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', color: '#5A7080', textTransform: 'uppercase', letterSpacing: '0.08em' }}>SECRET</span>
                                <span></span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {form.envVars.map((ev, i) => (
                                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 70px 36px', gap: '8px', alignItems: 'center' }}>
                                        <Input
                                            value={ev.key}
                                            onChange={e => updateEnvVar(i, 'key', e.target.value)}
                                            placeholder="DATABASE_URL"
                                            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                                        />
                                        <Input
                                            type={ev.secret ? 'password' : 'text'}
                                            value={ev.value}
                                            onChange={e => updateEnvVar(i, 'value', e.target.value)}
                                            placeholder="value..."
                                            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                                        />
                                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={ev.secret}
                                                onChange={e => updateEnvVar(i, 'secret', e.target.checked)}
                                                style={{ accentColor: '#4A9EF5', width: '16px', height: '16px', cursor: 'pointer' }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeEnvVar(i)}
                                            style={{
                                                background: 'transparent', border: '1px solid rgba(248,81,73,0.2)',
                                                borderRadius: '6px', color: '#F85149', cursor: 'pointer',
                                                width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}
                                        >
                                            <DeleteOutlineIcon style={{ fontSize: '16px' }} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}

                    {/* Tab 4 — Kafka Trigger */}
                    {activeTab === 3 && (
                        <SectionCard>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                                <div>
                                    <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 600, color: '#DDE6F0', marginBottom: '2px' }}>
                                        Kafka Trigger
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#5A7080' }}>
                                        Wake this app when Kafka messages arrive
                                    </div>
                                </div>
                                {/* Toggle */}
                                <div
                                    onClick={() => set('kafkaEnabled', !form.kafkaEnabled)}
                                    style={{
                                        width: '44px', height: '24px',
                                        borderRadius: '12px',
                                        background: form.kafkaEnabled ? '#4A9EF5' : '#1F2B3A',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        transition: 'background 0.2s',
                                        flexShrink: 0,
                                    }}
                                >
                                    <div style={{
                                        width: '18px', height: '18px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: '3px',
                                        left: form.kafkaEnabled ? '23px' : '3px',
                                        transition: 'left 0.2s',
                                    }} />
                                </div>
                            </div>

                            {form.kafkaEnabled && (
                                <>
                                    <div style={{ marginBottom: '16px' }}>
                                        <Label>Kafka Topic</Label>
                                        <select
                                            value={form.kafkaTopic}
                                            onChange={e => set('kafkaTopic', e.target.value)}
                                            style={{
                                                width: '100%', background: '#161B22',
                                                border: '1px solid #1F2B3A', color: form.kafkaTopic ? '#DDE6F0' : '#5A7080',
                                                padding: '10px 14px', borderRadius: '8px',
                                                fontSize: '14px', outline: 'none', cursor: 'pointer',
                                            }}
                                        >
                                            <option value="" style={{ background: '#0D1117' }}>
                                                {kafkaTopics.length === 0 ? 'No topics yet — create one in /kafka' : 'Select topic...'}
                                            </option>
                                            {kafkaTopics.map(t => (
                                                <option key={t.id} value={t.id} style={{ background: '#0D1117' }}>
                                                    {t.name} ({t.partitions} partitions)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <Label>Consumer Group</Label>
                                        <Input
                                            value={form.consumerGroup}
                                            onChange={e => set('consumerGroup', e.target.value)}
                                            placeholder={`${form.appName || 'app'}-group`}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '16px' }}>
                                        <Label>Event Type Filter</Label>
                                        <Input
                                            value={form.filterEventType}
                                            onChange={e => set('filterEventType', e.target.value)}
                                            placeholder="order.created"
                                        />
                                        <div style={{ fontSize: '11px', color: '#5A7080', marginTop: '4px', fontFamily: "'JetBrains Mono', monospace" }}>
                                            CloudEvent ce-type header to match (ex: order.created)
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: '20px' }}>
                                        <Label>Filter Mode</Label>
                                        <PillSelector
                                            options={['exact', 'prefix', 'suffix', 'none']}
                                            value={form.filterType}
                                            onChange={v => set('filterType', v)}
                                        />
                                    </div>
                                    <div style={{
                                        padding: '14px',
                                        background: 'rgba(74,158,245,0.05)',
                                        border: '1px solid rgba(74,158,245,0.15)',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        color: '#A8B8C8',
                                        lineHeight: 1.6,
                                    }}>
                                        <span style={{ color: '#4A9EF5', fontWeight: 600 }}>ℹ Scale-to-zero with Kafka:</span>{' '}
                                        A KafkaSource and Knative Trigger will be created. When messages arrive on{' '}
                                        <span style={{ color: '#E8A838', fontFamily: "'JetBrains Mono', monospace" }}>
                                            {form.kafkaTopic || '<topic>'}
                                        </span>
                                        , the autoscaler wakes this app from zero replicas within seconds.
                                    </div>
                                </>
                            )}
                        </SectionCard>
                    )}

                    {/* Tab navigation row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                        <button
                            type="button"
                            className="btn-glass"
                            style={{ padding: '9px 18px' }}
                            onClick={() => activeTab > 0 ? setActiveTab(activeTab - 1) : navigate(-1)}
                        >
                            {activeTab > 0 ? '← Back' : 'Cancel'}
                        </button>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {activeTab < TABS.length - 1 ? (
                                <button type="button" className="btn-neon" style={{ padding: '9px 22px' }} onClick={() => setActiveTab(activeTab + 1)}>
                                    Next →
                                </button>
                            ) : (
                                <>
                                    <button type="button" className="btn-glass" style={{ padding: '9px 18px' }}>
                                        Save as Draft
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-neon"
                                        style={{ padding: '9px 22px', gap: '6px' }}
                                        onClick={handleDeploy}
                                        disabled={deploying}
                                    >
                                        {deploying ? (
                                            <>
                                                <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                                Deploying...
                                            </>
                                        ) : (
                                            <><RocketLaunchIcon style={{ fontSize: '16px' }} /> Deploy to Cluster</>
                                        )}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right — Preview card */}
                <div style={{ position: 'sticky', top: '20px' }}>
                    <div style={{
                        background: '#0D1117',
                        border: '1px solid #1F2B3A',
                        borderRadius: '12px',
                        overflow: 'hidden',
                    }}>
                        <div style={{
                            padding: '14px 18px',
                            borderBottom: '1px solid #1F2B3A',
                            fontFamily: "'Syne', sans-serif",
                            fontWeight: 600,
                            fontSize: '13px',
                            color: '#DDE6F0',
                        }}>Deployment Preview</div>

                        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {[
                                { label: 'Name', value: form.appName || '—' },
                                { label: 'Namespace', value: form.namespace },
                                { label: 'Image', value: form.image || '—', mono: true },
                                { label: 'Port', value: form.port, mono: true },
                                { label: 'Min replicas', value: form.minReplicas },
                                { label: 'Max replicas', value: form.maxReplicas },
                                { label: 'CPU', value: `${form.cpuRequest} / ${form.cpuLimit}`, mono: true },
                                { label: 'Memory', value: `${form.memoryRequest} / ${form.memoryLimit}`, mono: true },
                                ...(form.kafkaEnabled ? [{ label: 'Kafka topic', value: form.kafkaTopic || '—', mono: true }] : []),
                                { label: 'Env vars', value: form.envVars.filter(e => e.key).length },
                            ].map(row => (
                                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#5A7080', flexShrink: 0 }}>
                                        {row.label}
                                    </span>
                                    <span style={{
                                        fontFamily: row.mono ? "'JetBrains Mono', monospace" : "'Syne', sans-serif",
                                        fontSize: '12px',
                                        color: '#DDE6F0',
                                        textAlign: 'right',
                                        wordBreak: 'break-all',
                                    }}>{String(row.value)}</span>
                                </div>
                            ))}
                        </div>

                        {/* YAML toggle */}
                        <div style={{ borderTop: '1px solid #1F2B3A' }}>
                            <button
                                type="button"
                                onClick={() => setShowYaml(!showYaml)}
                                style={{
                                    width: '100%', background: 'transparent', border: 'none',
                                    padding: '10px 18px', cursor: 'pointer',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    color: '#5A7080', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace",
                                }}
                            >
                                <span>YAML Preview</span>
                                <span>{showYaml ? '▲' : '▼'}</span>
                            </button>

                            {showYaml && (
                                <div style={{ position: 'relative' }}>
                                    <pre style={{
                                        background: '#020408',
                                        padding: '14px 16px',
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: '11px',
                                        color: '#A8B8C8',
                                        overflowX: 'auto',
                                        margin: 0,
                                        lineHeight: 1.6,
                                    }}>{yamlPreview}</pre>
                                    <button
                                        type="button"
                                        onClick={() => navigator.clipboard?.writeText(yamlPreview)}
                                        style={{
                                            position: 'absolute', top: '8px', right: '8px',
                                            background: 'rgba(255,255,255,0.08)', border: '1px solid #1F2B3A',
                                            borderRadius: '5px', color: '#5A7080', cursor: 'pointer',
                                            padding: '3px 6px', display: 'flex', alignItems: 'center',
                                        }}
                                    >
                                        <ContentCopyIcon style={{ fontSize: '13px' }} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeployApp;
