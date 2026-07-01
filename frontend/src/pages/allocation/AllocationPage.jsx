import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Eye, RotateCcw, X, RefreshCw, Filter, User, Calendar, Tag, FileText } from 'lucide-react'
import { allocationApi, employeeApi, assetApi } from '../../api/index'
import { formatDate, getErrorMessage } from '../../utils/formatters'
import { useToast } from '../../hooks/useToast'
import { useDebounce } from '../../hooks/useDebounce'
import useAuthStore from '../../store/authStore'

const STATUS_OPTIONS = ['ACTIVE', 'RETURNED', 'TRANSFERRED', 'LOST']

function statusClass(s) {
  const m = {
    ACTIVE: 'badge-info',
    RETURNED: 'badge-success',
    TRANSFERRED: 'badge-warning',
    LOST: 'badge-danger',
  }
  return m[s] || 'badge-gray'
}

// ── Assign Asset Modal ───────────────────────────────────────────────────────
function AssignModal({ employees, assets, onClose, onSave }) {
  const [form, setForm] = useState({
    assetId: '',
    employeeId: '',
    allocatedDate: new Date().toISOString().split('T')[0],
    expectedReturn: '',
    purpose: '',
    notes: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box max-w-lg">
        <div className="px-6 py-4 border-b flex items-center justify-between"
             style={{ borderColor: 'rgb(var(--border-color))' }}>
          <h2 className="text-sm font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
            New Asset Assignment
          </h2>
          <button onClick={onClose} className="btn-icon">
            <X size={16} style={{ color: 'rgb(var(--text-muted))' }} />
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Asset Selection */}
          <div className="col-span-2">
            <label className="form-label">Select Asset <span className="text-red-500">*</span></label>
            <select
              value={form.assetId}
              onChange={e => set('assetId', e.target.value)}
              className="input text-sm"
            >
              <option value="">Select Asset</option>
              {(assets || [])
                .filter(a => a.status === 'AVAILABLE' || a.status === 'ACTIVE')
                .map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} — ID: #{a.id} {a.serialNumber ? `(${a.serialNumber})` : ''}
                  </option>
                ))}
            </select>
          </div>

          {/* Employee Selection */}
          <div className="col-span-2">
            <label className="form-label">Assign To Employee <span className="text-red-500">*</span></label>
            <select
              value={form.employeeId}
              onChange={e => set('employeeId', e.target.value)}
              className="input text-sm"
            >
              <option value="">Select Employee</option>
              {(employees || []).map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} — Code: {emp.employeeCode || emp.id}
                </option>
              ))}
            </select>
          </div>

          {/* Allocated Date */}
          <div>
            <label className="form-label">Allocation Date</label>
            <input
              type="date"
              value={form.allocatedDate}
              onChange={e => set('allocatedDate', e.target.value)}
              className="input text-sm"
            />
          </div>

          {/* Expected Return Date */}
          <div>
            <label className="form-label">Expected Return Date</label>
            <input
              type="date"
              value={form.expectedReturn}
              onChange={e => set('expectedReturn', e.target.value)}
              className="input text-sm"
            />
          </div>

          {/* Purpose */}
          <div className="col-span-2">
            <label className="form-label">Purpose</label>
            <input
              type="text"
              value={form.purpose}
              onChange={e => set('purpose', e.target.value)}
              placeholder="e.g., Remote working setup"
              className="input text-sm"
            />
          </div>

          {/* Notes */}
          <div className="col-span-2">
            <label className="form-label">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder="Any additional notes..."
              className="input text-sm resize-none"
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.assetId || !form.employeeId}
            className="btn-primary btn-sm"
          >
            Assign Asset
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AllocationPage() {
  const { isAdmin } = useAuthStore()
  const qc = useQueryClient()
  const { success, error } = useToast()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const debouncedSearch = useDebounce(search, 400)

  // Fetch Allocations
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['allocations', { page, search: debouncedSearch, status: statusFilter }],
    queryFn: () => allocationApi.getAll({
      page,
      size: 20,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
    }).then(r => r.data.data),
    keepPreviousData: true,
  })

  // Fetch Employees for assignment selection
  const { data: employeesData } = useQuery({
    queryKey: ['employees', 'simple'],
    queryFn: () => employeeApi.getAll({ size: 300 }).then(r => r.data.data?.content || []),
    enabled: showModal,
  })

  // Fetch Assets for assignment selection
  const { data: assetsData } = useQuery({
    queryKey: ['assets', 'simple'],
    queryFn: () => assetApi.getAll({ size: 500 }).then(r => r.data.data?.content || []),
    enabled: showModal,
  })

  const assignMutation = useMutation({
    mutationFn: allocationApi.assign,
    onSuccess: () => {
      success('Asset successfully assigned!')
      qc.invalidateQueries(['allocations'])
      setShowModal(false)
    },
    onError: e => error(getErrorMessage(e)),
  })

  const returnMutation = useMutation({
    mutationFn: ({ id, notes }) => allocationApi.return(id, notes),
    onSuccess: () => {
      success('Asset returned successfully!')
      qc.invalidateQueries(['allocations'])
    },
    onError: e => error(getErrorMessage(e)),
  })

  const handleAssign = (form) => {
    assignMutation.mutate(form)
  }

  const handleReturn = (id) => {
    const notes = window.prompt('Enter return notes/comments:')
    if (notes !== null) {
      returnMutation.mutate({ id, notes })
    }
  }

  const allocations = data?.content || []
  const totalPages = data?.totalPages || 0
  const totalEl = data?.totalElements || 0

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Asset Assignments</h1>
          <nav className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
            Dashboard &rsaquo; <span style={{ color: 'var(--ams-blue-mid)' }}>Assignments</span>
          </nav>
        </div>
        {isAdmin && isAdmin() && (
          <button onClick={() => setShowModal(true)} className="btn-primary btn-sm flex items-center gap-1.5">
            <Plus size={14} /> Assign Asset
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="card p-4 mb-5">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1" style={{ minWidth: '220px' }}>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ color: 'rgb(var(--text-muted))' }} />
            <input
              type="text"
              placeholder="Search assignments..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              className="search-input"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
            className="input text-sm h-[38px]"
            style={{ width: 'auto', minWidth: '135px' }}
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => refetch()} className="btn-secondary btn-sm">
            <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Grid/Table Card */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b flex items-center justify-between"
             style={{ borderColor: 'rgb(var(--border-color))' }}>
          <p className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
            Assignment List
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
                    <th>Allocation ID</th>
                    <th>Asset Name</th>
                    <th>Assigned To</th>
                    <th>Assigned Date</th>
                    <th>Expected Return</th>
                    <th>Status</th>
                    <th>Purpose</th>
                    <th className="text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12" style={{ color: 'rgb(var(--text-muted))' }}>
                        No asset assignments found.
                      </td>
                    </tr>
                  ) : allocations.map(row => (
                    <tr key={row.id}>
                      <td><span className="table-asset-tag">AL#{row.id}</span></td>
                      <td>
                        <div>
                          <div className="font-medium text-sm" style={{ color: 'rgb(var(--text-primary))' }}>
                            {row.assetName || `Asset #${row.assetId}`}
                          </div>
                          <div className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                            Tag: {row.assetTag || '—'}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                          <User size={12} className="text-blue-500" />
                          {row.employeeName || `Employee #${row.employeeId}`}
                        </div>
                      </td>
                      <td className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {formatDate(row.allocatedDate) || '—'}
                      </td>
                      <td className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>
                        {formatDate(row.expectedReturn) || '—'}
                      </td>
                      <td>
                        <span className={`badge ${statusClass(row.status)}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="text-sm max-w-xs truncate" style={{ color: 'rgb(var(--text-muted))' }} title={row.purpose}>
                        {row.purpose || '—'}
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1.5">
                          {row.status === 'ACTIVE' && isAdmin && isAdmin() && (
                            <button
                              onClick={() => handleReturn(row.id)}
                              className="btn-secondary btn-xs flex items-center gap-1"
                              title="Return Asset"
                              style={{ color: 'var(--ams-blue-mid)' }}
                            >
                              <RotateCcw size={12} /> Return
                            </button>
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
              {allocations.length === 0 ? (
                <div className="text-center py-12 px-4 flex flex-col items-center gap-2">
                  <p className="text-sm" style={{ color: 'rgb(var(--text-muted))' }}>
                    No asset assignments found.
                  </p>
                </div>
              ) : (
                allocations.map(row => (
                  <div key={row.id} className="p-4 space-y-3 text-left">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-red-700 dark:text-red-400">AL#{row.id}</span>
                        <h4 className="text-sm font-bold mt-1" style={{ color: 'rgb(var(--text-primary))' }}>
                          {row.assetName || `Asset #${row.assetId}`}
                        </h4>
                        <p className="text-xs mt-0.5 text-slate-500 font-semibold">
                          Tag: {row.assetTag || '—'}
                        </p>
                      </div>
                      <span className={`badge ${statusClass(row.status)} text-[10px] px-2 py-0.5 rounded font-bold`}>
                        {row.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500">
                      <div className="col-span-2">
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400">Assigned To</span>
                        <span className="text-slate-700 dark:text-slate-200 flex items-center gap-1">
                          <User size={11} className="text-blue-500" />
                          {row.employeeName || `Employee #${row.employeeId}`}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400">Assigned Date</span>
                        <span className="text-slate-700 dark:text-slate-200">{formatDate(row.allocatedDate) || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400">Expected Return</span>
                        <span className="text-slate-700 dark:text-slate-200">{formatDate(row.expectedReturn) || '—'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[9px] uppercase tracking-wider text-slate-400">Purpose</span>
                        <span className="text-slate-700 dark:text-slate-200">{row.purpose || '—'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100/60 dark:border-slate-800/40">
                      {row.status === 'ACTIVE' && isAdmin && isAdmin() && (
                        <button
                          onClick={() => handleReturn(row.id)}
                          className="btn-secondary btn-sm py-1.5 px-3 flex items-center gap-1 text-red-700 dark:text-red-400"
                        >
                          <RotateCcw size={12} /> Return
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
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
        <AssignModal
          employees={employeesData}
          assets={assetsData}
          onClose={() => setShowModal(false)}
          onSave={handleAssign}
        />
      )}
    </div>
  )
}
