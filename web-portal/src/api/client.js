import axios from 'axios'
import keycloak from '../auth/keycloak'  // ← ajouter cet import

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
    // Prend le token depuis Keycloak au lieu de localStorage
    const token = keycloak.token || localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

api.interceptors.response.use(
    res => res,
    err => {
        // Si 401 → token expiré → déconnexion automatique
        if (err.response?.status === 401) {
            keycloak.logout()
        }
        return Promise.reject(err)
    }
)

export default api