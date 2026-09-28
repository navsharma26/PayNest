import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { SEND_MONEY } from '../graphql/mutations';
import { GET_MY_WALLET, GET_TRANSACTION_HISTORY, GET_MY_REWARDS } from '../graphql/queries';
import {
  X,
  Send,
  Phone,
  DollarSign,
  FileText,
  Lock,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  Clock,
  Gift,
} from 'lucide-react';

export default function SendMoneyModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1); // 1: Input details, 2: PIN confirmation, 3: Success Receipt
  const [recipientPhone, setRecipientPhone] = useState('+1-555-FLOW-RCVR');
  const [amount, setAmount] = useState('150.00');
  const [note, setNote] = useState('Dinner split');
  const [pin, setPin] = useState('');
  const [validationError, setValidationError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const { data: walletData } = useQuery(GET_MY_WALLET);
  const availableBalance = parseFloat(
    walletData?.myWallet?.availableBalance?.formatted?.replace(/[$,]/g, '') || '25450.00'
  );

  const [sendMoneyMutation, { loading }] = useMutation(SEND_MONEY, {
    refetchQueries: [
      { query: GET_MY_WALLET },
      { query: GET_TRANSACTION_HISTORY, variables: { limit: 10 } },
      { query: GET_MY_REWARDS },
    ],
  });

  if (!isOpen) return null;

  const handleNextToPin = (e) => {
    e.preventDefault();
    setValidationError(null);
    setApiError(null);

    const numAmount = parseFloat(amount);
    if (!recipientPhone.trim()) {
      setValidationError('Please enter a recipient phone number.');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setValidationError('Amount must be greater than $0.00');
      return;
    }
    if (numAmount > availableBalance) {
      setValidationError(
        `Insufficient available funds. Your available balance is $${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`
      );
      return;
    }

    setStep(2);
  };

  const handleConfirmTransfer = async (e) => {
    e.preventDefault();
    if (pin.length < 4) {
      setValidationError('Please enter your 4-digit Security PIN.');
      return;
    }

    setValidationError(null);
    setApiError(null);

    try {
      const response = await sendMoneyMutation({
        variables: {
          recipientPhone: recipientPhone.trim(),
          amount: parseFloat(amount),
          note: note.trim() || 'P2P Instant Transfer',
        },
      });

      const data = response.data?.sendMoney;
      if (data && data.success) {
        setReceipt(data);
        setStep(3);
      } else {
        setApiError(data?.errorMessage || 'Transaction failed. Please check ledger status.');
      }
    } catch (err) {
      const graphQLErrors = err.graphQLErrors || [];
      const errorCode = graphQLErrors[0]?.extensions?.code;
      const errorMsg = graphQLErrors[0]?.message || err.message;

      if (errorCode === 'FRAUD_REJECTED') {
        setApiError('🚨 FRAUD ALERT TRIGGERED: Transaction blocked due to high velocity or risk policy.');
      } else if (errorCode === 'INSUFFICIENT_FUNDS') {
        setApiError('Transaction Rejected: Insufficient available liquidity in wallet.');
      } else {
        setApiError(errorMsg);
      }
    }
  };

  const handleResetAndClose = () => {
    setStep(1);
    setPin('');
    setValidationError(null);
    setApiError(null);
    setReceipt(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg p-6 sm:p-8 glass-panel rounded-3xl border border-cyan-500/20 bg-[#0E1528] shadow-2xl shadow-cyan-950/60">
        {/* Close Button */}
        <button
          onClick={handleResetAndClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* STEP 1: Transfer Inputs */}
        {step === 1 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl text-cyan-400">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Send Money</h2>
                <p className="text-xs text-slate-400">
                  Instant settlement via Kafka event stream & gRPC ledger
                </p>
              </div>
            </div>

            {/* Error alerts */}
            {validationError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <form onSubmit={handleNextToPin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Recipient Phone Number or Wallet
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+1-555-FLOW-RCVR"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setRecipientPhone('+1-555-FLOW-RCVR')}
                    className="text-[10px] text-cyan-400/80 hover:text-cyan-300 font-mono underline"
                  >
                    Use Demo Receiver (+1-555-FLOW-RCVR)
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-300">Amount (USD)</label>
                  <span className="text-[11px] font-mono text-slate-400">
                    Avail: ${availableBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-3.5 top-2.5 h-5 w-5 text-slate-500" />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-base font-mono font-bold text-white focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Note / Statement Description
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Dinner, Rent, Invoice #1024"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-slate-950 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  <span>Review Transfer Details</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: PIN Confirmation */}
        {step === 2 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Authorize Settlement</h2>
                <p className="text-xs text-slate-400">Enter your 4-digit Security PIN to sign transfer</p>
              </div>
            </div>

            {/* Summary Ticket */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 mb-6 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Sending Amount:</span>
                <span className="font-mono font-bold text-white text-base">
                  ${parseFloat(amount).toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Recipient:</span>
                <span className="font-mono text-cyan-300">{recipientPhone}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Description:</span>
                <span className="text-slate-300">{note}</span>
              </div>
              <div className="flex justify-between text-slate-400 pt-2 border-t border-slate-800/80">
                <span>Cashback Reward (1.5%):</span>
                <span className="font-mono text-amber-400 font-semibold">
                  +{Math.round(parseFloat(amount) * 0.015 * 100)} Flow Points
                </span>
              </div>
            </div>

            {/* Immediate API Error Banner */}
            {apiError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-start gap-2.5">
                <ShieldAlert className="h-5 w-5 text-rose-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Authorization Denied</p>
                  <p className="text-[11px] mt-0.5 text-rose-300/90">{apiError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleConfirmTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2 text-center">
                  Security PIN
                </label>
                <div className="flex justify-center">
                  <input
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    autoFocus
                    className="w-40 text-center tracking-[0.6em] text-2xl py-2 bg-slate-900 border border-slate-700 rounded-xl text-cyan-300 font-mono focus:outline-none focus:border-cyan-400"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-500 text-center mt-2">
                  (Demo environment: any 4-digit PIN e.g. 1234)
                </p>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-semibold text-xs transition-all hover:bg-slate-800"
                >
                  Back
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-600 hover:from-cyan-300 hover:to-indigo-500 text-slate-950 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      <span>Settling via gRPC...</span>
                    </>
                  ) : (
                    <span>Execute Atomic Transfer</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: Success Receipt */}
        {step === 3 && receipt && (
          <div className="text-center py-2 animate-in zoom-in-95">
            <div className="inline-flex p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-4 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <h2 className="text-2xl font-extrabold text-white tracking-tight">Payment Settled!</h2>
            <p className="text-xs text-slate-400 mt-1">
              Funds debited atomically and emitted to Kafka event stream
            </p>

            <div className="my-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Sent:</span>
                <span className="text-white font-bold">{receipt.amountTransferred?.formatted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transaction Ref:</span>
                <span className="text-cyan-400">{receipt.transactionReference}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transfer ID:</span>
                <span className="text-slate-300 text-[11px]">{receipt.transferId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">New Available Balance:</span>
                <span className="text-emerald-400">{receipt.sourceRemainingBalance?.formatted}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800 text-amber-300 font-semibold">
                <span className="flex items-center gap-1">
                  <Gift className="h-3.5 w-3.5" />
                  Rewards Earned:
                </span>
                <span>+{receipt.rewardPointsEarned} Flow Points</span>
              </div>
            </div>

            <button
              onClick={handleResetAndClose}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs tracking-wider uppercase transition-all"
            >
              Done & Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
