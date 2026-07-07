import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cloud, Eye, EyeOff, Gauge } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setError('Veuillez remplir tous les champs.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await login(username.trim(), password);
            navigate('/dashboard');
        } catch (err) {
            setError(err?.message || err?.response?.data?.error_description || 'Identifiants incorrects.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="glow-sphere glow-1"></div>
            <div className="glow-sphere glow-2"></div>

            <div className="auth-form-panel">
                <div className="branding-top">
                    <div className="brand-mark">
                        <Cloud size={20} fill="currentColor" strokeWidth={1.5} />
                    </div>
                    <span className="brand-name">NEXTSTEP</span>
                </div>

                <div className="auth-card">
                    <header className="auth-header">
                        <h2>Welcome back</h2>
                        <p>Access your high-performance serverless environment.</p>
                    </header>

                    {error && (
                        <div className="badge badge-error" style={{ width: '100%', padding: '1rem', marginBottom: '1.5rem', borderRadius: '8px', boxSizing: 'border-box' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="identity">Email or Username</label>
                            <input
                                id="identity"
                                className="form-input"
                                type="text"
                                placeholder="name@company.com"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                autoComplete="username"
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <div className="form-label-row">
                                <label className="form-label" htmlFor="password">Password</label>
                                <a href="#" className="form-link">Forgot password?</a>
                            </div>
                            <div className="form-input-wrap">
                                <input
                                    id="password"
                                    className="form-input"
                                    style={{ paddingRight: 44 }}
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPassword(s => !s)}
                                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="auth-submit" disabled={loading}>
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '1.75rem', paddingTop: '1.75rem', borderTop: '1px solid rgba(255,255,255,0.08)', fontSize: '0.875rem' }}>
                        <span style={{ color: '#9CA3AF' }}>New here? </span>
                        <Link to="/register" style={{ color: '#00D4FF', fontWeight: 600, textDecoration: 'none' }}>
                            Create an account
                        </Link>
                    </div>
                </div>

                <footer className="auth-footer-links">
                    <a href="#">Privacy Policy</a>
                    <a href="#">Terms of Service</a>
                    <a href="#">Security</a>
                    <span className="auth-footer-copyright">© 2026 NextStep Cloud Systems.</span>
                </footer>
            </div>

            <div className="auth-showcase">
                <div className="showcase-card">
                    <div className="showcase-glow"><div className="showcase-glow-orb"></div></div>

                    <div className="showcase-orbit">
                        <div className="orbit-ring"></div>
                        <div className="orbit-ring r2"></div>
                        <div className="orbit-ring r3"></div>
                        <div className="orbit-node" style={{ top: '-7px', left: 'calc(50% - 7px)' }}></div>
                        <div className="orbit-node" style={{ bottom: '18px', right: '10px' }}></div>
                        <div className="orbit-node" style={{ bottom: '18px', left: '10px' }}></div>
                        <div className="showcase-center-icon">
                            <Cloud size={28} fill="currentColor" strokeWidth={1.5} />
                        </div>
                    </div>

                    <div className="showcase-status">
                        <div className="showcase-status-icon">
                            <Gauge size={20} />
                        </div>
                        <div>
                            <p className="showcase-status-label">Performance Status</p>
                            <p className="showcase-status-value">Optimized Architecture Active</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
