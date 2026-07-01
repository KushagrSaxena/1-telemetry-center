import { useState, useEffect } from 'react';

export default function App() {
  const [mode, setMode] = useState('live');
  const [activeTab, setActiveTab] = useState('timing'); // 'timing' | 'upgrades' | 'news'
  const [year, setYear] = useState('2026');
  const [roundNum, setRoundNum] = useState('1');
  const [news, setNews] = useState([]);
  const [upgrades, setUpgrades] = useState([]);

  const [liveData, setLiveData] = useState({
    laps: [],
    positions: [],
    circuit_name: '',
    location: '',
    sessions: null
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Load telemetry news feed stream & authentic technical development feeds
  useEffect(() => {
    const fetchWireFeeds = async () => {
      try {
        const newsRes = await fetch('http://localhost:8000/api/f1-news');
        const newsData = await newsRes.json();
        setNews(newsData || []);

        const upgradesRes = await fetch('http://localhost:8000/api/real-time-upgrades');
        const upgradesData = await upgradesRes.json();
        setUpgrades(upgradesData || []);
      } catch (err) {
        console.error("Failed loading layout stream pipelines", err);
      }
    };
    fetchWireFeeds();
  }, []);

  // Handle WebSocket lifecycle for Live Mode
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

  // Fetch Historical Telemetry Archives
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
          circuit_name: payload.circuit_name || '',
          location: payload.location || '',
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
      <header className="border-b-2 border-[#e10600] pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
        <div className="bg-[#141822] border border-slate-800 p-4 rounded mb-6 flex flex-wrap gap-4 items-end animate-fadeIn">
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

      {/* Primary Module Navigation Tabs */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab('timing')}
          className={`px-4 py-2 text-xs font-black uppercase border-b-2 tracking-wider transition-all ${
            activeTab === 'timing' ? 'border-[#e10600] text-white bg-[#141822]' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          ⏱️ Live Timing & Telemetry
        </button>
        <button
          onClick={() => setActiveTab('upgrades')}
          className={`px-4 py-2 text-xs font-black uppercase border-b-2 tracking-wider transition-all ${
            activeTab === 'upgrades' ? 'border-[#e10600] text-white bg-[#141822]' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          🔧 Team Upgrade Matrix ({upgrades.length})
        </button>
        <button
          onClick={() => setActiveTab('news')}
          className={`px-4 py-2 text-xs font-black uppercase border-b-2 tracking-wider transition-all ${
            activeTab === 'news' ? 'border-[#e10600] text-white bg-[#141822]' : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          📰 FIA News Wire ({news.length})
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20 border border-dashed border-slate-800 rounded">
          <div className="text-[#e10600] font-black text-xl tracking-widest animate-pulse">PARSING FASTF1 CACHE DATA DATASETS...</div>
        </div>
      ) : (
        <main className="bg-[#141822] border border-slate-800 rounded p-5">
          {/* TAB 1: TIMING AND TELEMETRY */}
          {activeTab === 'timing' && (
            <div>
              {liveData.circuit_name && (
                <div className="border-b border-slate-800 pb-4 mb-4">
                  <span className="text-[10px] font-black uppercase text-[#e10600] tracking-widest block mb-1">TRACK PROFILE</span>
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">{liveData.circuit_name} - <span className="text-slate-400">{liveData.location}</span></h2>
                </div>
              )}

              {(liveData.positions || []).length === 0 ? (
                <div className="text-center py-12 bg-[#1f242d]/40 rounded border border-dashed border-slate-800">
                  <p className="text-slate-400 text-sm uppercase tracking-wider">No active telemetry streams detected.</p>
                  {mode === 'live' && <p className="text-xs text-[#e10600] mt-2 font-bold uppercase">Tower populates once cars cross physical timing loops.</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  {liveData.positions.map((driver) => {
                    const matchingLap = (liveData.laps || []).find(l => l.driver_number === driver.driver_number);
                    return (
                      <div 
                        key={driver.driver_number}
                        className="flex items-center bg-[#1f242d] rounded overflow-hidden border-l-4 border-slate-700"
                        style={{ borderLeftColor: driver.team_color || '#ffffff' }}
                      >
                        <div className="bg-black/40 text-center w-14 py-3 font-black text-lg text-slate-300">
                          {isNaN(driver.position) ? driver.position : `P${driver.position}`}
                        </div>
                        <div className="flex-1 px-4 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-base tracking-tight text-white">{driver.full_name}</span>
                              <span className="text-xs text-slate-400 font-bold">#{driver.driver_number}</span>
                            </div>
                            <span className="text-[10px] uppercase font-bold text-slate-400">{driver.team_name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Lap Duration</span>
                            <span className="font-mono text-sm font-bold text-white tracking-wide">
                              {matchingLap ? matchingLap.lap_duration : '---'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UPGRADE MATRIX */}
          {activeTab === 'upgrades' && (
            <div>
              <div className="border-b border-slate-800 pb-3 mb-4 flex justify-between items-center">
                <div>
                  <h2 className="text-md font-black text-white uppercase tracking-tight">Official Car Presentation Submissions</h2>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Physical aero adjustments filed with technical delegates</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upgrades.map((pkg, idx) => (
                  <div key={idx} className="bg-[#1f242d] border border-slate-800 p-4 rounded flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-black tracking-widest text-[#e10600] uppercase bg-[#e10600]/10 px-2 py-0.5 rounded border border-[#e10600]/20">
                          {pkg.source}
                        </span>
                        <span className="text-[9px] text-slate-400 uppercase font-bold">{pkg.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-200 font-bold leading-relaxed uppercase tracking-tight">
                        {pkg.headline}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-800/60">
                      <a 
                        href={pkg.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] uppercase font-black text-[#e10600] hover:text-red-400 flex items-center gap-1 transition-colors"
                      >
                        View Scrutineering Log ↗
                      </a>
                    </div>
                  </div>
                ))}
                {upgrades.length === 0 && (
                  <p className="text-xs text-slate-500 uppercase p-4">No validation metrics parsed in this cycle.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: NEWS WIRE */}
          {activeTab === 'news' && (
            <div>
              <div className="border-b border-slate-800 pb-3 mb-4">
                <h2 className="text-md font-black text-white uppercase tracking-tight">Technical Regulations Wire</h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">Scraped sporting and directive bulletins</p>
              </div>
              <div className="space-y-3">
                {news.map((item, idx) => (
                  <div key={idx} className="bg-[#1f242d] border border-slate-800 p-3 rounded flex justify-between items-center gap-4">
                    <p className="text-xs text-white font-bold uppercase tracking-tight leading-snug">{item.title}</p>
                    <a 
                      href={item.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] uppercase font-black text-[#e10600] hover:text-red-400 shrink-0 tracking-wider transition-colors"
                    >
                      Read Directive ↗
                    </a>
                  </div>
                ))}
                {news.length === 0 && (
                  <p className="text-xs text-slate-500 uppercase p-4">Awaiting incoming RSS feeds...</p>
                )}
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}