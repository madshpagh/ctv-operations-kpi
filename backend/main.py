from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

conn = sqlite3.connect("database.db", check_same_thread=False)
cursor = conn.cursor()

# ---------- TABLES ----------

cursor.execute("""
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS vessels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    vessel_type TEXT,
    project_id INTEGER
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    vessel_id INTEGER,
    date TEXT,
    UNIQUE(project_id, vessel_id, date)
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

# ---------- SETUP ----------

@app.post("/setup/")
def setup(data: dict):
    project_name = data["project_name"]
    vessel_name = data["vessel_name"]
    vessel_type = data["vessel_type"]
    date = data["date"]

    # project
    row = cursor.execute(
        "SELECT id FROM projects WHERE name = ?",
        (project_name,)
    ).fetchone()

    if row:
        project_id = row[0]
    else:
        cursor.execute(
            "INSERT INTO projects (name) VALUES (?)",
            (project_name,)
        )
        project_id = cursor.lastrowid

    # vessel
    row = cursor.execute(
        "SELECT id FROM vessels WHERE name = ? AND project_id = ?",
        (vessel_name, project_id)
    ).fetchone()

    if row:
        vessel_id = row[0]
    else:
        cursor.execute(
            """
            INSERT INTO vessels (name, vessel_type, project_id)
            VALUES (?, ?, ?)
            """,
            (vessel_name, vessel_type, project_id)
        )
        vessel_id = cursor.lastrowid

    # daily report
    row = cursor.execute(
        """
        SELECT id FROM daily_reports
        WHERE project_id = ? AND vessel_id = ? AND date = ?
        """,
        (project_id, vessel_id, date)
    ).fetchone()

    if row:
        report_id = row[0]
    else:
        cursor.execute(
            """
            INSERT INTO daily_reports (project_id, vessel_id, date)
            VALUES (?, ?, ?)
            """,
            (project_id, vessel_id, date)
        )
        report_id = cursor.lastrowid

    conn.commit()

    return {
        "project_id": project_id,
        "vessel_id": vessel_id,
        "daily_report_id": report_id
    }
@app.get("/projects/")
def get_projects():
    rows = cursor.execute(
        "SELECT id, name FROM projects ORDER BY name"
    ).fetchall()

    return [
        {
            "id": row[0],
            "name": row[1]
        }
        for row in rows
    ]
