import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import {
  Eye, EyeOff, Lock, Mail, LogIn, AlertCircle,
  Users, Calendar, Monitor, Phone,
  FileText, ChevronRight, CheckCircle2, Sun, Moon
} from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../api/authApi'
import useAuthStore from '../../store/authStore'
import { useToast } from '../../hooks/useToast'
import { getErrorMessage } from '../../utils/formatters'
import irLogo from '../../assets/images/indian_railways.png'
import trainWatermark from '../../assets/images/train_watermark.png'
import useThemeStore from '../../store/themeStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const { success, error } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [portal, setPortal] = useState('admin') // 'admin' | 'employee'
  const [capsLock, setCapsLock] = useState(false)

  const { isDark, toggleTheme, initTheme } = useThemeStore()

  const { register, handleSubmit, setValue, formState: { errors } } = useForm()

  const [dateStr] = useState(() => {
    return new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  })

  const [dayName] = useState(() => {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long' })
  })

  // Detect Caps Lock state
  const handleKeyDown = (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setCapsLock(true)
    } else {
      setCapsLock(false)
    }
  }

  // Pre-fill demo credentials on portal tab change
  React.useEffect(() => {
    if (portal === 'admin') {
      setValue('email', 'admin@company.com')
      setValue('password', 'Admin@123')
    } else {
      setValue('email', 'employee@company.com')
      setValue('password', 'Emp@123')
    }
  }, [portal, setValue])

  // Initialize theme on component mount
  React.useEffect(() => {
    initTheme()
  }, [initTheme])



  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (res) => {
      const data = res.data?.data || res.data
      setAuth(data)
      success(`Welcome, ${data.firstName}!`)
      navigate('/dashboard')
    },
    onError: (err) => {
      error(getErrorMessage(err))
    }
  })

  const onSubmit = (data) => loginMutation.mutate(data)

  return (
    <div
      className={`min-h-screen flex flex-col justify-between font-sans select-none relative overflow-hidden transition-colors duration-150 ${isDark ? 'text-slate-100' : 'text-slate-900'
        }`}
      onKeyDown={handleKeyDown}
    >
      {/* Background train watermark decorative overlay */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden flex items-center justify-center">
        <img
          src={trainWatermark}
          alt="Railway Background Watermark"
          className={`w-[85%] max-w-4xl object-contain transition-all duration-300 ${isDark
              ? 'opacity-[0.15] invert select-none'
              : 'opacity-[0.3] select-none'
            }`}
          style={{
            mixBlendMode: isDark ? 'screen' : 'multiply'
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen justify-between">
        {/* 1. Official Government Header Strip */}
        <header className="gov-strip px-3 sm:px-6 py-1.5 flex flex-row items-center justify-between bg-[#7c0a0a] text-[8.5px] sm:text-xs font-bold uppercase tracking-wider text-white shadow-md">
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline">भारत सरकार | GOVERNMENT OF INDIA</span>
            <span className="sm:hidden">GOVT. OF INDIA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline">रेल मंत्रालय | MINISTRY OF RAILWAYS</span>
            <span className="sm:hidden">MINISTRY OF RAILWAYS</span>
          </div>
        </header>

        {/* 2. Official East Coast Railway Banner Card */}
        <div className={`border-b px-4 sm:px-8 py-2.5 flex flex-row items-center justify-between shadow-sm transition-colors duration-150 ${isDark ? 'bg-slate-900/90 border-slate-800/80' : 'bg-white border-slate-200/80'
          }`}>
          {/* Circular ECoR-style IR Crest and Title */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 sm:w-14 sm:h-14 flex items-center justify-center flex-shrink-0">
              <img src={irLogo} alt="Indian Railways" className="w-full h-full object-contain rounded-full shadow-md" />
            </div>
            <div className="text-left">
              <h2 className={`text-xs sm:text-base font-black uppercase tracking-wider leading-none mb-0.5 sm:mb-1 ${isDark ? 'text-amber-500' : 'text-[#1e3a8a]'
                }`}>
                East Coast Railway
              </h2>
              <p className="text-[10px] sm:text-xs font-bold text-slate-500 leading-none">
                पूर्व तट रेलवे
              </p>
            </div>
          </div>

          {/* Top Panel Indicators */}
          <div className="flex items-center gap-3 sm:gap-6">
            {/* Calendar */}
            <div className="hidden md:flex items-center gap-2.5 text-left">
              <div className={`p-2 rounded ${isDark ? 'bg-rose-950/50 text-rose-450' : 'bg-rose-50 text-[#7c0a0a]'}`}>
                <Calendar size={16} />
              </div>
              <div>
                <div className={`text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{dateStr}</div>
                <div className="text-[11px] font-bold text-slate-450 leading-none">{dayName}</div>
              </div>
            </div>


            {/* Server Status */}
            <div className="hidden md:flex items-center gap-2.5 text-left">
              <div className={`p-2 rounded flex items-center justify-center ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div>
                <div className={`text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>System Status</div>
                <div className="text-[11px] font-bold text-slate-455 leading-none">All Operational</div>
              </div>
            </div>

            {/* Light / Dark Mode Toggle button */}
            <button
              id="theme-toggle"
              type="button"
              onClick={toggleTheme}
              className={`p-2 rounded-lg border transition-all duration-155 flex items-center justify-center ${isDark
                  ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-750'
                  : 'bg-white border-slate-250 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
                }`}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun size={15} style={{ width: '15px', height: '15px' }} /> : <Moon size={15} style={{ width: '15px', height: '15px' }} />}
            </button>
          </div>
        </div>

        {/* 3. Main Body Container (Balanced Two-Column layout) */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">

          {/* Mobile-only heading at the top */}
          <div className="block lg:hidden lg:col-span-12 text-center space-y-1.5">
            <span className="text-[10px] font-black tracking-widest text-[#d97706] uppercase">
              Welcome To
            </span>
            <h1 className={`text-2xl font-black tracking-tight leading-tight ${isDark ? 'text-white' : 'text-slate-900'
              }`}>
              Asset Management Platform <span className="text-[#7c0a0a] dark:text-rose-500">(ECOR-AMP)</span>
            </h1>
            <p className="text-[10px] font-semibold text-slate-500 tracking-wide">
              AI-Powered &bull; Secure &bull; Intelligent &bull; Efficient
            </p>
          </div>

          {/* Left Column (lg:col-span-7): Heading, Stats Row & Circulars */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-5 text-left order-2 lg:order-1">

            {/* Greetings & Titles - Desktop Only */}
            <div className="hidden lg:block space-y-2.5">
              <span className="text-[12px] font-black tracking-widest text-[#d97706] uppercase">
                Welcome To
              </span>
              <h1 className={`text-4xl font-black tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'
                }`}>
                Asset Management <br />
                <span className={isDark ? 'text-slate-200' : 'text-slate-900'}>Platform </span>
                <span className="text-[#7c0a0a] font-black dark:text-rose-500">(ECOR-AMP)</span>
              </h1>
              <p className="text-sm font-semibold text-slate-500 tracking-wide pt-1">
                AI-Powered &bull; Secure &bull; Intelligent &bull; Efficient
              </p>
            </div>

            {/* Circulars Ticker Container */}
            <div className="space-y-2">
              <div className={`flex items-center gap-2.5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                <FileText size={16} className="text-[#d97706]" />
                <h3 className="text-sm font-black uppercase tracking-wider">
                  Latest Division Circulars
                </h3>
              </div>

              <div className="space-y-2.5">
                {[
                  { date: '15', month: 'MAY', badge: 'Important', title: 'Asset Condemnation & Disposal guidelines updated.', bColor: 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/45' },
                  { date: '10', month: 'MAY', badge: 'Medium', title: 'All zonal heads must upload physical verification reports.', bColor: 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/45' },
                ].map((notice, idx) => (
                  <div key={idx} className={`border rounded-xl p-4 flex items-center justify-between transition-all duration-155 shadow-sm ${isDark ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700' : 'bg-white/82 backdrop-blur-sm border-slate-200/80 hover:border-slate-350'
                    }`}>
                    <div className="flex items-center gap-4">
                      {/* Round Maroon Date Ticker */}
                      <div className="w-12 h-12 rounded-full bg-[#7c0a0a] text-white flex flex-col items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-sm font-black leading-none mt-0.5">{notice.date}</span>
                        <span className="text-[10px] font-bold leading-none">{notice.month}</span>
                      </div>
                      <div>
                        <p className={`text-sm font-bold leading-normal ${isDark ? 'text-slate-200' : 'text-slate-800'
                          }`}>
                          {notice.title}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-[11px] font-bold border rounded ${notice.bColor}`}>
                        {notice.badge}
                      </span>
                      <ChevronRight size={15} className="text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (lg:col-span-5): Login Card Container */}
          <div className="lg:col-span-5 flex justify-center lg:justify-end order-1 lg:order-2">
            <div className={`w-full max-w-md border shadow-2xl rounded-2xl overflow-hidden text-left flex flex-col justify-between transition-all duration-150 ${isDark ? 'bg-slate-900/60 backdrop-blur-md border-slate-850 text-white' : 'bg-white/82 backdrop-blur-md border-slate-200/80 text-slate-900'
              }`}>

              {/* Form Block */}
              <div className="p-6">

                <div className="text-center mb-6">
                  <h2 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Welcome!
                  </h2>
                  <p className="text-sm font-semibold text-slate-450 mt-1">
                    Sign in to continue to your account
                  </p>
                </div>

                {/* Secure Tabs */}
                <div className={`flex border rounded-lg overflow-hidden p-1 mb-6 bg-slate-50 ${isDark ? 'bg-slate-950 border-slate-850' : 'bg-slate-50 border-slate-200/80'
                  }`}>
                  <button
                    type="button"
                    onClick={() => setPortal('admin')}
                    className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-150 rounded-md ${portal === 'admin'
                        ? isDark
                          ? 'text-amber-500 bg-slate-900 border border-slate-850 shadow-sm font-bold border-b-2 border-b-amber-500'
                          : 'text-[#7c0a0a] bg-white shadow-sm border border-slate-100 font-bold border-b-2 border-b-[#7c0a0a]'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                      }`}
                  >
                    <Users size={14} />
                    <span>Administrator</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPortal('employee')}
                    className={`flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-all duration-150 rounded-md ${portal === 'employee'
                        ? isDark
                          ? 'text-amber-500 bg-slate-900 border border-slate-850 shadow-sm font-bold border-b-2 border-b-amber-500'
                          : 'text-[#7c0a0a] bg-white shadow-sm border border-slate-100 font-bold border-b-2 border-b-[#7c0a0a]'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-350'
                      }`}
                  >
                    <Users size={14} />
                    <span>Employee</span>
                  </button>
                </div>

                {/* Login Inputs form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Email address */}
                  <div>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="login-email"
                        type="email"
                        placeholder="Email Address"
                        {...register('email', {
                          required: 'Email address is required',
                          pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email address' }
                        })}
                        className={`w-full pl-10 pr-3.5 py-3 rounded-lg text-sm focus:outline-none transition-all duration-150 ${isDark
                            ? 'bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                            : 'bg-slate-50/50 border border-slate-250 text-slate-900 placeholder-slate-400 focus:border-[#7c0a0a] focus:bg-white'
                          }`}
                      />
                    </div>
                    {errors.email && <p className="mt-1.5 text-xs text-red-655 font-bold">{errors.email.message}</p>}
                  </div>

                  {/* Password entry */}
                  <div>
                    <div className="relative">
                      <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Password"
                        {...register('password', {
                          required: 'Password is required',
                          minLength: { value: 6, message: 'Minimum 6 characters required' }
                        })}
                        className={`w-full pl-10 pr-10 py-3 rounded-lg text-sm focus:outline-none transition-all duration-150 ${isDark
                            ? 'bg-slate-950/80 border border-slate-800 text-white placeholder-slate-600 focus:border-amber-500'
                            : 'bg-slate-50/50 border border-slate-250 text-slate-900 placeholder-slate-400 focus:border-[#7c0a0a] focus:bg-white'
                          }`}
                      />
                      <button
                        type="button"
                        id="toggle-password"
                        onClick={() => setShowPassword(s => !s)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1.5 text-xs text-red-655 font-bold">{errors.password.message}</p>}
                  </div>

                  {/* Caps Lock warning detector */}
                  {capsLock && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#d97706] uppercase tracking-wider bg-amber-55 border border-amber-100/40 p-2.5 rounded-lg">
                      <AlertCircle size={12} />
                      <span>Caps Lock is ON</span>
                    </div>
                  )}

                  {/* Remember and Forgot options */}
                  <div className="flex items-center justify-between text-xs font-bold">
                    <label className="flex items-center gap-1.5 text-slate-450 cursor-pointer">
                      <input type="checkbox" className="accent-[#7c0a0a] rounded bg-slate-50 border-slate-300 w-3.5 h-3.5" />
                      <span>Remember me</span>
                    </label>
                    <Link to="/forgot-password" className="text-[#7c0a0a] dark:text-amber-500 hover:underline uppercase tracking-wider text-[11px]">
                      Forgot Password?
                    </Link>
                  </div>

                  {/* Submit button */}
                  <button
                    id="login-submit"
                    type="submit"
                    disabled={loginMutation.isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#7c0a0a] hover:bg-[#5e0808] text-white font-bold text-xs uppercase tracking-widest transition-all duration-150 border border-[#5e0808] disabled:opacity-50 active:scale-[0.98] shadow"
                  >
                    {loginMutation.isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Authenticating...
                      </span>
                    ) : (
                      <>
                        <LogIn size={14} />
                        Login to System
                      </>
                    )}
                  </button>
                </form>

                {/* OR divider strip */}
                <div className="my-5 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  <div className="h-[1px] bg-slate-200 dark:bg-slate-800 w-1/3" />
                  <span>OR</span>
                  <div className="h-[1px] bg-slate-200 dark:bg-slate-800 w-1/3" />
                </div>

                {/* Demo accounts credentials layout drawer */}
                <div className={`p-4 border rounded-lg text-left flex items-start gap-3 transition-colors duration-150 ${isDark ? 'bg-slate-950/60 border-slate-800 text-slate-400' : 'bg-amber-50/40 border-amber-200 text-slate-600'
                  }`}>
                  <div className={`p-2 rounded mt-0.5 flex-shrink-0 border ${isDark ? 'bg-slate-900 text-amber-500 border-slate-850' : 'bg-amber-50 text-[#d97706] border-amber-100'
                    }`}>
                    <Monitor size={15} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-amber-800 dark:text-amber-500 uppercase tracking-widest mb-1.5">
                      Demo Credentials
                    </p>
                    <div className="space-y-1 text-[11px] font-mono leading-relaxed">
                      <div>
                        <span className="font-bold text-slate-600 dark:text-slate-400">Admin:</span> admin@company.com / Admin@123
                      </div>
                      <div>
                        <span className="font-bold text-slate-600 dark:text-slate-400">Employee:</span> employee@company.com / Emp@123
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Login Card Footer Strip */}
              <div className={`border-t px-6 py-3 flex justify-between items-center gap-1.5 text-[10px] font-bold tracking-wider transition-colors duration-150 ${isDark ? 'bg-slate-950/40 border-slate-800 text-slate-400' : 'bg-slate-100 border-slate-200/80 text-slate-600'
                }`}>
                <div className="flex items-center gap-1">
                  <Phone size={11} className="text-[#1e3a8a] dark:text-blue-400" />
                  <span>+91-674-2301234</span>
                </div>
                <div className="flex items-center gap-1">
                  <Mail size={11} className="text-[#1e3a8a] dark:text-blue-400" />
                  <span>support@ecor.gov.in</span>
                </div>
                <div className="flex items-center gap-1 font-mono text-[9px]">
                  <CheckCircle2 size={11} className="text-emerald-500" />
                  <span>v2.6.0 (Stable)</span>
                </div>
              </div>

            </div>
          </div>
        </main>

        {/* 4. Official Government Page Footer */}
        <footer className={`relative z-10 flex-shrink-0 border-t px-4 sm:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-4 select-none transition-colors duration-150 ${isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-white border-slate-200/80 text-slate-600'
          }`}>
          <div className="text-left">
            <h3 className="text-xs font-black text-[#1e3a8a] dark:text-blue-400 tracking-wider uppercase mb-0.5">
              NIC | National Informatics Centre
            </h3>
            <p className="text-[10px] font-bold text-slate-450 leading-none">
              Ministry of Electronics & Information Technology, Government of India
            </p>
          </div>

          <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider">
            <Lock size={13} className="text-[#7c0a0a] dark:text-rose-500" />
            <span>This is a secure government system. Unauthorized access is prohibited.</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
