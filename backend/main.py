from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3

app = FastAPI()

# ===== CORS (VIGTIGT: SKAL STÅ HER) =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ctv-operations-kpi.vercel.app"
    ],
    allow_credentials=True,
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

conn.commit()

# ===== MODELS =====
class VesselIn(BaseModel):
    name: str

class ProjectIn(BaseModel):
    name: str

# ===== ENDPOINTS =====
@app.get("/vessels")
def get_vessels():
    rows = cursor.execute("SELECT id, name FROM vessels").fetchall()
    return [{"id": r[0], "name": r[1]} for r in rows]

@app.post("/vessels")
def create_vessel(vessel: VesselIn):
    cursor.execute(
        "INSERT INTO vessels (name) VALUES (?)",
        (vessel.name,)
    )
    conn.commit()
    return {"status": "ok"}

@app.get("/projects")
def get_projects():
    rows = cursor.execute("SELECT id, name FROM projects").fetchall()
    return [{"id": r[0], "name": r[1]} for r in rows]

@app.post("/projects")
def create_project(project: ProjectIn):
    cursor.execute(
        "INSERT INTO projects (name) VALUES (?)",
        (project.name,)
    )
    conn.commit()
    return {"status": "ok"}
