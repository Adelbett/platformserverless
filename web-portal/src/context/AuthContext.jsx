import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { authApi } from '../api';

const KEYCLOAK_URL    = import.meta.env.VITE_KEYCLOAK_URL       || 'http://localhost:8081';
const KEYCLOAK_REALM  = import.meta.env.VITE_KEYCLOAK_REALM     || 'platform';
const KEYCLOAK_CLIENT = import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'platform-web';
const TOKEN_URL  = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
const LOGOUT_URL = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`;

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

const parseToken = (token) => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const roles   = payload.realm_access?.roles || [];
        return {
            username: payload.preferred_username || payload.sub,
            email:    payload.email || '',
            role:     roles.includes('admin') || roles.includes('ADMIN') ? 'ADMIN' : 'USER',
        };
    } catch { return null; }
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
    });
    const [loading]  = useState(false);
    const refreshRef = useRef(null);

    // Au rechargement de page : rafraîchir le token immédiatement si un refreshToken existe
    useEffect(() => {
        const rt = localStorage.getItem('refreshToken');
        if (!rt) return;
        axios.post(TOKEN_URL,
            new URLSearchParams({ grant_type: 'refresh_token', client_id: KEYCLOAK_CLIENT, refresh_token: rt }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        ).then(res => {
            localStorage.setItem('token', res.data.access_token);
            localStorage.setItem('refreshToken', res.data.refresh_token);
            startAutoRefresh(res.data.refresh_token);
        }).catch(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startAutoRefresh = (refreshToken) => {
        clearInterval(refreshRef.current);
        refreshRef.current = setInterval(async () => {
            try {
                const res = await axios.post(TOKEN_URL,
                    new URLSearchParams({ grant_type: 'refresh_token', client_id: KEYCLOAK_CLIENT, refresh_token: refreshToken }),
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                );
                localStorage.setItem('token', res.data.access_token);
                localStorage.setItem('refreshToken', res.data.refresh_token);
            } catch { logout(); }
        }, 55000);
    };

    const login = async (username, password) => {
        try {
            const res = await axios.post(TOKEN_URL,
                new URLSearchParams({ grant_type: 'password', client_id: KEYCLOAK_CLIENT, username, password }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            const { access_token, refresh_token } = res.data;
            const userData = parseToken(access_token);
            if (!userData) throw new Error('Token invalide');
            localStorage.setItem('token', access_token);
            localStorage.setItem('refreshToken', refresh_token);
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            startAutoRefresh(refresh_token);
            return userData;
        } catch (err) {
            const msg = err?.response?.data?.error_description || err?.response?.data?.error || err?.message || 'Identifiants incorrects.';
            throw new Error(msg);
        }
    };

    const register = async (username, password, email) => {
        await authApi.register({ username, password, email });
        return login(username, password);
    };

    const logout = () => {
        clearInterval(refreshRef.current);
        const rt = localStorage.getItem('refreshToken');
        if (rt) {
            axios.post(LOGOUT_URL,
                new URLSearchParams({ client_id: KEYCLOAK_CLIENT, refresh_token: rt }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            ).catch(() => {});
        }
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
