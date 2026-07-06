import axiosClient from './axiosClient'
import {
  demoCharts,
  demoDashboard,
  demoDepartments,
  fallbackOnNetworkError,
  demoEmployeePage,
  demoAllocationPage,
  demoVendorPage,
  demoMaintenancePage,
  demoWarrantyPage,
  demoDepreciationPage,
  demoAssets,
  demoAllocations,
  demoMaintenance,
  demoWarranties,
  demoDepreciation,
} from './mockData'
export { assetApi } from './assetApi'
export { userApi } from './userApi'

export const employeeApi = {
  getAll: (params) => fallbackOnNetworkError(axiosClient.get('/employees', { params }), demoEmployeePage),
  getById: (id) => axiosClient.get(`/employees/${id}`),
  create: (data) => axiosClient.post('/employees', data),
  update: (id, data) => axiosClient.put(`/employees/${id}`, data),
  delete: (id) => axiosClient.delete(`/employees/${id}`),
  getAllocations: (id, params) => axiosClient.get(`/employees/${id}/allocations`, { params }),
}

export const allocationApi = {
  getAll: (params) => fallbackOnNetworkError(axiosClient.get('/allocations', { params }), demoAllocationPage),
  getById: (id) => axiosClient.get(`/allocations/${id}`),
  assign: (data) => axiosClient.post('/allocations/assign', data),
  return: (id, notes) => axiosClient.post(`/allocations/${id}/return`, { notes }),
  transfer: (id, data) => axiosClient.post(`/allocations/${id}/transfer`, data),
  getByAsset: (assetId, params) => axiosClient.get(`/allocations/asset/${assetId}`, { params }),
  getByEmployee: (empId, params) => axiosClient.get(`/allocations/employee/${empId}`, { params }),
}

export const vendorApi = {
  getAll: (params) => fallbackOnNetworkError(axiosClient.get('/vendors', { params }), demoVendorPage),
  getById: (id) => axiosClient.get(`/vendors/${id}`),
  create: (data) => axiosClient.post('/vendors', data),
  update: (id, data) => axiosClient.put(`/vendors/${id}`, data),
  delete: (id) => axiosClient.delete(`/vendors/${id}`),
  addRating: (id, data) => axiosClient.post(`/vendors/${id}/ratings`, data),
}

export const maintenanceApi = {
  getAll: (params) => fallbackOnNetworkError(axiosClient.get('/maintenance', { params }), demoMaintenancePage),
  getById: (id) => axiosClient.get(`/maintenance/${id}`),
  create: (data) => axiosClient.post('/maintenance', data),
  update: (id, data) => axiosClient.put(`/maintenance/${id}`, data),
  updateStatus: (id, status) => axiosClient.patch(`/maintenance/${id}/status`, { status }),
  complete: (id, data) => axiosClient.post(`/maintenance/${id}/complete`, data),
  getByAsset: (assetId, params) => axiosClient.get(`/maintenance/asset/${assetId}`, { params }),
}

export const dashboardApi = {
  getStats: () => fallbackOnNetworkError(axiosClient.get('/dashboard/stats'), demoDashboard),
  getCategoryChart: () => fallbackOnNetworkError(axiosClient.get('/dashboard/category'), demoCharts.category),
  getDepartmentChart: () => fallbackOnNetworkError(axiosClient.get('/dashboard/department'), demoCharts.department),
  getStatusChart: () => fallbackOnNetworkError(axiosClient.get('/dashboard/status'), demoCharts.status),
  getHealthChart: () => fallbackOnNetworkError(axiosClient.get('/dashboard/health'), demoCharts.health),
}

export const warrantyApi = {
  getAll: (params) => fallbackOnNetworkError(axiosClient.get('/warranty', { params }), demoWarrantyPage),
  getExpiring: (days, params) => fallbackOnNetworkError(axiosClient.get('/warranty/expiring', { params: { days, ...params } }), demoWarrantyPage),
  getByAsset: (assetId) => axiosClient.get(`/warranty/asset/${assetId}`),
  update: (assetId, data) => axiosClient.put(`/warranty/asset/${assetId}`, data),
}

export const depreciationApi = {
  calculate: (assetId) => axiosClient.post(`/depreciation/calculate/${assetId}`),
  calculateAll: () => axiosClient.post('/depreciation/calculate-all'),
  getRecords: (params) => fallbackOnNetworkError(axiosClient.get('/depreciation/records', { params }), demoDepreciationPage),
}

