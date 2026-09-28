import React, { useState } from 'react';
import { X, Mail, Lock, User, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const [isRegister, setIsRegister] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tier, setTier] = useState('TIER_PREMIUM');
  const [errors, setErrors] = useState({});

  const { login, register, loading, authError, setAuthError } = useAuth();

  if (!isOpen) return null;

  const validate = () => {
    const errs = {};
    if (isRegister && !fullName.trim()) {
      errs.fullName = 'Full name is required';
    }
    if (!email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Please enter a valid email address';
    }
    if (!password) {
      errs.password = 'Password is required';
    } else if (password.length < 8) {
      errs.password = 'Password must be at least 8 characters long';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (isRegister) {
      const result = await register({ fullName, email, password, tier });
      if (result.success) onClose();
    } else {
      const result = await login(email, password);
      if (result.success) onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md p-6 glass-panel rounded-2xl border border-cyan-500/20 bg-[#0E1426] shadow-2xl shadow-cyan-950/50">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 mb-3 shadow-inner">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isRegister ? 'Open a Flow Account' : 'Welcome Back to Flow'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isRegister
              ? 'Institutional-grade digital banking & instant payments'
              : 'Sign in to access your ledger, balances & active holds'}
          </p>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1 bg-slate-900/80 border border-slate-800 rounded-xl mb-6 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setAuthError(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              !isRegister
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setAuthError(null);
            }}
            className={`py-2 rounded-lg transition-all ${
              isRegister
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Global Error Banner */}
        {authError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 bg-slate-900/90 border ${
                    errors.fullName ? 'border-rose-500' : 'border-slate-800'
                  } rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400`}
                />
              </div>
              {errors.fullName && <p className="text-[11px] text-rose-400 mt-1">{errors.fullName}</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="email"
                placeholder="name@flowbank.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 bg-slate-900/90 border ${
                  errors.email ? 'border-rose-500' : 'border-slate-800'
                } rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400`}
              />
            </div>
            {errors.email && <p className="text-[11px] text-rose-400 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 bg-slate-900/90 border ${
                  errors.password ? 'border-rose-500' : 'border-slate-800'
                } rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400`}
              />
            </div>
            {errors.password && <p className="text-[11px] text-rose-400 mt-1">{errors.password}</p>}
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Account Tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-mono"
              >
                <option value="TIER_STANDARD">Standard (1.0% Cashback)</option>
                <option value="TIER_PREMIUM">Premium (1.5% Cashback + Zero Fees)</option>
                <option value="TIER_ENTERPRISE">Enterprise (2.0% Cashback + Dedicated Core)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-semibold text-xs tracking-wide shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span className="animate-pulse">Processing...</span>
            ) : isRegister ? (
              'Create Account & Open Ledger'
            ) : (
              'Sign In with Security Clearance'
            )}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-500">
            Protected by Argon/Bcrypt Salt & SHA-256 Distributed Authorization.
          </p>
        </div>
      </div>
    </div>
  );
}
