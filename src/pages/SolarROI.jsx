import React, { useState, useEffect } from 'react';
import { Sun, DollarSign, Leaf, Info, ArrowRight, Clock, Award, ShieldCheck, Zap, CheckCircle2, RefreshCw } from 'lucide-react';
import { useHouseholdEnergy } from '../context/ApplianceContext';
import ConnectedDataSourceBadge from '../components/ConnectedDataSourceBadge';

const STATE_CONFIG = {
  // Northern Region
  'Delhi': { tariff: 7.0, sunHours: 5.0, region: 'Northern', discom: 'BSES / TPDDL' },
  'Haryana': { tariff: 7.0, sunHours: 5.2, region: 'Northern', discom: 'DHBVN / UHBVN' },
  'Himachal Pradesh': { tariff: 5.5, sunHours: 4.8, region: 'Northern', discom: 'HPSEBL' },
  'Punjab': { tariff: 7.3, sunHours: 5.1, region: 'Northern', discom: 'PSPCL' },
  'Rajasthan': { tariff: 7.8, sunHours: 5.8, region: 'Northern', discom: 'JVVNL / AVVNL / JdVVNL' },
  'Uttar Pradesh': { tariff: 7.4, sunHours: 5.2, region: 'Northern', discom: 'UPPCL / PVVNL / MVVNL' },
  'Uttarakhand': { tariff: 5.6, sunHours: 4.9, region: 'Northern', discom: 'UPCL' },

  // Western Region
  'Goa': { tariff: 4.8, sunHours: 5.4, region: 'Western', discom: 'Goa Electricity Dept' },
  'Gujarat': { tariff: 6.8, sunHours: 5.6, region: 'Western', discom: 'UGVCL / DGVCL / Torrent' },
  'Maharashtra': { tariff: 8.5, sunHours: 5.2, region: 'Western', discom: 'MSEDCL / Adani / Tata Power' },

  // Southern Region
  'Andhra Pradesh': { tariff: 7.3, sunHours: 5.5, region: 'Southern', discom: 'APCPDCL / APEPDCL / APSPDCL' },
  'Karnataka': { tariff: 8.0, sunHours: 5.3, region: 'Southern', discom: 'BESCOM / MESCOM / HESCOM' },
  'Kerala': { tariff: 6.9, sunHours: 4.9, region: 'Southern', discom: 'KSEBL' },
  'Tamil Nadu': { tariff: 7.2, sunHours: 5.4, region: 'Southern', discom: 'TANGEDCO' },
  'Telangana': { tariff: 7.5, sunHours: 5.4, region: 'Southern', discom: 'TSSPDCL / TSNPDCL' },

  // Eastern Region
  'Bihar': { tariff: 7.1, sunHours: 5.1, region: 'Eastern', discom: 'NBPDCL / SBPDCL' },
  'Jharkhand': { tariff: 6.5, sunHours: 5.1, region: 'Eastern', discom: 'JBVNL' },
  'Odisha': { tariff: 6.0, sunHours: 5.2, region: 'Eastern', discom: 'TPCODL / TPNODL / TPSODL' },
  'West Bengal': { tariff: 7.6, sunHours: 4.8, region: 'Eastern', discom: 'WBSEDCL / CESC' },

  // Central Region
  'Chhattisgarh': { tariff: 6.4, sunHours: 5.3, region: 'Central', discom: 'CSPDCL' },
  'Madhya Pradesh': { tariff: 7.5, sunHours: 5.5, region: 'Central', discom: 'MPPKVVCL / MPMKVVCL' },

  // North-Eastern Region
  'Arunachal Pradesh': { tariff: 5.2, sunHours: 4.3, region: 'North-Eastern', discom: 'Power Dept Arunachal' },
  'Assam': { tariff: 7.2, sunHours: 4.4, region: 'North-Eastern', discom: 'APDCL' },
  'Manipur': { tariff: 6.0, sunHours: 4.5, region: 'North-Eastern', discom: 'MSPDCL' },
  'Meghalaya': { tariff: 5.8, sunHours: 4.2, region: 'North-Eastern', discom: 'MePDCL' },
  'Mizoram': { tariff: 5.7, sunHours: 4.6, region: 'North-Eastern', discom: 'P&E Dept Mizoram' },
  'Nagaland': { tariff: 6.2, sunHours: 4.4, region: 'North-Eastern', discom: 'Power Dept Nagaland' },
  'Sikkim': { tariff: 4.5, sunHours: 4.1, region: 'North-Eastern', discom: 'Power Dept Sikkim' },
  'Tripura': { tariff: 5.9, sunHours: 4.5, region: 'North-Eastern', discom: 'TSECL' },

  // Union Territories
  'Andaman & Nicobar Islands': { tariff: 6.8, sunHours: 4.7, region: 'Union Territory', discom: 'Electricity Dept A&N' },
  'Chandigarh': { tariff: 5.8, sunHours: 5.2, region: 'Union Territory', discom: 'Chandigarh Electricity Dept' },
  'Dadra & Nagar Haveli and Daman & Diu': { tariff: 5.2, sunHours: 5.5, region: 'Union Territory', discom: 'DNH Power' },
  'Jammu & Kashmir': { tariff: 4.8, sunHours: 4.9, region: 'Union Territory', discom: 'JPDCL / KPDCL' },
  'Ladakh': { tariff: 4.6, sunHours: 5.6, region: 'Union Territory', discom: 'Power Dept Ladakh' },
  'Lakshadweep': { tariff: 6.5, sunHours: 5.1, region: 'Union Territory', discom: 'Lakshadweep Electricity' },
  'Puducherry': { tariff: 5.4, sunHours: 5.3, region: 'Union Territory', discom: 'Electricity Dept Puducherry' },

  'Other': { tariff: 7.5, sunHours: 5.0, region: 'General', discom: 'National Average' },
};

