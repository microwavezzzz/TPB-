"""
admin.py — Admin-only endpoints untuk TPB Portal
Hanya bisa diakses oleh role: admin, super_admin
"""
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.database import (
    engine, User, ScheduleOverride, AdminTask, Announcement,
    get_all_overrides_for_class
)
from backend.auth import get_current_user, require_admin, require_super_admin, user_to_dict, hash_password

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ─────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────
class ScheduleEditRequest(BaseModel):
    schedule_id: str
    class_name: str
    day: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room: Optional[str] = None
    lecturer: Optional[str] = None
    link: Optional[str] = None
    note: Optional[str] = None

class ScheduleDeleteRequest(BaseModel):
    schedule_id: str
    class_name: str

class TaskRequest(BaseModel):
    class_name: str
    title: str
    course_name: str
    deadline: Optional[str] = None
    notes: Optional[str] = None

class AnnouncementRequest(BaseModel):
    class_name: str
    title: str
    content: str
    is_pinned: bool = False

class RoleUpdateRequest(BaseModel):
    role: str  # "member" | "admin" | "super_admin"

class ResetPasswordRequest(BaseModel):
    nim: str


# ─────────────────────────────────────────────
# SCHEDULE OVERRIDES
# ─────────────────────────────────────────────

@router.put("/schedule")
def edit_schedule(body: ScheduleEditRequest, admin: User = Depends(require_admin)):
    """Admin: edit jadwal — override dari master Excel"""
    with Session(engine) as session:
        # Cek apakah sudah ada override untuk schedule_id ini
        existing = session.exec(
            select(ScheduleOverride).where(
                ScheduleOverride.schedule_id == body.schedule_id,
                ScheduleOverride.class_name == body.class_name.strip().upper(),
                ScheduleOverride.is_deleted == False
            )
        ).first()

        if existing:
            # Update existing override
            if body.day is not None: existing.day = body.day
            if body.start_time is not None: existing.start_time = body.start_time
            if body.end_time is not None: existing.end_time = body.end_time
            if body.room is not None: existing.room = body.room
            if body.lecturer is not None: existing.lecturer = body.lecturer
            if body.link is not None: existing.link = body.link
            if body.note is not None: existing.note = body.note
            existing.changed_by_nim = admin.nim
            existing.changed_by_name = admin.name
            existing.changed_at = datetime.now().isoformat()
            session.commit()
        else:
            # Buat override baru
            new_ov = ScheduleOverride(
                class_name=body.class_name.strip().upper(),
                schedule_id=body.schedule_id,
                day=body.day,
                start_time=body.start_time,
                end_time=body.end_time,
                room=body.room,
                lecturer=body.lecturer,
                link=body.link,
                note=body.note,
                changed_by_nim=admin.nim,
                changed_by_name=admin.name,
            )
            session.add(new_ov)
            session.commit()

    return {"message": "Jadwal berhasil diperbarui.", "edited_by": admin.name}


@router.delete("/schedule")
def delete_schedule(body: ScheduleDeleteRequest, admin: User = Depends(require_admin)):
    """Admin: soft-delete jadwal dari tampilan kelas"""
    with Session(engine) as session:
        existing = session.exec(
            select(ScheduleOverride).where(
                ScheduleOverride.schedule_id == body.schedule_id,
                ScheduleOverride.class_name == body.class_name.strip().upper(),
            )
        ).first()

        if existing:
            existing.is_deleted = True
            existing.changed_by_nim = admin.nim
            existing.changed_by_name = admin.name
            existing.changed_at = datetime.now().isoformat()
        else:
            # Buat entry deleted baru
            del_ov = ScheduleOverride(
                class_name=body.class_name.strip().upper(),
                schedule_id=body.schedule_id,
                changed_by_nim=admin.nim,
                changed_by_name=admin.name,
                is_deleted=True
            )
            session.add(del_ov)
        session.commit()

    return {"message": "Jadwal berhasil dihapus dari tampilan kelas."}


@router.post("/schedule/restore")
def restore_schedule(body: ScheduleDeleteRequest, admin: User = Depends(require_admin)):
    """Admin: pulihkan jadwal yang sudah dihapus"""
    with Session(engine) as session:
        existing = session.exec(
            select(ScheduleOverride).where(
                ScheduleOverride.schedule_id == body.schedule_id,
                ScheduleOverride.class_name == body.class_name.strip().upper(),
                ScheduleOverride.is_deleted == True
            )
        ).first()
        if existing:
            existing.is_deleted = False
            session.commit()
    return {"message": "Jadwal dipulihkan ke tampilan kelas."}


@router.get("/schedule/{class_name}/log")
def get_edit_log(class_name: str, admin: User = Depends(require_admin)):
    """Admin: lihat riwayat edit jadwal"""
    with Session(engine) as session:
        logs = session.exec(
            select(ScheduleOverride).where(
                ScheduleOverride.class_name == class_name.strip().upper()
            ).order_by(ScheduleOverride.changed_at.desc())
        ).all()
    return {"logs": [l.model_dump() for l in logs]}


