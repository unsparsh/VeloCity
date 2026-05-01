import api from './api'

export const fetchStats = () =>
  api.get('/admin/stats/').then((r) => r.data)

export const fetchRides = (params = {}) =>
  api.get('/admin/rides/', { params }).then((r) => r.data)

export const fetchDrivers = (params = {}) =>
  api.get('/admin/drivers/', { params }).then((r) => r.data)

export const fetchPayments = (params = {}) =>
  api.get('/admin/payments/', { params }).then((r) => r.data)
