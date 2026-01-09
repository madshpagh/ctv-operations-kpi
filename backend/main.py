from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import date, time, datetime
from typing import Optional
from database import get_db, init_db
from fastapi.responses import StreamingResponse
import io
from openpyxl import Workbook

app = FastAPI(title="CTV Operations KPI System")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ctv-operations-kpi.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()

# ---------- MODELS ----------

class Vessel(BaseModel):
    name: str

class Project(BaseModel):
    name: str

class DailyReportCreate(BaseModel):
    date: date
    vessel_id: int
    project_id: int
    comment: Optional[str] = None

class Operation(BaseModel):
    daily_report_id: int
    operation_type: str
    status: str  # WORKING or DOWNTIME
    start_time: time
    end_time: time
    fuel_mgo: float = 0
    downtime_reason: Optional[str] = None
    weather_related: bool = False

# ---------- HELPERS ----------

def calc_duration(start: time, end: time) -> float:
    if end <= start:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    delta = datetime.combine(date.today(), end) - datetime.combine(date.today(), start)
    return round(delta.total_seconds() / 3600, 2)

# ---------- MASTER DATA ----------

@app.post("/vessels")
def add_vessel(v: Vessel):
    db = get_db()
    try:
        db.execute("INSERT INTO vessels (name) VALUES (?)", (v.name,))
        db.commit()
    except:
        raise HTTPException(status_code=400, detail="Vessel already exists")
    return {"status": "ok"}

@app.get("/vessels")
def get_vessels():
    rows = get_db().execute("SELECT * FROM vessels").fetchall()
    return [dict(r) for r in rows]

@app.post("/projects")
def add_project(p: Project):
    db = get_db()
    try:
        db.execute("INSERT INTO projects (name) VALUES (?)", (p.name,))
        db.commit()
    except:
        raise HTTPException(status_code=400, detail="Project already exists")
    return {"status": "ok"}

@app.get("/projects")
def get_projects():
    rows = get_db().execute("SELECT * FROM projects").fetchall()
    return [dict(r) for r in rows]

# ---------- DAILY REPORT ----------

@app.post("/daily-reports")
def create_daily_report(r: DailyReportCreate):
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("""
            INSERT INTO daily_reports (date, vessel_id, project_id, comment)
            VALUES (?,?,?,?)
        """, (r.date.isoformat(), r.vessel_id, r.project_id, r.comment))
        db.commit()
    except:
        raise HTTPException(status_code=400, detail="Daily report already exists")
    return {"daily_report_id": cur.lastrowid}

@app.post("/daily-reports/{report_id}/save")
def save_day(report_id: int):
    db = get_db()
    db.execute("UPDATE daily_reports SET is_saved=1 WHERE id=?", (report_id,))
    db.commit()
    return {"status": "saved"}

# ---------- OPERATIONS ----------

@app.post("/operations")
def add_operation(op: Operation):
    duration = calc_duration(op.start_time, op.end_time)

    db = get_db()
    db.execute("""
        INSERT INTO operations (
            daily_report_id, operation_type, status,
            start_time, end_time, duration_hours,
            fuel_mgo, downtime_reason, weather_related
        )
        VALUES (?,?,?,?,?,?,?,?,?)
    """, (
        op.daily_report_id,
        op.operation_type,
        op.status,
        op.start_time.isoformat(),
        op.end_time.isoformat(),
        duration,
        op.fuel_mgo,
        op.downtime_reason,
        int(op.weather_related)
    ))
    db.commit()

    return {"duration_hours": duration}

@app.put("/operations/{operation_id}")
def update_operation(operation_id: int, op: Operation):
    duration = calc_duration(op.start_time, op.end_time)

    db = get_db()
    db.execute("""
        UPDATE operations
        SET operation_type=?,
            status=?,
            start_time=?,
            end_time=?,
            duration_hours=?,
            fuel_mgo=?,
            downtime_reason=?,
            weather_related=?
        WHERE id=?
    """, (
        op.operation_type,
        op.status,
        op.start_time.isoformat(),
        op.end_time.isoformat(),
        duration,
        op.fuel_mgo,
        op.downtime_reason,
        int(op.weather_related),
        operation_id
    ))
    db.commit()

    return {"duration_hours": duration}

# ---------- MONTHLY OVERVIEW ----------

@app.get("/overview/monthly")
def monthly_overview(vessel_id: int, project_id: int, year: int, month: int):
    start = f"{year}-{month:02d}-01"
    end = f"{year}-{month:02d}-31"

    row = get_db().execute("""
        SELECT
            SUM(CASE WHEN o.status='WORKING' THEN o.duration_hours ELSE 0 END),
            SUM(CASE WHEN o.status='DOWNTIME' THEN o.duration_hours ELSE 0 END),
            SUM(o.fuel_mgo),
            SUM(CASE WHEN o.weather_related=1 THEN o.duration_hours ELSE 0 END)
        FROM operations o
        JOIN daily_reports d ON d.id = o.daily_report_id
        WHERE d.vessel_id = ?
          AND d.project_id = ?
          AND d.is_saved = 1
          AND d.date BETWEEN ? AND ?
    """, (vessel_id, project_id, start, end)).fetchone()

    working, downtime, fuel, weather = row or (0,0,0,0)

    utilization = round(working / (working + downtime) * 100, 1) if (working + downtime) else 0

    return {
        "working_hours": working,
        "downtime_hours": downtime,
        "utilization_pct": utilization,
        "fuel_total": fuel,
        "fuel_per_working_hour": round(fuel / working, 2) if working else 0,
        "weather_impact_pct": round(weather / downtime * 100, 1) if downtime else 0
    }

# ---------- EXCEL EXPORT ----------

@app.get("/overview/monthly/excel")
def monthly_overview_excel(vessel_id: int, project_id: int, year: int, month: int):
    data = monthly_overview(vessel_id, project_id, year, month)

    wb = Workbook()
    ws = wb.active
    ws.title = "Overview"

    ws.append(["Metric", "Value"])
    for k, v in data.items():
        ws.append([k.replace("_", " ").title(), v])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    filename = f"Overview_{year}_{month:02d}.xlsx"

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

