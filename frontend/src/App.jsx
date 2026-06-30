import { useState, useEffect } from 'react';

export default function App() {
  const [mode, setMode] = useState('live');
  const [year, setYear] = useState('2023');
  const [roundNum, setRoundNum] = useState('1');

  const [liveData, setLiveData] = useState({
    laps: [],
    positions: [],
    circuit_name: '',
    location: '',
    sessions: null
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let ws = null;

    if (mode === 'live') {
      setLoading(false);
      ws = new WebSocket('ws://localhost:8000/ws/live');

      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        setLiveData({
          positions: payload.positions || [],
          laps: payload.laps || [],
          circuit_name: payload.circuit_name || '',
          location: payload.location || '',
          sessions: payload.sessions || null,
        });
        setStatusMessage(payload.status || '');
      };

      ws.onerror = () => {
        setStatusMessage('WebSocket connection error.');
      };

      ws.onclose = () => {
        setStatusMessage('Disconnected from live hub.');
      };
    } else {
      setLiveData({ laps: [], positions: [], circuit_name: '', location: '', sessions: null });
      setStatusMessage('');
    }

    return () => {
      if (ws) ws.close();
    };
  }, [mode]);

  const fetchHistoricalData = async () => {
    setLoading(true);
    setStatusMessage('');
    try {
      const res = await fetch(`http://localhost:8000/api/past-race/${year}/${roundNum}`);
      const payload = await res.json();
      
      if (payload.error) {
        setStatusMessage(`Error: ${payload.error}`);
        setLiveData({ laps: [], positions: [], circuit_name: '', location: '', sessions: null });
      } else {
        setLiveData({
          positions: payload.positions || [],
          laps: payload.laps || [],
          circuit_name: '',
          location: '',
          sessions: null
        });
      }
    } catch (err) {
      setStatusMessage('Failed to fetch historical record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-slate-100 p-6 font-mono selection:bg-[#e10600]">
      <header className="border-b-2 border-[#e10600] pb-4 mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white flex items-center gap-2">
            <span className="bg-[#e10600] px-2 py-0.5 text-black transform -skew-x-12">F1</span> 
            TELEMETRY CENTER
          </h1>
          <p className="text-xs text-slate-400 uppercase mt-1 tracking-widest">Real-Time Sync & Archival Core</p>
        </div>

        <div className="flex bg-[#1f242d] p-1 rounded border border-slate-700">
          <button
            onClick={() => setMode('live')}
            className={`px-4 py-1.5 text-xs font-bold uppercase rounded transition-all duration-150 ${
              mode === 'live' ? 'bg-[#e10600] text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Hub
          </button>
          <button
            onClick={() => setMode('history')}
            className={`px-4 py-1.5 text-xs font-bold uppercase rounded transition-all duration-150 ${
              mode === 'history' ? 'bg-[#e10600] text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            History Records
          </button>
        </div>
      </header>

      {mode === 'history' && (
        <div className="bg-[#141822] border border-slate-800 p-4 rounded mb-6 flex gap-4 items-end animate-fadeIn">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Season (Year)</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="bg-[#1f242d] text-white border border-slate-700 rounded px-3 py-1.5 w-28 text-sm focus:outline-none focus:border-[#e10600]"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Round Number</label>
            <input
              type="number"
              value={roundNum}
              onChange={(e) => setRoundNum(e.target.value)}
              className="bg-[#1f242d] text-white border border-slate-700 rounded px-3 py-1.5 w-28 text-sm focus:outline-none focus:border-[#e10600]"
            />
          </div>
          <button
            onClick={fetchHistoricalData}
            disabled={loading}
            className="bg-[#e10600] hover:bg-red-700 text-white font-bold text-xs uppercase px-5 py-2.5 rounded transition-colors disabled:opacity-50"
          >
            {loading ? 'LOADING...' : 'FETCH ARCHIVE'}
          </button>
        </div>
      )}

      {statusMessage && (
        <div className="bg-amber-950/40 border border-amber-600/50 text-amber-400 px-4 py-3 rounded text-xs font-bold uppercase tracking-wide mb-6">
          ⚠️ Status: {statusMessage}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 border border-dashed border-slate-800 rounded">
          <div className="text-[#e10600] font-black text-xl tracking-widest animate-pulse">PARSING FASTF1 CACHE DATA DATASETS...</div>
        </div>
      ) : (liveData.positions || []).length === 0 ? (
        <div className="space-y-6">
          {mode === 'live' && liveData.circuit_name && (
            <div className="bg-[#141822] border border-slate-800 rounded p-6">
              <div className="border-b border-slate-800 pb-3 mb-4">
                <span className="text-[10px] font-black uppercase text-[#e10600] tracking-widest block mb-1">UPCOMING EVENT SCHEDULE</span>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">{liveData.circuit_name}</h2>
                <p className="text-xs text-slate-400 uppercase mt-0.5 tracking-wider">{liveData.location}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {liveData.sessions && Object.entries(liveData.sessions).map(([sessionName, utcString]) => {
                  if (!utcString) return null;
                  const sessionDate = new Date(utcString);

                  return (
                    <div key={sessionName} className="bg-[#1f242d] border border-slate-800 p-3 rounded">
                      <span className="text-xs font-black uppercase text-slate-400 block border-b border-slate-800/60 pb-1 mb-2 tracking-wide">
                        {sessionName}
                      </span>
                      <div className="space-y-2 font-sans">
                        <div>
                          <span className="text-[9px] font-bold text-[#e10600] uppercase tracking-wider block">Your Time</span>
                          <span className="text-xs font-bold text-white tracking-tight">
                            {sessionDate.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">GMT / UTC</span>
                          <span className="text-xs font-medium text-slate-300 tracking-tight">
                            {sessionDate.toLocaleString('en-GB', { timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })} UTC
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <div className="text-center py-16 border border-dashed border-slate-800 rounded bg-[#141822]/40">
            <p className="text-slate-400 text-sm uppercase tracking-wider">No active live data streams detected.</p>
            {mode === 'live' && <p className="text-xs text-[#e10600] mt-2 font-bold uppercase">Telemetry frames map onto timing tower once track segment goes green.</p>}
          </div>
        </div>
      ) : (
        <main className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="xl:col-span-2 bg-[#141822] border border-slate-800 rounded p-4">
            <h2 className="text-sm font-black uppercase text-slate-400 tracking-wider mb-3 pb-2 border-b border-slate-800">
              Timing Tower Leaderboard
            </h2>
            <div className="space-y-2">
              {(liveData.positions || []).map((driver) => {
                const matchingLap = (liveData.laps || []).find(l => l.driver_number === driver.driver_number);
                
                return (
                  <div 
                    key={driver.driver_number}
                    className="flex items-center bg-[#1f242d] rounded overflow-hidden border-l-4 transition-transform duration-100 hover:scale-[1.005]"
                    style={{ borderLeftColor: driver.team_color || '#ffffff' }}
                  >
                    <div className="bg-black/40 text-center w-14 py-3 font-black text-lg text-slate-300 border-r border-slate-800/80">
                      {isNaN(driver.position) ? driver.position : `P${driver.position}`}
                    </div>
                    <div className="flex-1 px-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base tracking-tight text-white">{driver.full_name}</span>
                          <span className="text-xs text-slate-400 font-bold">#{driver.driver_number}</span>
                        </div>
                        <span 
                          className="inline-block text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded mt-0.5"
                          style={{ backgroundColor: `${driver.team_color}25`, color: driver.team_color }}
                        >
                          {driver.team_name}
                        </span>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Lap Time</span>
                        <span className="font-mono text-sm font-bold text-white tracking-wide">
                          {matchingLap ? matchingLap.lap_duration : '---'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-[#141822] border border-slate-800 rounded p-4 h-fit">
            <h2 className="text-sm font-black uppercase text-slate-400 tracking-wider mb-3 pb-2 border-b border-slate-800">
              Telemetry Summary
            </h2>
            <div className="text-xs space-y-3 text-slate-300">
              <div className="flex justify-between border-b border-slate-800/50 pb-2">
                <span className="text-slate-400 uppercase">Operational Mode</span>
                <span className="font-bold uppercase text-[#e10600]">{mode} hub</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/50 pb-2">
                <span className="text-slate-400 uppercase">Track Grid Outflow</span>
                <span className="font-bold text-white">{(liveData.positions || []).length} Vehicles Logged</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 uppercase">System Status</span>
                <span className="font-bold text-green-400 uppercase">Online</span>
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}