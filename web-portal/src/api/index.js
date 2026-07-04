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
    update: (id, data) => api.put(`/apps/${id}`, data),
    delete: (id) => api.delete(`/apps/${id}`),
    listRevisions: (id) => api.get(`/apps/${id}/revisions`),
    rollback: (id, revisionName) => api.post(`/apps/${id}/rollback/${revisionName}`),
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
    getMine: () => api.get('/logs/me'),
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
    listSources:    ()     => api.get('/eventing/sources'),
    createSource:   (data) => api.post('/eventing/sources', data),
    listTriggers:   ()     => api.get('/eventing/triggers'),
    createTrigger:  (data) => api.post('/eventing/triggers', data),
    deleteTrigger:  (id)   => api.delete(`/eventing/triggers/${id}`),
}

export const billingApi = {
    getMyBilling:    () => api.get('/billing/me'),
    getAdminBilling: () => api.get('/billing/admin'),
    triggerSnapshot: () => api.post('/billing/admin/snapshot'),
    exportExcel:     () => api.get('/billing/export', { responseType: 'blob' }),
}

export const teamApi = {
    listMembers:       ()                 => api.get('/team/members'),
    addMember:         (data)             => api.post('/team/members', data),
    removeMember:      (id)               => api.delete(`/team/members/${id}`),
    updatePermissions: (id, permissions)  => api.put(`/team/members/${id}/permissions`, permissions),
}

export const adminApi = {
    getStats:           ()   => api.get('/admin/stats'),
    getAllApps:          ()   => api.get('/admin/apps'),
    forceDelete:        (id) => api.delete(`/admin/apps/${id}`),
    suspendApp:         (id) => api.post(`/admin/apps/${id}/suspend`),
    restoreApp:         (id) => api.post(`/admin/apps/${id}/restore`),
    getAllTopics:        ()   => api.get('/admin/kafka/topics'),
    deleteTopic:        (id) => api.delete(`/admin/kafka/topics/${id}`),
    getAllLogs:          ()   => api.get('/admin/logs'),
    getNodes:           ()   => api.get('/admin/cluster/nodes'),
    getNamespaces:      ()   => api.get('/admin/cluster/namespaces'),
    getPods:            ()   => api.get('/admin/cluster/pods'),
    getKnativeServices: ()   => api.get('/admin/cluster/knative/services'),
    getKafkaBrokers:    ()   => api.get('/admin/cluster/kafka/brokers'),
    getAllSources:       ()   => api.get('/admin/eventing/sources'),
    getAllTriggers:      ()   => api.get('/admin/eventing/triggers'),
    getClusterOverview: ()   => api.get('/admin/cluster/overview'),
    getClients:         ()   => api.get('/admin/clients'),
    suspendClient:      (id) => api.post(`/admin/clients/${id}/suspend`),
    restoreClient:      (id) => api.post(`/admin/clients/${id}/restore`),
}

export const paymentApi = {
    getConfig:       ()         => api.get('/payment/config'),
    createSetupIntent: ()       => api.post('/payment/setup-intent'),
    listMethods:     ()         => api.get('/payment/methods'),
    deleteMethod:    (id)       => api.delete(`/payment/methods/${id}`),
    pay:             (body)     => api.post('/payment/pay', body),
    getTransactions: ()         => api.get('/payment/transactions'),
}