export const healthApi = {
  getByAsset: (assetId) => axiosClient.get(`/health/asset/${assetId}`),
  calculateForAsset: (assetId) => axiosClient.post(`/health/calculate/${assetId}`),
  getHighRisk: (params) => axiosClient.get('/health/high-risk', { params }),
  recalculateAll: () => axiosClient.post('/health/recalculate-all'),
}

export const reportApi = {
  downloadAssets: (params) => axiosClient.get('/reports/assets', { params, responseType: 'blob' }),
  downloadMaintenance: (params) => axiosClient.get('/reports/maintenance', { params, responseType: 'blob' }),
  downloadWarranty: (params) => axiosClient.get('/reports/warranty', { params, responseType: 'blob' }),
  downloadDepreciation: (params) => axiosClient.get('/reports/depreciation', { params, responseType: 'blob' }),
}

export const aiApi = {
  chat: (message) => fallbackOnNetworkError(
    axiosClient.post('/ai/chat', { message }),
    { message: `Demo response: backend is offline, but I understood your query: "${message}".` }
  ),
  getHistory: (page = 0, size = 20, search = '') => fallbackOnNetworkError(
    axiosClient.get('/ai/history', { params: { page, size, search } }),
    { data: { data: { rows: [], count: 0 } } }
  ),
  deleteHistoryItem: (id) => fallbackOnNetworkError(
    axiosClient.delete(`/ai/history/${id}`),
    { success: true }
  ),
  clearHistory: () => fallbackOnNetworkError(
    axiosClient.delete('/ai/history'),
    { success: true }
  ),
}

export const ocrApi = {
  scan: (file) => {
    const fd = new FormData(); fd.append('file', file)
    return fallbackOnNetworkError(
      axiosClient.post('/ocr/scan', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
      {
        vendorName: 'Demo Vendor',
        invoiceNumber: 'INV-DEMO-001',
        invoiceDate: '2026-06-02',
        purchaseDate: '2026-06-02',
        totalAmount: 145000,
        warrantyPeriod: '36 months',
        assetName: 'Demo Laptop',
        serialNumber: 'DEMO12345',
        extractionConfidence: 92,
        isDemo: true,
      }
    )
  },
}

export const notificationApi = {
  getAll: (params) => axiosClient.get('/notifications', { params }),
  getUnreadCount: () => fallbackOnNetworkError(axiosClient.get('/notifications/unread-count'), 0),
  markAsRead: (id) => axiosClient.patch(`/notifications/${id}/read`),
  markAllRead: () => axiosClient.patch('/notifications/mark-all-read'),
}

export const auditApi = {
  getLogs: (params) => axiosClient.get('/audit-logs', { params }),
}

export const budgetApi = {
  getAll: (params) => axiosClient.get('/budget', { params }),
  getById: (id) => axiosClient.get(`/budget/${id}`),
  create: (data) => axiosClient.post('/budget', data),
  update: (id, data) => axiosClient.put(`/budget/${id}`, data),
  delete: (id) => axiosClient.delete(`/budget/${id}`),
}

export const departmentApi = {
  getAll: () => fallbackOnNetworkError(axiosClient.get('/departments'), demoDepartments),
  create: (data) => axiosClient.post('/departments', data),
  update: (id, data) => axiosClient.put(`/departments/${id}`, data),
  delete: (id) => axiosClient.delete(`/departments/${id}`),
}

export const publicApi = {
  getPassport: (assetTag) => fallbackOnNetworkError(
    axiosClient.get(`/assets/public/passport/${assetTag}?scan=true`),
    {
      asset: demoAssets.find(a => a.assetTag === assetTag) || demoAssets.find(a => String(a.id) === String(assetTag)) || demoAssets[0],
      allocations: demoAllocations.filter(al => al.assetTag === assetTag),
      maintenance: demoMaintenance.filter(m => m.assetName === (demoAssets.find(a => a.assetTag === assetTag)?.name || '')),
      warranty: demoWarranties.find(w => w.contractNumber === `WNT-${assetTag}`) || demoWarranties[0],
      depreciation: demoDepreciation.filter(d => d.assetName === (demoAssets.find(a => a.assetTag === assetTag)?.name || ''))
    }
  )
}
