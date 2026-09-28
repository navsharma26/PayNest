import React from 'react';
import { Zap, Shield, LogOut, User, Lock, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onOpenAuth, onOpenSendMoney }) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="border-b border-slate-800/80 bg-[#090D1A]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Zap className="h-5 w-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-300 to-indigo-500">
                FLOW
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                BFF v4
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">Digital Banking & Distributed Ledger</p>
          </div>
        </div>

        {/* Central status */}
        <div className="hidden md:flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
            GraphQL Gateway :4000
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300">
            <Activity className="h-3 w-3 text-indigo-400" />
            gRPC Core :50051
          </div>
        </div>

        {/* Actions & User State */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenSendMoney}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 text-xs font-semibold tracking-wide flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Send Money</span>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                {user?.fullName?.split(' ').map((n) => n[0]).join('') || 'U'}
              </div>
              <div className="hidden sm:block text-left text-xs">
                <p className="font-semibold text-slate-200 leading-tight">{user?.fullName || 'Account Holder'}</p>
                <p className="text-[10px] text-cyan-400 font-mono">{user?.tier || 'TIER_PREMIUM'}</p>
              </div>
              <button
                onClick={logout}
                title="Log Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <User className="h-3.5 w-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
