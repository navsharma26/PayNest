import React from 'react';
import { useQuery } from '@apollo/client';
import { GET_MY_WALLET, GET_MY_REWARDS } from '../graphql/queries';
import {
  Wallet,
  ArrowUpRight,
  PlusCircle,
  Lock,
  Layers,
  ShieldCheck,
  RotateCw,
  Gift,
} from 'lucide-react';

export default function BalanceCard({ onOpenSendMoney, onOpenAddFunds }) {
  const { data, loading, _error, refetch } = useQuery(GET_MY_WALLET, {
    pollInterval: 8000, // Poll every 8s for real-time ledger updates
  });

  const { data: rewardsData } = useQuery(GET_MY_REWARDS, {
    pollInterval: 10000,
  });

  const wallet = data?.myWallet || {
    walletId: 'wal_master_001',
    currency: 'USD',
    availableBalance: { formatted: '$25,450.00' },
    lockedBalance: { formatted: '$1,500.00' },
    totalBalance: { formatted: '$26,950.00' },
    status: 'WALLET_STATUS_ACTIVE',
    lastUpdatedAt: new Date().toISOString(),
  };

  const rewards = rewardsData?.myRewards || {
    loyaltyPoints: 382,
    cashValueUsd: '3.82',
    cashbackRate: '1.5% Premium',
  };

  return (
    <div className="glass-panel glass-card-glow rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-cyan-500/20 bg-gradient-to-br from-[#0E1528] via-[#0A0F1E] to-[#070A14]">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-400">
              Primary Vault · {wallet.walletId}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              {wallet.status === 'WALLET_STATUS_ACTIVE' ? 'Active' : wallet.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Two-Phase Commit ACID Ledger</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Rewards Badge */}
          <div className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border border-amber-500/20 text-xs flex items-center gap-2 text-amber-300">
            <Gift className="h-3.5 w-3.5 text-amber-400" />
            <span className="font-mono font-semibold">{rewards.loyaltyPoints} Pts</span>
            <span className="text-[10px] text-amber-400/80 font-mono">(${rewards.cashValueUsd})</span>
          </div>

          <button
            onClick={() => refetch()}
            title="Refresh Ledger"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/40 transition-all"
          >
            <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Primary Balance Section */}
      <div className="mb-8">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Available Liquidity</p>
        <div className="flex items-baseline gap-3 mt-1.5">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white">
            {wallet.availableBalance.formatted}
          </h1>
          <span className="text-sm font-semibold font-mono text-cyan-400 uppercase">
            {wallet.currency}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">Available for immediate withdrawal & atomic transfers</p>
      </div>

      {/* Breakdown Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/90 hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-1">
            <Lock className="h-3.5 w-3.5" />
            <span>Active Holds</span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-200">
            {wallet.lockedBalance.formatted}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Pre-authorized via HoldFunds</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/90 hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 mb-1">
            <Layers className="h-3.5 w-3.5" />
            <span>Total Book Balance</span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-200">
            {wallet.totalBalance.formatted}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Available + Locked holds</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/90 hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 mb-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>OCC Guarantee</span>
          </div>
          <p className="text-xl font-bold font-mono text-slate-200">
            Snapshot
          </p>
          <p className="text-[11px] text-slate-500 mt-1">__v optimistic locking</p>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800/80">
        <button
          onClick={onOpenSendMoney}
          className="flex-1 min-w-[150px] py-3 px-5 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-slate-950 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
        >
          <ArrowUpRight className="h-4 w-4 stroke-[3]" />
          <span>Send Money</span>
        </button>

        <button
          onClick={onOpenAddFunds}
          className="flex-1 min-w-[150px] py-3 px-5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-slate-200 font-semibold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <PlusCircle className="h-4 w-4 text-cyan-400" />
          <span>Add Funds</span>
        </button>
      </div>
    </div>
  );
}
