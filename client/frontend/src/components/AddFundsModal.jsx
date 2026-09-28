import React, { useState } from 'react';
import { X, PlusCircle, CheckCircle2, DollarSign, CreditCard } from 'lucide-react';
import { useQuery } from '@apollo/client';
import { GET_MY_WALLET, GET_TRANSACTION_HISTORY } from '../graphql/queries';

export default function AddFundsModal({ isOpen, onClose }) {
  const [amount, setAmount] = useState('500.00');
  const [source, setSource] = useState('ACH_CHECKING');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { refetch: refetchWallet } = useQuery(GET_MY_WALLET);
  const { refetch: refetchTransactions } = useQuery(GET_TRANSACTION_HISTORY);

  if (!isOpen) return null;

  const handleDeposit = (e) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(async () => {
      setLoading(false);
      setSuccess(true);
      await refetchWallet();
      await refetchTransactions();
    }, 700);
  };

  const handleClose = () => {
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md p-6 sm:p-8 glass-panel rounded-3xl border border-cyan-500/20 bg-[#0E1528] shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {!success ? (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
                <PlusCircle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Deposit Funds</h2>
                <p className="text-xs text-slate-400">Top-up liquidity into your Flow core wallet</p>
              </div>
            </div>

            <form onSubmit={handleDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Funding Source</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="ACH_CHECKING">Linked Checking Account (••• 4912) - Fee: $0</option>
                  <option value="DEBIT_CARD">Visa Instant Debit Card (••• 8812) - Fee: $0</option>
                  <option value="FEDNOW">FedNow / RTP Instant Rail - Instant</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Deposit Amount (USD)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-2.5 h-5 w-5 text-slate-500" />
                  <input
                    type="number"
                    step="10"
                    min="10"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-lg font-mono font-bold text-white focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[100, 500, 1000, 2500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset.toFixed(2))}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-mono text-cyan-400"
                    >
                      +${preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-slate-950 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Initiating ACH Deposit...' : 'Confirm Instant Top-Up'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="text-center py-4 animate-in zoom-in-95">
            <div className="inline-flex p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-3">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white">Deposit Confirmed</h3>
            <p className="text-xs text-slate-400 mt-1">
              ${parseFloat(amount).toFixed(2)} has been credited to your available balance.
            </p>
            <button
              onClick={handleClose}
              className="mt-6 w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs tracking-wider uppercase"
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
