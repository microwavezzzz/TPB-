/**
 * Exam Schedule Module (UTS TPB Gasal TA 2026/2027)
 * Menampilkan jadwal ujian personal mahasiswa & jadwal master
 */
window.ExamManager = {
  data: {
    overview: null,
    selectedStudent: null,
    searchQuery: '',
    searchResults: [],
    classRoster: [],
    activeSubTab: 'personal', // 'personal' | 'master' | 'class'
    isLoading: false,
    filterMode: 'ALL', // 'ALL' | 'CBT' | 'PBT'
  },

  async init() {
    this.bindEvents();
    await this.loadOverview();

    // Cek apakah user sedang login dan punya NIM mahasiswa
    const user = (window.Auth && window.Auth.isLoggedIn()) ? window.Auth.getUser() : null;
    if (user && user.nim) {
      // Auto-load data jadwal ujian mahasiswa yang login jika belum ada pilihan
      this.loadStudentSchedule(user.nim, false);
    }
  },

  loadMyExamSchedule() {
    const user = (window.Auth && window.Auth.isLoggedIn()) ? window.Auth.getUser() : null;
    if (user && user.nim) {
      this.loadStudentSchedule(user.nim, true);
    } else {
      alert('Silakan masukkan nama atau NIM Anda pada kolom pencarian.');
    }
  },

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('examSearchInput');
    if (searchInput) {
      let debounceTimer = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const val = e.target.value.trim();
        if (val.length >= 1) {
          debounceTimer = setTimeout(() => this.searchStudents(val), 200);
        } else {
          this.hideSearchResults();
        }
      });

      searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 1 && this.data.searchResults.length > 0) {
          this.showSearchResults();
        }
      });

      // Keyboard navigation
      searchInput.addEventListener('keydown', (e) => {
        const resultsEl = document.getElementById('examSearchResults');
        if (!resultsEl || resultsEl.classList.contains('hidden')) return;
        const items = resultsEl.querySelectorAll('.exam-search-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          items[0].focus();
        } else if (e.key === 'Escape') {
          this.hideSearchResults();
        }
      });
    }

    // Close search dropdown when clicking or tapping outside
    const handleOutsideClick = (e) => {
      const searchBox = document.getElementById('examSearchWrapper');
      if (searchBox && !searchBox.contains(e.target)) {
        this.hideSearchResults();
      }
    };
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('touchend', handleOutsideClick);

    // Sub-tabs (Personal / Master / Kelas TPB 44)
    document.querySelectorAll('.exam-subtab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-exam-subtab');
        this.switchSubTab(tab);
      });
    });
  },

  switchSubTab(tab) {
    this.data.activeSubTab = tab;
    document.querySelectorAll('.exam-subtab-btn').forEach(btn => {
      if (btn.getAttribute('data-exam-subtab') === tab) {
        btn.style.background = '#7C5C40';
        btn.style.color = '#FFFBF7';
        btn.classList.add('shadow-sm');
      } else {
        btn.style.background = '#F2E8DA';
        btn.style.color = '#5E4230';
        btn.classList.remove('shadow-sm');
      }
    });

    const personalSection = document.getElementById('examPersonalSection');
    const masterSection = document.getElementById('examMasterSection');
    const classSection = document.getElementById('examClassSection');

    if (personalSection) personalSection.classList.toggle('hidden', tab !== 'personal');
    if (masterSection) masterSection.classList.toggle('hidden', tab !== 'master');
    if (classSection) classSection.classList.toggle('hidden', tab !== 'class');

    if (tab === 'master') {
      this.renderMasterTable();
    } else if (tab === 'class') {
      this.loadClassRoster('TPB 44');
    }
  },

  async loadOverview() {
    try {
      const res = await fetch('/api/exam/overview');
      if (res.ok) {
        this.data.overview = await res.json();
        this.renderMasterStats();
      }
    } catch (e) {
      console.warn('Gagal memuat overview ujian:', e);
    }
  },

  renderMasterStats() {
    const bannerTotalEl = document.getElementById('examBannerTotalCount');
    if (bannerTotalEl && this.data.overview) {
      bannerTotalEl.textContent = `${this.data.overview.master_exams_count || 14} Mata Kuliah UTS`;
    }
  },

  async searchStudents(query) {
    const resultsContainer = document.getElementById('examSearchResults');
    if (!resultsContainer) return;

    try {
      const res = await fetch(`/api/exam/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return;
      const json = await res.json();
      this.data.searchResults = json.results || [];

      if (this.data.searchResults.length === 0) {
        resultsContainer.innerHTML = `
          <div class="p-4 text-center text-xs" style="color:#8C7B6E">
            <i class="fas fa-search mb-1 text-base opacity-40"></i>
            <p class="font-bold">Mahasiswa tidak ditemukan</p>
            <p class="text-[11px] mt-0.5">Coba cari dengan nama depan, nama lengkap, atau 9 digit NIM.</p>
          </div>
        `;
      } else {
        let html = '';
        this.data.searchResults.forEach((s, idx) => {
          const nextExam = s.next_exam;
          let nextExamPreview = '';
          if (nextExam) {
            nextExamPreview = `
              <div class="mt-1 text-[11px] flex items-center gap-1.5 font-medium" style="color:#7C5C40">
                <i class="fas fa-calendar-check text-[10px]"></i>
                <span class="truncate max-w-[280px]">${nextExam.course} • ${nextExam.date} (${nextExam.time})</span>
              </div>
            `;
          }

          html += `
            <div tabindex="0" onclick="ExamManager.loadStudentSchedule('${s.nim}')"
              class="exam-search-item p-3 hover:bg-[#F2E8DA] cursor-pointer border-b border-[#E8D5C0] flex items-start justify-between gap-3 text-xs transition-colors outline-none focus:bg-[#EDE0D0]"
              data-nim="${s.nim}">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <p class="font-bold truncate text-sm" style="color:#2C1A0E">${s.name}</p>
                  <span class="text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap" style="background:#EDE0D0; color:#5E4230">
                    ${s.tpb_class || 'TPB'}
                  </span>
                </div>
                <p class="text-[11px]" style="color:#8C7B6E">NIM: <span class="font-mono font-bold">${s.nim}</span> • ${s.prodi}</p>
                ${nextExamPreview}
              </div>
              <div class="text-right flex flex-col items-end justify-center">
                <span class="text-[10px] font-bold px-2 py-1 rounded-lg" style="background:#7C5C40; color:#FFFBF7">
                  ${s.exams_count} Ujian
                </span>
                <span class="text-[10px] text-amber-700 mt-1 font-semibold flex items-center gap-0.5">
                  Buka <i class="fas fa-arrow-right text-[9px]"></i>
                </span>
              </div>
            </div>
          `;
        });
        resultsContainer.innerHTML = html;
      }
      this.showSearchResults();
    } catch (e) {
      console.error('Search error:', e);
    }
  },

  showSearchResults() {
    const el = document.getElementById('examSearchResults');
    if (el) el.classList.remove('hidden');
  },

  hideSearchResults() {
    const el = document.getElementById('examSearchResults');
    if (el) el.classList.add('hidden');
  },

  async loadStudentSchedule(nim, switchToTab = true) {
    this.hideSearchResults();
    const container = document.getElementById('examStudentCardContainer');
    if (container) {
      container.innerHTML = `
        <div class="p-8 text-center" style="color:#8C7B6E">
          <i class="fas fa-spinner fa-spin text-2xl mb-2" style="color:#7C5C40"></i>
          <p class="text-xs font-bold">Memuat jadwal ujian lengkap mahasiswa...</p>
        </div>
      `;
    }

    try {
      const res = await fetch(`/api/exam/student/${encodeURIComponent(nim)}`);
      if (!res.ok) {
        if (container) {
          container.innerHTML = `
            <div class="p-6 text-center text-xs text-rose-700 bg-rose-50 rounded-2xl border border-rose-200">
              <i class="fas fa-exclamation-triangle text-xl mb-1"></i>
              <p class="font-bold">Jadwal ujian untuk NIM ${nim} tidak ditemukan.</p>
            </div>
          `;
        }
        return;
      }

      const student = await res.json();
      this.data.selectedStudent = student;
      this.renderStudentSchedule(student);

      // Pastikan subtab aktif ke 'personal'
      this.switchSubTab('personal');

      // Jika dipanggil dari luar (misal navbar), pindahkan tab utama juga
      if (switchToTab && window.TPBApp) {
        window.TPBApp.setActiveTab('exam');
      }

      // Update input search teks ke nama mahasiswa terpilih
      const searchInput = document.getElementById('examSearchInput');
      if (searchInput) {
        searchInput.value = `${student.name} (${student.nim})`;
      }
    } catch (e) {
      console.error('Error loadStudentSchedule:', e);
    }
  },

  renderStudentSchedule(student) {
    const container = document.getElementById('examStudentCardContainer');
    if (!container) return;

    if (!student || !student.exams || student.exams.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-xs" style="color:#8C7B6E">
          <p class="font-bold">Tidak ada jadwal ujian terdata untuk mahasiswa ini.</p>
        </div>
      `;
      return;
    }

    const cbtCount = student.exams.filter(e => e.mode === 'CBT').length;
    const pbtCount = student.exams.filter(e => e.mode === 'PBT').length;
    const firstExam = student.exams[0];

    // Build Student Header Card
    let html = `
      <div class="glass-card p-5 sm:p-6 rounded-3xl border border-[#E8D5C0] shadow-sm space-y-5" style="background:#FFFBF7">
        
        <!-- Header Info Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8D5C0]">
          <div class="flex items-center gap-3.5">
            <div class="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-sm shrink-0"
              style="background: linear-gradient(135deg, #7C5C40 0%, #C8956A 100%)">
              ${(student.name || 'M').charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-black text-base sm:text-lg leading-tight" style="color:#2C1A0E">
                  ${student.name}
                </h3>
                <span class="text-xs font-black px-2.5 py-0.5 rounded-full" style="background:#7C5C40; color:#FFFBF7">
                  ${student.tpb_class || 'TPB'}
                </span>
                ${student.fakultas ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#EDE0D0; color:#5E4230">${student.fakultas}</span>` : ''}
              </div>
              <p class="text-xs mt-0.5" style="color:#8C7B6E">
                NIM: <span class="font-mono font-bold text-amber-900">${student.nim}</span> • Program Studi: <span class="font-semibold text-stone-800">${student.prodi || '-'}</span>
              </p>
            </div>
          </div>

          <!-- Actions: Print & ICS -->
          <div class="flex items-center gap-2 no-print shrink-0">
            <button onclick="ExamManager.downloadStudentICS()"
              class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all"
              style="background:#F2E8DA; border-color:#E8D5C0; color:#5E4230"
              title="Tambahkan seluruh sesi ujian ke Google Calendar / Apple Calendar">
              <i class="fas fa-calendar-plus text-amber-700"></i>
              <span>Simpan ke Kalender (.ICS)</span>
            </button>
            <button onclick="ExamManager.printStudentExamCard()"
              class="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 text-white shadow-sm transition-all"
              style="background:#7C5C40"
              title="Cetak Kartu Ujian Resmi">
              <i class="fas fa-print"></i>
              <span>Cetak Kartu</span>
            </button>
          </div>
        </div>

        <!-- Metric Badges -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div class="p-3 rounded-2xl border" style="background:#F9F5F0; border-color:#E8D5C0">
            <p class="text-[11px] font-bold uppercase" style="color:#8C7B6E">Total Ujian</p>
            <p class="text-lg font-black mt-0.5" style="color:#2C1A0E">${student.exams.length} <span class="text-xs font-semibold">Mata Kuliah</span></p>
          </div>
          <div class="p-3 rounded-2xl border" style="background:#F5F3FF; border-color:#DDD6FE">
            <p class="text-[11px] font-bold uppercase text-purple-700">Ujian CBT Labkom</p>
            <p class="text-lg font-black text-purple-900 mt-0.5">${cbtCount} <span class="text-xs font-semibold">Sesi</span></p>
          </div>
          <div class="p-3 rounded-2xl border" style="background:#FEF3C7; border-color:#FDE68A">
            <p class="text-[11px] font-bold uppercase text-amber-800">Ujian PBT Kelas</p>
            <p class="text-lg font-black text-amber-950 mt-0.5">${pbtCount} <span class="text-xs font-semibold">Matkul</span></p>
          </div>
          <div class="p-3 rounded-2xl border" style="background:#ECFDF5; border-color:#A7F3D0">
            <p class="text-[11px] font-bold uppercase text-emerald-700">Mulai Ujian Pertama</p>
            <p class="text-xs font-black text-emerald-900 mt-1 truncate">${firstExam ? firstExam.date : '-'}</p>
          </div>
        </div>

        <!-- Filter Mode Chips -->
        <div class="flex items-center justify-between gap-2 flex-wrap pt-2 no-print">
          <div class="flex items-center gap-1.5 text-xs">
            <span class="font-bold text-[11px] uppercase mr-1" style="color:#8C7B6E">Filter Mode:</span>
            <button onclick="ExamManager.setFilterMode('ALL')" id="examFilter_ALL"
              class="px-3 py-1 rounded-lg text-xs font-bold transition-all ${this.data.filterMode === 'ALL' ? 'text-white shadow-sm' : ''}"
              style="background:${this.data.filterMode === 'ALL' ? '#7C5C40' : '#F2E8DA'}; color:${this.data.filterMode === 'ALL' ? '#FFFBF7' : '#5E4230'}">
              Semua (${student.exams.length})
            </button>
            <button onclick="ExamManager.setFilterMode('CBT')" id="examFilter_CBT"
              class="px-3 py-1 rounded-lg text-xs font-bold transition-all ${this.data.filterMode === 'CBT' ? 'text-white shadow-sm' : ''}"
              style="background:${this.data.filterMode === 'CBT' ? '#7C5C40' : '#F2E8DA'}; color:${this.data.filterMode === 'CBT' ? '#FFFBF7' : '#5E4230'}">
              CBT Labkom (${cbtCount})
            </button>
            <button onclick="ExamManager.setFilterMode('PBT')" id="examFilter_PBT"
              class="px-3 py-1 rounded-lg text-xs font-bold transition-all ${this.data.filterMode === 'PBT' ? 'text-white shadow-sm' : ''}"
              style="background:${this.data.filterMode === 'PBT' ? '#7C5C40' : '#F2E8DA'}; color:${this.data.filterMode === 'PBT' ? '#FFFBF7' : '#5E4230'}">
              PBT Ruang Kelas (${pbtCount})
            </button>
          </div>

          <p class="text-[11px] text-stone-500 italic">
            *Pastikan hadir 15 menit sebelum waktu ujian & membawa kartu identitas.
          </p>
        </div>

        <!-- Exam Cards List -->
        <div class="space-y-3 pt-1">
    `;

    const filteredExams = student.exams.filter(ex => {
      if (this.data.filterMode === 'ALL') return true;
      return ex.mode === this.data.filterMode;
    });

    filteredExams.forEach((ex, idx) => {
      const isCBT = ex.mode === 'CBT';
      const statusBadge = this.computeExamStatusBadge(ex.date, ex.time);
      const isSeatSpecified = ex.seat && ex.seat !== '-';

      html += `
        <div class="exam-card p-4 sm:p-5 rounded-2xl border transition-all hover:shadow-md ${isCBT ? 'border-purple-200' : 'border-amber-200'}"
          style="background:${isCBT ? '#FAF8FF' : '#FFFDF5'}">
          
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            <!-- Left: Course title & Mode -->
            <div class="space-y-1.5 flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${isCBT ? 'bg-purple-600 text-white' : 'bg-amber-600 text-white'}">
                  ${ex.mode}
                </span>
                ${statusBadge}
                <span class="text-[11px] font-bold px-2 py-0.5 rounded" style="background:#F2E8DA; color:#5E4230">
                  ${ex.sesi || 'Sesi Ujian'}
                </span>
              </div>
              <h4 class="font-black text-base sm:text-lg text-stone-900 leading-snug">
                ${ex.course}
              </h4>
              <p class="text-xs text-stone-600 flex items-center gap-2 flex-wrap">
                <span class="font-bold flex items-center gap-1 text-stone-800">
                  <i class="far fa-calendar-alt text-amber-700"></i> ${ex.date}
                </span>
                <span>•</span>
                <span class="font-bold font-mono flex items-center gap-1 text-stone-800">
                  <i class="far fa-clock text-amber-700"></i> ${ex.time} WIB
                </span>
              </p>
            </div>

            <!-- Right: Room & Seat Box -->
            <div class="flex items-center gap-2 sm:gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-200 w-full md:w-auto">
              
              <!-- Seat Badge (Only for CBT or when specified) -->
              ${isSeatSpecified ? `
                <div class="px-3 py-2 rounded-xl border text-center shadow-xs flex flex-col items-center justify-center shrink-0 min-w-[65px] sm:min-w-[75px]"
                  style="background:#FFFBF7; border-color:#E8D5C0">
                  <span class="text-[9px] font-bold uppercase tracking-wider" style="color:#8C7B6E">No. Kursi</span>
                  <span class="text-lg sm:text-xl font-black font-mono leading-none mt-1" style="color:#7C5C40">${ex.seat}</span>
                </div>
              ` : `
                <div class="px-3 py-2 rounded-xl border text-center hidden sm:flex flex-col items-center justify-center shrink-0"
                  style="background:#F9F5F0; border-color:#E8D5C0">
                  <span class="text-[9px] font-bold uppercase text-stone-500">Kursi</span>
                  <span class="text-xs font-bold text-stone-600 mt-0.5">Bebas/Absen</span>
                </div>
              `}

              <!-- Room Box -->
              <div class="p-2.5 sm:p-3 rounded-xl border flex-1 md:flex-initial text-left md:text-right min-w-0 md:min-w-[200px]"
                style="background:#FFFBF7; border-color:#E8D5C0">
                <span class="text-[10px] font-bold uppercase block tracking-wider truncate" style="color:#8C7B6E">
                  <i class="fas fa-map-marker-alt text-rose-600 mr-1"></i> Ruang Ujian
                </span>
                <p class="font-bold text-xs sm:text-sm text-stone-900 mt-0.5 leading-snug break-words">
                  ${ex.room}
                </p>
                <p class="text-[10px] text-stone-500 mt-0.5 truncate">
                  ${ex.note || (isCBT ? 'CBT di Labkom' : 'PBT di Ruang Kelas')}
                </p>
              </div>

            </div>

          </div>

        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  setFilterMode(mode) {
    this.data.filterMode = mode;
    if (this.data.selectedStudent) {
      this.renderStudentSchedule(this.data.selectedStudent);
    }
  },

  computeExamStatusBadge(dateStr, timeStr) {
    // Current date check (Indonesian parser)
    const today = new Date();
    // Default exam year 2026
    const months = {
      'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
      'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
    };

    let examDay = null;
    let examMonth = null;
    const lowerDate = (dateStr || '').toLowerCase();
    for (const [mName, mIdx] of Object.entries(months)) {
      if (lowerDate.includes(mName)) {
        examMonth = mIdx;
        break;
      }
    }

    const dayMatch = lowerDate.match(/\b(\d{1,2})\b/);
    if (dayMatch) {
      examDay = parseInt(dayMatch[1], 10);
    }

    if (examDay !== null && examMonth !== null) {
      const examDate = new Date(2026, examMonth, examDay);
      const isToday = (today.getFullYear() === 2026 && today.getMonth() === examMonth && today.getDate() === examDay);

      if (isToday) {
        return `<span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">🔥 HARI INI</span>`;
      } else if (today < examDate) {
        const diffDays = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) {
          return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">H-${diffDays}</span>`;
        }
        return `<span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">Mendatang</span>`;
      } else {
        return `<span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-200 text-stone-500">Selesai</span>`;
      }
    }

    return `<span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">Akan Berlangsung</span>`;
  },

  renderMasterTable() {
    const container = document.getElementById('examMasterTableBody');
    if (!container || !this.data.overview) return;

    const masterExams = this.data.overview.master_exams || [];
    let html = '';

    masterExams.forEach(item => {
      const isCBT = item.mode === 'CBT';
      html += `
        <tr class="border-b border-[#E8D5C0] hover:bg-[#F2E8DA] transition-colors text-xs">
          <td class="p-3 font-bold text-center font-mono" style="color:#7C5C40">${item.no}</td>
          <td class="p-3 font-bold" style="color:#2C1A0E">
            ${item.course}
          </td>
          <td class="p-3">
            <span class="text-[10px] font-black px-2 py-0.5 rounded-full ${isCBT ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-900'}">
              ${item.mode}
            </span>
          </td>
          <td class="p-3 font-medium text-stone-700">${item.schedule}</td>
          <td class="p-3 font-semibold text-stone-900">${item.room}</td>
          <td class="p-3">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#EDE0D0; color:#5E4230">
              ${item.status}
            </span>
          </td>
        </tr>
      `;
    });

    container.innerHTML = html;
  },

  async loadClassRoster(className = 'TPB 44') {
    const container = document.getElementById('examClassRosterContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="p-8 text-center text-xs" style="color:#8C7B6E">
        <i class="fas fa-spinner fa-spin text-xl mb-2" style="color:#7C5C40"></i>
        <p class="font-bold">Memuat daftar ujian mahasiswa kelas ${className}...</p>
      </div>
    `;

    try {
      const res = await fetch(`/api/exam/class/${encodeURIComponent(className)}`);
      if (!res.ok) return;
      const json = await res.json();
      this.data.classRoster = json.students || [];
      this.renderClassRoster(this.data.classRoster);
    } catch (e) {
      console.error('Error loadClassRoster:', e);
    }
  },

  renderClassRoster(students) {
    const container = document.getElementById('examClassRosterContainer');
    if (!container) return;

    if (students.length === 0) {
      container.innerHTML = `<div class="p-6 text-center text-xs text-stone-500">Tidak ada data mahasiswa untuk kelas ini.</div>`;
      return;
    }

    let html = `
      <div class="space-y-3">
        <div class="flex items-center justify-between gap-3 flex-wrap text-xs">
          <p class="font-bold" style="color:#5E4230">
            Daftar ${students.length} Mahasiswa TPB 44
          </p>
          <input type="text" oninput="ExamManager.filterClassRoster(this.value)" placeholder="Saring nama atau NIM di kelas ini..."
            class="px-3 py-1.5 text-xs rounded-xl outline-none border" style="background:#F2E8DA; border-color:#E8D5C0; color:#2C1A0E">
        </div>

        <div class="overflow-x-auto rounded-2xl border border-[#E8D5C0]">
          <table class="w-full text-left border-collapse text-xs">
            <thead style="background:#EDE0D0; color:#5E4230">
              <tr>
                <th class="p-3 text-center w-12 font-bold">No</th>
                <th class="p-3 font-bold">NIM</th>
                <th class="p-3 font-bold">Nama Lengkap</th>
                <th class="p-3 font-bold">Program Studi</th>
                <th class="p-3 text-center font-bold">Total Ujian</th>
                <th class="p-3 text-center font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody id="examClassRosterTbody" style="background:#FFFBF7">
    `;

    students.forEach((s, i) => {
      html += `
        <tr class="border-b border-[#E8D5C0] hover:bg-[#F2E8DA] transition-colors">
          <td class="p-2.5 text-center font-mono text-stone-500">${i + 1}</td>
          <td class="p-2.5 font-mono font-bold text-amber-950">${s.nim}</td>
          <td class="p-2.5 font-bold" style="color:#2C1A0E">${s.name}</td>
          <td class="p-2.5 text-stone-700">${s.prodi}</td>
          <td class="p-2.5 text-center">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#F2E8DA; color:#7C5C40">
              ${(s.exams || []).length} Ujian
            </span>
          </td>
          <td class="p-2.5 text-center">
            <button onclick="ExamManager.loadStudentSchedule('${s.nim}')"
              class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white transition-all shadow-xs"
              style="background:#7C5C40">
              Lihat Jadwal
            </button>
          </td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  filterClassRoster(q) {
    const tbody = document.getElementById('examClassRosterTbody');
    if (!tbody || !this.data.classRoster) return;
    const clean = q.trim().toLowerCase();

    const rows = tbody.querySelectorAll('tr');
    rows.forEach(tr => {
      const text = tr.textContent.toLowerCase();
      tr.style.display = text.includes(clean) ? '' : 'none';
    });
  },

  downloadStudentICS() {
    const student = this.data.selectedStudent;
    if (!student || !student.exams || student.exams.length === 0) {
      alert('Pilih data mahasiswa terlebih dahulu.');
      return;
    }

    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TPB ITERA Exam Schedule//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:Jadwal UTS TPB - ${student.name}`,
      'X-WR-TIMEZONE:Asia/Jakarta'
    ];

    student.exams.forEach((ex, idx) => {
      // Parse date and time
      const lowerDate = ex.date.toLowerCase();
      const months = {
        'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
        'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
      };
      let month = 9; // Oct default
      for (const [mName, mIdx] of Object.entries(months)) {
        if (lowerDate.includes(mName)) {
          month = mIdx;
          break;
        }
      }
      const dayMatch = lowerDate.match(/\b(\d{1,2})\b/);
      const day = dayMatch ? parseInt(dayMatch[1], 10) : 17;

      let startH = 8, startM = 0, endH = 9, endM = 30;
      const tMatch = ex.time.match(/(\d{2})[.:](\d{2})\s*-\s*(\d{2})[.:](\d{2})/);
      if (tMatch) {
        startH = parseInt(tMatch[1], 10);
        startM = parseInt(tMatch[2], 10);
        endH = parseInt(tMatch[3], 10);
        endM = parseInt(tMatch[4], 10);
      }

      const dtStart = new Date(Date.UTC(2026, month, day, startH - 7, startM, 0));
      const dtEnd = new Date(Date.UTC(2026, month, day, endH - 7, endM, 0));

      const formatICSDate = (d) => {
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      const uid = `uts-${student.nim}-${idx}-${Math.random().toString(36).substr(2, 6)}@tpb.itera.ac.id`;
      const summary = `${ex.course} [${ex.mode}] (${student.tpb_class || 'TPB'})`;
      const location = `${ex.room} ${ex.seat && ex.seat !== '-' ? '• Kursi No. ' + ex.seat : ''}`;
      const description = `Mata Kuliah: ${ex.course}\\nMode: ${ex.mode}\\nSesi: ${ex.sesi}\\nWaktu: ${ex.time} WIB\\nRuang: ${ex.room}\\nNo Kursi: ${ex.seat || '-'}\\nPeserta: ${student.name} (${student.nim} - ${student.prodi})`;

      ics.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${formatICSDate(dtStart)}`,
        `DTEND:${formatICSDate(dtEnd)}`,
        `SUMMARY:${summary}`,
        `LOCATION:${location}`,
        `DESCRIPTION:${description}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Pengingat Ujian (30 Menit Lagi): ${ex.course}`,
        'END:VALARM',
        'END:VEVENT'
      );
    });

    ics.push('END:VCALENDAR');

    const blob = new Blob([ics.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `Jadwal_UTS_${student.nim}_${student.name.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  printStudentExamCard() {
    const student = this.data.selectedStudent;
    if (!student) return;

    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    const today = new Date();
    const printedAt = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}, ${String(today.getHours()).padStart(2,'0')}.${String(today.getMinutes()).padStart(2,'0')} WIB`;

    const rows = student.exams.map((ex, i) => {
      const isCBT = ex.mode === 'CBT';
      const modeColor = isCBT ? '#6D28D9' : '#B45309';
      const modeBg   = isCBT ? '#EDE9FE' : '#FEF3C7';
      return `
        <tr style="border-bottom:1px solid #E8D5C0; ${i % 2 === 1 ? 'background:#FDFAF6' : 'background:#FFFFFF'}">
          <td style="padding:8px 10px; text-align:center; font-weight:700; color:#5E4230; font-size:9pt">${i + 1}</td>
          <td style="padding:8px 10px; font-weight:800; color:#1C0F06; font-size:9pt; line-height:1.3">${ex.course}</td>
          <td style="padding:8px 10px; text-align:center">
            <span style="background:${modeBg}; color:${modeColor}; font-weight:800; font-size:8pt; padding:2px 8px; border-radius:999px">${ex.mode}</span>
          </td>
          <td style="padding:8px 10px; font-size:8.5pt; color:#2C1A0E; font-weight:600; white-space:nowrap">${ex.date || '-'}</td>
          <td style="padding:8px 10px; font-size:8.5pt; color:#2C1A0E; font-family:monospace; font-weight:700; white-space:nowrap">${ex.time ? ex.time + ' WIB' : '-'}</td>
          <td style="padding:8px 10px; font-size:8.5pt; color:#2C1A0E; font-weight:600">${ex.sesi || '-'}</td>
          <td style="padding:8px 10px; font-size:8.5pt; color:#3D2314; font-weight:700; text-align:center">${ex.seat && ex.seat !== '-' ? ex.seat : '—'}</td>
          <td style="padding:8px 10px; font-size:8.5pt; color:#2C1A0E; font-weight:600; line-height:1.3">${ex.room || '-'}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Kartu Ujian UTS — ${student.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: #fff;
      color: #1C0F06;
      padding: 14mm 14mm 10mm;
      font-size: 9pt;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A4 portrait; margin: 0; }

    .kop {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #7C5C40;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .kop-title h1 { font-size: 14pt; font-weight: 900; color: #3D2314; letter-spacing: -0.3px; }
    .kop-title p { font-size: 8pt; color: #7C5C40; font-weight: 600; margin-top: 2px; }
    .kop-badge {
      background: #7C5C40; color: #FFFBF7; font-weight: 900;
      font-size: 11pt; padding: 6px 16px; border-radius: 8px; letter-spacing: 1px;
    }

    .identity {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;
      background: #FDF8F2; border: 1.5px solid #D4B896; border-radius: 10px;
      padding: 10px 14px; margin-bottom: 12px;
    }
    .identity-field label {
      font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #8C7B6E; display: block; margin-bottom: 2px;
    }
    .identity-field span { font-size: 10pt; font-weight: 800; color: #1C0F06; }
    .identity-field.nim span { font-family: monospace; font-size: 12pt; color: #7C5C40; }

    table { width: 100%; border-collapse: collapse; border: 1.5px solid #D4B896; border-radius: 8px; overflow: hidden; }
    thead tr { background: #7C5C40; }
    thead th {
      padding: 8px 10px; text-align: left; font-size: 8pt; font-weight: 800;
      color: #FFFBF7; text-transform: uppercase; letter-spacing: 0.4px; white-space: nowrap;
    }
    thead th:nth-child(1), thead th:nth-child(3), thead th:nth-child(7) { text-align: center; }

    .summary { display: flex; gap: 10px; margin-top: 10px; }
    .summary-box {
      flex: 1; border: 1.5px solid #D4B896; border-radius: 8px;
      padding: 8px 12px; background: #FDF8F2;
    }
    .summary-box label {
      font-size: 7.5pt; font-weight: 700; text-transform: uppercase; color: #8C7B6E; display: block;
    }
    .summary-box span { font-size: 13pt; font-weight: 900; color: #3D2314; }

    .footer { margin-top: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
    .footer .note { font-size: 7.5pt; color: #5E4230; max-width: 65%; line-height: 1.6; }
    .ttd {
      text-align: center; border: 1px solid #D4B896; border-radius: 8px;
      padding: 8px 20px 6px; min-width: 160px;
    }
    .ttd p { font-size: 7.5pt; color: #5E4230; font-weight: 600; }
    .ttd .sign-space { height: 36px; }
    .ttd .sign-name { font-size: 7.5pt; font-weight: 800; color: #1C0F06; border-top: 1px solid #C8956A; padding-top: 4px; margin-top: 2px; }
    .watermark { font-size: 7pt; color: #B0967E; text-align: center; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="kop">
    <div class="kop-title">
      <h1>KARTU UJIAN TENGAH SEMESTER</h1>
      <p>Portal Akademik TPB ITERA &bull; Gasal TA 2026/2027 &bull; Dicetak: ${printedAt}</p>
    </div>
    <div class="kop-badge">UTS 2026</div>
  </div>

  <div class="identity">
    <div class="identity-field">
      <label>Nama Mahasiswa</label>
      <span>${student.name}</span>
    </div>
    <div class="identity-field nim">
      <label>NIM</label>
      <span>${student.nim}</span>
    </div>
    <div class="identity-field">
      <label>Program Studi</label>
      <span>${student.prodi || '-'}</span>
    </div>
    <div class="identity-field">
      <label>Kelas TPB</label>
      <span>${student.tpb_class || '-'}</span>
    </div>
    <div class="identity-field">
      <label>Fakultas</label>
      <span>${student.fakultas || '-'}</span>
    </div>
    <div class="identity-field">
      <label>Total Ujian</label>
      <span>${student.exams.length} Mata Kuliah</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:4%">No</th>
        <th>Mata Kuliah</th>
        <th style="width:7%">Mode</th>
        <th style="width:15%">Tanggal</th>
        <th style="width:13%">Waktu</th>
        <th style="width:13%">Sesi</th>
        <th style="width:7%; text-align:center">Kursi</th>
        <th>Ruang Ujian</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="summary">
    <div class="summary-box">
      <label>CBT (Labkom)</label>
      <span>${student.exams.filter(e => e.mode === 'CBT').length} Ujian</span>
    </div>
    <div class="summary-box">
      <label>PBT (Ruang Kelas)</label>
      <span>${student.exams.filter(e => e.mode === 'PBT').length} Ujian</span>
    </div>
    <div class="summary-box" style="flex:2">
      <label>Ujian Pertama</label>
      <span style="font-size:10pt">${student.exams[0]?.date || '-'} &mdash; ${student.exams[0]?.time || ''}</span>
    </div>
    <div class="summary-box" style="flex:2">
      <label>Ujian Terakhir</label>
      <span style="font-size:10pt">${student.exams[student.exams.length-1]?.date || '-'} &mdash; ${student.exams[student.exams.length-1]?.time || ''}</span>
    </div>
  </div>

  <div class="footer">
    <div class="note">
      <strong>&#9888; Perhatian:</strong> Hadir minimal <strong>15 menit</strong> sebelum ujian dimulai.<br>
      Wajib membawa <strong>kartu identitas</strong> (KTM/KTP) dan kartu ujian ini.<br>
      Dilarang membawa alat bantu selain yang diizinkan pengawas.<br>
      Kartu ini dicetak dari sistem &mdash; tidak memerlukan tanda tangan manual.
    </div>
    <div class="ttd">
      <p>Koordinator TPB ITERA</p>
      <div class="sign-space"></div>
      <div class="sign-name">Dr. Koordinator TPB</div>
    </div>
  </div>

  <div class="watermark">
    Portal Jadwal TPB ITERA &bull; ${student.nim} &bull; ${student.name} &bull; Dicetak otomatis ${printedAt}
  </div>

  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }<\/script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Popup diblokir browser. Izinkan popup untuk mencetak kartu ujian.'); return; }
    win.document.write(html);
    win.document.close();
  }
};

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.ExamManager.init();
});
