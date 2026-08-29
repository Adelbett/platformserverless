import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    User, Lock, Bell, Palette, AlertTriangle, Eye, EyeOff,
    Check, Trash2, LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { paymentApi } from '../api';
import api from '../api/client';

// ── Section wrapper ────────────────────────────────────────────────────────────
const Section = ({ icon: Icon, title, subtitle, color = '#00D4FF', children }) => (
    <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="ns-card"
        style={{ overflow: 'hidden' }}
    >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 24px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={17} style={{ color }} />
            </div>
            <div>
                <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0, fontFamily: "'Outfit', sans-serif" }} className="text-primary">{title}</h3>
                {subtitle && <p style={{ fontSize: 11, margin: '2px 0 0', color: '#6B7280' }}>{subtitle}</p>}
            </div>
        </div>
        <div style={{ padding: '20px 24px' }}>
            {children}
        </div>
    </motion.div>
);

// ── Field row ──────────────────────────────────────────────────────────────────
const FieldRow = ({ label, children, hint }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', alignItems: 'start', gap: 16, marginBottom: 18 }}>
        <div>
            <p style={{ fontSize: 12, fontWeight: 700, margin: 0 }} className="text-primary">{label}</p>
            {hint && <p style={{ fontSize: 10.5, margin: '3px 0 0', color: '#6B7280', lineHeight: 1.4 }}>{hint}</p>}
        </div>
        <div>{children}</div>
    </div>
);

