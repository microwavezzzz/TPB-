# 🎓 Portal Jadwal TPB 44 ITERA Gasal TA 2026/2027

Aplikasi web portal jadwal terpusat khusus mahasiswa **TPB 44 Institut Teknologi Sumatera (ITERA)** dengan tema **Warm Minimalist (Cream & Cocoa)**, sistem autentikasi **NIM + Password**, peran **Admin (Ketua Kelas & PJ Matkul)**, dan sinkronisasi jadwal real-time.

---

## ✨ Fitur & Arsitektur Sistem

### 👥 Sistem Role & Hak Akses
| Role | Siapa | Hak Akses |
|---|---|---|
| **Super Admin** | Pengembang / Dosen Wali | Full akses sistem, kelola role user lain, reset password, edit jadwal & tugas |
| **Admin** | Ketua Kelas TPB 44 & Penanggung Jawab (PJ) Matkul | **Edit jadwal kelas** (pindah jam/ruangan), hapus/tambah matkul, siarkan **pengumuman kelas**, buat **tugas resmi kelas** |
| **Member** | Seluruh Mahasiswa TPB 44 | **Read-only**: Melihat jadwal resmi yang sudah disetujui admin, membaca pengumuman kelas, melihat tugas kelas, mencatat tugas pribadi |

### 🔐 Alur Login Mahasiswa
1. Setiap mahasiswa TPB 44 dapat langsung login menggunakan **NIM**.
2. **Password Default Pertama Kali = NIM masing-masing**.
3. Setelah login, mahasiswa dapat mengganti password kapan saja di menu profil (kanan atas).
4. Sesi login tersimpan dengan aman menggunakan token **JWT (JSON Web Token)**.

### 📅 Jadwal Terpusat & Sinkronisasi Real-Time
- Ketika Ketua Kelas atau PJ Matkul mengubah jam/ruangan kuliah yang diundur, perubahan **langsung tersimpan di database server**.
- Seluruh anggota TPB 44 yang membuka portal langsung melihat jadwal terbaru yang telah diperbarui tanpa perlu mengedit secara manual.
- Riwayat catatan admin (alasan diundur / ruang baru) tertampil jelas pada kartu jadwal.

---

## 🛠️ Menetapkan Admin / Ketua Kelas

Jalankan perintah ini di terminal:
```bash
python backend/setup_admin.py --nim <NIM_KETUA_KELAS> --role admin
```
Atau untuk Super Admin:
```bash
python backend/setup_admin.py --nim <NIM_KAMU> --role super_admin
```
*(Bisa juga dijalankan tanpa argumen `python backend/setup_admin.py` untuk mode tanya-jawab interaktif).*

---

## 🚀 Cara Menjalankan Lokal

### Cara 1: Menggunakan File Batch (1-Klik)
Double-click file **`run_app.bat`** di folder `d:\TPB`. Browser akan otomatis membuka alamat `http://localhost:8000`.

### Cara 2: Menjalankan via Terminal
```bash
python -m uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
```
Buka browser: **`http://localhost:8000`**

---

## ☁️ Panduan Deploy Online (100% Gratis)

Agar mahasiswa TPB 44 bisa mengakses portal lewat HP atau laptop masing-masing dari mana saja, kamu bisa mendeploy secara gratis:

### Opsi 1: Railway.app (Sangat Direkomendasikan)
1. Buat akun di [railway.app](https://railway.app) (login via GitHub).
2. Buat repository baru di GitHub dan push project `d:\TPB` ke repository tersebut:
   ```bash
   git init
   git add .
   git commit -m "Deploy TPB 44 Portal"
   git branch -M main
   git remote add origin <URL_REPO_GITHUB_KAMU>
   git push -u origin main
   ```
3. Di dashboard Railway: klik **"New Project"** → **"Deploy from GitHub repo"** → pilih repo kamu.
4. Railway akan otomatis mendeteksi `requirements.txt` dan `Procfile`.
5. Buka tab **Settings** → **Generate Domain** (contoh: `tpb44.up.railway.app`).
6. Selesai! Web sudah aktif online dan bisa dibagikan ke grup kelas WhatsApp.

### Opsi 2: Render.com
1. Buat akun di [render.com](https://render.com).
2. Pilih **"New +"** → **"Web Service"** → sambungkan ke repo GitHub kamu.
3. Masukkan konfigurasi:
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`
4. Pilih paket **Free Tier**.
5. Klik **Create Web Service**. Link publik gratis langsung aktif.