const SolarROI = () => {
  const { householdBaseline } = useHouseholdEnergy();

  const [inputs, setInputs] = useState({
    monthlyBill: householdBaseline?.currentBill || 3500,
    roofArea: 400,
    location: 'Maharashtra',
    sunHours: 5.2
  });
  const [isCalculated, setIsCalculated] = useState(false);

  // Sync with household baseline when available and user hasn't overridden
  useEffect(() => {
    if (householdBaseline?.currentBill && householdBaseline.currentBill > 0) {
      setInputs(prev => ({
        ...prev,
        monthlyBill: householdBaseline.currentBill
      }));
    }
  }, [householdBaseline?.currentBill]);

  const calculateSolar = (bill, area, loc, customSunHrs) => {
    const validBill = Math.max(200, Number(bill) || 3500);
    const validArea = Math.max(50, Number(area) || 400);
    const cfg = STATE_CONFIG[loc] || STATE_CONFIG['Other'];
    const avgTariff = cfg.tariff;
    const sunHrs = Number(customSunHrs) || cfg.sunHours;

    const monthlyKwhTarget = validBill / avgTariff;
    const capacityByArea = validArea / 100; // ~100 sq ft per kWp
    const genPerKwPerMonth = sunHrs * 30 * 0.78; // 0.78 performance ratio
    const capacityByBill = monthlyKwhTarget / Math.max(60, genPerKwPerMonth);

    // Recommended capacity capped to available roof area
    const rawCapacity = Math.min(capacityByArea, Math.max(1, capacityByBill));
    const recommendedCapacity = Math.max(1, Math.round(rawCapacity * 10) / 10);

    const monthlyGenerationKwh = Math.round(recommendedCapacity * genPerKwPerMonth);
    const grossCost = Math.round(recommendedCapacity * 60000); // ₹60k/kWp benchmark

    // PM Surya Ghar Muft Bijli Yojana Central Financial Assistance (Subsidy)
    let subsidy = 0;
    if (recommendedCapacity <= 2) {
      subsidy = Math.round(recommendedCapacity * 30000);
    } else if (recommendedCapacity <= 3) {
      subsidy = Math.round(60000 + (recommendedCapacity - 2) * 18000);
    } else {
      subsidy = 78000; // Cap at ₹78,000 for residential > 3 kWp
    }

    const netCost = Math.max(15000, grossCost - subsidy);
    const monthlySavings = Math.round(Math.min(validBill * 0.95, monthlyGenerationKwh * avgTariff));
    const annualSavings = monthlySavings * 12;
    const paybackYears = Math.round((netCost / Math.max(1000, annualSavings)) * 10) / 10;
    const longTermSavings = Math.round((annualSavings * 25) - netCost);
    const roiPercentage = Math.round((longTermSavings / Math.max(1, netCost)) * 100);
    const co2Reduction = Math.round(recommendedCapacity * 1250);

    return {
      capacity: recommendedCapacity,
      monthlyGen: monthlyGenerationKwh,
      grossCost,
      subsidy,
      netCost,
      monthlySavings,
      annualSavings,
      payback: paybackYears,
      longTermSavings,
      roi: roiPercentage,
      co2: co2Reduction,
      tariff: avgTariff
    };
  };

  const [results, setResults] = useState(() => 
    calculateSolar(inputs.monthlyBill, inputs.roofArea, inputs.location, inputs.sunHours)
  );

  // Automatically recalculate whenever inputs change
  useEffect(() => {
    const updated = calculateSolar(inputs.monthlyBill, inputs.roofArea, inputs.location, inputs.sunHours);
    setResults(updated);
  }, [inputs.monthlyBill, inputs.roofArea, inputs.location, inputs.sunHours]);

  const handleLocationChange = (e) => {
    const newLoc = e.target.value;
    const cfg = STATE_CONFIG[newLoc] || STATE_CONFIG['Other'];
    setInputs((prev) => ({
      ...prev,
      location: newLoc,
      sunHours: cfg.sunHours,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const res = calculateSolar(inputs.monthlyBill, inputs.roofArea, inputs.location, inputs.sunHours);
    setResults(res);
    setIsCalculated(true);
    setTimeout(() => setIsCalculated(false), 1500);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-white">Rooftop Solar ROI Calculator</h1>
            <ConnectedDataSourceBadge />
          </div>
          <p className="text-slate-400 text-sm">Estimate rooftop capacity, installation cost, government subsidy, and 25-year financial savings based on your household consumption.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Input Details Form */}
        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-sm h-fit space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h3 className="text-xl font-bold text-white">Household & Solar Inputs</h3>
            {inputs.monthlyBill !== householdBaseline.currentBill && (
              <button
                type="button"
                onClick={() => setInputs(prev => ({ ...prev, monthlyBill: householdBaseline.currentBill }))}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                title="Reset bill to match current household baseline"
              >
                <RefreshCw className="w-3 h-3" />
                Reset to ₹{householdBaseline.currentBill}
              </button>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">Avg. Monthly Electricity Bill (₹)</label>
                <span className="text-[10px] text-slate-400">
                  Default: {householdBaseline.sourceLabel}
                </span>
              </div>
              <input 
                type="number" 
                min="200"
                step="100"
                value={inputs.monthlyBill}
                onChange={(e) => setInputs({ ...inputs, monthlyBill: Number(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all text-sm font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Available Shade-Free Roof Area (Sq. Ft.)</label>
              <input 
                type="number" 
                min="100"
                step="50"
                value={inputs.roofArea}
                onChange={(e) => setInputs({ ...inputs, roofArea: Number(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all text-sm"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">State / Region (All India)</label>
                <span className="text-[10px] text-amber-400 font-medium">36 States & UTs</span>
              </div>
              <select
                id="solar-state-select"
                value={inputs.location}
                onChange={handleLocationChange}
                className="w-full bg-slate-900 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all text-sm"
              >
                <optgroup label="Northern Region" className="bg-slate-900 font-bold text-yellow-400">
                  <option value="Delhi" className="text-white">Delhi NCR (₹7.0/kWh • 5.0 hrs sun)</option>
                  <option value="Haryana" className="text-white">Haryana (₹7.0/kWh • 5.2 hrs sun)</option>
                  <option value="Himachal Pradesh" className="text-white">Himachal Pradesh (₹5.5/kWh • 4.8 hrs sun)</option>
                  <option value="Punjab" className="text-white">Punjab (₹7.3/kWh • 5.1 hrs sun)</option>
                  <option value="Rajasthan" className="text-white">Rajasthan (₹7.8/kWh • 5.8 hrs sun)</option>
                  <option value="Uttar Pradesh" className="text-white">Uttar Pradesh (₹7.4/kWh • 5.2 hrs sun)</option>
                  <option value="Uttarakhand" className="text-white">Uttarakhand (₹5.6/kWh • 4.9 hrs sun)</option>
                </optgroup>
                <optgroup label="Western Region" className="bg-slate-900 font-bold text-yellow-400">
                  <option value="Goa" className="text-white">Goa (₹4.8/kWh • 5.4 hrs sun)</option>
                  <option value="Gujarat" className="text-white">Gujarat (₹6.8/kWh • 5.6 hrs sun)</option>
                  <option value="Maharashtra" className="text-white">Maharashtra (₹8.5/kWh • 5.2 hrs sun)</option>
                </optgroup>
                <optgroup label="Southern Region" className="bg-slate-900 font-bold text-yellow-400">
                  <option value="Andhra Pradesh" className="text-white">Andhra Pradesh (₹7.3/kWh • 5.5 hrs sun)</option>
                  <option value="Karnataka" className="text-white">Karnataka (₹8.0/kWh • 5.3 hrs sun)</option>
                  <option value="Kerala" className="text-white">Kerala (₹6.9/kWh • 4.9 hrs sun)</option>
                  <option value="Tamil Nadu" className="text-white">Tamil Nadu (₹7.2/kWh • 5.4 hrs sun)</option>
                  <option value="Telangana" className="text-white">Telangana (₹7.5/kWh • 5.4 hrs sun)</option>
                </optgroup>
                <optgroup label="Eastern Region" className="bg-slate-900 font-bold text-yellow-400">
                  <option value="Bihar" className="text-white">Bihar (₹7.1/kWh • 5.1 hrs sun)</option>
                  <option value="Jharkhand" className="text-white">Jharkhand (₹6.5/kWh • 5.1 hrs sun)</option>
                  <option value="Odisha" className="text-white">Odisha (₹6.0/kWh • 5.2 hrs sun)</option>
                  <option value="West Bengal" className="text-white">West Bengal (₹7.6/kWh • 4.8 hrs sun)</option>
                </optgroup>
                <optgroup label="Central Region" className="bg-slate-900 font-bold text-yellow-400">
                  <option value="Chhattisgarh" className="text-white">Chhattisgarh (₹6.4/kWh • 5.3 hrs sun)</option>
                  <option value="Madhya Pradesh" className="text-white">Madhya Pradesh (₹7.5/kWh • 5.5 hrs sun)</option>
                </optgroup>
                <optgroup label="North-Eastern Region" className="bg-slate-900 font-bold text-yellow-400">
                  <option value="Arunachal Pradesh" className="text-white">Arunachal Pradesh (₹5.2/kWh • 4.3 hrs sun)</option>
                  <option value="Assam" className="text-white">Assam (₹7.2/kWh • 4.4 hrs sun)</option>
                  <option value="Manipur" className="text-white">Manipur (₹6.0/kWh • 4.5 hrs sun)</option>
                  <option value="Meghalaya" className="text-white">Meghalaya (₹5.8/kWh • 4.2 hrs sun)</option>
                  <option value="Mizoram" className="text-white">Mizoram (₹5.7/kWh • 4.6 hrs sun)</option>
                  <option value="Nagaland" className="text-white">Nagaland (₹6.2/kWh • 4.4 hrs sun)</option>
                  <option value="Sikkim" className="text-white">Sikkim (₹4.5/kWh • 4.1 hrs sun)</option>
                  <option value="Tripura" className="text-white">Tripura (₹5.9/kWh • 4.5 hrs sun)</option>
                </optgroup>
                <optgroup label="Union Territories" className="bg-slate-900 font-bold text-yellow-400">
                  <option value="Andaman & Nicobar Islands" className="text-white">Andaman & Nicobar Islands (₹6.8/kWh • 4.7 hrs sun)</option>
                  <option value="Chandigarh" className="text-white">Chandigarh (₹5.8/kWh • 5.2 hrs sun)</option>
                  <option value="Dadra & Nagar Haveli and Daman & Diu" className="text-white">Dadra & Nagar Haveli and Daman & Diu (₹5.2/kWh • 5.5 hrs)</option>
                  <option value="Jammu & Kashmir" className="text-white">Jammu & Kashmir (₹4.8/kWh • 4.9 hrs sun)</option>
                  <option value="Ladakh" className="text-white">Ladakh (₹4.6/kWh • 5.6 hrs sun)</option>
                  <option value="Lakshadweep" className="text-white">Lakshadweep (₹6.5/kWh • 5.1 hrs sun)</option>
                  <option value="Puducherry" className="text-white">Puducherry (₹5.4/kWh • 5.3 hrs sun)</option>
                </optgroup>
                <optgroup label="Custom / Other" className="bg-slate-900 font-bold text-yellow-400">
                  <option value="Other" className="text-white">Other / National Benchmark (₹7.5/kWh • 5.0 hrs)</option>
                </optgroup>
              </select>

              {STATE_CONFIG[inputs.location] && (
                <div className="mt-2.5 p-3 bg-white/[0.04] border border-white/10 rounded-2xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Region / Zone</span>
                    <span className="font-semibold text-yellow-400">{STATE_CONFIG[inputs.location].region} Region</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Major DISCOMs</span>
                    <span className="font-medium text-slate-200 text-right truncate max-w-[180px]" title={STATE_CONFIG[inputs.location].discom}>
                      {STATE_CONFIG[inputs.location].discom}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Benchmark Tariff</span>
                    <span className="font-mono font-bold text-white">₹{STATE_CONFIG[inputs.location].tariff} / kWh</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Peak Sun Hours / Day (Avg: {inputs.sunHours} hrs)</label>
              <input 
                id="solar-sun-hours-input"
                type="number" 
                min="3"
                max="8"
                step="0.1"
                value={inputs.sunHours}
                onChange={(e) => setInputs({ ...inputs, sunHours: Number(e.target.value) })}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 px-4 text-white focus:ring-2 focus:ring-yellow-500/50 outline-none transition-all text-sm"
              />
            </div>

            <button 
              id="recalculate-roi-btn"
              type="submit" 
              className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-400 hover:to-amber-500 text-slate-950 font-bold py-4 rounded-2xl transition-all shadow-lg shadow-yellow-500/20 flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {isCalculated ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-slate-950" />
                  <span>ROI Recalculated!</span>
                </>
              ) : (
                <>
                  <span>Recalculate ROI</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results & Financial Analysis Overview */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Top Capacity & CO2 Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            
            <div className="bg-gradient-to-br from-yellow-500/15 via-amber-500/10 to-transparent border border-yellow-500/30 p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <Sun className="w-8 h-8 text-yellow-400" />
                <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-300 px-2.5 py-1 rounded-full uppercase tracking-wider border border-yellow-500/30">
                  Capacity
                </span>
              </div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Recommended System</p>
              <h3 className="text-3xl font-black text-white">{results.capacity} <span className="text-base font-bold text-yellow-400">kWp</span></h3>
              <p className="text-[11px] text-slate-400 mt-2">Generates ~{results.monthlyGen} kWh / month</p>
            </div>

            <div className="bg-gradient-to-br from-green-500/15 via-emerald-500/10 to-transparent border border-green-500/30 p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <Leaf className="w-8 h-8 text-green-400" />
                <span className="text-[10px] font-bold bg-green-500/20 text-green-300 px-2.5 py-1 rounded-full uppercase tracking-wider border border-green-500/30">
                  Eco Offset
                </span>
              </div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Annual CO₂ Reduction</p>
              <h3 className="text-3xl font-black text-white">{results.co2.toLocaleString()} <span className="text-base font-bold text-green-400">kg</span></h3>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">Equivalent to planting ~{Math.round(results.co2 / 20)} trees</p>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-transparent border border-cyan-500/30 p-6 rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <Award className="w-8 h-8 text-cyan-400" />
                <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-full uppercase tracking-wider border border-cyan-500/30">
                  25-Yr ROI
                </span>
              </div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Return on Investment</p>
              <h3 className="text-3xl font-black text-cyan-400">{results.roi}%</h3>
              <p className="text-[11px] text-slate-400 mt-2 font-medium">25-Yr Savings: ₹{results.longTermSavings.toLocaleString()}</p>
            </div>

          </div>

          {/* Financial Breakdown Panel */}
          <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-sm space-y-6">
            <h3 className="text-xl font-bold text-white border-b border-white/10 pb-4">Detailed Financial Breakdown</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
                  <DollarSign className="w-4 h-4 text-slate-400" /> Gross System Cost
                </p>
                <p className="text-xl font-bold text-white">₹{results.grossCost.toLocaleString()}</p>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-green-400" /> Govt PM Subsidy
                </p>
                <p className="text-xl font-bold text-green-400">- ₹{results.subsidy.toLocaleString()}</p>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
                  <Zap className="w-4 h-4 text-yellow-400" /> Net Out-Of-Pocket Cost
                </p>
                <p className="text-xl font-bold text-yellow-400">₹{results.netCost.toLocaleString()}</p>
              </div>

              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-xs text-slate-400 mb-1 flex items-center gap-1.5 font-medium">
                  <Clock className="w-4 h-4 text-cyan-400" /> Payback Period
                </p>
                <p className="text-xl font-bold text-cyan-400">{results.payback} Years</p>
              </div>
            </div>

            {/* Savings Timeline */}
            <div className="p-6 bg-white/[0.03] border border-white/10 rounded-2xl space-y-3">
              <div className="flex justify-between items-center text-sm font-semibold text-slate-200">
                <span>Estimated Monthly Savings</span>
                <span className="text-green-400 font-bold text-base">₹{results.monthlySavings.toLocaleString()} / month</span>
              </div>
              <div className="flex justify-between items-center text-sm font-semibold text-slate-200">
                <span>Estimated Annual Savings</span>
                <span className="text-green-400 font-bold text-base">₹{results.annualSavings.toLocaleString()} / year</span>
              </div>
              <div className="flex justify-between items-center text-sm font-semibold text-slate-200 pt-2 border-t border-white/10">
                <span>25-Year Cumulative Net Savings</span>
                <span className="text-cyan-400 font-bold text-lg">₹{results.longTermSavings.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* PM Surya Ghar Subsidy Banner */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 p-6 rounded-3xl flex items-start gap-4 text-left">
            <Info className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm text-yellow-200/90 leading-relaxed space-y-1">
              <strong className="text-white font-bold block text-sm">PM Surya Ghar: Muft Bijli Yojana Subsidy Applied</strong>
              <p>
                Under current Ministry of New and Renewable Energy (MNRE) guidelines, residential systems up to 2 kW receive ₹30,000/kW and 3 kW systems receive up to ₹78,000 total subsidy.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SolarROI;

