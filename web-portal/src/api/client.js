import axios from 'axios'

const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
})

api.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) {
            localStorage.removeItem('token')
            localStorage.removeItem('refreshToken')
            localStorage.removeItem('user')
            window.location.href = '/login'
        }
        if (err.response?.status === 403 && err.response?.data?.error === 'ACCOUNT_SUSPENDED') {
            try {
                const cached = JSON.parse(localStorage.getItem('user'))
                if (cached && !cached.suspended) {
                    localStorage.setItem('user', JSON.stringify({ ...cached, suspended: true }))
                    window.location.reload()
                }
            } catch { /* ignore */ }
        }
        return Promise.reject(err)
    }
)

export default api