import React, { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  Package, Users, Wrench, AlertTriangle, TrendingDown,
  Activity, Building2, Shield, RefreshCw, Clock, Plus,
  Scan, QrCode, ClipboardList, FileSpreadsheet, ArrowRight,
  TrendingUp, CheckCircle, ShieldAlert, FileText, Send, Terminal
} from 'lucide-react'
import { dashboardApi } from '../../api/index'
import useAuthStore from '../../store/authStore'
import useLanguageStore from '../../store/languageStore'
import { useTranslation } from '../../utils/translations'
import { formatCurrency, formatNumber } from '../../utils/formatters'

// ─── Custom Tooltip (Clean portal styling) ──────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="custom-recharts-tooltip">
      {label && <p className="tooltip-title">{label}</p>}
      {payload.map((p, i) => {
        const color = p.color || p.payload?.fill || p.fill || p.payload?.color
        return (
          <div key={i} className="tooltip-row">
            <span className="flex items-center gap-1.5">
              {color && (
                <span 
                  className="w-2 h-2 rounded-full inline-block" 
                  style={{ backgroundColor: color }}
                />
              )}
              <span className="tooltip-label">{p.name}:</span>
            </span>
            <span className="tooltip-value">
              {formatNumber(p.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Skeleton Card Loader ───────────────────────────────────────────────────
const SkeletonCard = ({ cols = 'col-span-1' }) => (
  <div className={`card p-5 space-y-3 ${cols} animate-pulse`}>
    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24" />
    <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-16" />
    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-36" />
  </div>
)

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { lang } = useLanguageStore()
  const t = useTranslation(lang)

  // ─── Query Hooks ───────────────────────────────────────────────────────────
  const { data: stats, isLoading: statsLoading, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats().then(r => r.data.data),
  })

  const { data: categoryChart } = useQuery({
    queryKey: ['dashboard', 'category'],
    queryFn: () => dashboardApi.getCategoryChart().then(r => r.data.data),
  })

  const { data: statusChart } = useQuery({
    queryKey: ['dashboard', 'status'],
    queryFn: () => dashboardApi.getStatusChart().then(r => r.data.data),
  })



  const { data: deptChart } = useQuery({
    queryKey: ['dashboard', 'department'],
    queryFn: () => dashboardApi.getDepartmentChart().then(r => r.data.data),
  })

  // Keyboard Shortcuts Listener [Alt + Key]
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault()
            navigate('/assets/new')
            break
          case 'i':
            e.preventDefault()
            navigate('/ocr-scanner')
            break
          case 'q':
            e.preventDefault()
            navigate('/qr-scanner')
            break
          case 'a':
            e.preventDefault()
            navigate('/allocation')
            break
          case 'm':
            e.preventDefault()
            navigate('/maintenance')
            break
          case 'r':
            e.preventDefault()
            navigate('/reports')
            break
          default:
            break
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  // Mock Critical Assets (Seeder linked data details)
  const criticalAssets = useMemo(() => [
    { name: 'Trimble GEDO CE (Track Inspection Device)', tag: 'AST-2026-000004', health: 28, status: 'UNDER_REPAIR', action: 'Recalibrate sensors & test log feed' },
    { name: 'Honeywell IP-Bullet 5MP (Railway CCTV)', tag: 'AST-2026-000009', health: 35, status: 'ASSIGNED', action: 'Inspect power adapters & replace lens' },
    { name: 'APC Smart-UPS 5kVA (UPS System)', tag: 'AST-2026-000005', health: 39, status: 'ASSIGNED', action: 'Replace battery cells immediately' }
  ], [])

  // Mock Recent Activity Timeline (colored status indicators, timestamps, designees)
  const activityTimeline = useMemo(() => [
    { type: 'invoice', text: 'Invoice uploaded & scanned via OCR', time: '14:22', user: 'Rajesh Sharma', dept: 'S&T Dept', status: 'success' },
    { type: 'alloc', text: 'Siemens Westrace II Signal Controller allocated', time: '11:45', user: 'Suresh Verma', dept: 'Operating', status: 'info' },
    { type: 'maint', text: 'Point Machine calibration maintenance completed', time: '09:15', user: 'Amit Kumar', dept: 'Electrical', status: 'success' },
    { type: 'warranty', text: 'Substation Transformer warranty alert flagged', time: 'Yesterday', user: 'Priya Patel', dept: 'Safety', status: 'warning' },
    { type: 'transfer', text: 'Platform Display Board transferred to Puri Station', time: 'Yesterday', user: 'Neha Singh', dept: 'Commercial', status: 'info' },
    { type: 'qr', text: 'New asset tags and QR codes generated', time: '2 days ago', user: 'Rajesh Sharma', dept: 'S&T Dept', status: 'success' }
  ], [])

  const primaryColors = ['#8B0000', '#1E3A8A', '#0d9488', '#d97706', '#2563eb', '#7c3aed']

  return (
    <div className="space-y-6 animate-fade-in text-left">

      {/* ── Page Title / Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'rgb(var(--border-color))' }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="w-1 h-5 rounded-sm" style={{ background: 'var(--railway-crimson)' }} />
            <h1 className="text-base font-bold uppercase tracking-wider text-slate-800 dark:text-white">
              Welcome, {user?.firstName}!
            </h1>
          </div>
          <p className="text-xs font-semibold text-slate-550 dark:text-slate-400 pl-3">
            ECoR Divisional Asset Management System &bull; Zonal Control Command Portal
          </p>
        </div>

        <button onClick={() => refetch()} className="btn-secondary btn-sm flex items-center gap-1.5 shadow-sm">
          <RefreshCw size={11} className={isFetching ? 'animate-spin' : ''} />
          <span>Refresh Control Feed</span>
        </button>
      </div>

      {/* ── Visual Hierarchy Stats Grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statsLoading ? (
          <>
            <SkeletonCard cols="md:col-span-2 xl:col-span-3" />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : stats ? (
          <>
            {/* Primary Large Card */}
            <div className="card p-5 md:col-span-2 xl:col-span-3 flex flex-col justify-between min-h-[130px] border-l-4 border-l-[#7c0a0a] transition-all hover:translate-y-[-2px] duration-200">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest block text-slate-500 dark:text-slate-400">Total Registered Assets</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-3xl font-black font-mono text-slate-900 dark:text-white">
                    {formatNumber(stats.totalAssets)}
                  </span>
                  <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400">Active Units</span>
                </div>
              </div>
              <p className="text-[10px] mt-2 font-semibold text-slate-400">
                Registered assets across East Coast Railway depots, workshops, and divisions.
              </p>
            </div>

            {/* Smaller Secondary Cards */}
            <div className="card p-4 flex flex-col justify-between min-h-[130px] transition-all hover:translate-y-[-2px] duration-200">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest block text-slate-400">Available</span>
                <span className="text-2xl font-black font-mono text-emerald-500 block mt-2">
                  {formatNumber(stats.availableAssets)}
                </span>
              </div>
              <span className="text-[9px] font-bold uppercase text-slate-500">Ready for Deployment</span>
            </div>

            <div className="card p-4 flex flex-col justify-between min-h-[130px] transition-all hover:translate-y-[-2px] duration-200">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest block text-slate-400">Assigned</span>
                <span className="text-2xl font-black font-mono text-blue-400 block mt-2">
                  {formatNumber(stats.assignedAssets)}
                </span>
              </div>
              <span className="text-[9px] font-bold uppercase text-slate-500">In Active Service</span>
            </div>

            <div className="card p-4 flex flex-col justify-between min-h-[130px] transition-all hover:translate-y-[-2px] duration-200">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest block text-slate-500 dark:text-slate-400">Under Repair</span>
                <span className="text-2xl font-black font-mono text-amber-500 block mt-2">
                  {formatNumber(stats.underRepair)}
                </span>
              </div>
              <span className="text-[9px] font-bold uppercase text-slate-600 dark:text-slate-400">Workshop Queue</span>
            </div>
          </>
        ) : null}
      </div>

      {/* ── Financial Ledger Row ────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 border-l-4 border-l-blue-900 transition-all hover:translate-y-[-2px] duration-200">
            <span className="text-[9px] font-bold uppercase tracking-wider block text-slate-500 dark:text-slate-400">Zonal Purchase Value</span>
            <span className="text-xl font-black font-mono mt-1 block text-slate-900 dark:text-white">
              {formatCurrency(stats.totalPurchaseValue)}
            </span>
          </div>

          <div className="card p-4 border-l-4 border-l-emerald-600 transition-all hover:translate-y-[-2px] duration-200">
            <span className="text-[9px] font-bold uppercase tracking-wider block text-slate-500 dark:text-slate-400">Current Book Value</span>
            <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 block">
              {formatCurrency(stats.totalCurrentValue)}
            </span>
          </div>

          <div className="card p-4 border-l-4 border-l-amber-600 transition-all hover:translate-y-[-2px] duration-200">
            <span className="text-[9px] font-bold uppercase tracking-wider block text-slate-500 dark:text-slate-400">Total Depreciation</span>
            <span className="text-xl font-black font-mono text-amber-600 dark:text-amber-500 mt-1 block">
              {formatCurrency(stats.totalDepreciation)}
            </span>
          </div>
        </div>
      )}

      {/* ── Executive Operations Center Section ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Critical Assets list (lg:col-span-7) */}
        <div className="card p-5 lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 dark:border-slate-800/80 select-none">
            <div className="flex items-center gap-2">
              <ShieldAlert size={14} className="text-rose-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Critical Assets & Risk Status
              </h3>
            </div>
            <span className="text-[8.5px] font-black uppercase tracking-widest text-rose-500 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
              Immediate Action Required
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-semibold">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/80 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40">
                  <th className="py-2.5 px-3">Asset & Tag</th>
                  <th className="py-2.5 px-3 text-center">Health</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Recommended action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                {criticalAssets.map((asset, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white leading-tight">{asset.name}</div>
                      <div className="text-[9.5px] font-mono text-slate-500 mt-0.5">{asset.tag}</div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-[11px] font-bold text-rose-455 font-mono">{asset.health}%</span>
                      <div className="w-12 h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden mx-auto border border-slate-750">
                        <div className="h-full bg-rose-500" style={{ width: `${asset.health}%` }} />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                        asset.status === 'UNDER_REPAIR'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {asset.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">
                      {asset.action}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Today's Operations feed (lg:col-span-5) */}
        <div className="card p-5 lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-2.5 border-slate-200 dark:border-slate-800/80 select-none">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-blue-500 dark:text-blue-400 animate-pulse" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Today's Zonal Operations
              </h3>
            </div>
            <span className="text-[9px] font-mono text-slate-500">LIVE MONITOR</span>
          </div>

          {stats && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Assets Allocated', count: 3, desc: 'Assigned today', color: 'text-blue-400' },
                { label: 'Maintenance Due', count: stats.maintenanceDue || 9, desc: 'Requires scheduling', color: 'text-amber-500' },
                { label: 'Active Warranty Alerts', count: stats.warrantyExpiringIn30Days || 14, desc: 'Expires in 30 days', color: 'text-rose-500' },
                { label: 'Invoices Processed', count: 4, desc: 'OCR scans completed', color: 'text-emerald-500' },
              ].map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40 text-left">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">{item.label}</span>
                  <div className={`text-2xl font-black font-mono mt-1 ${item.color}`}>
                    {item.count}
                  </div>
                  <span className="text-[9.5px] font-semibold text-slate-600 dark:text-slate-505 mt-1 block leading-none">{item.desc}</span>
                </div>
              ))}
              
              <div className="col-span-2 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40 text-left flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Recent Asset Movement</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-200 mt-1 block">Platform Display Board moved to Puri Station</span>
                </div>
                <ArrowRight size={16} className="text-slate-500" />
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ── Quick Action Bar ────────────────────────────────────────────────── */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 border-b pb-1.5 border-slate-200 dark:border-slate-800/80">
          <Terminal size={13} className="text-blue-500 dark:text-blue-400" />
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-650 dark:text-slate-400">
            Operations Command Bar
          </h4>
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'New Asset', path: '/assets/new', shortcut: 'Alt+N', icon: Plus },
            { label: 'Scan Invoice', path: '/ocr-scanner', shortcut: 'Alt+I', icon: Scan },
            { label: 'Generate QR', path: '/qr-scanner', shortcut: 'Alt+Q', icon: QrCode },
            { label: 'Allocate Asset', path: '/allocation', shortcut: 'Alt+A', icon: ClipboardList },
            { label: 'Maintenance Log', path: '/maintenance', shortcut: 'Alt+M', icon: Wrench },
            { label: 'Generate Report', path: '/reports', shortcut: 'Alt+R', icon: FileSpreadsheet },
          ].map((btn, idx) => {
            const BtnIcon = btn.icon
            return (
              <button
                key={idx}
                onClick={() => navigate(btn.path)}
                className="px-4 py-2.5 rounded-lg border border-slate-250 dark:border-slate-800 bg-slate-105 dark:bg-slate-900/40 text-slate-800 dark:text-white font-bold text-xs uppercase tracking-wider transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-500/50 hover:bg-slate-200 dark:hover:bg-slate-900/80 active:translate-y-0 flex items-center gap-2 group shadow-sm"
              >
                <BtnIcon size={14} className="text-[#3b82f6] group-hover:scale-110 transition-transform" />
                <span>{btn.label}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 text-[9px] font-mono leading-none border border-slate-300 dark:border-slate-700/40 ml-1">
                  {btn.shortcut}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Recent Activity Feed Timeline ──────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 border-b pb-2.5 border-slate-200 dark:border-slate-800/80 select-none">
          <Clock size={14} className="text-[#7c0a0a]" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            Divisional Dispatch & Activity Timeline
          </h3>
        </div>

        <div className="relative border-l border-slate-200 dark:border-slate-800 ml-4 pl-6 space-y-5">
          {activityTimeline.map((item, idx) => (
            <div key={idx} className="relative group text-left">
              {/* Timeline dot */}
              <span className={`absolute -left-[30px] top-1.5 w-3 h-3 rounded-full border-2 ${
                item.status === 'success'
                  ? 'bg-emerald-500 border-emerald-950/80'
                  : item.status === 'warning'
                  ? 'bg-amber-500 border-amber-950/80'
                  : 'bg-blue-500 border-blue-950/80'
              } group-hover:scale-125 transition-transform`} />

              <div className={`p-3.5 rounded-xl border border-slate-200 dark:border-slate-800/40 bg-slate-50/30 dark:bg-slate-900/20 hover:border-slate-350 dark:hover:border-slate-700/60 transition-all duration-150 flex flex-col sm:flex-row justify-between sm:items-center gap-2`}>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-200">{item.text}</p>
                  <div className="flex flex-wrap gap-x-3 text-[10px] font-semibold text-slate-500">
                    <span>Officer: {item.user}</span>
                    <span>&bull;</span>
                    <span>Department: {item.dept}</span>
                  </div>
                </div>
                
                <span className="text-[10px] font-mono font-bold text-slate-450 px-2 py-0.5 rounded bg-slate-900/60 border border-slate-800 select-none self-start sm:self-center">
                  {item.time}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts Section ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Status Distribution */}
        <div className="card p-5">
          <div className="border-b pb-2.5 border-slate-100 dark:border-slate-800/80 mb-4 flex items-center justify-between select-none">
            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Asset Status Distribution
            </h4>
            <span className="text-[9px] font-mono text-slate-400">PIE MONITOR</span>
          </div>
          {statusChart ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusChart}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={72}
                  innerRadius={42}
                  paddingAngle={3}
                >
                  {statusChart.map((_, i) => (
                    <Cell key={i} fill={primaryColors[i % primaryColors.length]} />
                  ))}
                </Pie>
                <Tooltip cursor={false} content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 9, textTransform: 'uppercase', paddingTop: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500">Retrieving status chart...</div>
          )}
        </div>

        {/* Category Volume */}
        <div className="card p-5">
          <div className="border-b pb-2.5 border-slate-100 dark:border-slate-800/80 mb-4 flex items-center justify-between select-none">
            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Asset Category Volume
            </h4>
            <span className="text-[9px] font-mono text-slate-400">BAR CHART</span>
          </div>
          {categoryChart ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryChart} barSize={24} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(var(--text-muted)/0.15)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'rgb(var(--text-secondary))' }} stroke="rgba(var(--text-muted)/0.3)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'rgb(var(--text-secondary))' }} stroke="rgba(var(--text-muted)/0.3)" />
                <Tooltip cursor={false} content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 9, textTransform: 'uppercase', paddingTop: 10 }} />
                <Bar dataKey="value" name="Asset Count" radius={[2, 2, 0, 0]}>
                  {categoryChart.map((_, i) => (
                    <Cell key={i} fill={primaryColors[i % primaryColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500">Retrieving category chart...</div>
          )}
        </div>

        {/* Department Distribution */}
        <div className="card p-5 lg:col-span-2">
          <div className="border-b pb-2.5 border-slate-100 dark:border-slate-800/80 mb-4 flex items-center justify-between select-none">
            <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Department-wise Assets
            </h4>
            <span className="text-[9px] font-mono text-slate-400">DEPARTMENT BAR LIST</span>
          </div>
          {deptChart ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={deptChart} barSize={32} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(var(--text-muted)/0.15)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'rgb(var(--text-secondary))' }} stroke="rgba(var(--text-muted)/0.3)" angle={-25} textAnchor="end" interval={0} height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: 'rgb(var(--text-secondary))' }} stroke="rgba(var(--text-muted)/0.3)" />
                <Tooltip cursor={false} content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 9, textTransform: 'uppercase', paddingTop: 10 }} />
                <Bar dataKey="value" name="Assets Count" radius={[3, 3, 0, 0]}>
                  {deptChart.map((_, i) => (
                    <Cell key={i} fill={primaryColors[i % primaryColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-xs text-slate-500">Retrieving department chart...</div>
          )}
        </div>

      </div>

    </div>
  )
}
