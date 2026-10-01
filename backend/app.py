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
    Jadwal kelas terpadu (Jadwal umum + Core Prodi Kelas A/B/C) secara default,
    dengan override dari admin sudah digabung.
    """
    data = load_data()
    clean_target = class_name.strip().upper()

    # 1. Jadwal umum kelas TPB
    raw_schedules = []
    for item in data.get("schedules", []):
        c_name = (item.get("class_name") or "").strip().upper()
        sheet = (item.get("sheet") or "").upper()
        if sheet != "CORE PRODI":
            if c_name == clean_target or c_name == f"TPB {clean_target}" or clean_target in c_name:
                raw_schedules.append(dict(item))

    # 2. Satukan Jadwal Core Prodi terkait (A/B/C) secara default
    students_in_class = [
        s for s in data.get("students", [])
        if (s.get("tpb_class") or "").strip().upper() == clean_target
        or (s.get("tpb_class") or "").strip().upper() == f"TPB {clean_target}"
    ]

    class_prodis = set(s.get("prodi", "").strip().lower() for s in students_in_class if s.get("prodi"))
    core_classes_in_students = set(
        s.get("core2", "").strip().upper() for s in students_in_class if s.get("core2")
    )

    core_prodi_schedules = []
    for item in data.get("schedules", []):
        if item.get("sheet") == "CORE PRODI":
            p_item = (item.get("prodi") or "").lower()
            core_cls = (item.get("core_class") or "").strip().upper()

            # Cocokkan dengan prodi anggota kelas
            is_matching_prodi = any((cp in p_item or p_item in cp) for cp in class_prodis if cp)
            if is_matching_prodi:
                # Untuk Sains Data di TPB 44, kelas A, B, C
                if "sains data" in p_item and core_cls in ("A", "B", "C"):
                    c_item = dict(item)
                    c_item["is_core_prodi"] = True
                    c_item["core_class"] = core_cls
                    c_item["display_core_type"] = f"Kelas {core_cls}"
                    core_prodi_schedules.append(c_item)
                # Untuk Teknik Sistem Energi di TPB 44, kelas A, B
                elif "energi" in p_item and core_cls in ("A", "B"):
                    c_item = dict(item)
                    c_item["is_core_prodi"] = True
                    c_item["core_class"] = core_cls
                    c_item["display_core_type"] = f"Kelas {core_cls}"
                    core_prodi_schedules.append(c_item)
                elif not class_prodis:
                    # Fallback jika kelas non-TPB
                    c_item = dict(item)
                    c_item["is_core_prodi"] = True
                    c_item["core_class"] = core_cls
                    c_item["display_core_type"] = f"Kelas {core_cls}" if core_cls else "Core"
                    core_prodi_schedules.append(c_item)

    all_raw = raw_schedules + core_prodi_schedules

    # 3. Terapkan override dari admin SQLite
    overrides = get_all_overrides_for_class(clean_target)
    deleted_ids = get_deleted_schedule_ids(clean_target)

    merged = []
    for item in all_raw:
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

    # 4. Sertakan jadwal tambahan buatan Admin (CUSTOM_*) seperti Tutorial / Responsi
    for sid, ov in overrides.items():
        if sid.startswith("CUSTOM_"):
            raw_note = ov.get("note") or ""
            course_name = "Jadwal Tambahan"
            category = "Tutorial"
            core_class = ""
            prodi = ""
            user_note = ""

            if raw_note.startswith("__CUSTOM_META__"):
                try:
                    payload = json.loads(raw_note.replace("__CUSTOM_META__", ""))
                    course_name = payload.get("course_name", course_name)
                    category = payload.get("category", category)
                    core_class = payload.get("tutorial_class", "")
                    prodi = payload.get("prodi", "")
                    user_note = payload.get("user_note", "")
                except Exception:
                    user_note = raw_note
            else:
                user_note = raw_note

            custom_item = {
                "id": sid,
                "class_name": class_name,
                "course_name": course_name,
                "category": category,
                "day": ov.get("day", ""),
                "start_time": ov.get("start_time", ""),
                "end_time": ov.get("end_time", ""),
                "room": ov.get("room", "") or "-",
                "lecturer": ov.get("lecturer", "") or "",
                "note": user_note,
                "core_class": core_class,
                "prodi": prodi,
                "is_core_prodi": (category in ("Core Prodi", "Tutorial") and bool(core_class or prodi)),
                "isAdminEdited": True,
                "changed_by_name": ov.get("changed_by_name", "Admin"),
                "changed_at": ov.get("changed_at", "")
            }
            merged.append(custom_item)

    return {
        "class_name": class_name,
        "count": len(merged),
        "schedules": merged,
        "core_types_available": sorted(list(set(c["core_class"] for c in core_prodi_schedules if c.get("core_class")))),
        "prodis_available": sorted(list(set(s.get("prodi") for s in students_in_class if s.get("prodi")))),
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
