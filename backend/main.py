from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import sqlite3
from datetime import datetime
from openpyxl import Workbook
import io

app = FastAPI()

# =========================
# CORS
# =========================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# DATABASE
# =========================
conn = sqlite3.connect("database.db", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS vessels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    vessel_type TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vessel_id INTEGER,
    project_id INTEGER,
    date TEXT
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS operations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    daily_report_id INTEGER,
    start_time TEXT,
    end_time TEXT,
    operation_type TEXT,
    comment TEXT
)
""")

conn.commit()

# =========================
# SETUP (one-click)
# =========================
@app.post("/setup/")
def setup(data: dict):
    vessel_name = data["vessel_name"]
    vessel_type = data["vessel_type"]
    project_name = data["project_name"]

    cursor.execute(
        "INSERT INTO vessels (name, vessel_type) VALUES (?, ?)",
        (vessel_name, vessel_type)
    )
    vessel_id = cursor.lastrowid

    cursor.execute(
        "INSERT INTO projects (name) VALUES (?)",
        (project_name,)
    )
    project_id = cursor.lastrowid

    conn.commit()

    return {
        "vessel_id": vessel_id,
        "project_id": project_id
    }

# =========================
# PROJECTS
# =========================
@app.get("/projects/")
def get_projects():
    rows = cursor.execute("SELECT id, name FROM projects").fetchall()
    return [{"id": r[0], "name": r[1]} for r in rows]

# =========================
# DAILY REPORTS
# =========================
@app.post("/daily-reports/")
def create_daily_report(data: dict):
    cursor.execute("""
        INSERT INTO daily_reports (vessel_id, project_id, date)
        VALUES (?, ?, ?)
    """, (data["vessel_id"], data["project_id"], data["date"]))
    conn.commit()
    return {"status": "ok"}

@app.get("/projects/{project_id}/daily-reports/")
def get_daily_reports(project_id: int):
    rows = cursor.execute("""
        SELECT dr.id, dr.date, v.name, v.vessel_type
        FROM daily_reports dr
        JOIN vessels v ON v.id = dr.vessel_id
        WHERE dr.project_id = ?
        ORDER BY v.name
    """, (project_id,)).fetchall()

   return [
    {
        "id": dr.id,
        "date": dr.date,
        "vessel_name": dr.vessel.name,
        "vessel_type": dr.vessel.vessel_type,
        "operations": [
            {
                "id": op.id,
                "start_time": op.start_time,
                "end_time": op.end_time,
                "operation_type": op.operation_type,
                "comment": op.comment
            }
            for op in dr.operations
        ]
    }
    for dr in daily_reports
]


# =========================
# OPERATIONS
# =========================
@app.post("/operations/")
def add_operation(data: dict):
    cursor.execute("""
        INSERT INTO operations
        (daily_report_id, start_time, end_time, operation_type, comment)
        VALUES (?, ?, ?, ?, ?)
    """, (
        data["daily_report_id"],
        data["start_time"],
        data["end_time"],
        data["operation_type"],
        data.get("comment", "")
    ))
    conn.commit()
    return {"status": "ok"}

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
        } for r in rows
    ]

# =========================
# KPI – OPERATION BASED
# =========================
@app.get("/projects/{project_id}/kpi/{year}/{month}/")
@app.get("/projects/{project_id}/kpi/{year}/{month}")
def project_kpi(project_id: int, year: int, month: int):
    rows = cursor.execute("""
        SELECT v.name, o.operation_type, o.start_time, o.end_time
        FROM operations o
        JOIN daily_reports dr ON dr.id = o.daily_report_id
        JOIN vessels v ON v.id = dr.vessel_id
        WHERE dr.project_id = ?
        AND strftime('%Y', dr.date) = ?
        AND strftime('%m', dr.date) = ?
    """, (project_id, str(year), f"{month:02d}")).fetchall()

    result = {}

    for vessel, op_type, start, end in rows:
        start_dt = datetime.strptime(start, "%H:%M")
        end_dt = datetime.strptime(end, "%H:%M")
        minutes = int((end_dt - start_dt).total_seconds() / 60)

        result.setdefault(vessel, {})
        result[vessel][op_type] = result[vessel].get(op_type, 0) + minutes

    output = []
    for vessel, ops in result.items():
        output.append({
            "vessel": vessel,
            "operations": [
                {"operation_type": k, "minutes": v}
                for k, v in ops.items()
            ]
        })

    return output

# =========================
# KPI – EXCEL EXPORT
# =========================
@app.get("/projects/{project_id}/kpi/{year}/{month}/excel/")
@app.get("/projects/{project_id}/kpi/{year}/{month}/excel")
def export_kpi_excel(project_id: int, year: int, month: int):
    rows = cursor.execute("""
        SELECT v.name, o.operation_type, o.start_time, o.end_time
        FROM operations o
        JOIN daily_reports dr ON dr.id = o.daily_report_id
        JOIN vessels v ON v.id = dr.vessel_id
        WHERE dr.project_id = ?
        AND strftime('%Y', dr.date) = ?
        AND strftime('%m', dr.date) = ?
    """, (project_id, str(year), f"{month:02d}")).fetchall()

    data = {}

    for vessel, op_type, start, end in rows:
        start_dt = datetime.strptime(start, "%H:%M")
        end_dt = datetime.strptime(end, "%H:%M")
        minutes = int((end_dt - start_dt).total_seconds() / 60)

        data.setdefault(vessel, {})
        data[vessel][op_type] = data[vessel].get(op_type, 0) + minutes

    wb = Workbook()
    ws_default = wb.active
    ws_default.title = "Overview"

    # Hvis der ingen data er
    if not data:
        ws_default.append(["Ingen KPI-data for valgt periode"])
    else:
        # Fjern default sheet først NÅR vi ved der kommer andre
        wb.remove(ws_default)

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
            ws.append(["TOTAL", total, f"{total // 60:02d}:{total % 60:02d}"])

    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition":
            f"attachment; filename=KPI_Project_{project_id}_{year}-{month:02d}.xlsx"
        }
    )

