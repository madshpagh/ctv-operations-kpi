from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3

app = FastAPI()

# ===== CORS =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ctv-operations-kpi.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== DATABASE =====
conn = sqlite3.connect("database.db", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS vessels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vessel_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    UNIQUE(vessel_id, project_id, date)
)
""")

conn.commit()

# ===== MODELS =====
class VesselIn(BaseModel):
    name: str

class ProjectIn(BaseModel):
    name: str

class DailyReportIn(BaseModel):
    vessel_id: int
    project_id: int
    date: str

# ===== VESSELS =====
@app.get("/vessels")
def get_vessels():
    rows = cursor.execute("SELECT id, name FROM vessels").fetchall()
    return [{"id": r[0], "name": r[1]} for r in rows]

@app.post("/vessels")
def create_vessel(vessel: VesselIn):
    cursor.execute("INSERT INTO vessels (name) VALUES (?)", (vessel.name,))
    conn.commit()
    return {"status": "ok"}

# ===== PROJECTS =====
@app.get("/projects")
def get_projects():
    rows = cursor.execute("SELECT id, name FROM projects").fetchall()
    return [{"id": r[0], "name": r[1]} for r in rows]

@app.post("/projects")
def create_project(project: ProjectIn):
    cursor.execute("INSERT INTO projects (name) VALUES (?)", (project.name,))
    conn.commit()
    return {"status": "ok"}

# ===== DAILY REPORTS =====
@app.post("/daily-reports")
def create_daily_report(report: DailyReportIn):
    try:
        cursor.execute(
            "INSERT INTO daily_reports (vessel_id, project_id, date) VALUES (?, ?, ?)",
            (report.vessel_id, report.project_id, report.date)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Daily report already exists for this vessel/project/date"
        )

    return {"status": "ok"}

@app.get("/daily-reports")
def list_daily_reports():
    rows = cursor.execute("""
        SELECT dr.id, v.name, p.name, dr.date
        FROM daily_reports dr
        JOIN vessels v ON v.id = dr.vessel_id
        JOIN projects p ON p.id = dr.project_id
        ORDER BY dr.date DESC
    """).fetchall()

    return [
        {
            "id": r[0],
            "vessel": r[1],
            "project": r[2],
            "date": r[3]
        }
        for r in rows
    ]
