import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

/**
 * Route guard — redirects to /login if not authenticated.
 */
export function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />
}

/**
 * Admin route guard — redirects to /dashboard if not admin.
 */
export function AdminRoute() {
  const { isAuthenticated, isAdmin } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin()) return <Navigate to="/my-assets" replace />
  return <Outlet />
}

/**
 * Super Admin route guard.
 */
export function SuperAdminRoute() {
  const { isAuthenticated, isSuperAdmin, isAdmin } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isSuperAdmin()) return <Navigate to={isAdmin() ? "/dashboard" : "/my-assets"} replace />
  return <Outlet />
}

/**
 * Public route guard — redirects authenticated users to /dashboard.
 */
export function PublicRoute() {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />
}

/**
 * Employee route guard — redirects to /dashboard if not employee.
 */
export function EmployeeRoute() {
  const { isAuthenticated, isEmployee } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isEmployee()) return <Navigate to="/dashboard" replace />
  return <Outlet />
}
