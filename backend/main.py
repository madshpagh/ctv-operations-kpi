from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3

# ======================================================
# APP
# ======================================================
app = FastAPI()

# ======================================================
# CORS
# ======================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ctv-operations-kpi.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ======================================================
# DATABASE
# ======================================================
conn = sqlite3.connect("database.db", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS vessels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    vessel_type TEXT NOT NULL
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

cursor.execute("""
CREATE TABLE IF NOT EXISTS operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_report_id INTEGER NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    comment TEXT
)
""")

conn.commit()

# ======================================================
# MODELS
# ======================================================
class SetupIn(BaseModel):
    vessel_name: str
    vessel_type: str  # CTV / SOV / IV
    project_name: str

class DailyReportIn(BaseModel):
    vessel_id: int
    project_id: int
    date: str

class OperationIn(BaseModel):
    daily_report_id: int
    start_time: str
    end_time: str
    operation_type: str
    comment: str | None = None

# ======================================================
# SETUP (ONE-CLICK CREATE)
# ======================================================
@app.post("/setup")
@app.post("/setup/")
def create_setup(data: SetupIn):
    # project
    cursor.execute(
        "INSERT OR IGNORE INTO projects (name) VALUES (?)",
        (data.project_name,)
    )

    cursor.execute(
        "SELECT id FROM projects WHERE name = ?",
        (data.project_name,)
    )
    project_id = cursor.fetchone()[0]

    # vessel
    cursor.execute("""
        INSERT OR IGNORE INTO vessels (name, vessel_type)
        VALUES (?, ?)
    """, (data.vessel_name, data.vessel_type))

    cursor.execute("""
        SELECT id FROM vessels
        WHERE name = ? AND vessel_type = ?
    """, (data.vessel_name, data.vessel_type))
    vessel_id = cursor.fetchone()[0]

    conn.commit()

    return {
        "vessel_id": vessel_id,
        "project_id": project_id
    }

# ======================================================
# PROJECTS
# ======================================================
@app.get("/projects")
@app.get("/projects/")
def get_projects():
    rows = cursor.execute("SELECT id, name FROM projects ORDER BY name").fetchall()
    return [{"id": r[0], "name": r[1]} for r in rows]

# ======================================================
# DAILY REPORTS (FILTER BY PROJECT)
# ======================================================
@app.get("/projects/{project_id}/daily-reports")
@app.get("/projects/{project_id}/daily-reports/")
def get_project_daily_reports(project_id: int):
    rows = cursor.execute("""
        SELECT dr.id, dr.date, v.name, v.vessel_type
        FROM daily_reports dr
        JOIN vessels v ON v.id = dr.vessel_id
        WHERE dr.project_id = ?
        ORDER BY v.name, dr.date DESC
    """, (project_id,)).fetchall()

    return [
        {
            "id": r[0],
            "date": r[1],
            "vessel": r[2],
            "vessel_type": r[3]
        }
        for r in rows
    ]

@app.post("/daily-reports")
@app.post("/daily-reports/")
def create_daily_report(report: DailyReportIn):
    try:
        cursor.execute("""
            INSERT INTO daily_reports (vessel_id, project_id, date)
            VALUES (?, ?, ?)
        """, (report.vessel_id, report.project_id, report.date))
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=400,
            detail="Daily report already exists"
        )

    return {"status": "ok"}

# ======================================================
# OPERATIONS
# ======================================================
@app.get("/operations/{daily_report_id}")
@app.get("/operations/{daily_report_id}/")
def get_operations(daily_report_id: int):
    rows = cursor.execute("""
        SELECT id, start_time, end_time, operation_type, comment
        FROM operations
        WHERE daily_report_id = ?
        ORDER BY start_time
    """, (daily_report_id,)).fetchall()

    return [
        {
            "id": r[0],
            "start_time": r[1],
            "end_time": r[2],
            "operation_type": r[3],
            "comment": r[4]
        }
        for r in rows
    ]

@app.post("/operations")
@app.post("/operations/")
def create_operation(op: OperationIn):
    cursor.execute("""
        INSERT INTO operations
        (daily_report_id, start_time, end_time, operation_type, comment)
        VALUES (?, ?, ?, ?, ?)
    """, (
        op.daily_report_id,
        op.start_time,
        op.end_time,
        op.operation_type,
        op.comment
    ))

    conn.commit()
    return {"status": "ok"}

from openpyxl import Workbook
from fastapi.responses import StreamingResponse
import io

@app.get("/projects/{project_id}/kpi/{year}/{month}/excel")
@app.get("/projects/{project_id}/kpi/{year}/{month}/excel/")
def export_kpi_excel(project_id: int, year: int, month: int):
    rows = cursor.execute("""
        SELECT
            v.name,
            o.operation_type,
            o.start_time,
            o.end_time
        FROM operations o
        JOIN daily_reports dr ON dr.id = o.daily_report_id
        JOIN vessels v ON v.id = dr.vessel_id
        WHERE
            dr.project_id = ?
            AND strftime('%Y', dr.date) = ?
            AND strftime('%m', dr.date) = ?
    """, (project_id, str(year), f"{month:02d}")).fetchall()

    data = {}

    for vessel, op_type, start, end in rows:
        start_dt = datetime.strptime(start, "%H:%M")
        end_dt = datetime.strptime(end, "%H:%M")
        minutes = int((end_dt - start_dt).total_seconds() / 60)

        if vessel not in data:
            data[vessel] = {}

        data[vessel][op_type] = data[vessel].get(op_type, 0) + minutes

    wb = Workbook()
    wb.remove(wb.active)

    for vessel, ops in data.items():
        ws = wb.create_sheet(title=vessel[:31])
        ws.append(["Operation", "Tid (min)", "Tid (hh:mm)"])

        total = 0
        for op, minutes in ops.items():
            total += minutes
            ws.append([
                op,
                minutes,
                f"{minutes // 60:02d}:{minutes % 60:02d}"
            ])

        ws.append([])
        ws.append([
            "TOTAL",
            total,
            f"{total // 60:02d}:{total % 60:02d}"
        ])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    filename = f"KPI_Project_{project_id}_{year}-{month:02d}.xlsx"

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
