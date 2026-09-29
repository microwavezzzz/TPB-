import os
import json
from fastapi import FastAPI, Query, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.parser import parse_schedule_data
from backend.database import (
    create_db_and_tables, get_all_overrides_for_class,
    get_deleted_schedule_ids, get_admin_tasks_for_class,
    get_announcements_for_class
)
from backend.auth import router as auth_router, get_current_user
from backend.admin import router as admin_router

app = FastAPI(title="TPB Schedule Portal 2026/2027", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Init database on startup
@app.on_event("startup")
def on_startup():
    create_db_and_tables()

# Include routers
app.include_router(auth_router)
app.include_router(admin_router)

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "schedule_data.json")

def load_data():
    if os.path.exists(DATA_PATH):
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    data = parse_schedule_data()
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


# ─────────────────────────────────────────────
# PUBLIC ENDPOINTS (tidak perlu login)
# ─────────────────────────────────────────────

@app.get("/api/schedule")
def get_full_schedule():
    """Data jadwal master — public read-only"""
    data = load_data()
    return {
        "metadata": data.get("metadata", {}),
        "classes": data.get("classes", []),
        "core_classes": data.get("core_classes", []),
        "rooms": data.get("rooms", []),
        "lecturers": data.get("lecturers", []),
        "prodis": data.get("prodis", []),
        "schedules": data.get("schedules", [])
    }

@app.get("/api/class/{class_name}")
def get_class_schedule(class_name: str):
    """
    Jadwal kelas dengan override dari admin sudah digabung.
    Admin edit → semua member langsung lihat perubahan saat refresh.
    """
    data = load_data()
    clean_target = class_name.strip().upper()

    raw_schedules = []
    for item in data.get("schedules", []):
        c_name = (item.get("class_name") or "").strip().upper()
        if c_name == clean_target or c_name == f"TPB {clean_target}" or clean_target in c_name:
            raw_schedules.append(item)

    # Apply admin overrides
    overrides = get_all_overrides_for_class(clean_target)
    deleted_ids = get_deleted_schedule_ids(clean_target)

    merged = []
    for item in raw_schedules:
        sid = item.get("id", "")
        if sid in deleted_ids:
            continue  # Admin hapus jadwal ini
        if sid in overrides:
            ov = overrides[sid]
            merged_item = dict(item)
            for k, v in ov.items():
                if v is not None:
                    merged_item[k] = v
            merged.append(merged_item)
        else:
            merged.append(item)

    return {
        "class_name": class_name,
        "count": len(merged),
        "schedules": merged,
        "admin_tasks": get_admin_tasks_for_class(clean_target),
        "announcements": get_announcements_for_class(clean_target),
    }


@app.get("/api/student/search")
def search_students(q: str = Query(..., min_length=2)):
    data = load_data()
    query = q.strip().lower()
    results = []
    for s in data.get("students", []):
        if query in s.get("nim", "").lower() or query in s.get("name", "").lower():
            results.append(s)
            if len(results) >= 50:
                break
    return {"query": q, "count": len(results), "results": results}


@app.get("/api/student/{nim}")
def get_student_detail(nim: str):
    data = load_data()
    clean_nim = nim.strip()

    student = next((s for s in data.get("students", []) if s.get("nim") == clean_nim), None)
    if not student:
        raise HTTPException(status_code=404, detail="Student with given NIM not found")

    tpb_class = student.get("tpb_class", "").upper()
    core1 = student.get("core1", "").upper()
    core2 = student.get("core2", "").upper()
    pik_class = student.get("pik", "").upper()
    aapp_class = student.get("aapp", "").upper()

    personalized_schedules = []
    for item in data.get("schedules", []):
        c_name = (item.get("class_name") or "").strip().upper()
        sheet = (item.get("sheet") or "").upper()

        if tpb_class and (c_name == tpb_class or c_name == f"TPB {tpb_class}"):
            personalized_schedules.append(item)
        elif pik_class and sheet == "PIK" and (pik_class in c_name or c_name in pik_class):
            personalized_schedules.append(item)
        elif aapp_class and sheet == "AAPP" and (aapp_class in c_name or c_name in aapp_class):
            personalized_schedules.append(item)
        elif sheet == "CORE PRODI" and (core1 or core2):
            core_cls = (item.get("core_class") or "").strip().upper()
            prodi_str = (item.get("prodi") or "").lower()
            student_prodi = student.get("prodi", "").lower()
            if (core1 and core_cls == core1) or (core2 and core_cls == core2):
                if not prodi_str or student_prodi in prodi_str or prodi_str in student_prodi:
                    personalized_schedules.append(item)

    classmates = [s for s in data.get("students", []) if s.get("tpb_class", "").upper() == tpb_class]

    return {
        "student": student,
        "classmates_count": len(classmates),
        "classmates": classmates,
        "schedules": personalized_schedules
    }


@app.get("/api/classmates/{class_name}")
def get_classmates(class_name: str):
    data = load_data()
    clean_target = class_name.strip().upper()
    classmates = [s for s in data.get("students", []) if (s.get("tpb_class") or "").strip().upper() == clean_target]
    return {"class_name": class_name, "count": len(classmates), "students": classmates}


@app.get("/api/announcements/{class_name}")
def get_announcements(class_name: str):
    return {"announcements": get_announcements_for_class(class_name.strip().upper())}


@app.get("/api/tasks/{class_name}")
def get_admin_tasks(class_name: str):
    return {"tasks": get_admin_tasks_for_class(class_name.strip().upper())}


@app.post("/api/sync")
def sync_excel():
    try:
        data = parse_schedule_data()
        with open(DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"status": "success", "message": "Data successfully re-parsed and synchronized from Excel master."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# STATIC FILES & FRONTEND
# ─────────────────────────────────────────────
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

@app.get("/login")
def serve_login():
    login_path = os.path.join(frontend_dir, "login.html")
    if os.path.exists(login_path):
        return FileResponse(login_path)
    return {"message": "Login page not found."}

@app.get("/")
def serve_index():
    index_path = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "TPB Schedule API v2 is running."}
