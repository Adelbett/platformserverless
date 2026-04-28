import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
const VisibilityIcon    = () => <span>👁</span>;
const VisibilityOffIcon = () => <span>🙈</span>;

import Logo from '../components/Logo';

const Register = () => {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPass, setShowPass] = useState(false);

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirm) {
            setError('Passwords do not match.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await authApi.register({ username: form.username, password: form.password, email: form.email });
            navigate('/login');
        } catch (err) {
            const msg = err?.message || err?.response?.data?.error_description || err?.response?.data?.message || 'Erreur lors de la création du compte.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        width: '100%', background: '#161B22', border: '1px solid #1F2B3A',
        color: '#DDE6F0', padding: '11px 14px', borderRadius: '8px',
        fontSize: '14px', fontFamily: "'Syne', sans-serif", outline: 'none', transition: 'border-color 0.2s',
    };

    const labelStyle = {
        display: 'block', fontFamily: "'JetBrains Mono', monospace",
        fontSize: '11px', fontWeight: 500, color: '#5A7080',
        textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px',
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', background: '#07090E' }}>
            {/* Left panel */}
            <div style={{
                width: '40%', padding: '48px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                background: 'linear-gradient(160deg, #0D1117 0%, #07090E 100%)',
                borderRight: '1px solid #1F2B3A',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', width: '300px', height: '300px', background: '#9B6FD8', filter: 'blur(120px)', borderRadius: '50%', top: '-80px', right: '-80px', opacity: 0.06, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', width: '250px', height: '250px', background: '#4A9EF5', filter: 'blur(100px)', borderRadius: '50%', bottom: '80px', left: '-60px', opacity: 0.06, pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
                        <Logo size="large" />
                        <div>
                            <div style={{
                                fontFamily: "'Syne', sans-serif",
                                fontSize: '26px',
                                fontWeight: 800,
                                color: '#DDE6F0',
                                lineHeight: 1,
                                letterSpacing: '0.02em',
                            }}>NEXTSTEP</div>
                            <div style={{
                                fontFamily: "'Syne', sans-serif",
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#4A9EF5',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                marginTop: '4px',
                            }}>Cloud Platform</div>
                        </div>
                    </div>

                    <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: '32px', fontWeight: 800, color: '#DDE6F0', lineHeight: 1.2, marginBottom: '16px' }}>
                        Join the platform.<br />
                        <span style={{ color: '#9B6FD8' }}>Ship faster.</span>
                    </h1>

                    <p style={{ color: '#5A7080', fontSize: '14px', lineHeight: 1.7, marginBottom: '32px' }}>
                        Create your account to start deploying containerized workloads to a production-grade Knative cluster.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[
                            'Free to get started',
                            'Scale-to-zero by default',
                            'Kafka event-driven triggers included',
                        ].map(text => (
                            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#A8B8C8' }}>
                                <span style={{ color: '#3FB950', fontWeight: 700 }}>✓</span>
                                {text}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right panel */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
                <div style={{ width: '100%', maxWidth: '440px' }}>
                    <div style={{ background: '#0D1117', border: '1px solid #1F2B3A', borderRadius: '16px', padding: '36px' }}>
                        <div style={{ marginBottom: '28px' }}>
                            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '24px', fontWeight: 700, color: '#DDE6F0', marginBottom: '6px' }}>
                                Create account
                            </h2>
                            <p style={{ color: '#5A7080', fontSize: '14px' }}>Set up your developer profile</p>
                        </div>

                        {error && (
                            <div style={{
                                background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.25)',
                                borderRadius: '8px', padding: '12px 14px', color: '#F85149', fontSize: '13px',
                                marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px',
                            }}>
                                <span style={{ fontSize: '16px' }}>⚠</span> {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={labelStyle}>Username</label>
                                <input type="text" value={form.username} onChange={e => set('username', e.target.value)} placeholder="john_doe" required style={inputStyle}
                                    onFocus={e => e.target.style.borderColor = '#4A9EF5'} onBlur={e => e.target.style.borderColor = '#1F2B3A'} />
                            </div>
                            <div>
                                <label style={labelStyle}>Email</label>
                                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@company.io" required style={inputStyle}
                                    onFocus={e => e.target.style.borderColor = '#4A9EF5'} onBlur={e => e.target.style.borderColor = '#1F2B3A'} />
                            </div>
                            <div>
                                <label style={labelStyle}>Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="min 8 characters" required style={{ ...inputStyle, paddingRight: '44px' }}
                                        onFocus={e => e.target.style.borderColor = '#4A9EF5'} onBlur={e => e.target.style.borderColor = '#1F2B3A'} />
                                    <button type="button" onClick={() => setShowPass(s => !s)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#5A7080', display: 'flex', alignItems: 'center', padding: 0 }}>
                                        {showPass ? <VisibilityOffIcon style={{ fontSize: '18px' }} /> : <VisibilityIcon style={{ fontSize: '18px' }} />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Confirm Password</label>
                                <input type="password" value={form.confirm} onChange={e => set('confirm', e.target.value)} placeholder="repeat password" required style={inputStyle}
                                    onFocus={e => e.target.style.borderColor = '#4A9EF5'} onBlur={e => e.target.style.borderColor = '#1F2B3A'} />
                            </div>

                            <button type="submit" disabled={loading} style={{
                                width: '100%', background: loading ? '#2D3D52' : '#9B6FD8', color: 'white',
                                border: 'none', padding: '13px', borderRadius: '8px',
                                fontFamily: "'Syne', sans-serif", fontSize: '15px', fontWeight: 600,
                                cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px',
                            }}>
                                {loading ? (
                                    <>
                                        <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                        Redirecting...
                                    </>
                                ) : 'Create Account →'}
                            </button>
                        </form>

                        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#5A7080' }}>
                            Already have an account?{' '}
                            <Link to="/login" style={{ color: '#4A9EF5', textDecoration: 'none', fontWeight: 500 }}>Sign in</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
