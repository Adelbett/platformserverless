import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Box, Rocket, Activity, Zap,
    Globe, KeyRound, Users, CreditCard, Settings,
    LogOut, ChevronLeft, ChevronRight, Hexagon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_SECTIONS = [
    {
        label: 'Platform',
        items: [
            { path: '/dashboard',  label: 'Dashboard',         icon: LayoutDashboard },
            { path: '/apps',       label: 'Applications',      icon: Box             },
            { path: '/apps/new',   label: 'Deploy',            icon: Rocket          },
            { path: '/monitoring', label: 'Monitoring',        icon: Activity        },
        ],
    },
    {
        label: 'Configure',
        items: [
            { path: '/kafka',      label: 'Scaling',           icon: Zap             },
            { path: '/eventing',   label: 'Domains & Routing', icon: Globe           },
            { path: '/logs',       label: 'Secrets & Config',  icon: KeyRound        },
        ],
    },
    {
        label: 'Management',
        items: [
            { path: '/users',      label: 'Team & Access',     icon: Users,     adminOnly: true },
            { path: '/billing',    label: 'Billing',           icon: CreditCard },
            { path: '/settings',   label: 'Settings',          icon: Settings  },
        ],
    },
];

const NavItem = ({ item, collapsed, user }) => {
    if (item.adminOnly && user?.role !== 'ADMIN') return null;
    const Icon = item.icon;

    return (
        <NavLink
            to={item.path}
            end={item.path === '/apps'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}${collapsed ? ' collapsed-nav-item' : ''}`}
            title={collapsed ? item.label : undefined}
            style={collapsed ? { justifyContent: 'center', padding: '9px 0', width: 40, margin: '1px auto' } : undefined}
        >
            <Icon size={17} style={{ flexShrink: 0 }} />
            <AnimatePresence initial={false}>
                {!collapsed && (
                    <motion.span
                        key="label"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                        {item.label}
                    </motion.span>
                )}
            </AnimatePresence>
        </NavLink>
    );
};

const Sidebar = ({ collapsed, onToggle }) => {
    const { user, logout } = useAuth();
    const { dark } = useTheme();
    const navigate = useNavigate();

    const email    = user?.email || user?.username || 'user@nextstep.io';
    const username = user?.username || email.split('@')[0];
    const initials = username.slice(0, 2).toUpperCase();
    const role     = user?.role || 'VIEWER';

    const roleStyle = {
        ADMIN:     { color: '#EF4444', bg: 'rgba(239,68,68,0.12)'    },
        DEVELOPER: { color: '#00D4FF', bg: 'rgba(0,212,255,0.10)'    },
        VIEWER:    { color: '#9CA3AF', bg: 'rgba(156,163,175,0.10)'  },
    }[role] || { color: '#9CA3AF', bg: 'rgba(156,163,175,0.10)' };

    const handleLogout = () => { logout(); navigate('/login'); };

    return (
        <motion.div
            className="app-sidebar"
            animate={{ width: collapsed ? 64 : 240 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
            {/* Brand logo */}
            <div style={{
                height: 60, flexShrink: 0, display: 'flex', alignItems: 'center',
                padding: '0 16px', borderBottom: '1px solid rgba(0,0,0,0.07)',
                overflow: 'hidden',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: 'linear-gradient(135deg, #00D4FF, #0066FF)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 0 16px rgba(0,212,255,0.3)',
                    }}>
                        <Hexagon size={15} color="white" fill="white" />
                    </div>
                    <AnimatePresence initial={false}>
                        {!collapsed && (
                            <motion.div
                                key="brand"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -8 }}
                                transition={{ duration: 0.2 }}
                                style={{ minWidth: 0 }}
                            >
                                <p style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.06em', margin: 0, lineHeight: 1, fontFamily: "'Outfit', sans-serif", color: dark ? '#F9FAFB' : '#0F172A' }}>
                                    NEXTSTEP
                                </p>
                                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', margin: '3px 0 0', color: '#00D4FF', textTransform: 'uppercase' }}>
                                    Serverless OS
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 10px' }}>
                {NAV_SECTIONS.map(section => {
                    const visible = section.items.filter(i => !i.adminOnly || user?.role === 'ADMIN');
                    if (visible.length === 0) return null;
                    return (
                        <div key={section.label}>
                            <AnimatePresence initial={false}>
                                {!collapsed && (
                                    <motion.span
                                        key="sec-label"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="section-label"
                                    >
                                        {section.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            {visible.map(item => (
                                <NavItem key={item.path} item={item} collapsed={collapsed} user={user} />
                            ))}
                        </div>
                    );
                })}
            </nav>

            {/* Footer */}
            <div style={{ flexShrink: 0, borderTop: '1px solid rgba(0,0,0,0.07)', padding: 10 }}>
                <AnimatePresence initial={false}>
                    {!collapsed && (
                        <motion.div
                            key="user-card"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', marginBottom: 4 }}
                        >
                            <div style={{
                                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                                background: 'linear-gradient(135deg, #00D4FF, #0066FF)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 800, color: 'white',
                                fontFamily: "'Outfit', sans-serif",
                            }}>
                                {initials}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                                <p style={{ fontSize: 12, fontWeight: 700, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} className="text-primary">
                                    {username}
                                </p>
                                <span style={{
                                    display: 'inline-block', marginTop: 3,
                                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                                    textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace",
                                    padding: '2px 6px', borderRadius: 4,
                                    color: roleStyle.color, background: roleStyle.bg,
                                }}>
                                    {role}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <button
                    onClick={handleLogout}
                    className="btn-ghost"
                    style={{ width: '100%', justifyContent: collapsed ? 'center' : 'flex-start', fontSize: 12.5, color: '#EF4444' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    title={collapsed ? 'Sign out' : undefined}
                >
                    <LogOut size={15} style={{ flexShrink: 0 }} />
                    <AnimatePresence initial={false}>
                        {!collapsed && (
                            <motion.span
                                key="logout-label"
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                transition={{ duration: 0.18 }}
                                style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                            >
                                Sign out
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </div>

            {/* Collapse toggle button */}
            <button
                onClick={onToggle}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                style={{
                    position: 'absolute', right: -12, top: 72,
                    width: 24, height: 24, borderRadius: '50%',
                    background: dark ? '#1F2937' : '#FFFFFF',
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                    color: '#9CA3AF', zIndex: 10, transition: 'color 150ms, background 150ms',
                }}
                onMouseEnter={e => e.currentTarget.style.color = dark ? '#F9FAFB' : '#0F172A'}
                onMouseLeave={e => e.currentTarget.style.color = '#9CA3AF'}
            >
                {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>
        </motion.div>
    );
};

export default Sidebar;