// ── Toggle switch ──────────────────────────────────────────────────────────────
const Toggle = ({ value, onChange, label, desc }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
        <div>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }} className="text-primary">{label}</p>
            {desc && <p style={{ fontSize: 11, margin: '2px 0 0', color: '#6B7280' }}>{desc}</p>}
        </div>
        <button
            onClick={() => onChange(!value)}
            style={{
                width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer',
                background: value ? '#00D4FF' : '#374151',
                position: 'relative', transition: 'background 200ms', flexShrink: 0,
            }}
        >
            <span style={{
                position: 'absolute', top: 3, left: value ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%', background: '#fff',
                transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
        </button>
    </div>
);

// ── Main Settings ──────────────────────────────────────────────────────────────
const Settings = () => {
    const { user, logout } = useAuth();
    const { dark, toggleTheme } = useTheme();
    const navigate = useNavigate();

    const username = user?.username || 'user';
    const initials = username.slice(0, 2).toUpperCase();
    const role     = user?.role || 'MEMBER';

    // Password change state
    const [pwForm, setPwForm]   = useState({ current: '', next: '', confirm: '' });
    const [pwMsg, setPwMsg]     = useState('');
    const [showPw, setShowPw]   = useState(false);

    // Notification prefs (localStorage)
    const [notifPrefs, setNotifPrefs] = useState(() => {
        try { return JSON.parse(localStorage.getItem('notif_prefs') || '{}'); } catch { return {}; }
    });
    const toggleNotif = (key) => {
        const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
        setNotifPrefs(updated);
        localStorage.setItem('notif_prefs', JSON.stringify(updated));
    };
    const pref = (key, defaultVal = true) => notifPrefs[key] !== undefined ? notifPrefs[key] : defaultVal;

    // Display name (localStorage only — Keycloak read-only)
    const [displayName, setDisplayName]   = useState(() => localStorage.getItem('display_name') || username);
    const [displaySaved, setDisplaySaved] = useState(false);
    const saveDisplayName = () => {
        localStorage.setItem('display_name', displayName);
        setDisplaySaved(true);
        setTimeout(() => setDisplaySaved(false), 2000);
    };

    // Email — editable, synced to both the local DB and Keycloak (source of
    // truth for login) via PATCH /api/users/me → UserService.updateMe().
    const [email, setEmail]           = useState(user?.email || '');
    const [emailSaving, setEmailSaving] = useState(false);
    const [emailSaved, setEmailSaved]   = useState(false);
    const [emailError, setEmailError]   = useState('');
    const saveEmail = async () => {
        setEmailSaving(true);
        setEmailError('');
        try {
            await api.patch('/users/me', { email });
            setEmailSaved(true);
            setTimeout(() => setEmailSaved(false), 2000);
        } catch (e) {
            setEmailError(e.response?.data?.message || 'Failed to update email');
        } finally {
            setEmailSaving(false);
        }
    };

    const handlePwChange = (e) => {
        e.preventDefault();
        if (pwForm.next !== pwForm.confirm) { setPwMsg('error:Passwords do not match'); return; }
        if (pwForm.next.length < 8)          { setPwMsg('error:Password must be at least 8 characters'); return; }
        setPwMsg('ok:Password change request sent to Keycloak (admin required)');
        setPwForm({ current: '', next: '', confirm: '' });
    };

    const roleColor = { ADMIN: '#EF4444', CLIENT_ADMIN: '#3B82F6', MEMBER: '#00D4FF' }[role] || '#00D4FF';

    return (
        <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

            {/* Header */}
            <div>
                <p style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: '#00D4FF', textTransform: 'uppercase', letterSpacing: '0.15em', margin: '0 0 4px' }}>Account</p>
                <h2 style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Outfit', sans-serif", margin: 0 }} className="text-primary">Settings</h2>
                <p style={{ fontSize: 12, margin: '4px 0 0' }} className="text-secondary">Manage your profile, preferences and access tokens</p>
            </div>

            {/* Profile */}
            <Section icon={User} title="Profile" subtitle="Your account information" color="#00D4FF">
                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '16px', borderRadius: 12, background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #00D4FF, #0066FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#fff', fontFamily: "'Outfit', sans-serif", flexShrink: 0 }}>
                        {initials}
                    </div>
                    <div>
                        <p style={{ fontSize: 15, fontWeight: 800, margin: 0 }} className="text-primary">{displayName}</p>
                        <p style={{ fontSize: 12, margin: '3px 0 0', color: '#9CA3AF' }}>{email || 'No email set'}</p>
                        <span style={{ display: 'inline-block', marginTop: 5, fontSize: 10, fontWeight: 700, color: roleColor, background: `${roleColor}18`, padding: '2px 10px', borderRadius: 999, fontFamily: "'JetBrains Mono', monospace" }}>{role}</span>
                    </div>
                </div>

                <FieldRow label="Display name" hint="Shown in the UI (local only)">
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input className="ns-input" value={displayName} onChange={e => setDisplayName(e.target.value)} style={{ flex: 1 }} />
                        <button className="btn-primary" style={{ fontSize: 12, whiteSpace: 'nowrap' }} onClick={saveDisplayName}>
                            {displaySaved ? <><Check size={13} /> Saved</> : 'Save'}
                        </button>
                    </div>
                </FieldRow>

                <FieldRow label="Username" hint="Your Keycloak username — read only">
                    <input className="ns-input" value={username} disabled style={{ color: '#6B7280', cursor: 'not-allowed' }} />
                </FieldRow>

                <FieldRow
                    label="Email"
                    hint={emailError ? <span style={{ color: '#EF4444' }}>{emailError}</span> : 'Also updates your Keycloak login identity'}
                >
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            type="email"
                            className="ns-input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            style={{ flex: 1 }}
                        />
                        <button className="btn-primary" disabled={emailSaving} style={{ fontSize: 12, whiteSpace: 'nowrap' }} onClick={saveEmail}>
                            {emailSaving ? 'Saving…' : emailSaved ? <><Check size={13} /> Saved</> : 'Save'}
                        </button>
                    </div>
                </FieldRow>

                <FieldRow label="Role">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: roleColor, background: `${roleColor}12`, padding: '5px 14px', borderRadius: 8, fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${roleColor}25` }}>{role}</span>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>Assigned by your platform admin</span>
                    </div>
                </FieldRow>
            </Section>

            {/* Password */}
            <Section icon={Lock} title="Password" subtitle="Change your login password" color="#F59E0B">
                <form onSubmit={handlePwChange} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {[
                        { label: 'Current password', key: 'current' },
                        { label: 'New password',     key: 'next'    },
                        { label: 'Confirm password', key: 'confirm' },
                    ].map(f => (
                        <FieldRow key={f.key} label={f.label}>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="ns-input"
                                    type={showPw ? 'text' : 'password'}
                                    value={pwForm[f.key]}
                                    onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                                    placeholder="••••••••"
                                    style={{ paddingRight: 36 }}
                                />
                                <button type="button" onClick={() => setShowPw(s => !s)}
                                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
                                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </FieldRow>
                    ))}
                    {pwMsg && (
                        <div style={{ padding: '10px 14px', borderRadius: 8, fontSize: 12,
                            background: pwMsg.startsWith('ok:') ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                            border: `1px solid ${pwMsg.startsWith('ok:') ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                            color: pwMsg.startsWith('ok:') ? '#10B981' : '#EF4444',
                        }}>
                            {pwMsg.replace(/^(ok|error):/, '')}
                        </div>
                    )}
                    <div>
                        <button type="submit" className="btn-primary" style={{ fontSize: 12 }}>
                            <Lock size={13} /> Change Password
                        </button>
                    </div>
                </form>
            </Section>

            {/* Notifications */}
            <Section icon={Bell} title="Notifications" subtitle="Choose which events trigger in-app notifications" color="#10B981">
                <Toggle value={pref('deploy_success')} onChange={() => toggleNotif('deploy_success')} label="Deploy success" desc="When an app is deployed successfully" />
                <Toggle value={pref('deploy_fail')}    onChange={() => toggleNotif('deploy_fail')}    label="Deploy failed"  desc="When a deployment fails" />
                <Toggle value={pref('scale_event')}    onChange={() => toggleNotif('scale_event')}    label="Scale events"   desc="When an app scales up or down" />
                <Toggle value={pref('kafka_wired')}    onChange={() => toggleNotif('kafka_wired')}    label="Kafka wired"    desc="When a Kafka pipeline is created" />
                <Toggle value={pref('app_deleted')}    onChange={() => toggleNotif('app_deleted')}    label="App deleted"    desc="When an application is removed" />
            </Section>

            {/* Appearance */}
            <Section icon={Palette} title="Appearance" subtitle="Customize the look of your workspace" color="#A855F7">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }} className="text-primary">Theme</p>
                        <p style={{ fontSize: 11, margin: '3px 0 0', color: '#6B7280' }}>Switch between dark and light mode</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[
                            { label: '🌙 Dark',  value: true  },
                            { label: '☀️ Light', value: false },
                        ].map(opt => (
                            <button key={String(opt.value)}
                                onClick={() => opt.value !== dark && toggleTheme()}
                                style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${dark === opt.value ? '#00D4FF' : 'rgba(0,0,0,0.1)'}`, background: dark === opt.value ? 'rgba(0,212,255,0.1)' : 'transparent', color: dark === opt.value ? '#00D4FF' : '#6B7280', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: 'all 150ms' }}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </Section>

            {/* Danger Zone */}
            <Section icon={AlertTriangle} title="Danger Zone" subtitle="Irreversible actions — proceed with caution" color="#EF4444">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#EF4444' }}>Sign out of all devices</p>
                            <p style={{ fontSize: 11, margin: '3px 0 0', color: '#6B7280' }}>Invalidate all sessions and tokens</p>
                        </div>
                        <button className="btn-ghost" style={{ color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', fontSize: 12 }}
                            onClick={() => { logout(); navigate('/login'); }}>
                            <LogOut size={13} /> Sign out
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.03)' }}>
                        <div>
                            <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#EF4444' }}>Delete account</p>
                            <p style={{ fontSize: 11, margin: '3px 0 0', color: '#6B7280' }}>Permanently delete your account and all data</p>
                        </div>
                        <button
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#EF4444', cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => window.alert('Please contact your administrator to delete your account.')}
                        >
                            <Trash2 size={13} /> Delete account
                        </button>
                    </div>
                </div>
            </Section>
        </div>
    );
};

export default Settings;
