import React, { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ScanLine, Upload, CheckCircle, AlertCircle, FileText, X, Package } from 'lucide-react'
import { ocrApi } from '../../api/index'
import { formatCurrency, formatDate, getErrorMessage } from '../../utils/formatters'
import { Link } from 'react-router-dom'

export default function OcrScannerPage() {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState(null)

  const mutation = useMutation({
    mutationFn: ocrApi.scan,
    onSuccess: (res) => setResult(res.data.data),
    onError: () => setResult(null),
  })

  const handleFile = (f) => {
    if (!f) return
    setFile(f)
    setResult(null)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFile(dropped)
  }, [])

  const handleScan = () => {
    if (!file) return
    mutation.mutate(file)
  }

  const fields = result ? [
    { label: 'Vendor Name', value: result.vendorName },
    { label: 'Invoice Number', value: result.invoiceNumber },
    { label: 'Invoice Date', value: formatDate(result.invoiceDate) },
    { label: 'Purchase Date', value: formatDate(result.purchaseDate) },
    { label: 'Total Amount', value: formatCurrency(result.totalAmount) },
    { label: 'Warranty Period', value: result.warrantyPeriod },
    { label: 'Asset Name', value: result.assetName },
    { label: 'Serial Number', value: result.serialNumber },
  ] : []

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <ScanLine size={20} className="text-white" />
          </div>
          <div>
            <h1 className="page-title">OCR Invoice Scanner</h1>
            <p className="page-subtitle">Upload an invoice PDF or image to extract asset data automatically</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload zone */}
        <div className="space-y-4">
          <div
            className={`card border-2 border-dashed transition-all duration-200 cursor-pointer ${
              dragging ? 'border-indigo-500 bg-indigo-50/5' : ''
            }`}
            style={{ borderColor: dragging ? '#6366f1' : 'rgb(var(--border-color))' }}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('file-input').click()}
          >
            <div className="p-10 text-center">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                   style={{ background: 'rgb(var(--bg-elevated))' }}>
                <Upload size={28} style={{ color: 'rgb(var(--text-muted))' }} />
              </div>
              <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                Drop your invoice here
              </p>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                or click to browse · PDF, PNG, JPG supported
              </p>
              <input
                id="file-input"
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />
            </div>
          </div>

          {file && (
            <div className="card p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                   style={{ background: 'rgb(var(--bg-elevated))' }}>
                <FileText size={18} style={{ color: '#6366f1' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'rgb(var(--text-primary))' }}>
                  {file.name}
                </p>
                <p className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <button onClick={() => { setFile(null); setResult(null) }}
                      className="btn-icon text-red-400">
                <X size={16} />
              </button>
            </div>
          )}

          <button
            onClick={handleScan}
            disabled={!file || mutation.isLoading}
            className="btn-primary w-full justify-center py-3"
          >
            {mutation.isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Scanning with OCR...
              </>
            ) : (
              <>
                <ScanLine size={16} />
                Scan Invoice
              </>
            )}
          </button>

          {mutation.isError && (
            <div className="card p-4 border-red-200 bg-red-50/5 flex items-start gap-3">
              <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{getErrorMessage(mutation.error)}</p>
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          {result ? (
            <div className="card p-5 space-y-4 animate-scale-in">
              {result.isDemo && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl text-xs flex items-start gap-2.5">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Local Backend Offline</p>
                    <p className="mt-0.5 text-slate-400">Unable to reach the local API server. Showing simulated demo data. Please verify your local backend server is running on port 8080.</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-emerald-500" />
                  <h3 className="font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                    Extracted Data
                  </h3>
                </div>
                <span className="badge-success badge text-xs">
                  {result.extractionConfidence.toFixed(0)}% confidence
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {fields.map(f => (
                  <div key={f.label} className="flex justify-between items-center py-2 border-b"
                       style={{ borderColor: 'rgb(var(--border-color))' }}>
                    <span className="text-xs" style={{ color: 'rgb(var(--text-muted))' }}>{f.label}</span>
                    <span className="text-sm font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                      {f.value || '—'}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                to="/assets/new"
                state={{ ocrData: result }}
                className="btn-primary w-full justify-center"
              >
                <Package size={16} />
                Create Asset from Data
              </Link>
            </div>
          ) : (
            <div className="card p-10 text-center">
              <ScanLine size={40} className="mx-auto mb-3" style={{ color: 'rgb(var(--text-muted))' }} />
              <p className="font-medium" style={{ color: 'rgb(var(--text-primary))' }}>
                Scan result will appear here
              </p>
              <p className="text-sm mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                Upload an invoice and click "Scan Invoice"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="card p-5 mt-6">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'rgb(var(--text-primary))' }}>
          How OCR Scanning Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { step: '1', label: 'Upload', desc: 'Upload invoice PDF or image' },
            { step: '2', label: 'Scan', desc: 'Tesseract OCR extracts text' },
            { step: '3', label: 'Parse', desc: 'AI extracts key fields' },
            { step: '4', label: 'Create', desc: 'Create asset with extracted data' },
          ].map(s => (
            <div key={s.step} className="text-center p-4 rounded-xl flex flex-col items-center justify-center" style={{ background: 'rgb(var(--bg-elevated))' }}>
              <div className="w-8 h-8 rounded-full bg-red-800/10 text-red-500 flex items-center justify-center mb-2.5 text-xs font-bold border border-red-800/20">
                {s.step}
              </div>
              <div className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>{s.label}</div>
              <div className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
