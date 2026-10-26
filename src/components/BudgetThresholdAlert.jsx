import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AlertTriangle, CheckCircle2, DollarSign, 
  Edit3, ArrowRight, X, ShieldAlert, Sliders
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useHouseholdEnergy } from '../context/ApplianceContext';

const BUDGET_PRESETS = [2500, 3000, 3500, 4000, 5000, 6000];

const BudgetThresholdAlert = ({ compact = false, showStatusWhenNormal = true }) => {
  const { 
    monthlyBudget, 
    setMonthlyBudget, 
    isBudgetExceeded, 
    budgetOverrun, 
    budgetUsagePercent,
    householdBaseline
  } = useHouseholdEnergy();

  const [isEditing, setIsEditing] = useState(false);
  const [customBudgetInput, setCustomBudgetInput] = useState(String(monthlyBudget));
  const [isDismissed, setIsDismissed] = useState(false);

  const currentBill = householdBaseline?.currentBill || 0;
  const currentKwh = householdBaseline?.currentMonthlyKwh || householdBaseline?.currentKwh || 0;

  const handleSaveBudget = (e) => {
    e?.preventDefault();
    const val = Number(customBudgetInput);
    if (!isNaN(val) && val > 0) {
      setMonthlyBudget(val);
      setIsEditing(false);
      setIsDismissed(false);
    }
  };

  const handlePresetSelect = (preset) => {
    setCustomBudgetInput(String(preset));
    setMonthlyBudget(preset);
    setIsEditing(false);
    setIsDismissed(false);
  };

  // If budget is exceeded and banner is not dismissed
  if (isBudgetExceeded) {
    if (isDismissed && !compact) {
      return (
        <div className="bg-red-500/10 border border-red-500/30 px-4 py-2.5 rounded-2xl flex items-center justify-between gap-3 text-xs text-red-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="font-bold text-red-400">Budget Exceeded:</span>
            <span>Est. Bill ₹{currentBill.toLocaleString()} &gt; Budget ₹{monthlyBudget.toLocaleString()} (+₹{budgetOverrun.toLocaleString()})</span>
          </div>
          <button 
            onClick={() => setIsDismissed(false)}
            className="text-white hover:text-red-200 underline text-xs font-semibold cursor-pointer"
          >
            Show Details & Adjust
          </button>
        </div>
      );
    }

    return (
      <div 
        id="budget-threshold-notification-banner"
        className={`relative overflow-hidden rounded-3xl border transition-all ${
          compact 
            ? 'p-4 bg-red-950/60 border-red-500/40 text-red-200' 
            : 'p-6 bg-gradient-to-r from-red-950/90 via-slate-900 to-red-950/70 border-red-500/50 shadow-xl shadow-red-500/10'
        }`}
      >
        {/* Ambient warning background glow */}
        <div className="absolute -right-10 -top-10 w-48 h-48 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Warning Icon & Text */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0 shadow-lg shadow-red-500/20">
              <AlertTriangle className="w-6 h-6 animate-pulse text-red-400" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" /> Threshold Exceeded
                </span>
                <span className="text-xs font-mono font-bold text-red-400">
                  {budgetUsagePercent}% of Defined Budget
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                Estimated Monthly Bill Over Budget Limit
              </h3>

              <p className="text-xs sm:text-sm text-red-200/90 mt-1 max-w-2xl leading-relaxed">
                Your estimated monthly bill of <strong className="text-white font-extrabold underline decoration-red-500 underline-offset-2">₹{currentBill.toLocaleString()}</strong> ({currentKwh} kWh) exceeds your monthly budget of <strong className="text-white font-bold">₹{monthlyBudget.toLocaleString()}</strong> by <strong className="text-red-400 font-extrabold bg-red-950/80 px-2 py-0.5 rounded-lg border border-red-500/30">+₹{budgetOverrun.toLocaleString()}</strong>.
                Usage data and cost metrics are highlighted in red below.
              </p>
            </div>
          </div>

          {/* Action Buttons & Budget Config */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              id="adjust-budget-btn"
              onClick={() => {
                setCustomBudgetInput(String(monthlyBudget));
                setIsEditing(!isEditing);
              }}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-red-400" />
              <span>{isEditing ? 'Close' : 'Adjust Budget'}</span>
            </button>

            <Link
              to="/dashboard/appliances"
              className="px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <span>Reduce Load</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            {!compact && (
              <button
                onClick={() => setIsDismissed(true)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-all cursor-pointer"
                title="Minimize banner"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Inline Quick Budget Editor Drawer */}
        <AnimatePresence>
          {isEditing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-5 pt-5 border-t border-red-500/20 overflow-hidden"
            >
              <form onSubmit={handleSaveBudget} className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-white flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                    Configure Monthly Threshold (₹ INR):
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Enter a higher budget or select a preset to clear the alert
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[200px]">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={customBudgetInput}
                      onChange={(e) => setCustomBudgetInput(e.target.value)}
                      placeholder="e.g., 4000"
                      className="w-full bg-slate-950 border border-white/20 rounded-xl py-2 pl-8 pr-3 text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-xs rounded-xl shadow-md shadow-cyan-500/20 cursor-pointer transition-all"
                  >
                    Save Threshold
                  </button>
                </div>

                {/* Presets */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">Quick Presets:</span>
                  {BUDGET_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetSelect(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        monthlyBudget === preset
                          ? 'bg-cyan-500 text-white font-bold'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                      }`}
                    >
                      ₹{preset.toLocaleString()}
                    </button>
                  ))}
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // When within budget (Normal / Healthy state)
  if (!showStatusWhenNormal) return null;

  return (
    <div 
      id="budget-threshold-normal-widget"
      className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 shrink-0">
          <CheckCircle2 className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">Monthly Energy Budget:</span>
            <span className="font-mono text-cyan-300 font-semibold">₹{currentBill.toLocaleString()} / ₹{monthlyBudget.toLocaleString()}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/25 font-bold">
              {budgetUsagePercent}% (Within Budget)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Estimated bill is ₹{(monthlyBudget - currentBill).toLocaleString()} below your set threshold limit.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isEditing ? (
          <form onSubmit={handleSaveBudget} className="flex items-center gap-2">
            <input
              type="number"
              min="100"
              step="100"
              value={customBudgetInput}
              onChange={(e) => setCustomBudgetInput(e.target.value)}
              className="w-24 bg-slate-900 border border-white/20 rounded-lg py-1 px-2 text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <button
              type="submit"
              className="px-2.5 py-1 bg-cyan-500 text-white rounded-lg font-bold text-xs hover:bg-cyan-600 transition-all cursor-pointer"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => {
              setCustomBudgetInput(String(monthlyBudget));
              setIsEditing(true);
            }}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 rounded-xl font-medium transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 className="w-3 h-3 text-cyan-400" />
            <span>Set Budget</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default BudgetThresholdAlert;
