import api from './client'

export const authApi = {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    getMe: () => api.get('/users/me'),
}

export const appsApi = {
    create: (data) => api.post('/apps', data),
    list: () => api.get('/apps'),
    get: (id) => api.get(`/apps/${id}`),
    deploy: (id) => api.post(`/apps/${id}/deploy`),
    delete: (id) => api.delete(`/apps/${id}`),
}

export const metricsApi = {
    getApp: (id) => api.get(`/metrics/apps/${id}`),
    getCluster: () => api.get('/metrics/cluster'),
}

export const usersApi = {
    me:         ()           => api.get('/users/me'),
    list:       ()           => api.get('/users'),
    updateRole: (id, role)   => api.patch(`/users/${id}/role`, { role }),
}

export const logsApi = {
    getByApp: (id) => api.get(`/logs/apps/${id}`),
    getByUser: (id) => api.get(`/logs/users/${id}`),
}

export const kafkaApi = {
    list: () => api.get('/kafka/topics'),
    create: (data) => api.post('/kafka/topics', data),
    get: (id) => api.get(`/kafka/topics/${id}`),
    delete: (id) => api.delete(`/kafka/topics/${id}`),
}

export const eventApi = {
    publish: (data) => api.post('/events', data),
}

export const eventingApi = {
    listSources:   ()     => api.get('/eventing/sources'),
    createSource:  (data) => api.post('/eventing/sources', data),
    listTriggers:  ()     => api.get('/eventing/triggers'),
    createTrigger: (data) => api.post('/eventing/triggers', data),
}
