import csv
import json
import os
import re
import time
from typing import Dict, Any, List, Optional

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
EXAMS_DIR = os.path.join(DATA_DIR, "exams")
SCHEDULE_DATA_PATH = os.path.join(DATA_DIR, "schedule_data.json")
EXAM_DATA_PATH = os.path.join(DATA_DIR, "exam_data.json")

# In-memory cache
_EXAM_CACHE: Optional[Dict[str, Any]] = None
_STUDENT_NIM_MAP: Dict[str, Dict[str, Any]] = {}

def build_exam_data() -> Dict[str, Any]:
    global _EXAM_CACHE, _STUDENT_NIM_MAP
    # 1. Load base students from schedule_data.json
    base_students: Dict[str, Dict[str, Any]] = {}
    if os.path.exists(SCHEDULE_DATA_PATH):
        try:
            with open(SCHEDULE_DATA_PATH, "r", encoding="utf-8") as f:
                sched = json.load(f)
                for s in sched.get("students", []):
                    nim = (s.get("nim") or "").strip()
                    if nim:
                        base_students[nim] = {
                            "nim": nim,
                            "name": (s.get("name") or "").strip(),
                            "prodi": (s.get("prodi") or "").strip(),
                            "tpb_class": (s.get("tpb_class") or "").strip(),
                            "fakultas": (s.get("fakultas") or "").strip(),
                            "core1": (s.get("core1") or "").strip(),
                            "core2": (s.get("core2") or "").strip(),
                            "pik": (s.get("pik") or "").strip(),
                            "aapp": (s.get("aapp") or "").strip(),
                            "exams": []
                        }
        except Exception as e:
            print(f"Error reading schedule_data.json: {e}")

    # 2. Master overview from home.csv
    master_exams: List[Dict[str, Any]] = []
    home_csv = os.path.join(EXAMS_DIR, "home.csv")
    if os.path.exists(home_csv):
        with open(home_csv, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for r in reader:
                clean_r = [c.strip() for c in r if c.strip()]
                if len(clean_r) >= 5 and clean_r[0].isdigit():
                    no = clean_r[0]
                    course = clean_r[1]
                    if "Transformasi Berkelanjutan Sumatera" in course:
                        course = "UTS Transformasi Berkelanjutan Sumatera"
                    mode = clean_r[2]
                    time_schedule = clean_r[3]
                    room = clean_r[4]
                    ket = clean_r[5] if len(clean_r) > 5 else "Akan berlangsung"
                    master_exams.append({
                        "no": int(no),
                        "course": course,
                        "mode": mode,
                        "schedule": time_schedule,
                        "room": room,
                        "status": ket
                    })

    # 3. Specific CBT Exam CSVs
    cbt_sources = [
        ("biologi.csv", "UTS Biologi Dasar", "CBT"),
        ("fisika.csv", "UTS Fisika Dasar & Pengantar Fisika", "CBT"),
        ("kimia.csv", "UTS Kimia Dasar", "CBT"),
        ("dtd_pk.csv", "UTS Dasar Teknologi Digital / Pengenalan Komputasi", "CBT")
    ]

    for fname, course_title, mode in cbt_sources:
        fpath = os.path.join(EXAMS_DIR, fname)
        if not os.path.exists(fpath):
            continue
        with open(fpath, "r", encoding="utf-8", errors="replace") as f:
            reader = csv.reader(f)
            for r in reader:
                if len(r) >= 10:
                    nim = r[1].strip()
                    name = r[2].strip()
                    prodi = r[3].strip()
                    tpb_class = r[4].strip()
                    sesi = r[5].strip()
                    hari_tgl = r[6].strip()
                    waktu = r[7].strip()
                    no_urut = r[8].strip()
                    ruang = r[9].strip()

                    if not nim or nim.lower() == "nim" or not hari_tgl:
                        continue

                    if nim not in base_students:
                        base_students[nim] = {
                            "nim": nim,
                            "name": name,
                            "prodi": prodi,
                            "tpb_class": tpb_class,
                            "fakultas": "",
                            "core1": "",
                            "core2": "",
                            "pik": "",
                            "aapp": "",
                            "exams": []
                        }

                    if not base_students[nim]["name"] and name:
                        base_students[nim]["name"] = name
                    if not base_students[nim]["tpb_class"] and tpb_class:
                        base_students[nim]["tpb_class"] = tpb_class
                    if not base_students[nim]["prodi"] and prodi:
                        base_students[nim]["prodi"] = prodi

                    base_students[nim]["exams"].append({
                        "course": course_title,
                        "mode": mode,
                        "sesi": sesi,
                        "date": hari_tgl,
                        "time": waktu,
                        "seat": no_urut,
                        "room": ruang,
                        "note": "CBT di Laboratorium Komputer"
                    })

    # 4. Integrate PBT and General Class Exams for each student
    for nim, s in base_students.items():
        tpb_class = s.get("tpb_class", "").upper()
        class_num = None
        m = re.search(r'\d+', tpb_class)
        if m:
            class_num = int(m.group(0))

        # A. UTS PIK
        if s.get("pik"):
            s["exams"].append({
                "course": "UTS Pengantar Infrastruktur dan Kewilayahan (PIK)",
                "mode": "PBT",
                "sesi": s.get("pik"),
                "date": "Jumat, 23 Oktober 2026",
                "time": "07.30 - 09.10",
                "seat": "-",
                "room": "Mengikuti ruang kelas perkuliahan",
                "note": "PBT (Paper Based Test) di Ruang Kelas Perkuliahan"
            })

        # B. UTS AAPP
        if s.get("aapp"):
            s["exams"].append({
                "course": "UTS Asas - Asas Perencanaan dan Perancangan (AAPP)",
                "mode": "PBT",
                "sesi": s.get("aapp"),
                "date": "Jumat, 23 Oktober 2026",
                "time": "09.20 - 11.00",
                "seat": "-",
                "room": "Mengikuti ruang kelas perkuliahan",
                "note": "PBT (Paper Based Test) di Ruang Kelas Perkuliahan"
            })

        # C. UTS Matematika Dasar
        matematika_course = "UTS Matematika Dasar"
        matematika_time = "08.30 - 10.10"
        matematika_sesi = "Sesi 01"
        if class_num and class_num > 41:
            matematika_sesi = "Sesi 02"
            matematika_time = "10.30 - 12.10"

        s["exams"].append({
            "course": matematika_course,
            "mode": "PBT",
            "sesi": matematika_sesi,
            "date": "Sabtu, 31 Oktober 2026",
            "time": matematika_time,
            "seat": "-",
            "room": "Ruang kelas perkuliahan",
            "note": "PBT (Paper Based Test)"
        })

        # D. UTS Transformasi Berkelanjutan Sumatera
        if class_num:
            if class_num <= 41:
                tb_sesi = "Sesi 01"
                tb_time = "08.30 - 10.10"
            else:
                tb_sesi = "Sesi 02"
                tb_time = "10.30 - 12.10"
            
            s["exams"].append({
                "course": "UTS Transformasi Berkelanjutan Sumatera",
                "mode": "PBT",
                "sesi": tb_sesi,
                "date": "Sabtu, 07 November 2026",
                "time": tb_time,
                "seat": "-",
                "room": "Ruang kelas perkuliahan",
                "note": f"PBT di Ruang Kelas ({tpb_class})"
            })

        # E. UTS Bahasa Indonesia / Inggris
        s["exams"].append({
            "course": "UTS Bahasa Indonesia / Inggris",
            "mode": "CBT",
            "sesi": "Sesuai Jadwal Labkom",
            "date": "Sabtu, 14 November 2026",
            "time": "08.00 - selesai",
            "seat": "-",
            "room": "Laboratorium Komputer",
            "note": "CBT di Labkom (Jadwal sesi detail menyusul)"
        })

        # Sort student exams by date and time
        def get_exam_sort_key(ex):
            d_str = ex.get("date", "").lower()
            month_val = 10
            if "nov" in d_str:
                month_val = 11
            elif "des" in d_str:
                month_val = 12
            
            m_day = re.search(r'\b(\d{1,2})\b', d_str)
            day_val = int(m_day.group(1)) if m_day else 0
            
            t_str = ex.get("time", "")
            m_hour = re.search(r'(\d{2})[.:](\d{2})', t_str)
            hour_val = int(m_hour.group(1)) if m_hour else 0
            min_val = int(m_hour.group(2)) if m_hour else 0
            
            return (month_val, day_val, hour_val, min_val)

        s["exams"].sort(key=get_exam_sort_key)

    payload = {
        "metadata": {
            "title": "Jadwal & Pembagian Ruang UTS TPB Gasal TA 2026/2027",
            "semester": "Gasal 2026/2027",
            "institution": "Institut Teknologi Sumatera (ITERA)",
            "updated_at": "16 Oktober 2026",
            "total_students": len(base_students),
            "master_exams_count": len(master_exams)
        },
        "master_exams": master_exams,
        "students": list(base_students.values())
    }

    try:
        with open(EXAM_DATA_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Error saving {EXAM_DATA_PATH}: {e}")

    _EXAM_CACHE = payload
    _STUDENT_NIM_MAP = {s["nim"]: s for s in payload["students"]}
    return payload


def load_exam_data() -> Dict[str, Any]:
    global _EXAM_CACHE, _STUDENT_NIM_MAP
    if _EXAM_CACHE is not None:
        return _EXAM_CACHE

    if os.path.exists(EXAM_DATA_PATH):
        try:
            with open(EXAM_DATA_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                _EXAM_CACHE = data
                _STUDENT_NIM_MAP = {s["nim"]: s for s in data.get("students", [])}
                return _EXAM_CACHE
        except Exception as e:
            print(f"Error loading {EXAM_DATA_PATH}: {e}")

    return build_exam_data()


def get_exam_overview() -> Dict[str, Any]:
    data = load_exam_data()
    return {
        "metadata": data.get("metadata", {}),
        "master_exams": data.get("master_exams", []),
        "classes_count": len(set(s.get("tpb_class") for s in data.get("students", []) if s.get("tpb_class"))),
        "students_count": len(data.get("students", []))
    }


def search_exam_students(query: str, limit: int = 25) -> List[Dict[str, Any]]:
    data = load_exam_data()
    clean_q = query.strip().lower()
    if not clean_q:
        return []

    tokens = clean_q.split()
    results = []

    for s in data.get("students", []):
        nim = (s.get("nim") or "").lower()
        name = (s.get("name") or "").lower()
        tpb_class = (s.get("tpb_class") or "").lower()
        prodi = (s.get("prodi") or "").lower()

        # Score matching
        score = 0
        if clean_q == nim:
            score += 100
        elif nim.startswith(clean_q):
            score += 50
        elif clean_q in nim:
            score += 30

        if clean_q == name:
            score += 100
        elif name.startswith(clean_q):
            score += 60
        elif all(token in name for token in tokens):
            score += 40
        elif any(token in name for token in tokens):
            score += 20

        if clean_q in tpb_class:
            score += 10

        if score > 0:
            results.append((score, {
                "nim": s.get("nim"),
                "name": s.get("name"),
                "prodi": s.get("prodi"),
                "tpb_class": s.get("tpb_class"),
                "fakultas": s.get("fakultas"),
                "exams_count": len(s.get("exams", [])),
                # include first upcoming exam for quick preview in dropdown
                "next_exam": s["exams"][0] if s.get("exams") else None
            }))

    # Sort descending by score
    results.sort(key=lambda x: x[0], reverse=True)
    return [item[1] for item in results[:limit]]


def get_student_exam_schedule(nim: str) -> Optional[Dict[str, Any]]:
    load_exam_data()
    clean_nim = nim.strip()
    return _STUDENT_NIM_MAP.get(clean_nim)


def get_class_exam_schedule(class_name: str) -> Dict[str, Any]:
    data = load_exam_data()
    clean_cls = class_name.strip().upper()
    
    # support formats like "44", "TPB 44", "tpb 44"
    students = []
    for s in data.get("students", []):
        sc = (s.get("tpb_class") or "").strip().upper()
        if sc == clean_cls or sc == f"TPB {clean_cls}" or clean_cls in sc:
            students.append(s)

    return {
        "class_name": class_name,
        "count": len(students),
        "students": students
    }
