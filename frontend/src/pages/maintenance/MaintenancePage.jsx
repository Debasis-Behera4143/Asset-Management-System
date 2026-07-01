import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Eye, Edit, Trash2, X, RefreshCw, Filter } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend
} from 'recharts'
import { maintenanceApi, assetApi } from '../../api/index'
import { formatDate, getErrorMessage } from '../../utils/formatters'
import { useToast } from '../../hooks/useToast'
import { useDebounce } from '../../hooks/useDebounce'
import useAuthStore from '../../store/authStore'

const MAINTENANCE_TYPES = ['Hardware Issue', 'Software Issue', 'Network Issue', 'Cleaning', 'Toner Replacement', 'System Update', 'Battery Replacement', 'Other']
const STATUS_OPTIONS    = ['OPEN', 'IN_PROGRESS', 'PENDING_PARTS', 'COMPLETED', 'CANCELLED', 'PENDING', 'ONGOING']

function statusClass(s) {
  const m = { 
    COMPLETED: 'badge-success', 
    ONGOING: 'badge-warning', 
    IN_PROGRESS: 'badge-warning', 
    PENDING: 'badge-info', 
    OPEN: 'badge-info', 
    PENDING_PARTS: 'badge-warning',
    CANCELLED: 'badge-danger' 
  }
  return m[s] || 'badge-gray'
}

