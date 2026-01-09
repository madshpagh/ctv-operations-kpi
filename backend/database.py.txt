import sqlite3

DB_NAME = "data.db"

def get_db():
    conn = sqlite3.connect(DB_NAME, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS vessels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS daily_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        vessel_id INTEGER NOT NULL,
        project_id INTEGER NOT NULL,
        comment TEXT,
        is_saved INTEGER DEFAULT 0,
        UNIQUE(date, vessel_id, project_id)
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS operations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        daily_report_id INTEGER NOT NULL,
        operation_type TEXT NOT NULL,
        status TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        duration_hours REAL NOT NULL,
        fuel_mgo REAL DEFAULT 0,
        downtime_reason TEXT,
        weather_related INTEGER DEFAULT 0
    )
    """)

    conn.commit()
    conn.close()
