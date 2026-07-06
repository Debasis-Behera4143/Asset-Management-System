import React, { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/common/ErrorBoundary'
import PageLoader from './components/common/PageLoader'
import NotFoundPage from './components/common/NotFoundPage'
import { ProtectedRoute, PublicRoute, AdminRoute, SuperAdminRoute, EmployeeRoute } from './components/layout/ProtectedRoute'
import useAuthStore from './store/authStore'

// ─── Index Route Helper ──────────────────────────────────────────────────────
function IndexRoute() {
  const { isAdmin, isAuthenticated } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Navigate to={isAdmin() ? "/dashboard" : "/my-assets"} replace />
}

// ─── Lazy-loaded routes (code splitting) ─────────────────────────────────────
const AppLayout = lazy(() => import('./components/layout/AppLayout'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
const AssetsPage = lazy(() => import('./pages/assets/AssetsPage'))
const AssetFormPage = lazy(() => import('./pages/assets/AssetFormPage'))
const AssetDetailPage = lazy(() => import('./pages/assets/AssetDetailPage'))
const EmployeesPage = lazy(() => import('./pages/employees/EmployeesPage'))
const MaintenancePage = lazy(() => import('./pages/maintenance/MaintenancePage'))
const AllocationPage = lazy(() => import('./pages/allocation/AllocationPage'))
const VendorsPage = lazy(() => import('./pages/vendors/VendorsPage'))
const DepreciationPage = lazy(() => import('./pages/depreciation/DepreciationPage'))
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'))
const AiAssistantPage = lazy(() => import('./pages/ai/AiAssistantPage'))
const QrScannerPage = lazy(() => import('./pages/qr/QrScannerPage'))
const OcrScannerPage = lazy(() => import('./pages/ocr/OcrScannerPage'))
const ReturnAssetsPage = lazy(() => import('./pages/return/ReturnAssetsPage'))
const NotificationsPage = lazy(() => import('./pages/notifications/NotificationsPage'))
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage'))
const UsersPage = lazy(() => import('./pages/users/UsersPage'))
const MyAssetsPage = lazy(() => import('./pages/assets/MyAssetsPage'))

const AssetPassportPage = lazy(() => import('./pages/assets/AssetPassportPage'))

const BudgetForecastPage = lazy(() => import('./pages/budget/BudgetForecastPage'))
const AuditLogsPage = lazy(() => import('./pages/audit-logs/AuditLogsPage'))

// ─── Query Client ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000, // 30 seconds
    },
  },
})

// ─── Edit Asset Route ─────────────────────────────────────────────────────────
function EditAssetRoute() {
  const { id } = useParams()
  return <AssetFormPage assetId={id} />
}

import ComingSoonPlaceholder from './components/common/ComingSoonPlaceholder'

// ─── Module Under Development Placeholder ────────────────────────────────────
function ModulePlaceholder({ title }) {
  return (
    <div className="space-y-6">
      <div className="page-header mb-0">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-1 h-6 rounded-full" style={{ background: '#8B0000' }} />
            <h1 className="page-title">{title}</h1>
          </div>
          <p className="page-subtitle pl-3">This module is under active development.</p>
        </div>
      </div>
      <ComingSoonPlaceholder title={title} />
    </div>
  )
}

// ─── IR-themed Toaster config ────────────────────────────────────────────────
const toastOptions = {
  style: {
    background: 'rgb(10, 22, 40)',
    color: '#e2e8f0',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    fontSize: '13px',
    fontFamily: 'Inter, sans-serif',
  },
  success: {
    iconTheme: { primary: '#16a34a', secondary: '#fff' },
    style: { borderLeft: '3px solid #16a34a' },
  },
  error: {
    iconTheme: { primary: '#8B0000', secondary: '#fff' },
    style: { borderLeft: '3px solid #8B0000' },
  },
}

// ─── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public auth routes */}
            <Route element={<PublicRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
            </Route>

            {/* Public unauthenticated Asset Passport route */}
            <Route path="/assets/passport/:assetTag" element={<AssetPassportPage />} />
            <Route path="/asset/:assetTag" element={<AssetPassportPage />} />

            {/* Protected app routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<IndexRoute />} />
                <Route path="/assets/:id" element={<AssetDetailPage />} />
                <Route path="/my-assets" element={<MyAssetsPage />} />
                <Route path="/ai-assistant" element={<AiAssistantPage />} />
                <Route path="/qr-scanner" element={<QrScannerPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<SettingsPage />} />

                {/* Admin-only routes */}
                <Route element={<AdminRoute />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/assets" element={<AssetsPage />} />
                  <Route path="/ocr-scanner" element={<OcrScannerPage />} />
                  <Route path="/maintenance" element={<MaintenancePage />} />
                  <Route path="/return" element={<ReturnAssetsPage />} />
                  <Route path="/assets/new" element={<AssetFormPage />} />
                  <Route path="/assets/:id/edit" element={<EditAssetRoute />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/allocation" element={<AllocationPage />} />
                  <Route path="/vendors" element={<VendorsPage />} />
                  <Route path="/depreciation" element={<DepreciationPage />} />

                  {/* Real Admin modules */}
                  <Route path="/budget" element={<BudgetForecastPage />} />
                </Route>

                {/* Super Admin-only routes */}
                <Route element={<SuperAdminRoute />}>
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/audit-logs" element={<AuditLogsPage />} />
                </Route>
              </Route>
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>

        <Toaster
          position="top-right"
          gutter={8}
          containerStyle={{ top: 80 }}
          toastOptions={toastOptions}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
