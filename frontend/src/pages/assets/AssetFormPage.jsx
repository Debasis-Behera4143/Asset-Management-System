import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, X, Upload, ArrowLeft, Package } from 'lucide-react'
import { assetApi, departmentApi, vendorApi } from '../../api/index'
import { useToast } from '../../hooks/useToast'
import { getErrorMessage } from '../../utils/formatters'
import { ASSET_STATUSES as AS } from '../../utils/constants'

export default function AssetFormPage({ assetId }) {
  const navigate  = useNavigate()
  const qc        = useQueryClient()
  const { success, error } = useToast()
  const isEditing = !!assetId
  const [imagePreview, setImagePreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [imageRemoved, setImageRemoved] = useState(false)

  const { data: existingAsset } = useQuery({
    queryKey: ['assets', assetId],
    queryFn: () => assetApi.getById(assetId).then(r => r.data.data || r.data),
    enabled: isEditing,
  })

  React.useEffect(() => {
    if (existingAsset?.imageUrl) {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://asset-management-system-2s9o.onrender.com/api';
      const serverUrl = baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl;
      const previewUrl = existingAsset.imageUrl.startsWith('http')
        ? existingAsset.imageUrl
        : `${serverUrl}/${existingAsset.imageUrl}`;
      setImagePreview(previewUrl);
    } else {
      setImagePreview(null);
    }
  }, [existingAsset])

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentApi.getAll().then(r => r.data.data || []),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ['asset-categories'],
    queryFn: () => assetApi.getCategories().then(r => r.data.data || []),
  })

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorApi.getAll().then(r => r.data.data?.content || r.data.data || []),
  })

  const { register, handleSubmit, formState: { errors } } = useForm({
    values: existingAsset || {}
  })

  const mutation = useMutation({
    mutationFn: async (formData) => {
      const payload = { ...formData }
      if (imageRemoved && !imageFile) {
        payload.imageUrl = null
      }

      let res;
      if (isEditing) {
        res = await assetApi.update(assetId, payload);
      } else {
        res = await assetApi.create(payload);
      }

      const asset = res.data?.data || res.data;
      const assetIdToUse = asset.id || assetId;

      if (imageFile && assetIdToUse) {
        await assetApi.uploadImage(assetIdToUse, imageFile);
      }

      return asset;
    },
    onSuccess: (asset) => {
      success(isEditing ? 'Asset updated successfully!' : 'Asset created successfully!')
      qc.invalidateQueries(['assets'])
      qc.invalidateQueries(['assets', assetId])
      qc.invalidateQueries(['dashboard'])
      navigate('/assets')
    },
    onError: (err) => error(getErrorMessage(err)),
  })

  const onSubmit = (formData) => {
    if (formData.purchaseDate) {
      const pDate = new Date(formData.purchaseDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (pDate > today) {
        error("Purchase date cannot be in the future.");
        return;
      }
      if (formData.warrantyExpiry) {
        const wDate = new Date(formData.warrantyExpiry);
        if (wDate < pDate) {
          error("Warranty expiry date cannot be before purchase date.");
          return;
        }
      }
    }
    mutation.mutate(formData);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      setImageRemoved(false)
      const reader = new FileReader()
      reader.onload = ev => setImagePreview(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
    setImageFile(null)
    setImageRemoved(true)
  }

  const F = ({ name, label, type = 'text', placeholder, required, options, multiline, span }) => (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="form-label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {options ? (
        <select
          {...register(name, required ? { required: `${label} is required` } : {})}
          className={`input text-sm ${errors[name] ? 'input-error' : ''}`}
        >
          <option value="">Select {label}</option>
          {options.map(o => <option key={o.id || o.value} value={o.id || o.value}>{o.name || o.label}</option>)}
        </select>
      ) : multiline ? (
        <textarea
          {...register(name, required ? { required: `${label} is required` } : {})}
          placeholder={placeholder}
          rows={3}
          className={`input text-sm resize-none ${errors[name] ? 'input-error' : ''}`}
        />
      ) : (
        <input
          type={type}
          {...register(name, required ? { required: `${label} is required` } : {})}
          placeholder={placeholder}
          className={`input text-sm ${errors[name] ? 'input-error' : ''}`}
        />
      )}
      {errors[name] && <p className="mt-1 text-xs text-red-500">{errors[name].message}</p>}
    </div>
  )

  return (
    <div className="animate-fade-in">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/assets')}
                  className="btn-icon w-8 h-8 rounded-lg"
                  style={{ background: 'rgb(var(--bg-elevated))', color: 'rgb(var(--text-secondary))' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">{isEditing ? 'Edit Asset' : 'Add New Asset'}</h1>
            <nav className="text-xs mt-0.5" style={{ color: 'rgb(var(--text-muted))' }}>
              Dashboard &rsaquo;{' '}
              <Link to="/assets" style={{ color: 'var(--ams-blue-mid)' }}>Assets</Link>
              {' '}&rsaquo; {isEditing ? 'Edit Asset' : 'Add Asset'}
            </nav>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left: Asset Information ────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                  Asset Information
                </h2>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <F name="name"         label="Asset Name"    required placeholder="Enter asset name" span={2} />
                <F name="categoryId"   label="Category"      options={categories} />
                <F name="serialNumber" label="Serial Number"  placeholder="SN-XXXXXXX" />
                <F name="model"        label="Model Number"   placeholder="Model number" />
                <F name="purchaseDate" label="Purchase Date"  type="date" />
                <F name="purchaseCost" label="Purchase Price" type="number" placeholder="0.00" />
                <F name="warrantyExpiry" label="Warranty Expiry" type="date" />
                <F name="vendorId"     label="Vendor"        options={vendors} />
                <F name="location"     label="Location"      placeholder="Enter location" />
                <F name="departmentId" label="Department"    options={departments} />
                {isEditing && (
                  <F name="status"     label="Status"        options={AS} />
                )}
                <F name="description"  label="Description"  multiline placeholder="Enter asset description..." span={2} />
              </div>
            </div>
          </div>

          {/* ── Right: Upload Image ────────────────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="card overflow-hidden lg:sticky lg:top-24">
              <div className="px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border-color))' }}>
                <h2 className="text-sm font-semibold" style={{ color: 'rgb(var(--text-primary))' }}>
                  Upload Image
                </h2>
              </div>
              <div className="p-5">
                {/* Drop zone */}
                <label htmlFor="asset-image-upload" className="cursor-pointer block">
                  <div
                    className="border-2 border-dashed rounded-xl flex flex-col items-center justify-center py-10 px-4 text-center transition-all duration-200 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10"
                    style={{ borderColor: 'rgb(var(--border-color))' }}
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview"
                           className="w-full max-h-40 object-contain rounded-lg mb-3"
                           onError={() => setImagePreview(null)} />
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-3"
                             style={{ background: 'var(--ams-blue-pale)' }}>
                          <Upload size={24} style={{ color: 'var(--ams-blue-mid)' }} />
                        </div>
                        <p className="text-sm font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>
                          Click or drag to upload
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'rgb(var(--text-muted))' }}>
                          PNG, JPG up to 5MB
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    id="asset-image-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>
                {imagePreview && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="w-full btn-secondary btn-sm mt-3"
                  >
                    <X size={13} /> Remove Image
                  </button>
                )}
              </div>

              {/* Form Actions */}
              <div className="px-5 pb-5 space-y-2">
                <button
                  type="submit"
                  disabled={mutation.isLoading}
                  className="w-full btn-primary"
                >
                  {mutation.isLoading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <Save size={15} />}
                  {isEditing ? 'Save Changes' : 'Save Asset'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/assets')}
                  className="w-full btn-secondary"
                >
                  <X size={15} /> Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
