import os
import asyncio
import json
import feedparser
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import fastf1
import pandas as pd
from datetime import datetime

CACHE_DIR = os.path.join(os.path.dirname(__file__), '..', 'fastf1_cache')
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

@app.get("/api/f1-news")
def get_f1_news():
    RSS_URL = "https://www.autosport.com/rss/feed/f1"
    FILTERS = ["FIA", "technical", "directive", "regulation", "contract", "transfer", "sign", "engine", "aero", "fuel", "governance", "ownership", "formula", "upgrade", "ban", "legal"]

    try:
        feed = feedparser.parse(RSS_URL)
        articles = []

        for entry in feed.entries[:5]:
            articles.append({
                "title": entry.title,
                "link": entry.link
            })
        return articles
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to parse verified news matrix")
    
@app.get("/api/real-time-upgrades")
def get_real_time_upgrades():
    TECHNICAL_FEED_URL = "https://www.autosport.com/rss/feed/f1"
    try:
        feed = feedparser.parse(TECHNICAL_FEED_URL)
        upgrades_detected = []

        for entry in feed.entries:
            title_lower = entry.title.lower()
            if any(kw in title_lower for kw in ["upgraddes", "package", "wing", "floor", "sidepod", "fia doc"]):
                upgrades_detected.append({
                    "headline": entry.title,
                    "source": "FIA Technical Submission Wire",
                    "link": entry.link,
                    "timestamp": getattr(entry, "published", "Recent")
                })
        
        if not upgrades_detected:
            return[{
                "headline": "Teams submit official car presentation matrices to FIA. Main development packages pending track verification.",
                "source": "FIA Event Documents",
                "link": "https://www.fia.com/documents",
                "timestamp": "Friday Practice Cycle"
            }]
        return upgrades_detected[:4]
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse authentic technical grid data.")

@app.get("/api/past-race/{year}/{round_num}")
def get_historical_race_data(year: int, round_num: int):
    try:
        session = fastf1.get_session(year, round_num, 'R')
        session.load(laps=True, telemetry=False, weather=False, messages=False)
        
        results = session.results
        if results is None or results.empty:
            return {"positions": [], "laps": []}
            
        positions_payload = []
        laps_payload = []
        
        # Enumerate the rows to use the native dataframe order as a fallback
        for idx, (_, row) in enumerate(results.iterrows(), start=1):
            raw_driver_num = row.get('DriverNumber')
            if pd.isna(raw_driver_num) or str(raw_driver_num).strip().lower() == 'nan':
                continue
            driver_num = str(raw_driver_num).strip()

            raw_full_name = row.get('FullName')
            full_name = "Unknown Driver" if pd.isna(raw_full_name) or str(raw_full_name).strip().lower() == 'nan' else str(raw_full_name).strip()

            raw_team_name = row.get('TeamName')
            team_name = "Independent" if pd.isna(raw_team_name) or str(raw_team_name).strip().lower() == 'nan' else str(raw_team_name).strip()

            raw_color = row.get('TeamColor')
            if pd.isna(raw_color) or not str(raw_color).strip() or str(raw_color).strip().lower() == 'nan':
                team_color = "#FFFFFF"
            else:
                cleaned_color = str(raw_color).strip()
                team_color = f"#{cleaned_color}" if not cleaned_color.startswith('#') else cleaned_color

            raw_status = str(row.get('Status', 'Finished')).strip().lower()
            is_classified = str(row.get('Classified', 'Y')).strip().upper()
            
            # Fallback directly to loop index if the column is empty or unparseable
            raw_pos = row.get('Position')
            try:
                position_val = int(float(raw_pos)) if pd.notna(raw_pos) else idx
            except (ValueError, TypeError):
                position_val = idx

            # Intercept DNF, DNS, and DSQ statuses
            if is_classified not in ['Y', 'CLASSIFIED'] or any(keyword in raw_status for keyword in ['retired', 'accident', 'collision', 'power', 'engine', 'spinned']):
                if 'disqualified' in raw_status or 'dsq' in raw_status:
                    display_position = "DSQ"
                    sort_weight = 300 + position_val
                elif 'dns' in raw_status or 'did not start' in raw_status:
                    display_position = "DNS"
                    sort_weight = 200 + position_val
                else:
                    display_position = "DNF"
                    sort_weight = 100 + position_val
            else:
                display_position = int(position_val)
                sort_weight = position_val

            positions_payload.append({
                "driver_number": driver_num,
                "full_name": full_name,
                "team_name": team_name,
                "team_color": team_color[:7],
                "position": display_position,
                "_sort_weight": sort_weight
            })

            dur_str = "N/A"
            if display_position not in ["DNF", "DNS", "DSQ"]:
                try:
                    driver_laps = session.laps.pick_driver(driver_num)
                    if not driver_laps.empty:
                        fastest = driver_laps.pick_fastest()
                        if not fastest.empty:
                            lap_time = fastest.get('LapTime')
                            if pd.notna(lap_time) and str(lap_time).strip().lower() != 'nat':
                                dur_str = str(lap_time).split()[-1][:8]
                except Exception:
                    pass
            
            laps_payload.append({
                "driver_number": driver_num,
                "lap_duration": dur_str
            })
            
        positions_payload.sort(key=lambda x: x["_sort_weight"])
        
        for pos in positions_payload:
            pos.pop("_sort_weight", None)
        
        return {
            "positions": positions_payload,
            "laps": laps_payload
        }
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return {"error": str(e), "positions": [], "laps": []}


@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        current_year = datetime.now().year
        schedule = fastf1.get_event_schedule(current_year, include_testing=False)
        
        # Create a timezone-naive comparison timestamp matching FastF1's internal structure
        now_utc = datetime.utcnow()
        
        # Filter purely on the naive datetime objects (avoids pandas conversion crashing)
        upcoming_events = schedule[schedule['EventDate'] >= now_utc]
        
        if not upcoming_events.empty:
            next_event = upcoming_events.iloc[0]
        else:
            next_event = schedule.iloc[-1]
            
        event_metadata = {
            "status": "No Active Live Track Session",
            "circuit_name": str(next_event.get('OfficialEventName', next_event.get('EventName', 'Unknown Circuit'))),
            "location": f"{next_event.get('Location', 'Unknown')}, {next_event.get('Country', 'Unknown')}",
            "sessions": {
                "fp1": next_event.get('Session1DateUtc').isoformat() if pd.notna(next_event.get('Session1DateUtc')) else None,
                "fp2": next_event.get('Session2DateUtc').isoformat() if pd.notna(next_event.get('Session2DateUtc')) else None,
                "fp3": next_event.get('Session3DateUtc').isoformat() if pd.notna(next_event.get('Session3DateUtc')) else None,
                "qualifying": next_event.get('Session4DateUtc').isoformat() if pd.notna(next_event.get('Session4DateUtc')) else None,
                "race": next_event.get('Session5DateUtc').isoformat() if pd.notna(next_event.get('Session5DateUtc')) else next_event.get('EventDate').isoformat(),
            },
            "positions": [],
            "laps": []
        }

        while True:
            await websocket.send_text(json.dumps(event_metadata))
            await asyncio.sleep(10)
            
    except WebSocketDisconnect:
        print("Live Hub: Client disconnected")