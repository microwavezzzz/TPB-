"""
auth.py — Sistem autentikasi berbasis NIM + JWT untuk TPB Portal
Endpoints: /auth/login, /auth/me, /auth/change-password, /auth/logout
"""
import os
import json
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from jose import JWTError, jwt
from sqlmodel import Session, select

from backend.database import (
    User, engine, create_db_and_tables, get_user_by_nim
)

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
SECRET_KEY = os.environ.get("TPB_SECRET_KEY", "tpb-itera-2026-supersecret-changethis")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 48

bearer_scheme = HTTPBearer(auto_error=False)

router = APIRouter(prefix="/auth", tags=["auth"])


# ─────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────
class LoginRequest(BaseModel):
    nim: str
    password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


# ─────────────────────────────────────────────
# HELPERS (Direct bcrypt, zero deprecation issues)
# ─────────────────────────────────────────────
def hash_password(plain: str) -> str:
    pwd_bytes = plain.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    try:
        pwd_bytes = plain.encode('utf-8')[:72]
        hashed_bytes = hashed.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None

def _load_master_students() -> list:
    """Load daftar mahasiswa dari schedule_data.json master"""
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "schedule_data.json")
    if not os.path.exists(data_path):
        return []
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("students", [])

def _find_student_in_master(nim: str) -> Optional[dict]:
    """Cari mahasiswa di data master Excel berdasarkan NIM"""
    nim_clean = nim.strip()
    for s in _load_master_students():
        if s.get("nim", "").strip() == nim_clean:
            return s
    return None

def _ensure_user_exists(nim: str) -> Optional[User]:
    """
    Jika NIM ada di master Excel tapi belum pernah login,
    buat akun user otomatis dengan password default = NIM.
    """
    existing = get_user_by_nim(nim)
    if existing:
        return existing

    master = _find_student_in_master(nim)
    if not master:
        return None  # NIM tidak terdaftar di data mahasiswa

    new_user = User(
        nim=master["nim"],
        name=master.get("name", "Mahasiswa"),
        password_hash=hash_password(master["nim"]),  # password default = NIM
        role="member",
        class_name=master.get("tpb_class", ""),
        prodi=master.get("prodi", ""),
    )
    with Session(engine) as session:
        session.add(new_user)
        session.commit()
        session.refresh(new_user)
    return new_user


# ─────────────────────────────────────────────
# DEPENDENCY: get current user from token
# ─────────────────────────────────────────────
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak ditemukan. Silakan login terlebih dahulu.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau sudah kadaluarsa.",
        )
    nim = payload.get("sub")
    user = get_user_by_nim(nim)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User tidak ditemukan.")
    return user

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Hanya admin/ketua kelas yang diizinkan."
        )
    return current_user

async def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Hanya super admin yang diizinkan."
        )
    return current_user

def user_to_dict(user: User) -> dict:
    return {
        "nim": user.nim,
        "name": user.name,
        "role": user.role,
        "class_name": user.class_name,
        "prodi": user.prodi,
        "created_at": user.created_at,
        "last_login": user.last_login,
    }


# ─────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest):
    """
    Login dengan NIM + password.
    Jika NIM terdaftar di master Excel tapi belum pernah login,
    akun dibuat otomatis dengan password default = NIM.
    """
    nim = body.nim.strip()
    user = _ensure_user_exists(nim)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="NIM tidak terdaftar dalam data mahasiswa TPB ITERA."
        )

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Password salah."
        )

    # Update last_login
    with Session(engine) as session:
        db_user = session.get(User, user.id)
        if db_user:
            db_user.last_login = datetime.now().isoformat()
            session.commit()

    token = create_access_token({"sub": user.nim, "role": user.role})
    return TokenResponse(access_token=token, user=user_to_dict(user))


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """Ambil info user yang sedang login"""
    return {"user": user_to_dict(current_user)}


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, current_user: User = Depends(get_current_user)):
    """Ganti password — wajib verifikasi password lama dulu"""
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Password lama salah.")
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password baru minimal 6 karakter.")

    with Session(engine) as session:
        user = session.get(User, current_user.id)
        user.password_hash = hash_password(body.new_password)
        session.commit()

    return {"message": "Password berhasil diubah."}


@router.post("/logout")
def logout():
    """Logout — client cukup hapus token dari localStorage"""
    return {"message": "Logout berhasil."}