// ── Add/Edit Modal ─────────────────────────────────────────────────────────────
function MaintenanceModal({ item, assets, onClose, onSave }) {
  const [form, setForm] = useState(item || {
    assetId: '', maintenanceType: '', description: '', startDate: '', nextDueDate: '', status: 'PENDING', cost: '', technician: ''
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-lg">
        <div className="px-6 py-4 border-b flex items-center justify-between"
             style={{ borderColor: 'rgb(var(--border-color))' }}>
          <h2 className="text-sm font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
            {item ? 'Edit Maintenance' : 'Add Maintenance'}
          </h2>
          <button onClick={onClose} className="btn-icon"><X size={16} style={{ color: 'rgb(var(--text-muted))' }} /></button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Asset */}
          <div className="col-span-2">
            <label className="form-label">Asset <span className="text-red-500">*</span></label>
            <select value={form.assetId} onChange={e => set('assetId', e.target.value)} className="input text-sm">
              <option value="">Select Asset</option>
              {(assets || []).map(a => <option key={a.id} value={a.id}>{a.name} — {a.assetTag || `#${a.id}`}</option>)}
            </select>
          </div>
          {/* Type */}
          <div>
            <label className="form-label">Maintenance Type</label>
            <select value={form.maintenanceType} onChange={e => set('maintenanceType', e.target.value)} className="input text-sm">
              <option value="">Select type</option>
              {MAINTENANCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {/* Status */}
          <div>
            <label className="form-label">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="input text-sm">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Start Date */}
          <div>
            <label className="form-label">Start Date</label>
            <input type="date" value={form.startDate || ''} onChange={e => set('startDate', e.target.value)} className="input text-sm" />
          </div>
          {/* Next Due Date */}
          <div>
            <label className="form-label">Next Due Date</label>
            <input type="date" value={form.nextDueDate || ''} onChange={e => set('nextDueDate', e.target.value)} className="input text-sm" />
          </div>
          {/* Technician */}
          <div>
            <label className="form-label">Technician</label>
            <input type="text" value={form.technician || ''} onChange={e => set('technician', e.target.value)} placeholder="Technician name" className="input text-sm" />
          </div>
          {/* Cost */}
          <div>
            <label className="form-label">Cost (₹)</label>
            <input type="number" value={form.cost || ''} onChange={e => set('cost', e.target.value)} placeholder="0.00" className="input text-sm" />
          </div>
          {/* Description */}
          <div className="col-span-2">
            <label className="form-label">Description</label>
            <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} placeholder="Describe the issue..." className="input text-sm resize-none" />
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button onClick={() => onSave(form)} className="btn-primary btn-sm">
            {item ? 'Save Changes' : 'Add Maintenance'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Custom Tooltip for Recharts
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
              {p.name.toLowerCase().includes('cost') ? `₹${Number(p.value).toLocaleString()}` : p.value}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function MaintenancePage() {
  const { isAdmin } = useAuthStore()
  const qc = useQueryClient()
  const { success, error } = useToast()

  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const debouncedSearch       = useDebounce(search, 400)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['maintenance', { page, search: debouncedSearch, status: statusFilter }],
    queryFn: () => maintenanceApi.getAll({
      page, size: 20,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
    }).then(r => r.data.data),
    keepPreviousData: true,
  })

  const { data: assetsData } = useQuery({
    queryKey: ['assets', 'simple'],
    queryFn: () => assetApi.getAll({ size: 200 }).then(r => r.data.data?.content || []),
  })

  const createMutation = useMutation({
    mutationFn: maintenanceApi.create,
    onSuccess: () => { success('Maintenance record added!'); qc.invalidateQueries(['maintenance']); setShowModal(false) },
    onError: e => error(getErrorMessage(e)),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => maintenanceApi.update(id, data),
    onSuccess: () => { success('Updated!'); qc.invalidateQueries(['maintenance']); setEditing(null); setShowModal(false) },
    onError: e => error(getErrorMessage(e)),
  })

  const deleteMutation = useMutation({
    mutationFn: maintenanceApi.delete,
    onSuccess: () => { success('Deleted'); qc.invalidateQueries(['maintenance']) },
    onError: e => error(getErrorMessage(e)),
  })

  const handleSave = (form) => {
    if (editing) updateMutation.mutate({ id: editing.id, data: form })
    else createMutation.mutate(form)
  }

  const records    = data?.content || []
  const totalPages = data?.totalPages || 0
  const totalEl    = data?.totalElements || 0

  // Cost by Type aggregation
  const costByType = records.reduce((acc, r) => {
    const type = r.maintenanceType || 'Other'
    const cost = parseFloat(r.cost || 0)
    if (!acc[type]) acc[type] = { name: type, cost: 0 }
    acc[type].cost += cost
    return acc
  }, {})
  const costChartData = Object.values(costByType).filter(item => item.cost > 0)

  // Status aggregation
  const statusCounts = records.reduce((acc, r) => {
    const status = r.status || 'PENDING'
    if (!acc[status]) acc[status] = { name: status, value: 0 }
    acc[status].value += 1
    return acc
  }, {})
  const statusChartData = Object.values(statusCounts)

  const STATUS_COLORS = {
    // Real database / constant statuses
    OPEN: '#3b82f6',          // Bright blue
    IN_PROGRESS: '#f59e0b',   // Amber
    PENDING_PARTS: '#d97706', // Orange
    COMPLETED: '#10b981',     // Green
    CANCELLED: '#ef4444',     // Red

    // Legacy mock statuses
    PENDING: '#3b82f6',
    ONGOING: '#f59e0b'
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance</h1>
          <nav className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
            Dashboard &rsaquo; <span style={{ color: 'var(--ams-blue-mid)' }}>Maintenance</span>
          </nav>
        </div>
        {isAdmin && isAdmin() && (
          <button onClick={() => { setEditing(null); setShowModal(true) }} className="btn-primary btn-sm flex items-center gap-1.5">
            <Plus size={14} /> Add Maintenance
          </button>
        )}
      </div>

      {/* Visual Analytics & Maintenance Cost Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 text-[13px]">
        {/* Left: Cost analysis by type */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'rgb(var(--border-color))' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--text-primary))' }}>
              Maintenance Cost by Type (₹)
            </h3>
            <span className="text-[10px] text-slate-450 font-mono">BAR CHART</span>
          </div>
          {costChartData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="rgb(var(--text-muted))" fontSize={11} tickLine={false} />
                  <YAxis stroke="rgb(var(--text-muted))" fontSize={11} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cost" fill="var(--ams-blue-mid)" radius={[4, 4, 0, 0]} name="Repair Cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-slate-500 text-xs">
              No maintenance cost records to visualize
            </div>
          )}
        </div>

        {/* Right: Request distribution by status */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'rgb(var(--border-color))' }}>
            <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgb(var(--text-primary))' }}>
              Request Status Distribution
            </h3>
            <span className="text-[10px] text-slate-450 font-mono">PIE CHART</span>
          </div>
          {statusChartData.length > 0 ? (
            <div className="h-56 flex items-center justify-center relative">
              <div className="w-1/2 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {statusChartData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={STATUS_COLORS[entry.name] || '#64748b'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-2 text-xs">
                {statusChartData.map((entry, idx) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[entry.name] || '#64748b' }} />
                    <span className="font-medium text-slate-300">{entry.name}</span>
                    <span className="font-mono text-slate-400">({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-slate-500 text-xs">
              No tickets to visualize
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1" style={{ minWidth: '220px' }}>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'rgb(var(--text-muted))' }} />
            <input type="text" placeholder="Search maintenance records..."
                   value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
                   className="search-input" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
                  className="input text-sm h-[38px]" style={{ width: 'auto', minWidth: '130px' }}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => refetch()} className="btn-secondary btn-sm">
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b flex items-center justify-between"
             style={{ borderColor: 'rgb(var(--border-color))' }}>
          <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Maintenance Records
            <span className="ml-2 text-xs font-normal" style={{ color: 'rgb(var(--text-muted))' }}>({totalEl})</span>
          </p>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
          </div>
        ) : (
          <>
            <div className="hidden md:block table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Maint. ID</th>
                    <th>Asset ID</th>
                    <th>Asset Name</th>
                    <th>Maintenance Type</th>
                    <th>Started Date</th>
                    <th>Next Due Date</th>
                    <th>Status</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12" style={{ color: 'rgb(var(--text-muted))' }}>
                        No maintenance records found.
                      </td>
                    </tr>
                  ) : records.map(r => (
                    <tr key={r.id}>
                      <td><span className="table-asset-tag">M#{r.id}</span></td>
                      <td><span className="table-asset-tag">#{r.assetId}</span></td>
                      <td>
                        <div className="font-medium text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
                          {r.assetName || '—'}
                        </div>
                      </td>
                      <td className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {r.maintenanceType || '—'}
                      </td>
                      <td className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {formatDate(r.startDate) || '—'}
                      </td>
                      <td className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {formatDate(r.nextDueDate) || '—'}
                      </td>
                      <td>
                        <span className={`badge ${statusClass(r.status)}`}>
                          {r.status || '—'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1.5">
                          <button className="btn-icon-view" title="View"><Eye size={14} /></button>
                          {isAdmin && isAdmin() && (
                            <>
                              <button onClick={() => { setEditing(r); setShowModal(true) }}
                                      className="btn-icon-edit" title="Edit"><Edit size={14} /></button>
                              <button onClick={() => window.confirm('Delete?') && deleteMutation.mutate(r.id)}
                                      className="btn-icon-delete" title="Delete"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View Card List */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
              {records.length === 0 ? (
                <div className="text-center py-12 px-4 flex flex-col items-center gap-2">
                  <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
                    No maintenance records found.
                  </p>
                </div>
              ) : (
                records.map(r => (
                  <div key={r.id} className="p-4 space-y-3 text-left">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-red-700 dark:text-red-400">M#{r.id}</span>
                        <h4 className="text-sm font-bold mt-1" style={{ color: 'rgb(var(--text-primary))' }}>
                          {r.assetName || '—'}
                        </h4>
                        <p className="text-xs mt-0.5 font-semibold text-slate-500">
                          Type: {r.maintenanceType || '—'} • Asset: #{r.assetId}
                        </p>
                      </div>
                      <span className={`badge ${statusClass(r.status)} text-[10px] px-2 py-0.5 rounded font-bold`}>
                        {r.status || '—'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500">
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400">Started Date</span>
                        <span className="text-slate-700 dark:text-slate-200">{formatDate(r.startDate) || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400">Next Due Date</span>
                        <span className="text-slate-700 dark:text-slate-200">{formatDate(r.nextDueDate) || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400">Technician</span>
                        <span className="text-slate-700 dark:text-slate-200">{r.technician || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400">Cost</span>
                        <span className="text-slate-700 dark:text-slate-200">{r.cost ? `₹${r.cost}` : '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100/60 dark:border-slate-800/40">
                      <button className="btn-secondary btn-sm py-1.5 px-3 flex items-center gap-1">
                        <Eye size={12} /> View
                      </button>
                      {isAdmin && isAdmin() && (
                        <>
                          <button onClick={() => { setEditing(r); setShowModal(true) }} className="btn-secondary btn-sm py-1.5 px-3 flex items-center gap-1">
                            <Edit size={12} /> Edit
                          </button>
                          <button onClick={() => window.confirm('Delete?') && deleteMutation.mutate(r.id)} className="btn-secondary btn-sm py-1.5 px-3 flex items-center gap-1 text-red-700 dark:text-red-400">
                            <Trash2 size={12} /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t"
                   style={{ borderColor: 'rgb(var(--border-color))' }}>
                <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                  Page {page + 1} of {totalPages}
                </p>
                <div className="flex gap-1">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="pagination-btn disabled:opacity-40">
                    &lsaquo; Prev
                  </button>
                  <button disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)} className="pagination-btn disabled:opacity-40">
                    Next &rsaquo;
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showModal && (
        <MaintenanceModal
          item={editing}
          assets={assetsData}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