# ─────────────────────────────────────────────
# ADMIN TASKS
# ─────────────────────────────────────────────

@router.post("/task")
def create_task(body: TaskRequest, admin: User = Depends(require_admin)):
    """Admin: buat tugas baru untuk kelas"""
    task = AdminTask(
        class_name=body.class_name.strip().upper(),
        title=body.title,
        course_name=body.course_name,
        deadline=body.deadline,
        notes=body.notes,
        created_by_nim=admin.nim,
        created_by_name=admin.name,
    )
    with Session(engine) as session:
        session.add(task)
        session.commit()
        session.refresh(task)
    return {"message": "Tugas berhasil ditambahkan.", "task_id": task.id}


@router.delete("/task/{task_id}")
def delete_task(task_id: int, admin: User = Depends(require_admin)):
    """Admin: hapus tugas"""
    with Session(engine) as session:
        task = session.get(AdminTask, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Tugas tidak ditemukan.")
        task.is_active = False
        session.commit()
    return {"message": "Tugas berhasil dihapus."}


# ─────────────────────────────────────────────
# ANNOUNCEMENTS
# ─────────────────────────────────────────────

@router.post("/announcement")
def create_announcement(body: AnnouncementRequest, admin: User = Depends(require_admin)):
    """Admin: buat pengumuman kelas"""
    ann = Announcement(
        class_name=body.class_name.strip().upper(),
        title=body.title,
        content=body.content,
        is_pinned=body.is_pinned,
        created_by_nim=admin.nim,
        created_by_name=admin.name,
    )
    with Session(engine) as session:
        session.add(ann)
        session.commit()
        session.refresh(ann)
    return {"message": "Pengumuman berhasil dikirim.", "id": ann.id}


@router.delete("/announcement/{ann_id}")
def delete_announcement(ann_id: int, admin: User = Depends(require_admin)):
    """Admin: hapus pengumuman"""
    with Session(engine) as session:
        ann = session.get(Announcement, ann_id)
        if not ann:
            raise HTTPException(status_code=404, detail="Pengumuman tidak ditemukan.")
        ann.is_active = False
        session.commit()
    return {"message": "Pengumuman dihapus."}


# ─────────────────────────────────────────────
# USER MANAGEMENT (Super Admin Only)
# ─────────────────────────────────────────────

@router.get("/users")
def list_users(super_admin: User = Depends(require_super_admin)):
    """Super admin: lihat semua user terdaftar"""
    with Session(engine) as session:
        users = session.exec(select(User).order_by(User.role, User.class_name)).all()
    return {"users": [user_to_dict(u) for u in users]}


@router.put("/users/{nim}/role")
def update_user_role(nim: str, body: RoleUpdateRequest, super_admin: User = Depends(require_super_admin)):
    """Super admin: ubah role user"""
    if body.role not in ("member", "admin", "super_admin"):
        raise HTTPException(status_code=400, detail="Role tidak valid. Pilih: member, admin, super_admin")

    with Session(engine) as session:
        user = session.exec(select(User).where(User.nim == nim.strip())).first()
        if not user:
            raise HTTPException(status_code=404, detail="User tidak ditemukan.")
        old_role = user.role
        user.role = body.role
        session.commit()

    return {"message": f"Role {nim} diubah dari {old_role} → {body.role}."}


@router.post("/users/{nim}/reset-password")
def reset_user_password(nim: str, super_admin: User = Depends(require_super_admin)):
    """Super admin: reset password user ke default (NIM)"""
    with Session(engine) as session:
        user = session.exec(select(User).where(User.nim == nim.strip())).first()
        if not user:
            raise HTTPException(status_code=404, detail="User tidak ditemukan.")
        user.password_hash = hash_password(nim.strip())
        session.commit()

    return {"message": f"Password {nim} direset ke default (NIM)."}


@router.get("/stats")
def get_stats(admin: User = Depends(require_admin)):
    """Admin: statistik sederhana"""
    with Session(engine) as session:
        total_users = len(session.exec(select(User)).all())
        total_admins = len(session.exec(select(User).where(User.role.in_(["admin", "super_admin"]))).all())
        total_overrides = len(session.exec(select(ScheduleOverride).where(ScheduleOverride.is_deleted == False)).all())
        total_tasks = len(session.exec(select(AdminTask).where(AdminTask.is_active == True)).all())
        total_ann = len(session.exec(select(Announcement).where(Announcement.is_active == True)).all())

    return {
        "total_users": total_users,
        "total_admins": total_admins,
        "total_schedule_overrides": total_overrides,
        "total_tasks": total_tasks,
        "total_announcements": total_ann,
    }
