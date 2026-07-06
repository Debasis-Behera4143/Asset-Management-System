import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Edit, Printer, QrCode, Package, Calendar, Tag, Building2, User, MapPin, DollarSign, Shield, Download, Mail, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { assetApi, warrantyApi } from '../../api/index'
import { formatDate, formatCurrency, getStatusClass, formatStatus } from '../../utils/formatters'
import useAuthStore from '../../store/authStore'
import { useToast } from '../../hooks/useToast'

const tabs = ['Assignment History', 'Maintenance History', 'Activity Log', 'Warranty Coverage']

const InfoRow = ({ label, value, mono }) => (
  <tr className="border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
    <td className="py-3 pr-4 text-sm font-medium w-40" style={{ color: 'rgb(var(--text-muted))' }}>
      {label}
    </td>
    <td className={`py-3 text-sm ${mono ? 'font-mono' : 'font-medium'}`}
        style={{ color: 'rgb(var(--text-primary))' }}>
      {value || '—'}
    </td>
  </tr>
)

export default function AssetDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuthStore()
  const { success: toastSuccess, error: toastError } = useToast()
  
  const [activeTab, setActiveTab] = useState(0)
  const [regenerating, setRegenerating] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [imageError, setImageError] = useState(false)

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetApi.getById(id).then(r => r.data.data || r.data),
    enabled: !!id,
  })

  const handleDownloadQr = () => {
    if (!asset) return
    const tag = asset.assetUniqueId || asset.assetTag
    const url = `${import.meta.env.VITE_API_BASE_URL || 'https://asset-management-system-2s9o.onrender.com/api'}/qr/${tag}`
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `QR_${tag}.png`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toastSuccess('QR Code download started.')
  }

  const handlePrintQr = () => {
    if (!asset) return
    const tag = asset.assetUniqueId || asset.assetTag
    const qrUrl = `${import.meta.env.VITE_API_BASE_URL || 'https://asset-management-system-2s9o.onrender.com/api'}/qr/${tag}`
    const printWindow = window.open('', '_blank', 'width=350,height=400')
    printWindow.document.write(`
      <html>
        <head>
          <title>Print QR Label</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              text-align: center;
              margin: 15px;
            }
            .label {
              border: 2px dashed #000;
              padding: 15px;
              border-radius: 8px;
              display: inline-block;
            }
            img {
              width: 180px;
              height: 180px;
            }
            h2 {
              font-size: 13px;
              margin: 8px 0 2px 0;
            }
            p {
              font-size: 10px;
              font-family: monospace;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <h2>${asset.name}</h2>
            <img src="${qrUrl}" />
            <p>ID: ${tag}</p>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handleRegenerateQr = async () => {
    try {
      setRegenerating(true)
      await assetApi.generateQr(asset.id)
      toastSuccess('QR Code regenerated and saved.')
      queryClient.invalidateQueries(['asset', id])
    } catch (e) {
      toastError('Failed to regenerate QR code: ' + getErrorMessage(e))
    } finally {
      setRegenerating(false)
    }
  }

  const handleEmailQr = async () => {
    try {
      setSendingEmail(true)
      await assetApi.generateQr(asset.id)
      toastSuccess('QR Code dispatched to administrator email.')
    } catch (e) {
      toastError('Failed to send QR code via email: ' + getErrorMessage(e))
    } finally {
      setSendingEmail(false)
    }
  }

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true)
      const res = await assetApi.downloadSingleAssetPdf(asset.assetUniqueId || asset.assetTag)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `AssetPassport_${asset.assetUniqueId || asset.assetTag}.pdf`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toastSuccess('Asset passport PDF download started.')
    } catch (e) {
      toastError('Failed to generate individual PDF: ' + getErrorMessage(e))
    } finally {
      setDownloadingPdf(false)
    }
  }

  function getErrorMessage(e) {
    return e.response?.data?.message || e.message || 'Error occurred.'
  }

  if (isLoading) {
    return (
      <div className="animate-fade-in space-y-4">
        <div className="skeleton h-10 w-48 rounded-lg" />
        <div className="card p-6 space-y-4">
          <div className="skeleton h-6 w-64 rounded" />
          <div className="skeleton h-4 w-96 rounded" />
          <div className="skeleton h-40 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !asset) {
    return (
      <div className="card p-8 text-center animate-fade-in">
        <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>Asset not found.</p>
        <button onClick={() => navigate(-1)} className="btn-secondary btn-sm mt-4">Go Back</button>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
                  className="btn-icon w-8 h-8 rounded-lg"
                  style={{ background: 'rgb(var(--bg-elevated))', color: 'rgb(var(--text-secondary))' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">Asset Details</h1>
            <nav className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
              Dashboard &rsaquo; <Link to="/assets" style={{ color: 'var(--ams-blue-mid)' }}>Assets</Link> &rsaquo; {asset.name}
            </nav>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleDownloadPdf} 
            disabled={downloadingPdf} 
            className="btn-secondary btn-sm"
          >
            <Download size={14} /> {downloadingPdf ? 'Exporting...' : 'Download PDF Passport'}
          </button>
          {isAdmin && isAdmin() && (
            <Link to={`/assets/${id}/edit`} className="btn-primary btn-sm">
              <Edit size={14} /> Edit Asset
            </Link>
          )}
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Asset identity card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="card p-6 text-center">
            {/* Asset image */}
            <div className="w-32 h-32 rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden border"
                 style={{ borderColor: 'rgb(var(--border-color))', background: 'var(--ams-blue-pale)' }}>
              {asset.imageUrl && !imageError ? (
                <img
                  src={asset.imageUrl.startsWith('http') ? asset.imageUrl : `${(import.meta.env.VITE_API_BASE_URL || 'https://asset-management-system-2s9o.onrender.com/api').endsWith('/api') ? (import.meta.env.VITE_API_BASE_URL || 'https://asset-management-system-2s9o.onrender.com/api').slice(0, -4) : (import.meta.env.VITE_API_BASE_URL || 'https://asset-management-system-2s9o.onrender.com/api')}/${asset.imageUrl}`}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <Package size={52} style={{ color: 'var(--ams-blue-mid)' }} />
              )}
            </div>
            <h2 className="text-base font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
              {asset.name}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
              {asset.brand} {asset.model}
            </p>

            {/* ID + Status row */}
            <div className="flex items-center justify-center gap-3 mt-3">
              <span className="table-asset-tag">
                ID: #{asset.id || asset.assetTag}
              </span>
              <span className={`badge ${getStatusClass(asset.status)}`}>
                {formatStatus(asset.status)}
              </span>
            </div>

            {/* Quick info pills */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-left">
              {[
                { icon: Tag,       label: 'Category',   val: asset.categoryName },
                { icon: Building2, label: 'Department',  val: asset.departmentName },
                { icon: User,      label: 'Assigned To', val: asset.assignedToName },
                { icon: MapPin,    label: 'Location',    val: asset.location },
              ].map(({ icon: Icon, label, val }) => (
                <div key={label} className="p-2.5 rounded-lg text-center"
                     style={{ background: 'rgb(var(--bg-elevated))' }}>
                  <Icon size={14} className="mx-auto mb-1" style={{ color: 'var(--ams-blue-mid)' }} />
                  <p className="text-xs font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                    {val || '—'}
                  </p>
                  <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Financial card */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
              Financial Info
            </h3>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'rgb(var(--text-muted))' }}>Purchase Price</span>
              <span className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                {formatCurrency(asset.purchaseCost)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'rgb(var(--text-muted))' }}>Purchase Date</span>
              <span style={{ color: 'rgb(var(--text-primary))' }}>
                {formatDate(asset.purchaseDate) || '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'rgb(var(--text-muted))' }}>Warranty Expiry</span>
              <span style={{ color: 'rgb(var(--text-primary))' }}>
                {formatDate(asset.warrantyExpiry) || '—'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: 'rgb(var(--text-muted))' }}>Vendor</span>
              <span style={{ color: 'rgb(var(--text-primary))' }}>
                {asset.vendorName || '—'}
              </span>
            </div>
          </div>

          {/* QR Code Management Card */}
          <div className="card p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'rgb(var(--text-primary))' }}>
              <QrCode size={16} style={{ color: 'var(--ams-blue-mid)' }} /> Asset QR Code
            </h3>
            
            <div className="bg-slate-950/60 border rounded-xl p-4 flex flex-col items-center justify-center gap-3" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <img 
                src={`${import.meta.env.VITE_API_BASE_URL || 'https://asset-management-system-2s9o.onrender.com/api'}/qr/${asset.assetUniqueId || asset.assetTag}`} 
                alt="Asset QR Code" 
                className="w-40 h-40 rounded-lg border bg-white p-1" 
                style={{ borderColor: 'rgb(var(--border-color))' }}
              />
              <p className="text-xs font-mono select-all animate-pulse" style={{ color: 'rgb(var(--text-muted))' }}>
                {asset.assetUniqueId || asset.assetTag}
              </p>
            </div>

            {isAdmin && isAdmin() ? (
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={handleDownloadQr} 
                  className="btn-secondary btn-sm justify-center gap-1.5"
                >
                  <Download size={13} /> Download
                </button>
                <button 
                  onClick={handlePrintQr} 
                  className="btn-secondary btn-sm justify-center gap-1.5"
                >
                  <Printer size={13} /> Print Label
                </button>
                <button 
                  onClick={handleRegenerateQr} 
                  disabled={regenerating}
                  className="btn-secondary btn-sm justify-center gap-1.5 col-span-2"
                >
                  <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
                  {regenerating ? 'Regenerating...' : 'Regenerate QR'}
                </button>
                <button 
                  onClick={handleEmailQr} 
                  disabled={sendingEmail}
                  className="btn-secondary btn-sm justify-center gap-1.5 col-span-2"
                >
                  <Mail size={13} />
                  {sendingEmail ? 'Sending...' : 'Email QR to Admin'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-center" style={{ color: 'rgb(var(--text-muted))' }}>
                QR code controls restricted to administrators.
              </p>
            )}
          </div>
        </div>

        {/* Right: Details + Tabs */}
        <div className="lg:col-span-2 space-y-4">

          {/* Specs Table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                Asset Specifications
              </h3>
            </div>
            <div className="px-5 py-2">
              <table className="w-full">
                <tbody>
                  <InfoRow label="Asset Name"    value={asset.name} />
                  <InfoRow label="Category"      value={asset.categoryName} />
                  <InfoRow label="Serial Number" value={asset.serialNumber} mono />
                  <InfoRow label="Model"         value={asset.model} />
                  <InfoRow label="Brand"         value={asset.brand} />
                  <InfoRow label="Location"      value={asset.location} />
                  <InfoRow label="Department"    value={asset.departmentName} />
                  <InfoRow label="Description"   value={asset.description} />
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabs */}
          <div className="card overflow-hidden">
            <div className="tab-bar px-4">
              {tabs.map((t, i) => (
                <button key={t} onClick={() => setActiveTab(i)}
                        className={`tab-btn ${activeTab === i ? 'active' : ''}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="p-5">
              {activeTab === 0 && (
                <AssignmentHistory assetId={id} />
              )}
              {activeTab === 1 && (
                <MaintenanceHistory assetId={id} />
              )}
              {activeTab === 2 && (
                <ActivityLog assetId={id} />
              )}
              {activeTab === 3 && (
                <WarrantyCoverage assetId={id} purchaseDate={asset?.purchaseDate} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-tab components ─────────────────────────────────────────────────────────
function AssignmentHistory({ assetId }) {
  // In a real app, fetch from allocations API
  const rows = [
    { to: 'John Doe',  assignedDate: '10-02-2021', returnDate: '15-01-2026', status: 'Current' },
    { to: 'Mike Johnson', assignedDate: '14-01-2021', returnDate: '10-02-2021', status: 'Returned' },
  ]
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Assigned To</th>
            <th>Assigned Date</th>
            <th>Return Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="font-medium text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{r.to}</td>
              <td className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{r.assignedDate}</td>
              <td className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{r.returnDate}</td>
              <td>
                <span className={`badge ${r.status === 'Current' ? 'badge-info' : 'badge-success'}`}>
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MaintenanceHistory({ assetId }) {
  const rows = [
    { type: 'Network Issue', date: '10-05-2024', next: '10-11-2024', status: 'Completed' },
    { type: 'IT Segment',    date: '20-04-2024', next: '20-10-2024', status: 'Completed' },
  ]
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Date</th>
            <th>Next Due</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="font-medium text-sm" style={{ color: 'rgb(var(--text-primary))' }}>{r.type}</td>
              <td className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{r.date}</td>
              <td className="text-sm" style={{ color: 'rgb(var(--text-secondary))' }}>{r.next}</td>
              <td>
                <span className="badge badge-success">{r.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActivityLog({ assetId }) {
  const logs = [
    { action: 'Asset Created',   user: 'Admin',     date: '01-01-2021 09:00' },
    { action: 'Assigned to John', user: 'Admin',    date: '10-02-2021 11:30' },
    { action: 'Maintenance Added', user: 'IT Staff', date: '10-05-2024 14:00' },
  ]
  return (
    <div className="space-y-3">
      {logs.map((l, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
               style={{ background: 'var(--ams-blue-mid)' }} />
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>{l.action}</p>
            <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
              by {l.user} · {l.date}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function WarrantyCoverage({ assetId, purchaseDate }) {
  const { isAdmin } = useAuthStore()
  const queryClient = useQueryClient()
  const { success, error } = useToast()

  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState({
    contractNumber: '',
    warrantyType: 'MANUFACTURER',
    providerName: '',
    startDate: '',
    expiryDate: '',
    notes: ''
  })

  const { data: warranty, isLoading, refetch } = useQuery({
    queryKey: ['asset-warranty', assetId],
    queryFn: () => warrantyApi.getByAsset(assetId)
      .then(r => r.data?.data || r.data)
      .catch(err => {
        if (err.response?.status === 404) return null
        throw err
      }),
    onSuccess: (data) => {
      if (data) {
        setForm({
          contractNumber: data.contractNumber || '',
          warrantyType: data.warrantyType || 'MANUFACTURER',
          providerName: data.providerName || '',
          startDate: data.startDate || '',
          expiryDate: data.expiryDate || '',
          notes: data.notes || ''
        })
      }
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data) => warrantyApi.update(assetId, data),
    onSuccess: () => {
      success('Warranty updated successfully!')
      queryClient.invalidateQueries(['asset-warranty', assetId])
      queryClient.invalidateQueries(['asset', assetId])
      setIsEditing(false)
      refetch()
    },
    onError: (err) => {
      error(err.response?.data?.message || err.message || 'Failed to update warranty')
    }
  })

  const handleSave = (e) => {
    e.preventDefault()
    if (form.startDate && form.expiryDate) {
      if (new Date(form.expiryDate) < new Date(form.startDate)) {
        error("Warranty expiry date cannot be before the start date.");
        return;
      }
    }
    if (form.startDate && purchaseDate) {
      if (new Date(form.startDate) < new Date(purchaseDate)) {
        error(`Warranty start date cannot be before the asset's purchase date (${formatDate(purchaseDate)}).`);
        return;
      }
    }
    updateMutation.mutate(form)
  }

  const setVal = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (isLoading) {
    return <div className="skeleton h-24 rounded" />
  }

  function getWarrantyStatus(expiryDate) {
    if (!expiryDate) return { label: 'No Expiry', badge: 'badge-gray', icon: ShieldAlert }
    const exp = new Date(expiryDate)
    const now = new Date()
    if (exp < now) {
      return { label: 'Expired', badge: 'badge-danger', icon: ShieldAlert }
    }
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24))
    if (diffDays <= 30) {
      return { label: `Expiring Soon (${diffDays} days)`, badge: 'badge-warning', icon: ShieldAlert }
    }
    return { label: `Active (${diffDays} days remaining)`, badge: 'badge-success', icon: ShieldCheck }
  }

  const status = warranty ? getWarrantyStatus(warranty.expiryDate) : null
  const StatusIcon = status ? status.icon : null

  if (isEditing || !warranty) {
    return (
      <div className="text-left animate-fade-in">
        <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-4">
          {warranty ? 'Edit Warranty Contract' : 'Register Warranty Contract'}
        </h4>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Contract Number</label>
              <input
                type="text"
                value={form.contractNumber}
                onChange={e => setVal('contractNumber', e.target.value)}
                placeholder="e.g. WNT-2026-0001"
                className="input text-sm"
              />
            </div>
            <div>
              <label className="form-label">Warranty Type</label>
              <select
                value={form.warrantyType}
                onChange={e => setVal('warrantyType', e.target.value)}
                className="input text-sm"
              >
                <option value="MANUFACTURER">Manufacturer</option>
                <option value="EXTENDED">Extended</option>
                <option value="THIRD_PARTY">Third Party</option>
                <option value="ON_SITE">On-Site Assistance</option>
                <option value="COMPREHENSIVE">Comprehensive</option>
              </select>
            </div>
            <div>
              <label className="form-label">Provider Name</label>
              <input
                type="text"
                value={form.providerName}
                onChange={e => setVal('providerName', e.target.value)}
                placeholder="e.g. Dell Support Enterprise"
                className="input text-sm"
              />
            </div>
            <div>
              <label className="form-label">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setVal('startDate', e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="form-label">Expiry Date</label>
              <input
                type="date"
                value={form.expiryDate}
                onChange={e => setVal('expiryDate', e.target.value)}
                className="input text-sm"
              />
            </div>
          </div>
          <div>
            <label className="form-label">Notes & Coverage Specs</label>
            <textarea
              value={form.notes}
              onChange={e => setVal('notes', e.target.value)}
              placeholder="Enter additional details regarding parts coverage, SLA limits, etc..."
              rows={3}
              className="input text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            {warranty && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="btn-secondary btn-sm"
              >
                Cancel
              </button>
            )}
            {isAdmin && isAdmin() && (
              <button
                type="submit"
                disabled={updateMutation.isLoading}
                className="btn-primary btn-sm"
              >
                {updateMutation.isLoading ? 'Saving...' : 'Save Warranty'}
              </button>
            )}
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="text-left animate-fade-in space-y-5">
      <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
        <div>
          <h4 className="text-sm font-bold text-slate-800 dark:text-white">
            Warranty Details
          </h4>
          <p className="text-xs text-slate-400 mt-1">
            Standard support and coverage registration info.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${status.badge} flex items-center gap-1`}>
            <StatusIcon size={12} />
            {status.label}
          </span>
          {isAdmin && isAdmin() && (
            <button
              onClick={() => setIsEditing(true)}
              className="btn-secondary btn-sm flex items-center gap-1.5"
            >
              <Edit size={13} /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/35 border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Contract Number</p>
          <p className="text-slate-800 dark:text-slate-200 font-mono">{warranty.contractNumber || '—'}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/35 border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Provider Name</p>
          <p className="text-slate-800 dark:text-slate-200">{warranty.providerName || '—'}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/35 border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Warranty Type</p>
          <p className="text-slate-800 dark:text-slate-200">{warranty.warrantyType || '—'}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/35 border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Coverage Period</p>
          <p className="text-slate-800 dark:text-slate-200">
            {formatDate(warranty.startDate) || '—'} &rarr; {formatDate(warranty.expiryDate) || '—'}
          </p>
        </div>
      </div>

      {warranty.notes && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/35 border border-slate-100 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Notes & Details</p>
          <p className="text-xs text-slate-600 dark:text-slate-350 whitespace-pre-wrap">{warranty.notes}</p>
        </div>
      )}
    </div>
  )
}

