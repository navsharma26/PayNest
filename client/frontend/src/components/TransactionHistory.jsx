import React, { useState } from 'react';
import { useQuery } from '@apollo/client';
import { GET_TRANSACTION_HISTORY } from '../graphql/queries';
import {
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Hourglass,
  ExternalLink,
} from 'lucide-react';

export default function TransactionHistory() {
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const { data } = useQuery(GET_TRANSACTION_HISTORY, {
    variables: { limit: 20 },
    pollInterval: 10000,
  });

  const transactions = data?.transactionHistory || [
    {
      id: 'tx_01',
      transferId: 'tx_01HXYZ9991',
      sourceWalletId: 'wal_master_001',
      destinationWalletId: 'wal_dest_002',
      amount: { formatted: '$250.00' },
      type: 'DEBIT',
      status: 'COMPLETED',
      transactionReference: 'TXN_REF_17112001_8812',
      description: 'Payment to Bob Smith',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    },
    {
      id: 'tx_02',
      transferId: 'tx_01HXYZ9992',
      sourceWalletId: 'wal_dest_002',
      destinationWalletId: 'wal_master_001',
      amount: { formatted: '$1,200.50' },
      type: 'CREDIT',
      status: 'COMPLETED',
      transactionReference: 'TXN_REF_17111802_4491',
      description: 'Payroll Direct Deposit',
      timestamp: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
    {
      id: 'tx_03',
      transferId: 'tx_01HXYZ9993',
      sourceWalletId: 'wal_master_001',
      destinationWalletId: 'wal_dest_003',
      amount: { formatted: '$50.00' },
      type: 'DEBIT',
      status: 'PENDING',
      transactionReference: 'TXN_REF_17111501_1029',
      description: 'Coffee Subscription',
      timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'tx_04',
      transferId: 'tx_01HXYZ9994',
      sourceWalletId: 'wal_master_001',
      destinationWalletId: 'wal_dest_004',
      amount: { formatted: '$15,000.00' },
      type: 'DEBIT',
      status: 'FAILED',
      transactionReference: 'TXN_REF_17111201_9921',
      description: 'High Value Overseas Wire',
      timestamp: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    },
  ];

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    const matchesStatus =
      filterStatus === 'ALL' ||
      (filterStatus === 'COMPLETED' && (tx.status === 'COMPLETED' || tx.status === 'SETTLED')) ||
      tx.status === filterStatus;

    const matchesSearch =
      tx.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.transactionReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.transferId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.destinationWalletId?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
      case 'SETTLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Hourglass className="h-3 w-3" />
            Pending
          </span>
        );
      case 'FAILED':
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <AlertCircle className="h-3 w-3" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-800 text-slate-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 bg-[#0A0E1A]/80">
      {/* Title & Filter Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-400" />
            Transaction History & Ledger Activity
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable journal sequence backed by Kafka events & OCC verification
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-medium">
          {['ALL', 'COMPLETED', 'PENDING', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg transition-all text-[11px] cursor-pointer ${
                filterStatus === st
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="mb-6 relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
        <input
          type="text"
          placeholder="Search by description, reference, or recipient wallet..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
        />
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              <th className="pb-3 pl-2">Transaction</th>
              <th className="pb-3">Reference / Ledger ID</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Date & Time</th>
              <th className="pb-3 pr-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                  No transactions found matching your criteria.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const isDebit = tx.type === 'DEBIT';
                return (
                  <tr key={tx.id} className="hover:bg-slate-900/40 transition-colors group">
                    {/* Description & Icon */}
                    <td className="py-3.5 pl-2 font-sans">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-xl flex-shrink-0 ${
                            isDebit
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {isDebit ? (
                            <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
                          ) : (
                            <ArrowDownLeft className="h-4 w-4 stroke-[2.5]" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200">{tx.description}</p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {isDebit ? `To: ${tx.destinationWalletId}` : `From: ${tx.sourceWalletId}`}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Reference */}
                    <td className="py-3.5 text-slate-400 text-[11px]">
                      <span>{tx.transactionReference}</span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5">{getStatusBadge(tx.status)}</td>

                    {/* Timestamp */}
                    <td className="py-3.5 text-slate-400 text-[11px] font-sans">
                      {new Date(tx.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 pr-2 text-right">
                      <span
                        className={`text-sm font-bold ${
                          isDebit ? 'text-slate-200' : 'text-emerald-400'
                        }`}
                      >
                        {isDebit ? '-' : '+'}
                        {tx.amount.formatted}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
