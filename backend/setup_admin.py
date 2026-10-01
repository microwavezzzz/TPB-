"""
setup_admin.py — Script untuk menetapkan Super Admin / Admin kelas TPB 44
Penggunaan:
1. Interaktif: python backend/setup_admin.py
2. Langsung:   python backend/setup_admin.py --nim 126450004 --role super_admin --password rahasia
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlmodel import Session, select
from backend.database import engine, User, create_db_and_tables
from backend.auth import hash_password, _find_student_in_master

def setup_admin():
    create_db_and_tables()

    parser = argparse.ArgumentParser(description="Setup Admin TPB Portal")
    parser.add_argument("--nim", type=str, help="NIM Mahasiswa")
    parser.add_argument("--role", type=str, default="super_admin", choices=["super_admin", "admin", "member"])
    parser.add_argument("--password", type=str, help="Password (opsional, default: NIM)")
    args = parser.parse_args()

    nim = args.nim
    role = args.role
    custom_pw = args.password

    if not nim:
        print("========================================")
        print(" 🛠️  SETUP ADMIN TPB 44 / SUPER ADMIN")
        print("========================================")
        nim = input("Masukkan NIM Admin/Super Admin: ").strip()
        if not nim:
            print("NIM tidak boleh kosong.")
            return

        role_choice = input("Pilih Role: 1. super_admin | 2. admin (default 1): ").strip()
        role = "admin" if role_choice == "2" else "super_admin"
        custom_pw = input("Password baru (kosongkan jika default = NIM): ").strip()

    student = _find_student_in_master(nim)
    name = student.get("name", "Admin TPB") if student else "Admin TPB"
    class_name = student.get("tpb_class", "TPB 44") if student else "TPB 44"
    prodi = student.get("prodi", "") if student else ""

    password_to_hash = custom_pw if custom_pw else nim

    with Session(engine) as session:
        user = session.exec(select(User).where(User.nim == nim)).first()
        if user:
            user.role = role
            user.name = name
            user.class_name = class_name
            user.prodi = prodi
            user.password_hash = hash_password(password_to_hash)
            session.commit()
            print(f"[OK] User {nim} ({name}) berhasil diperbarui menjadi {role.upper()}!")
        else:
            new_user = User(
                nim=nim,
                name=name,
                password_hash=hash_password(password_to_hash),
                role=role,
                class_name=class_name,
                prodi=prodi
            )
            session.add(new_user)
            session.commit()
            print(f"[OK] User {nim} ({name}) berhasil didaftarkan sebagai {role.upper()}!")

    print(f"\nInfo Login:")
    print(f"NIM      : {nim}")
    print(f"Password : {'[NIM Kamu]' if not custom_pw else '[Password Kustom]'}")
    print(f"Role     : {role}\n")

if __name__ == "__main__":
    setup_admin()
