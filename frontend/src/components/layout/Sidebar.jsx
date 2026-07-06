import React, { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Tag, Users, Building2,
  GitBranch, RotateCcw, Wrench, QrCode, BarChart3,
  Bell, Settings, UserCog, LogOut, ChevronDown, Shield, Landmark,
  User, Activity, Cpu, TrendingUp, History, Bot
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import useAuthStore from '../../store/authStore'
import useLanguageStore from '../../store/languageStore'
import { useTranslation } from '../../utils/translations'
import {
  dashboardApi,
  employeeApi,
  vendorApi,
  allocationApi,
  maintenanceApi,
  depreciationApi,
  assetApi
} from '../../api/index'
import irLogo from '../../assets/images/indian_railways.png'

// Collapsible group navigation structure
const navigationGroups = [
  {
    title: 'Operations',
    items: [
      { to: '/dashboard',   icon: LayoutDashboard, label: 'Dashboard',     roles: ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
      { to: '/qr-scanner',   icon: QrCode,          label: 'QR Code Scanner' },
      { to: '/ocr-scanner',  icon: Cpu,             label: 'Invoice OCR',          roles: ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
      { to: '/ai-assistant', icon: Bot,             label: 'AI Assistant' },
    ]
  },
  {
    title: 'Assets',
    items: [
      { to: '/assets',      icon: Package,          label: 'Assets Registry',      roles: ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
      { to: '/my-assets',   icon: User,             label: 'My Assets',            roles: ['ROLE_EMPLOYEE', 'ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
    ]
  },
  {
    title: 'Maintenance',
    items: [
      { to: '/maintenance', icon: Wrench,           label: 'Work Orders',          roles: ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
    ]
  },
  {
    title: 'Inventory',
    items: [
      { to: '/allocation',  icon: Landmark,         label: 'Asset Assignment',     roles: ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
      { to: '/return',      icon: RotateCcw,        label: 'Return Assets',        roles: ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
    ]
  },
  {
    title: 'Analytics',
    items: [
      { to: '/budget',       icon: TrendingUp,       label: 'Budget Forecast',      roles: ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
      { to: '/depreciation', icon: Landmark,         label: 'Depreciation Ledger',  roles: ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
    ]
  },
  {
    title: 'Reports',
    items: [
      { to: '/reports',      icon: BarChart3,        label: 'System Reports',       roles: ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
    ]
  },
  {
    title: 'Administration',
    items: [
      { to: '/users',       icon: UserCog,          label: 'User Accounts',        roles: ['ROLE_SUPER_ADMIN'] },
      { to: '/vendors',     icon: Building2,        label: 'Vendors Directory',    roles: ['ROLE_ADMIN', 'ROLE_SUPER_ADMIN'] },
      { to: '/audit-logs',  icon: History,          label: 'Audit History',        roles: ['ROLE_SUPER_ADMIN'] },
    ]
  },
  {
    title: 'Settings',
    items: [
      { to: '/settings',    icon: Settings,         label: 'System Settings' },
    ]
  }
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuthStore()
  const { lang, toggleLang } = useLanguageStore()
  const t = useTranslation(lang)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Mobile clock & font scaling support
  const [timeStr, setTimeStr] = useState('')
  const [fontScale, setFontScale] = useState(() => {
    const saved = localStorage.getItem('ams-font-scale')
    return saved ? parseFloat(saved) : 1.0
  })

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(now.toLocaleTimeString('en-US', { hour12: false }))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', fontScale)
    localStorage.setItem('ams-font-scale', fontScale)
  }, [fontScale])

  const changeFont = (action) => {
    if (action === 'dec' && fontScale > 0.8) setFontScale(prev => parseFloat((prev - 0.1).toFixed(1)))
    if (action === 'reset') setFontScale(1.0)
    if (action === 'inc' && fontScale < 1.3) setFontScale(prev => parseFloat((prev + 0.1).toFixed(1)))
  }

  // Collapsed state
  const [collapsedGroups, setCollapsedGroups] = useState({
    Operations: false,
    Assets: false,
    Maintenance: false,
    Inventory: false,
    Analytics: true,
    Reports: true,
    Administration: true,
    Settings: false
  })

  const toggleGroup = (title) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [title]: !prev[title]
    }))
  }

  const prefetchRouteData = (route) => {
    try {
      if (route === '/dashboard') {
        const fetchDashboard = () => {
          queryClient.prefetchQuery({ queryKey: ['dashboard', 'stats'], queryFn: () => dashboardApi.getStats().then(r => r.data.data) })
          queryClient.prefetchQuery({ queryKey: ['dashboard', 'category'], queryFn: () => dashboardApi.getCategoryChart().then(r => r.data.data) })
          queryClient.prefetchQuery({ queryKey: ['dashboard', 'status'], queryFn: () => dashboardApi.getStatusChart().then(r => r.data.data) })
          queryClient.prefetchQuery({ queryKey: ['dashboard', 'health'], queryFn: () => dashboardApi.getHealthChart().then(r => r.data.data) })
          queryClient.prefetchQuery({ queryKey: ['dashboard', 'department'], queryFn: () => dashboardApi.getDepartmentChart().then(r => r.data.data) })
        }
        fetchDashboard()
      } else if (route === '/assets') {
        queryClient.prefetchQuery({
          queryKey: ['assets', { page: 0, search: '', status: '' }],
          queryFn: () => assetApi.getAll({ page: 0, size: 20 }).then(r => r.data.data)
        })
      } else if (route === '/employees') {
        queryClient.prefetchQuery({
          queryKey: ['employees', { page: 0, search: '', department: '' }],
          queryFn: () => employeeApi.getAll({ page: 0, size: 20 }).then(r => r.data.data)
        })
      } else if (route === '/vendors') {
        queryClient.prefetchQuery({
          queryKey: ['vendors', { page: 0, search: '' }],
          queryFn: () => vendorApi.getAll({ page: 0, size: 20 }).then(r => r.data.data)
        })
      } else if (route === '/allocation') {
        queryClient.prefetchQuery({
          queryKey: ['allocations', { page: 0, search: '', status: '' }],
          queryFn: () => allocationApi.getAll({ page: 0, size: 20 }).then(r => r.data.data)
        })
      } else if (route === '/maintenance') {
        queryClient.prefetchQuery({
          queryKey: ['maintenance', { page: 0, search: '', status: '', priority: '' }],
          queryFn: () => maintenanceApi.getAll({ page: 0, size: 20 }).then(r => r.data.data)
        })
      } else if (route === '/depreciation') {
        queryClient.prefetchQuery({
          queryKey: ['depreciation', { page: 0, search: '' }],
          queryFn: () => depreciationApi.getRecords({ page: 0, size: 20 }).then(r => r.data.data)
        })
      }
    } catch (err) {
      console.warn('Prefetch failed for:', route, err)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = (u) => {
    const f = u?.firstName?.[0] || ''
    const l = u?.lastName?.[0] || ''
    return (f + l).toUpperCase() || 'U'
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`sidebar ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>

        {/* ── Brand Header ──────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-4 py-5 flex items-center gap-3"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.1)' }}>
          <div className="w-9 h-9 flex items-center justify-center flex-shrink-0">
            <img src={irLogo} alt="Indian Railways" className="w-full h-full object-contain rounded-full shadow-sm" />
          </div>
          <div className="min-w-0">
            <div className="sidebar-brand-sub font-extrabold text-[10px] uppercase tracking-wider leading-none">
              पूर्व तट रेलवे
            </div>
            <div className="sidebar-brand-title font-bold text-xs leading-tight truncate mt-1">
              East Coast Railway
            </div>
            <div className="sidebar-brand-portal text-[9px] font-bold uppercase tracking-wider mt-0.5">
              Asset Portal (ECoR-AMP)
            </div>
          </div>
        </div>

        {/* System Clock & Control Strip at the top for easy access on mobile */}
        <div className="md:hidden flex-shrink-0 p-3 mx-2 mb-2 space-y-2 rounded-lg bg-black/15 border border-white/5">
          <div className="flex items-center justify-between text-[9px] font-bold tracking-wider text-slate-450 uppercase">
            <span>System NOC Clock</span>
            <span className="font-mono text-[9px] text-white/90 bg-black/35 px-2 py-0.5 rounded border border-white/5">{timeStr}</span>
          </div>

          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center bg-white/5 rounded overflow-hidden border border-white/5 text-[9px] font-bold text-white">
              <button type="button" onClick={() => changeFont('dec')} className="px-2 py-0.5 hover:bg-white/10 transition-colors" title="Decrease Text Size">A-</button>
              <button type="button" onClick={() => changeFont('reset')} className="px-2 py-0.5 hover:bg-white/10 border-x border-white/5 transition-colors" title="Normal Text Size">A</button>
              <button type="button" onClick={() => changeFont('inc')} className="px-2 py-0.5 hover:bg-white/10 transition-colors" title="Increase Text Size">A+</button>
            </div>
            <button 
              type="button"
              onClick={toggleLang} 
              className="px-2 py-0.5 bg-white/5 rounded border border-white/5 hover:bg-white/10 text-[9px] font-bold text-white transition-colors"
            >
              {lang === 'EN' ? 'हिन्दी' : 'English'}
            </button>
          </div>
        </div>

        {/* ── Collapsible Navigation List ───────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-1">
          {navigationGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter(
              item => !item.roles || item.roles.some(role => user?.roles?.includes(role))
            )
            if (visibleItems.length === 0) return null
            const isCollapsed = collapsedGroups[group.title]

            return (
              <div key={groupIdx} className="px-1">
                {/* Header Toggle */}
                <div 
                  onClick={() => toggleGroup(group.title)}
                  className="sidebar-group-header flex items-center justify-between px-4 py-2 cursor-pointer select-none hover:bg-white/5 rounded transition-all duration-75"
                >
                  <span>{t(group.title)}</span>
                  <ChevronDown 
                    size={10} 
                    style={{ transition: 'transform 0.15s' }}
                    className={`sidebar-group-chevron ${isCollapsed ? '-rotate-90' : ''}`} 
                  />
                </div>

                {/* Sub Menu Links */}
                {!isCollapsed && (
                  <div className="mt-0.5 space-y-0.5 animate-fade-in pl-1">
                    {visibleItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={onClose}
                        onMouseEnter={() => prefetchRouteData(item.to)}
                        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                      >
                        <item.icon size={13} className="flex-shrink-0" />
                        <span className="text-[11px] truncate tracking-wide">{t(item.label)}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>



        {/* ── User Profile + Logout ─────────────────────────────────────────── */}
        <div className="flex-shrink-0 p-3"
             style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2.5 px-3 py-2 rounded"
               style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                 style={{ background: 'var(--railway-crimson)' }}>
               {initials(user)}
            </div>
            <div className="flex-1 min-w-0 font-sans text-left">
              <div className="sidebar-user-name text-[11px] font-bold truncate leading-none">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="sidebar-user-role text-[9px] font-semibold uppercase truncate mt-1">
                {user?.roles?.[0]?.replace('ROLE_', '')?.replace('_', ' ') || 'User'}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              title="Logout"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>

      </aside>
    </>
  )
}
