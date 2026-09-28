import React, { useState } from 'react';
import { ApolloProvider } from '@apollo/client';
import apolloClient from './apollo/client';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import BalanceCard from './components/BalanceCard';
import TransactionHistory from './components/TransactionHistory';
import SendMoneyModal from './components/SendMoneyModal';
import AddFundsModal from './components/AddFundsModal';
import AuthModal from './components/AuthModal';
import {
  Server,
  Zap,
  Activity,
  ShieldCheck,
  CheckCircle,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

function DashboardView() {
  const [isSendMoneyOpen, setIsSendMoneyOpen] = useState(false);
  const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-300">
      {/* Top Header */}
      <Navbar
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenSendMoney={() => setIsSendMoneyOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Microservices Cluster Top Banner */}
        <div className="p-4 rounded-2xl glass-panel border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-indigo-950/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cpu className="h-5 w-5" />
            </div>
            <div className="text-xs">
              <span className="font-semibold text-slate-200">Distributed Core Cluster:</span>
              <span className="text-slate-400 ml-1.5 hidden sm:inline">
                Apollo GraphQL BFF (:4000) · gRPC Wallet (:50051) · Kafka Event Engine (:9092)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              ACID OCC
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
              Kafka 3.8
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-800 text-indigo-300 font-semibold">
              JWT Bearer
            </span>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Primary Ledger Balance & Quick Status */}
          <div className="lg:col-span-8 space-y-8">
            <BalanceCard
              onOpenSendMoney={() => setIsSendMoneyOpen(true)}
              onOpenAddFunds={() => setIsAddFundsOpen(true)}
            />

            <TransactionHistory />
          </div>

          {/* Right Column: Account Insights, Security & Tier Info */}
          <div className="lg:col-span-4 space-y-6">
            {/* Account Status Card */}
            <div className="glass-panel rounded-3xl p-6 border border-slate-800 bg-[#0A0E1A]/80 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <span className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-400">
                  Account Standing
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  Verified Tier
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Account Holder:</span>
                  <span className="font-semibold text-slate-200">{user?.fullName || 'Jane Doe'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">User ID:</span>
                  <span className="font-mono text-slate-300 text-[11px]">{user?.userId || 'usr_01HXYZ1234567890'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">KYC Status:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold font-mono text-[11px]">
                    <CheckCircle className="h-3 w-3" />
                    VERIFIED
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Daily Transfer Limit:</span>
                  <span className="font-mono font-semibold text-slate-200">$50,000.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Cashback Program:</span>
                  <span className="font-mono font-semibold text-amber-400">1.5% Premium</span>
                </div>
              </div>
            </div>

            {/* Architecture Node Health */}
            <div className="glass-panel rounded-3xl p-6 border border-slate-800 bg-[#0A0E1A]/80 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <span className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" />
                  Service Health Map
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">100% UP</span>
              </div>

              <div className="space-y-2.5 text-xs font-mono">
                {[
                  { name: 'graphql-gateway', port: ':4000', protocol: 'Apollo BFF' },
                  { name: 'wallet-service', port: ':50051', protocol: 'gRPC Core' },
                  { name: 'transaction-service', port: ':4003', protocol: 'REST + Kafka' },
                  { name: 'fraud-detection', port: ':4004', protocol: 'Rule Engine' },
                  { name: 'notification-service', port: ':4005', protocol: 'Event Loop' },
                  { name: 'mongodb-replica', port: ':27017', protocol: 'ACID rs0' },
                ].map((s) => (
                  <div
                    key={s.name}
                    className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-slate-200 font-sans text-xs font-medium">{s.name}</p>
                      <p className="text-[10px] text-slate-500">{s.protocol}</p>
                    </div>
                    <span className="text-[10px] text-cyan-400">{s.port}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Instant Help & Protections */}
            <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Double-Entry Ledger Integrity
              </p>
              <p className="text-[11px] leading-relaxed">
                Protected by strict MongoDB multi-document ACID transactions with optimistic concurrency
                control to guarantee zero race conditions on concurrent balance transfers.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Interactive Modals */}
      <SendMoneyModal
        isOpen={isSendMoneyOpen}
        onClose={() => setIsSendMoneyOpen(false)}
      />

      <AddFundsModal
        isOpen={isAddFundsOpen}
        onClose={() => setIsAddFundsOpen(false)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <DashboardView />
      </AuthProvider>
    </ApolloProvider>
  );
}
