import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import './Auth.css';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
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

            <div className="auth-left">
                <div className="branding-top">
                    <Logo size="large" />
                    <div className="brand-text">
                        <span className="brand-name" style={{ fontSize: '1.5rem' }}>NEXTSTEP</span>
                        <span className="brand-tagline">PLATFORM CONNECT</span>
                    </div>
                </div>

                <div className="auth-hero-text">
                    <h1>Future of <br /><span className="text-cyan">Serverless</span> <br />is Here.</h1>
                    <div className="feature-list">
                        <div className="feature-item">
                            <span className="feature-icon">✔</span>
                            <span>High-performance Knative Orchestration</span>
                        </div>
                        <div className="feature-item">
                            <span className="feature-icon">✔</span>
                            <span>Native Kafka Event Source Integration</span>
                        </div>
                        <div className="feature-item">
                            <span className="feature-icon">✔</span>
                            <span>Zero-overhead Production Clusters</span>
                        </div>
                    </div>
                </div>

                <div className="auth-footer-text">
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                        &copy; 2026 NextStep Cloud Systems. Restricted Access.
                    </p>
                </div>
            </div>

            <div className="auth-right">
                <div className="auth-card animate-fade-in">
                    <header className="auth-header">
                        <h2>Initialize Session</h2>
                        <p>Access your isolated cluster environment</p>
                    </header>

                    {error && (
                        <div className="badge badge-error" style={{ width: '100%', padding: '1rem', marginBottom: '1.5rem', borderRadius: '8px' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Username</label>
                            <input
                                className="form-input"
                                type="text"
                                placeholder="your-username"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                autoComplete="username"
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Password</label>
                            <input
                                className="form-input"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                autoComplete="current-password"
                                disabled={loading}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            style={{ width: '100%', marginTop: '1rem' }}
                            disabled={loading}
                        >
                            {loading ? 'Connecting...' : 'Login →'}
                        </button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-dim)' }}>New operator? </span>
                        <Link to="/register" style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}>
                            Register System
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
