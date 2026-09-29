"""
database.py — SQLite database models untuk TPB Portal
Tables: User, ScheduleOverride, AdminTask, Announcement
"""
import os
import json
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field, Session, create_engine, select

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "tpb.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


# ─────────────────────────────────────────────
# MODELS
# ─────────────────────────────────────────────

class User(SQLModel, table=True):
    """Tabel user: semua mahasiswa yang sudah setup password"""
    id: Optional[int] = Field(default=None, primary_key=True)
    nim: str = Field(index=True, unique=True)
    name: str
    password_hash: str
    role: str = Field(default="member")  # "super_admin" | "admin" | "member"
    class_name: Optional[str] = None     # e.g. "TPB 44"
    prodi: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    last_login: Optional[str] = None


class ScheduleOverride(SQLModel, table=True):
    """Edit jadwal oleh admin — override dari master Excel"""
    id: Optional[int] = Field(default=None, primary_key=True)
    class_name: str = Field(index=True)          # e.g. "TPB 44"
    schedule_id: str = Field(index=True)          # ID dari JSON master
    day: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room: Optional[str] = None
    lecturer: Optional[str] = None
    link: Optional[str] = None
    note: Optional[str] = None                   # catatan admin
    changed_by_nim: str                           # NIM admin yang ubah
    changed_by_name: str
    changed_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    is_deleted: bool = Field(default=False)       # soft delete


class AdminTask(SQLModel, table=True):
    """Tugas yang dibuat admin — global untuk semua member sekelas"""
    id: Optional[int] = Field(default=None, primary_key=True)
    class_name: str = Field(index=True)
    title: str
    course_name: str
    deadline: Optional[str] = None
    notes: Optional[str] = None
    created_by_nim: str
    created_by_name: str
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    is_active: bool = Field(default=True)


class Announcement(SQLModel, table=True):
    """Pengumuman kelas dari admin"""
    id: Optional[int] = Field(default=None, primary_key=True)
    class_name: str = Field(index=True)
    title: str
    content: str
    created_by_nim: str
    created_by_name: str
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    is_pinned: bool = Field(default=False)
    is_active: bool = Field(default=True)


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def create_db_and_tables():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session


def get_user_by_nim(nim: str) -> Optional[User]:
    with Session(engine) as session:
        return session.exec(select(User).where(User.nim == nim)).first()


def get_all_overrides_for_class(class_name: str) -> dict:
    """Return dict: schedule_id -> override_fields, untuk merge dengan master JSON"""
    with Session(engine) as session:
        overrides = session.exec(
            select(ScheduleOverride).where(
                ScheduleOverride.class_name == class_name.strip().upper(),
                ScheduleOverride.is_deleted == False
            )
        ).all()

    result = {}
    for ov in overrides:
        result[ov.schedule_id] = {
            "day": ov.day,
            "start_time": ov.start_time,
            "end_time": ov.end_time,
            "room": ov.room,
            "lecturer": ov.lecturer,
            "link": ov.link,
            "note": ov.note,
            "changed_by_name": ov.changed_by_name,
            "changed_at": ov.changed_at,
            "isAdminEdited": True
        }
    return result


def get_deleted_schedule_ids(class_name: str) -> set:
    with Session(engine) as session:
        overrides = session.exec(
            select(ScheduleOverride).where(
                ScheduleOverride.class_name == class_name.strip().upper(),
                ScheduleOverride.is_deleted == True
            )
        ).all()
    return {ov.schedule_id for ov in overrides}


def get_admin_tasks_for_class(class_name: str) -> list:
    with Session(engine) as session:
        tasks = session.exec(
            select(AdminTask).where(
                AdminTask.class_name == class_name.strip().upper(),
                AdminTask.is_active == True
            )
        ).all()
    return [t.model_dump() for t in tasks]


def get_announcements_for_class(class_name: str) -> list:
    with Session(engine) as session:
        ann = session.exec(
            select(Announcement).where(
                Announcement.class_name == class_name.strip().upper(),
                Announcement.is_active == True
            ).order_by(Announcement.is_pinned.desc(), Announcement.created_at.desc())
        ).all()
    return [a.model_dump() for a in ann]
