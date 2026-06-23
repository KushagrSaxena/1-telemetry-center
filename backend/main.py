import os
import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import fastf1


CACHE_DIR = os.path.join(os.path.dirname(__file__), '..',  'fastf1_cache')
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR)


fastf1.Cache.enable_cache(CACHE_DIR)

app = FastAPI(title="Formula 1 Telemetry Center")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/past-race/{year}/{round_num}")
def get_historical_race_data(year: int, round_num: int):
    try:
        session = fastf1.get_session(year, round_num, 'R')
        session.load(laps=True, telemetry=False, weather=False, messages=False)
        
        results = session.results
        positions_payload = []
        laps_payload = []
        
        for _, row in results.iterrows():
            driver_num = str(row['DriverNumber'])
            team_color = f"#{row['TeamColor']}" if row['TeamColor'] and not str(row['TeamColor']).startswith('#') else f"#{row['TeamColor'] or 'FFFFFF'}"

            positions_payload.append({
                "driver_number": driver_num,
                "full_name": str(row['FullName']),
                "team_name": str(row['TeamName']),
                "team_color": team_color[:7],
                "position": int(row['Position']) if row['Position'] else 99,
            })

            driver_laps = session.laps.pick_driver(driver_num)
            if not driver_laps.empty:
                fastest = driver_laps.pick_fastest()
                dur_str = str(fastest['LapTime']).split()[-1][:8] if not fastest.empty else "N/A"
            else:
                dur_str = "N/A"
            
            laps_payload.append({
                "driver_number": driver_num,
                "lap_duration": dur_str
            })
        
        return {
            "positions": positions_payload,
            "laps": laps_payload
        }
    except Exception as e:
        return {"error": str(e), "positions": [],  "laps": []}

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        await websocket.send_text(json.dumps({
            "status": "No Live Races",
            "positions": [],
            "laps": []
        }))
        while True:
            await asyncio.sleep(10)
    except WebSocketDisconnect:
        print("Live Hub: Client disconnected")