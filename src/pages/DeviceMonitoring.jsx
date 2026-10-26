import React, { useState, useEffect } from 'react';
import { 
  Zap, Play, Square, Pause, RotateCcw, AlertTriangle, ShieldCheck, 
  Activity, Thermometer, Battery, Cpu, HardDrive, Wrench, RefreshCw, 
  CheckCircle2, Sparkles, Sliders, Info, Clock, AlertCircle, Laptop, Gauge
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const DeviceMonitoring = () => {
  const [activeTab, setActiveTab] = useState('ac_simulator'); // 'ac_simulator' | 'laptop_primary'
  const [monitoringData, setMonitoringData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [mistralPrompt, setMistralPrompt] = useState('');
  const [customExplanation, setCustomExplanation] = useState('');
  const [generatingExplanation, setGeneratingExplanation] = useState(false);

  // Poll live telemetry every 2 seconds
  const fetchTelemetry = async () => {
    try {
      const res = await fetch('/api/devices/monitoring');
      if (res.ok) {
        const data = await res.json();
        setMonitoringData(data);
      }
    } catch (err) {
      console.error('Failed to fetch device monitoring data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(interval);
  }, []);

  // Simulator Controls Call
  const handleSimulatorControl = async (payload) => {
    try {
      setActionLoading(true);
      await fetch('/api/simulator/ac/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await fetchTelemetry();
    } catch (err) {
      console.error('Failed simulator control action:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Ask Mistral AI
  const handleAskMistral = async (device) => {
    if (!device) return;
    try {
      setGeneratingExplanation(true);
      const res = await fetch('/api/ai/mistral/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: mistralPrompt || `Provide detailed breakdown and maintenance advice for ${device.device_name} with health ${device.health?.health_status}.`,
          context: {
            device_name: device.device_name,
            health_status: device.health?.health_status,
            power_w: device.latest_telemetry?.power_w,
            operating_state: device.latest_telemetry?.operating_state,
            reasons: device.health?.anomaly_reasons,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomExplanation(data.explanation);
      }
    } catch (err) {
      console.error('Failed to generate Mistral AI explanation:', err);
    } finally {
      setGeneratingExplanation(false);
    }
  };

  if (loading && !monitoringData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-3 text-cyan-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="font-semibold text-lg">Loading Unified Device Monitoring Pipeline...</span>
        </div>
      </div>
    );
  }

  const acDevice = monitoringData?.devices?.find((d) => d.device_id === 'ac_simulator');
  const laptopDevice = monitoringData?.devices?.find((d) => d.device_id === 'laptop_primary');
  const selectedDevice = activeTab === 'ac_simulator' ? acDevice : laptopDevice;
  const tickets = monitoringData?.service_tickets || [];

  const simState = acDevice?.simulator_state || {};
  const telemetryHistory = selectedDevice?.history || [];
  const latestTel = selectedDevice?.latest_telemetry || {};
  const health = selectedDevice?.health || {};

  // Color mappings for health status
  const getHealthBadge = (status) => {
    switch (status) {
      case 'Healthy':
        return {
          label: 'Healthy',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: ShieldCheck,
          dot: 'bg-emerald-400',
        };
      case 'Attention Required':
        return {
          label: 'Attention Required',
          bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          icon: AlertCircle,
          dot: 'bg-amber-400 animate-pulse',
        };
      case 'Maintenance Required':
        return {
          label: 'Maintenance Required',
          bg: 'bg-red-500/10 text-red-400 border-red-500/30',
          icon: AlertTriangle,
          dot: 'bg-red-500 animate-ping',
        };
      default:
        return {
          label: 'Healthy',
          bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
          icon: ShieldCheck,
          dot: 'bg-emerald-400',
        };
    }
  };

  const currentBadge = getHealthBadge(health.health_status);
  const BadgeIcon = currentBadge.icon;

  // Chart data formatting
  const chartData = telemetryHistory.map((t, idx) => ({
    time: t.timestamp ? new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : `#${idx}`,
    power: t.power_w || 0,
    temp: t.temperature_c || 0,
    cpu: t.metrics?.cpu_percent || 0,
    battery: t.metrics?.battery_percent || 0,
  }));

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold text-white">Unified Device Telemetry</h1>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> Real-Time Stream
            </span>
          </div>
          <p className="text-slate-400 text-sm">
            Continuous telemetry, ML persistent anomaly detection, Mistral AI diagnostic explanations & automated provider ticketing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchTelemetry}
            className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl border border-white/10 transition-all flex items-center gap-2 text-sm font-semibold"
          >
            <RefreshCw className="w-4 h-4 text-cyan-400" /> Refresh Telemetry
          </button>
        </div>
      </header>

      {/* Device Selector Tabs */}
      <div className="flex border-b border-white/10 space-x-4">
        <button
          onClick={() => setActiveTab('ac_simulator')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-semibold text-sm transition-all ${
            activeTab === 'ac_simulator'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" /> Software AC Appliance Simulator
          {acDevice?.health?.health_status === 'Maintenance Required' && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('laptop_primary')}
          className={`flex items-center gap-2 py-3 px-5 border-b-2 font-semibold text-sm transition-all ${
            activeTab === 'laptop_primary'
              ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Laptop className="w-4 h-4" /> Live Laptop Monitor (Windows WMI/ACPI)
          {laptopDevice?.health?.health_status === 'Maintenance Required' && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          )}
        </button>
      </div>

      {/* Device Health Banner */}
      <div className={`p-6 rounded-3xl border backdrop-blur-xl transition-all ${currentBadge.bg} flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl`}>
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-2xl">
            <BadgeIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold">{selectedDevice?.device_name}</h2>
              <span className={`px-3 py-0.5 rounded-full text-xs font-extrabold uppercase border ${currentBadge.bg}`}>
                {health.health_status}
              </span>
            </div>
            <p className="text-sm opacity-90">
              {health.explanation_mistral || 'Device operating within safety limits.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 border-t md:border-t-0 border-white/10 pt-4 md:pt-0">
          <div className="text-right">
            <p className="text-xs uppercase font-semibold text-slate-400">Anomaly Confidence</p>
            <p className="text-2xl font-black">{Math.round((health.anomaly_score || 0.05) * 100)}%</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase font-semibold text-slate-400">Persistence Window</p>
            <p className="text-2xl font-black">{health.persistence_count || 0} / 3 checks</p>
          </div>
        </div>
      </div>

      {/* AC Simulator Controls Panel (only for AC tab) */}
      {activeTab === 'ac_simulator' && (
        <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-lg text-white">Software AC Simulator Controls</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Status:</span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${simState.running && !simState.paused ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {simState.paused ? 'PAUSED' : (simState.running ? 'RUNNING' : 'STOPPED')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Start/Stop/Pause/Resume Buttons */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Simulation Engine Controls</label>
              <div className="flex flex-wrap gap-2">
                {!simState.running || simState.paused ? (
                  <button
                    onClick={() => handleSimulatorControl({ action: 'resume' })}
                    disabled={actionLoading}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    <Play className="w-4 h-4" /> Resume
                  </button>
                ) : (
                  <button
                    onClick={() => handleSimulatorControl({ action: 'pause' })}
                    disabled={actionLoading}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-amber-500/20"
                  >
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                )}

                <button
                  onClick={() => handleSimulatorControl({ action: simState.running ? 'stop' : 'start' })}
                  disabled={actionLoading}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                    simState.running
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                      : 'bg-cyan-500 hover:bg-cyan-600 text-white border-cyan-500/40'
                  }`}
                >
                  <Square className="w-3.5 h-3.5" /> {simState.running ? 'Stop' : 'Start'}
                </button>
              </div>
            </div>

            {/* Simulation Speed Controls */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Simulation Speed Multiplier</label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 5, 10].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => handleSimulatorControl({ speed_multiplier: speed })}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                      simState.speed_multiplier === speed
                        ? 'bg-cyan-500 text-white border-cyan-400 shadow-md shadow-cyan-500/20'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Target Temperature Control */}
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Set Thermostat (°C)</label>
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5">
                <input
                  type="range"
                  min="16"
                  max="30"
                  value={simState.target_temperature_c || 24}
                  onChange={(e) => handleSimulatorControl({ target_temp: e.target.value })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <span className="font-bold text-sm text-cyan-400 w-12 text-right">{simState.target_temperature_c || 24}°C</span>
              </div>
            </div>
          </div>

          {/* Fault Scenario Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Test Scenarios (Inject Normal or Fault Behaviors for AI Detection)</label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { id: 'NORMAL', label: 'Normal Cooling', desc: 'Standard thermal cycle' },
                { id: 'HIGH_POWER', label: 'High Power Surge', desc: 'Overload 2800W+' },
                { id: 'LONG_RUNTIME', label: 'Long Continuous Runtime', desc: 'Runs 3+ hrs' },
                { id: 'FREQUENT_CYCLING', label: 'Frequent Cycling', desc: 'Rapid ON/OFF' },
                { id: 'ABNORMAL_TEMP', label: 'Abnormal Temp Rise', desc: 'Thermal failure' },
              ].map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => handleSimulatorControl({ scenario: sc.id })}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    simState.scenario === sc.id
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
                  }`}
                >
                  <span className="font-bold text-xs block mb-1">{sc.label}</span>
                  <span className="text-[10px] text-slate-400 block">{sc.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Laptop Telemetry Info Card (only for Laptop tab) */}
      {activeTab === 'laptop_primary' && (
        <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-400">
              <Laptop className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Live Laptop Monitor (Local Windows Agent)</h3>
              <p className="text-xs text-slate-400">
                Data collected in real time via Python 3 + Windows WMI / ACPI & <code className="text-cyan-400">psutil</code>.
              </p>
            </div>
          </div>

          <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <p className="text-xs text-cyan-200 leading-relaxed">
              <strong>Telemetry Disclosure:</strong> Laptop telemetry represents internal battery-side measured power draw (DC system consumption). It is explicitly distinguished from wall-socket AC meter measurements and does not fabricate unavailable hardware values.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>CPU Load</span> <Cpu className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-xl font-bold">{latestTel.metrics?.cpu_percent ?? 0}%</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>RAM Usage</span> <Gauge className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-xl font-bold">{latestTel.metrics?.ram_percent ?? 0}%</p>
              <p className="text-[10px] text-slate-400">{latestTel.metrics?.ram_used_gb || 0} / {latestTel.metrics?.ram_total_gb || 16} GB</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Battery Level</span> <Battery className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-xl font-bold">{latestTel.metrics?.battery_percent ?? 100}%</p>
              <p className="text-[10px] text-slate-400">{latestTel.metrics?.charging_status ? '⚡ Charging' : 'Discharging'}</p>
            </div>
            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
                <span>Storage Disk</span> <HardDrive className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-xl font-bold">{latestTel.metrics?.disk_percent ?? 0}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Metrics Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Measured Power</span>
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-white mb-1">{latestTel.power_w || 0} <span className="text-lg font-normal text-slate-400">W</span></h3>
          <p className="text-xs text-slate-400">
            {latestTel.power_measurement_type === 'battery_side_measured' ? 'Battery-Side Draw' : 'Direct Appliance Power'}
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Voltage & Current</span>
            <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-white mb-1">{latestTel.voltage_v || 230} <span className="text-lg font-normal text-slate-400">V</span></h3>
          <p className="text-xs text-slate-400">Current: {latestTel.current_a || 0} A</p>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Cumulative Energy</span>
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-white mb-1">{latestTel.energy_kwh || 0} <span className="text-lg font-normal text-slate-400">kWh</span></h3>
          <p className="text-xs text-slate-400">Updated continuous tally</p>
        </div>

        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Temperature / State</span>
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400">
              <Thermometer className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-3xl font-extrabold text-white mb-1">
            {latestTel.temperature_c !== null && latestTel.temperature_c !== undefined ? `${latestTel.temperature_c}°C` : 'N/A'}
          </h3>
          <p className="text-xs text-slate-400">State: {latestTel.operating_state || 'IDLE'}</p>
        </div>
      </div>

      {/* Real-Time Recharts Stream */}
      <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" /> Real-Time Telemetry Stream
          </h3>
          <span className="text-xs text-slate-400">Sliding window (Last 60 ticks)</span>
        </div>
        <div className="h-72 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="powerColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tempColor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#06b6d4" tick={{ fontSize: 11 }} unit="W" />
              <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={{ fontSize: 11 }} unit="°C" />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#ffffff20', borderRadius: '1rem', color: '#fff' }}
              />
              <Legend />
              <Area yAxisId="left" type="monotone" dataKey="power" name="Power (W)" stroke="#06b6d4" fillOpacity={1} fill="url(#powerColor)" strokeWidth={2} />
              <Area yAxisId="right" type="monotone" dataKey="temp" name="Temperature (°C)" stroke="#f59e0b" fillOpacity={1} fill="url(#tempColor)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Mistral AI Natural Language Diagnostic Assistant */}
      <div className="bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-500/20 rounded-3xl p-6 backdrop-blur-md space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-2xl">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                Mistral AI Diagnostic Explanations
              </h3>
              <p className="text-xs text-purple-200/70">Powered by Mistral AI API for natural language root cause analysis.</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4 text-sm text-slate-200 leading-relaxed">
          <p className="font-semibold text-purple-300 mb-1">Latest AI Diagnosis:</p>
          <p>{health.explanation_mistral || 'Device behavior is standard. No abnormal parameters detected.'}</p>
        </div>

        {customExplanation && (
          <div className="bg-purple-900/30 border border-purple-500/30 rounded-2xl p-4 text-sm text-purple-100">
            <p className="font-semibold text-purple-300 mb-1">Custom Mistral Response:</p>
            <p>{customExplanation}</p>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask Mistral AI about device health, maintenance, or energy trends..."
            value={mistralPrompt}
            onChange={(e) => setMistralPrompt(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
          />
          <button
            onClick={() => handleAskMistral(selectedDevice)}
            disabled={generatingExplanation}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-2xl text-xs flex items-center gap-2 transition-all disabled:opacity-60 shadow-lg shadow-purple-600/20"
          >
            <Sparkles className="w-4 h-4" /> {generatingExplanation ? 'Analyzing...' : 'Ask Mistral'}
          </button>
        </div>
      </div>

      {/* Automatic Service Provider Workflow Tracker */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-2xl">
              <Wrench className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Automated Service Provider Workflow</h3>
              <p className="text-xs text-slate-400">
                Continuous Telemetry → Anomaly Detection → Verify Persistence → Device Health → Auto Create Ticket → Provider Dispatch
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold">
            {tickets.length} Ticket{tickets.length !== 1 ? 's' : ''} Created
          </span>
        </div>

        {tickets.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-white/5 rounded-2xl border border-white/5">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="font-semibold text-white text-sm">No Active Maintenance Tickets Required</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Devices are monitored continuously. If persistent anomalies ($N \ge 3$ consecutive checks) escalate health to <strong>Maintenance Required</strong>, a service ticket will be automatically dispatched to an appropriate provider.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {tickets.map((t) => (
              <div key={t.id} className="bg-slate-900/80 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-cyan-400 font-bold text-sm">{t.ticket_number}</span>
                    <span className="text-white font-bold text-sm">{t.service_type}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                      t.severity === 'Critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {t.severity} Severity
                    </span>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {t.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-slate-400 font-semibold mb-1">Target Device:</p>
                    <p className="text-slate-200 font-medium">{t.device_name}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-semibold mb-1">Assigned Service Provider:</p>
                    <p className="text-emerald-400 font-bold">{t.provider_name}</p>
                  </div>
                </div>

                <div className="bg-white/5 p-3 rounded-xl text-xs text-slate-300">
                  <p className="font-semibold text-slate-200 mb-1">Diagnostic Explanation (Mistral AI):</p>
                  <p className="text-slate-300 italic">{t.detailed_explanation}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceMonitoring;
