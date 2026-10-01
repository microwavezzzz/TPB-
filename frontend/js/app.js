// Helper: 24-Hour Time Formatter & Comparison
function format24h(timeStr) {
  if (!timeStr) return '';
  const clean = timeStr.toString().trim().replace('.', ':');
  const match = clean.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = match[2];
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  }
  return timeStr;
}

function timeToMinutes24(timeStr) {
  if (!timeStr) return 9999;
  const formatted = format24h(timeStr);
  const parts = formatted.split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) {
      return h * 60 + m;
    }
  }
  return 9999;
}

// Main TPB Portal Application Logic
const TPBApp = {
  data: {
    currentUser: null,
    masterSchedule: [],
    classes: [],
    coreClasses: [],
    rooms: [],
    lecturers: [],
    prodis: [],
    currentClass: 'TPB 44',
    selectedCoreClass: '',
    currentStudent: null,
    viewMode: 'table',
    activeTab: 'schedule',
    searchQuery: '',
    isDarkMode: false,
    editingItem: null,
    conflicts: new Map(),
    adminTasks: [],
    announcements: [],
    allUsers: [],
    coreFilter: 'ALL',
    dayFilter: 'ALL',
    classSchedules: []
  },

  dropdownInstances: {},

  STORAGE_KEY_CLASS: 'tpb_selected_class',
  STORAGE_KEY_THEME: 'tpb_dark_mode',
  STORAGE_KEY_CORE: 'tpb_selected_core_class',
  STORAGE_KEY_VIEW: 'tpb_selected_view_mode',

  async init() {
    // 1. Auth Guard: Check if user is logged in
    if (!Auth.isLoggedIn()) {
      window.location.href = '/login';
      return;
    }

    this.data.currentUser = Auth.getUser();
    this.initTheme();
    this.renderUserProfileHeader();
    await this.loadMasterData();
    this.initEventListeners();
    this.restoreState();
    await this.refreshClassData();
    this.render();
    this.startLiveTicker();
  },

  setCoreFilter(val) {
    this.data.coreFilter = val;
    document.querySelectorAll('.core-filter-btn').forEach(btn => {
      btn.style.background = 'transparent';
      btn.style.color = '#5E4230';
      btn.classList.remove('text-white', 'shadow-sm');
    });
    const activeBtn = document.getElementById(`filterCoreBtn_${val}`);
    if (activeBtn) {
      activeBtn.style.background = '#7C5C40';
      activeBtn.style.color = '#FFFBF7';
      activeBtn.classList.add('text-white', 'shadow-sm');
    }
    this.render();
  },

  setDayFilter(day) {
    this.data.dayFilter = day;
    document.querySelectorAll('.day-chip').forEach(btn => {
      btn.style.background = '#F2E8DA';
      btn.style.color = '#5E4230';
      btn.classList.remove('text-white', 'shadow-sm');
    });
    const activeChip = document.getElementById(`dayChip_${day}`);
    if (activeChip) {
      activeChip.style.background = '#7C5C40';
      activeChip.style.color = '#FFFBF7';
      activeChip.classList.add('text-white', 'shadow-sm');
    }
    this.renderScheduleView();
  },

  getFilteredDays() {
    const allDays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    if (!this.data.dayFilter || this.data.dayFilter === 'ALL') {
      return allDays;
    }
    if (this.data.dayFilter === 'TODAY') {
      const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const today = dayNames[new Date().getDay()];
      const match = allDays.find(d => d.toLowerCase() === today.toLowerCase());
      return match ? [match] : ['Senin'];
    }
    return allDays.filter(d => d.toLowerCase() === this.data.dayFilter.toLowerCase());
  },

  renderUserProfileHeader() {
    const user = this.data.currentUser;
    if (!user) return;

    const nameEl = document.getElementById('userNameLabel');
    const roleBadgeEl = document.getElementById('userRoleBadge');
    const avatarEl = document.getElementById('userAvatar');
    const menuFullName = document.getElementById('menuFullName');
    const menuNimProdi = document.getElementById('menuNimProdi');
    const superAdminBtn = document.getElementById('superAdminBtn');
    const adminActionGroup = document.getElementById('adminActionGroup');
    const adminLiveTag = document.getElementById('adminLiveTag');
    const addTaskBtnLabel = document.getElementById('addTaskBtnLabel');

    if (nameEl) nameEl.textContent = user.name;
    if (menuFullName) menuFullName.textContent = user.name;
    if (menuNimProdi) menuNimProdi.textContent = `${user.nim} • ${user.prodi || user.class_name || 'TPB 44'}`;

    if (avatarEl) {
      avatarEl.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    }

    let roleText = 'Mahasiswa';
    if (user.role === 'super_admin') {
      roleText = 'Super Admin';
      if (roleBadgeEl) {
        roleBadgeEl.textContent = 'SUPER ADMIN';
        roleBadgeEl.style.color = '#BFA080';
      }
      if (superAdminBtn) superAdminBtn.classList.remove('hidden');
      if (adminActionGroup) adminActionGroup.classList.remove('hidden');
      if (adminLiveTag) adminLiveTag.classList.remove('hidden');
      if (addTaskBtnLabel) addTaskBtnLabel.textContent = 'Tambah Tugas Kelas (Admin)';
    } else if (user.role === 'admin') {
      roleText = 'Ketua / PJ Matkul';
      if (roleBadgeEl) {
        roleBadgeEl.textContent = 'ADMIN TPB 44';
        roleBadgeEl.style.color = '#7C5C40';
      }
      if (adminActionGroup) adminActionGroup.classList.remove('hidden');
      if (adminLiveTag) adminLiveTag.classList.remove('hidden');
      if (addTaskBtnLabel) addTaskBtnLabel.textContent = 'Tambah Tugas Kelas (Admin)';
    } else {
      if (roleBadgeEl) {
        roleBadgeEl.textContent = 'Anggota TPB 44';
        roleBadgeEl.style.color = '#8C7B6E';
      }
      if (addTaskBtnLabel) addTaskBtnLabel.textContent = 'Tambah Catatan Tugas';
    }
  },

  initTheme() {
    const savedTheme = localStorage.getItem(this.STORAGE_KEY_THEME);
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      this.data.isDarkMode = true;
      document.documentElement.classList.add('dark');
    } else {
      this.data.isDarkMode = false;
      document.documentElement.classList.remove('dark');
    }
  },

  toggleTheme() {
    this.data.isDarkMode = !this.data.isDarkMode;
    if (this.data.isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(this.STORAGE_KEY_THEME, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(this.STORAGE_KEY_THEME, 'light');
    }
  },

  async loadMasterData() {
    try {
      const response = await fetch('/api/schedule');
      if (!response.ok) throw new Error('Gagal memuat data dari server');
      const json = await response.json();
      
      this.data.masterSchedule = (json.schedules || []).map(item => ({
        ...item,
        start_time: format24h(item.start_time),
        end_time: format24h(item.end_time)
      }));

      this.data.classes = json.classes || [];
      this.data.coreClasses = json.core_classes || [];
      this.data.rooms = json.rooms || [];
      this.data.lecturers = json.lecturers || [];
      this.data.prodis = json.prodis || [];

      this.initSearchableDropdowns();
    } catch (err) {
      console.error('Error fetching master data:', err);
    }
  },

  async refreshClassData() {
    try {
      const res = await fetch(`/api/class/${encodeURIComponent(this.data.currentClass)}`);
      if (res.ok) {
        const json = await res.json();
        this.data.adminTasks = json.admin_tasks || [];
        this.data.announcements = json.announcements || [];
        
        // Simpan seluruh jadwal gabungan (Umum + Core Prodi) dari backend
        this.data.classSchedules = (json.schedules || []).map(item => ({
          ...item,
          start_time: format24h(item.start_time),
          end_time: format24h(item.end_time)
        }));

        // Perbarui juga di masterSchedule agar sinkron dengan komponen lain
        this.data.masterSchedule = this.data.masterSchedule.map(s => {
          const found = this.data.classSchedules.find(m => m.id === s.id);
          return found ? { ...s, ...found } : s;
        });

        // Tampilkan filter bar tipe kelas Core jika kelas memiliki Core Prodi
        const filterBar = document.getElementById('coreProdiFilterBar');
        if (filterBar) {
          const hasCore = this.data.classSchedules.some(s => s.is_core_prodi || s.category === 'Core Prodi');
          if (hasCore) {
            filterBar.classList.remove('hidden');
          } else {
            filterBar.classList.add('hidden');
          }
        }
      }
    } catch (e) {
      console.error('Error refreshing class data:', e);
    }
  },

  initSearchableDropdowns() {
    // 1. Searchable Class Dropdown (TPB 44 prioritized on top)
    const tpbClasses = this.data.classes.filter(c => c.startsWith('TPB '));
    // Sort so TPB 44 is at the very beginning
    const sortedTpb = ['TPB 44', ...tpbClasses.filter(c => c !== 'TPB 44')];
    const otherClasses = this.data.classes.filter(c => !c.startsWith('TPB ') && !c.startsWith('Core '));

    const classGroups = [
      {
        label: 'Kelas Utama',
        items: sortedTpb.map(c => ({ value: c, label: c, subtext: c === 'TPB 44' ? 'Prioritas / Kelas Utama' : '' }))
      }
    ];

    if (this.data.coreClasses && this.data.coreClasses.length > 0) {
      classGroups.push({
        label: 'Jadwal Core Prodi Spesifik',
        items: this.data.coreClasses.map(c => ({ value: c, label: c }))
      });
    }

    if (otherClasses.length > 0) {
      classGroups.push({
        label: 'Kelas Khusus (AAPP / PIK / R01)',
        items: otherClasses.map(c => ({ value: c, label: c }))
      });
    }

    this.dropdownInstances.class = window.SearchableDropdown.create({
      containerId: 'classSelectDropdownContainer',
      placeholder: 'Pilih Kelas...',
      defaultValue: this.data.currentClass,
      groups: classGroups,
      onSelect: async (val) => {
        this.data.currentClass = val;
        localStorage.setItem(this.STORAGE_KEY_CLASS, this.data.currentClass);
        await this.refreshClassData();
        this.render();
      }
    });

    // 2. Searchable Core Prodi Dropdown
    const coreGroups = [
      {
        label: 'Opsi Default',
        items: [{ value: '', label: '+ Gabungkan Core Prodi (Opsional)' }]
      },
      {
        label: 'Daftar Core Prodi (126 Kelas)',
        items: this.data.coreClasses.map(c => ({ value: c, label: c }))
      }
    ];

    this.dropdownInstances.core = window.SearchableDropdown.create({
      containerId: 'coreProdiDropdownContainer',
      placeholder: '+ Gabungkan Core Prodi',
      defaultValue: this.data.selectedCoreClass || '',
      theme: 'purple',
      groups: coreGroups,
      onSelect: (val) => {
        this.data.selectedCoreClass = val;
        localStorage.setItem(this.STORAGE_KEY_CORE, this.data.selectedCoreClass);
        this.render();
      }
    });

    // 3. Searchable Room Dropdown
    const roomGroups = [
      {
        label: 'Daftar Ruangan Gedung & Laboratorium',
        items: this.data.rooms.map(r => ({ value: r, label: r }))
      }
    ];

    this.dropdownInstances.room = window.SearchableDropdown.create({
      containerId: 'roomSelectDropdownContainer',
      placeholder: 'Pilih atau cari ruangan (misal: GK1, LABKOM)...',
      defaultValue: '',
      groups: roomGroups,
      onSelect: (val) => {
        this.searchRoomSchedule(val);
      }
    });
  },

  restoreState() {
    const savedClass = localStorage.getItem(this.STORAGE_KEY_CLASS);
    if (savedClass) {
      this.data.currentClass = savedClass;
      if (this.dropdownInstances.class) {
        this.dropdownInstances.class.setValue(savedClass);
      }
    } else {
      // Default to TPB 44
      this.data.currentClass = 'TPB 44';
      if (this.dropdownInstances.class) {
        this.dropdownInstances.class.setValue('TPB 44');
      }
    }

    const savedCore = localStorage.getItem(this.STORAGE_KEY_CORE);
    if (savedCore) {
      this.data.selectedCoreClass = savedCore;
      if (this.dropdownInstances.core) {
        this.dropdownInstances.core.setValue(savedCore);
      }
    }

    // Default view: if on mobile and no saved preference, use 'grid' (Card View)
    const savedView = localStorage.getItem(this.STORAGE_KEY_VIEW);
    if (savedView) {
      this.data.viewMode = savedView;
    } else if (window.innerWidth < 768) {
      this.data.viewMode = 'grid';
    }

    // Update view switcher buttons active visual
    document.querySelectorAll('.view-btn').forEach(b => {
      if (b.getAttribute('data-view') === this.data.viewMode) {
        b.classList.add('text-white');
        b.style.background = '#7C5C40';
        b.style.color = '#FFFBF7';
      } else {
        b.classList.remove('text-white');
        b.style.background = 'transparent';
        b.style.color = '#5E4230';
      }
    });
  },

  setTimePreset(startId, endId, startVal, endVal) {
    const startInput = document.getElementById(startId);
    const endInput = document.getElementById(endId);
    if (startInput) startInput.value = startVal;
    if (endInput) endInput.value = endVal;
    this.updateModalConflictPreview();
  },

  getActiveSchedule() {
    const currentClass = this.data.currentClass.trim().toUpperCase();
    let rawItems = [];

    // Prioritaskan jadwal gabungan (Umum + Core Prodi) dari classSchedules
    if (this.data.classSchedules && this.data.classSchedules.length > 0) {
      rawItems = [...this.data.classSchedules];
    } else {
      rawItems = this.data.masterSchedule.filter(item => {
        const c = (item.class_name || '').trim().toUpperCase();
        return c === currentClass || c === `TPB ${currentClass}` || (currentClass.startsWith('TPB') && c === currentClass);
      });
    }

    if (this.data.selectedCoreClass && !this.data.currentClass.startsWith('Core ')) {
      const coreTarget = this.data.selectedCoreClass.trim().toUpperCase();
      const coreMatches = this.data.masterSchedule.filter(item => {
        return (item.class_name || '').trim().toUpperCase() === coreTarget;
      });
      coreMatches.forEach(cm => {
        if (!rawItems.some(r => r.id === cm.id)) {
          rawItems.push(cm);
        }
      });
    }

    // Filter berdasarkan Tipe Kelas Core Prodi (A / B / C / ALL)
    if (this.data.coreFilter && this.data.coreFilter !== 'ALL') {
      const targetFilter = this.data.coreFilter.toUpperCase();
      rawItems = rawItems.filter(item => {
        const isCore = item.is_core_prodi || item.category === 'Core Prodi';
        if (!isCore) return true; // Jadwal umum selalu ditampilkan
        return (item.core_class || '').toUpperCase() === targetFilter;
      });
    }

    const dayOrder = { 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6, 'minggu': 7 };
    rawItems.sort((a, b) => {
      const dA = dayOrder[(a.day || '').toLowerCase()] || 99;
      const dB = dayOrder[(b.day || '').toLowerCase()] || 99;
      if (dA !== dB) return dA - dB;
      
      const minA = timeToMinutes24(a.start_time);
      const minB = timeToMinutes24(b.start_time);
      return minA - minB;
    });

    this.data.conflicts = window.ConflictDetector.detectConflicts(rawItems);
    return rawItems;
  },

  initEventListeners() {
    // User profile dropdown toggle
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdownMenu = document.getElementById('userDropdownMenu');
    const userMenuWrapper = document.getElementById('userMenuWrapper');

    if (userMenuBtn && userDropdownMenu) {
      userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdownMenu.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (userMenuWrapper && !userMenuWrapper.contains(e.target)) {
          userDropdownMenu.classList.add('hidden');
        }
      });
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.setActiveTab(tab);
      });
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.data.viewMode = e.currentTarget.getAttribute('data-view');
        localStorage.setItem(this.STORAGE_KEY_VIEW, this.data.viewMode);
        document.querySelectorAll('.view-btn').forEach(b => {
          b.classList.remove('text-white');
          b.style.background = 'transparent';
          b.style.color = '#5E4230';
        });
        e.currentTarget.classList.add('text-white');
        e.currentTarget.style.background = '#7C5C40';
        e.currentTarget.style.color = '#FFFBF7';
        this.renderScheduleView();
      });
    });

    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
    }

    const studentSearchInput = document.getElementById('studentSearchInput');
    if (studentSearchInput) {
      let timeout = null;
      studentSearchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => this.searchStudents(e.target.value), 250);
      });
    }

    const exportIcsBtn = document.getElementById('exportIcsBtn');
    if (exportIcsBtn) {
      exportIcsBtn.addEventListener('click', () => {
        const schedules = this.getActiveSchedule();
        window.CalendarManager.downloadICS(schedules, this.data.currentClass);
      });
    }

    const exportWallpaperBtn = document.getElementById('exportWallpaperBtn');
    if (exportWallpaperBtn) {
      exportWallpaperBtn.addEventListener('click', () => {
        const schedules = this.getActiveSchedule();
        window.ScheduleExporter.generateWallpaper(schedules, this.data.currentClass);
      });
    }

    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
      printBtn.addEventListener('click', () => window.ScheduleExporter.printSchedule());
    }

    const addClassBtn = document.getElementById('addClassBtn');
    if (addClassBtn) {
      addClassBtn.addEventListener('click', () => this.openAddClassModal());
    }

    const syncExcelBtn = document.getElementById('syncExcelBtn');
    if (syncExcelBtn) {
      syncExcelBtn.addEventListener('click', () => this.syncExcelMaster());
    }
  },

  setActiveTab(tab) {
    this.data.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
      if (b.getAttribute('data-tab') === tab) {
        b.style.borderColor = '#7C5C40';
        b.style.color = '#7C5C40';
      } else {
        b.style.borderColor = 'transparent';
        b.style.color = '#8C7B6E';
      }
    });

    document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
    const activeContent = document.getElementById(`tab_${tab}`);
    if (activeContent) activeContent.classList.remove('hidden');

    if (tab === 'tasks') this.renderTasks();
    if (tab === 'students') this.renderClassmates();
    if (tab === 'core') this.renderCoreCatalog();
  },

  render() {
    this.renderHeaderInfo();
    this.renderAnnouncements();
    this.renderLiveBanner();
    this.renderScheduleView();
  },

  renderHeaderInfo() {
    const titleEl = document.getElementById('headerClassTitle');
    if (titleEl) {
      const isPriority = this.data.currentClass === 'TPB 44';
      titleEl.innerHTML = `
        <span>Jadwal ${this.data.currentClass}</span>
        ${isPriority ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#EDE0D0; color:#5E4230">⭐ Terpusat & Sinkron</span>` : ''}
      `;
    }

    const countEl = document.getElementById('totalCoursesCount');
    const schedule = this.getActiveSchedule();
    if (countEl) {
      countEl.textContent = `${schedule.length} Mata Kuliah Terjadwal`;
    }

    const conflictBanner = document.getElementById('conflictAlertBanner');
    if (conflictBanner) {
      if (this.data.conflicts.size > 0) {
        conflictBanner.classList.remove('hidden');
        conflictBanner.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-xl">⚠️</span>
            <div>
              <p class="font-bold">Terdeteksi ${this.data.conflicts.size} Jadwal Bertabrakan!</p>
              <p class="text-xs">Ada jam kuliah yang bentrok di hari yang sama. Silakan periksa kartu bertanda merah.</p>
            </div>
          </div>
        `;
      } else {
        conflictBanner.classList.add('hidden');
      }
    }
  },

  renderAnnouncements() {
    const container = document.getElementById('announcementsBanner');
    if (!container) return;

    if (!this.data.announcements || this.data.announcements.length === 0) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    this.data.announcements.forEach(ann => {
      html += `
        <div class="p-3.5 rounded-2xl flex items-start justify-between gap-3 shadow-sm border" style="background:#FFFBF7; border-color:#E8D5C0">
          <div class="flex items-start gap-3">
            <span class="p-2 rounded-xl text-white text-xs mt-0.5" style="background:#7C5C40">
              <i class="fas fa-bullhorn"></i>
            </span>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded" style="background:#F2E8DA; color:#7C5C40">PENGUMUMAN KELAS</span>
                <span class="text-xs font-bold" style="color:#2C1A0E">${ann.title}</span>
              </div>
              <p class="text-xs mt-1 whitespace-pre-line" style="color:#5E4230">${ann.content}</p>
              <p class="text-[10px] mt-1" style="color:#8C7B6E">Oleh: ${ann.created_by_name} (${ann.created_by_nim}) • ${new Date(ann.created_at).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
          ${Auth.isAdmin() ? `
            <button onclick="TPBApp.deleteAnnouncement(${ann.id})" class="text-xs text-rose-500 hover:text-rose-700 p-1" title="Hapus Pengumuman">
              <i class="fas fa-times"></i>
            </button>
          ` : ''}
        </div>
      `;
    });
    container.innerHTML = html;
  },

  renderLiveBanner() {
    const banner = document.getElementById('liveClassBanner');
    if (!banner) return;

    const schedules = this.getActiveSchedule();
    const liveStatus = window.CalendarManager.getTodayStatus(schedules);

    if (liveStatus.ongoing) {
      const item = liveStatus.ongoing.item;
      banner.className = 'p-4 rounded-2xl flex items-center justify-between shadow-sm border';
      banner.style.background = '#F2E8DA';
      banner.style.borderColor = '#D4B896';
      banner.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="relative flex h-3.5 w-3.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style="background:#7C5C40"></span>
            <span class="relative inline-flex rounded-full h-3.5 w-3.5" style="background:#5E4230"></span>
          </span>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#7C5C40; color:#FFFBF7">SEDANG BERLANGSUNG</span>
              <span class="text-xs" style="color:#8C7B6E">Selesai dalam ${liveStatus.ongoing.endsInMinutes} menit</span>
            </div>
            <h4 class="font-bold text-sm sm:text-base mt-0.5" style="color:#2C1A0E">${item.course_name} (${item.room || 'Ruang -'})</h4>
          </div>
        </div>
        <div class="text-right">
          <span class="text-xs sm:text-sm font-bold font-mono" style="color:#7C5C40">${format24h(item.start_time)} - ${format24h(item.end_time)} WIB</span>
        </div>
      `;
    } else if (liveStatus.nextUp) {
      const item = liveStatus.nextUp.item;
      banner.className = 'p-4 rounded-2xl flex items-center justify-between shadow-sm border';
      banner.style.background = '#FFFBF7';
      banner.style.borderColor = '#E8D5C0';
      banner.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="p-2 rounded-xl text-xs" style="background:#F2E8DA; color:#7C5C40">
            <i class="fas fa-clock text-base"></i>
          </span>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#F2E8DA; color:#5E4230">KELAS BERIKUTNYA</span>
              <span class="text-xs" style="color:#8C7B6E">Dimulai dalam ${liveStatus.nextUp.startsInMinutes} menit</span>
            </div>
            <h4 class="font-bold text-sm sm:text-base mt-0.5" style="color:#2C1A0E">${item.course_name} • ${item.room || '-'}</h4>
          </div>
        </div>
        <div class="text-right">
          <span class="text-xs sm:text-sm font-bold font-mono" style="color:#5E4230">${format24h(item.start_time)} - ${format24h(item.end_time)} WIB</span>
        </div>
      `;
    } else {
      banner.className = 'p-3.5 rounded-2xl flex items-center justify-between border';
      banner.style.background = '#FFFBF7';
      banner.style.borderColor = '#E8D5C0';
      banner.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="p-2 rounded-xl text-xs" style="background:#F2E8DA; color:#8C7B6E">
            <i class="fas fa-calendar-check text-base"></i>
          </span>
          <div>
            <h4 class="font-bold text-xs sm:text-sm" style="color:#5E4230">Tidak ada jadwal kuliah berlangsung hari ini (${liveStatus.currentDay})</h4>
            <p class="text-[11px]" style="color:#8C7B6E">Gunakan waktu luang untuk belajar atau istirahat.</p>
          </div>
        </div>
      `;
    }
  },

  startLiveTicker() {
    setInterval(() => {
      this.renderLiveBanner();
    }, 60000);
  },

  renderScheduleView() {
    const container = document.getElementById('scheduleViewContainer');
    if (!container) return;

    const schedules = this.getActiveSchedule();

    if (schedules.length === 0) {
      container.innerHTML = `
        <div class="p-12 text-center text-slate-400 glass-card rounded-2xl">
          <i class="fas fa-calendar-times text-4xl mb-3" style="color:#B89070"></i>
          <p class="text-sm font-semibold" style="color:#5E4230">Belum ada jadwal untuk kelas ini.</p>
        </div>
      `;
      return;
    }

    if (this.data.viewMode === 'table') {
      this.renderTableView(container, schedules);
    } else if (this.data.viewMode === 'grid') {
      this.renderGridView(container, schedules);
    } else if (this.data.viewMode === 'today') {
      this.renderTodayView(container, schedules);
    }
  },

  renderTableView(container, schedules) {
    const days = this.getFilteredDays();
    const grouped = {};
    days.forEach(day => grouped[day] = []);

    schedules.forEach(item => {
      const day = days.find(value => value.toLowerCase() === (item.day || '').toLowerCase() || (value === 'Jumat' && (item.day || '').toLowerCase().includes('jum')));
      if (day) grouped[day].push(item);
    });

    const isAdmin = Auth.isAdmin();

    let html = `
      <div class="glass-card rounded-2xl overflow-hidden shadow-sm border border-[#E8D5C0]">
        <div class="schedule-table-wrap overflow-x-auto w-full">
          <table class="schedule-table min-w-[650px] w-full">
            <thead>
              <tr>
                <th style="width: 100px;">Hari</th>
                <th style="width: 125px;">Waktu</th>
                <th>Mata Kuliah</th>
                <th style="width: 110px;">Ruang</th>
                <th>Dosen Pengampu</th>
                <th style="width: 95px;">Kategori</th>
                ${isAdmin ? `<th style="width: 75px; text-align:center;">Aksi</th>` : ''}
              </tr>
            </thead>
            <tbody>
    `;

    days.forEach(day => {
      const items = grouped[day].sort((a, b) => timeToMinutes24(a.start_time) - timeToMinutes24(b.start_time));
      if (items.length === 0) return;

      items.forEach((item, index) => {
        let badgeClass = 'badge-kuliah';
        if (item.category === 'Praktikum') badgeClass = 'badge-praktikum';
        else if (item.category === 'Core Prodi') badgeClass = 'badge-core';
        else if (item.category === 'MKWU') badgeClass = 'badge-mkwu';
        else if (item.category === 'Tutorial') badgeClass = 'badge-tutorial';
        else if (item.category === 'Responsi') badgeClass = 'badge-responsi';

        const isConflict = this.data.conflicts.has(item.id);
        const rowClass = isConflict ? 'conflict-row' : '';

        html += `
          <tr class="${rowClass}">
            ${index === 0 ? `<td rowspan="${items.length}" class="font-bold text-xs align-top pt-3 border-r border-[#E8D5C0]" style="color:#5E4230; background:#FFFBF7">${day}</td>` : ''}
            <td class="font-mono text-xs font-semibold" style="color:#7C5C40">
              ${format24h(item.start_time)} - ${format24h(item.end_time)}
            </td>
            <td>
              <div class="font-bold text-xs sm:text-sm flex flex-wrap items-center gap-1.5" style="color:#2C1A0E">
                <span>${item.course_name}</span>
                ${item.is_core_prodi || item.category === 'Core Prodi' ? `
                  <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-xs" style="${item.core_class === 'A' ? 'background:#FEF3C7; color:#92400E; border:1px solid #FCD34D' : item.core_class === 'B' ? 'background:#D1FAE5; color:#065F46; border:1px solid #6EE7B7' : item.core_class === 'C' ? 'background:#EDE9FE; color:#5B21B6; border:1px solid #C4B5FD' : 'background:#F2E8DA; color:#5E4230; border:1px solid #E8D5C0'}">
                    KELAS ${item.core_class || 'A/B/C'}
                  </span>
                  <span class="text-[10px] font-semibold text-[#8C7B6E]">(${item.prodi || item.core_prodi_name || 'Core'})</span>
                ` : ''}
                ${item.isAdminEdited ? `
                  <span class="text-[9px] font-bold px-1.5 py-0.2 rounded" style="background:#EDE0D0; color:#5E4230" title="Diubah oleh Admin: ${item.changed_by_name || ''} (${item.note || ''})">
                    EDITED ADMIN
                  </span>
                ` : ''}
              </div>
              <div class="text-[11px] flex items-center gap-2 mt-0.5" style="color:#8C7B6E">
                ${item.sks ? `<span>${item.sks} SKS</span>` : ''}
                ${item.course_code ? `<span>• ${item.course_code}</span>` : ''}
                ${item.note ? `<span class="italic text-amber-700">📌 ${item.note}</span>` : ''}
              </div>
            </td>
            <td class="text-xs font-semibold" style="color:#5E4230">
              <i class="fas fa-map-marker-alt text-[10px] mr-1 opacity-70"></i>${item.room || '-'}
            </td>
            <td class="text-xs" style="color:#5E4230">
              ${item.lecturer || '-'}
            </td>
            <td>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeClass}">
                ${item.category || 'Kuliah'}
              </span>
            </td>
            ${isAdmin ? `
              <td class="text-center">
                <button onclick="TPBApp.openEditModal('${item.id}')" class="px-2.5 py-1 rounded-lg text-xs font-bold text-white transition-all shadow-sm" style="background:#7C5C40" title="Edit Jadwal Kelas">
                  <i class="fas fa-edit"></i>
                </button>
              </td>
            ` : ''}
          </tr>
        `;
      });
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
    container.innerHTML = html;
  },

  renderGridView(container, schedules) {
    const days = this.getFilteredDays();
    const grouped = {};
    days.forEach(d => grouped[d] = []);

    schedules.forEach(item => {
      const d = item.day || 'Lainnya';
      const normDay = days.find(x => x.toLowerCase() === d.toLowerCase() || (x === 'Jumat' && d.toLowerCase().includes('jum')));
      if (normDay) {
        grouped[normDay].push(item);
      }
    });

    const isSingle = days.length === 1;
    let html = `<div class="grid grid-cols-1 ${isSingle ? 'max-w-2xl mx-auto' : 'md:grid-cols-2 lg:grid-cols-5'} gap-3.5">`;

    days.forEach(day => {
      const items = grouped[day].sort((a, b) => timeToMinutes24(a.start_time) - timeToMinutes24(b.start_time));
      
      html += `
        <div class="flex flex-col gap-2.5 p-3.5 rounded-2xl border" style="background:#FFFBF7; border-color:#E8D5C0">
          <div class="flex items-center justify-between pb-2 border-b border-[#E8D5C0]">
            <span class="font-bold text-xs sm:text-sm flex items-center gap-1.5" style="color:#2C1A0E">
              <span class="w-2.5 h-2.5 rounded-full" style="background:#7C5C40"></span>
              ${day}
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:#F2E8DA; color:#5E4230">
              ${items.length} Matkul
            </span>
          </div>

          <div class="flex flex-col gap-2">
      `;

      if (items.length === 0) {
        html += `
          <div class="py-8 text-center text-xs italic" style="color:#B89070">
            <i class="fas fa-bed text-2xl mb-1.5 block opacity-60"></i>
            Libur / Tidak ada jadwal
          </div>
        `;
      } else {
        items.forEach(item => {
          html += this.renderScheduleCard(item);
        });
      }

      html += `
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  },

  renderTodayView(container, schedules) {
    const liveStatus = window.CalendarManager.getTodayStatus(schedules);
    const items = liveStatus.todaySchedules.sort((a, b) => timeToMinutes24(a.start_time) - timeToMinutes24(b.start_time));

    let html = `
      <div class="max-w-2xl mx-auto flex flex-col gap-3">
        <div class="flex items-center justify-between p-4 rounded-2xl border" style="background:#FFFBF7; border-color:#E8D5C0">
          <div>
            <h3 class="font-bold text-base" style="color:#2C1A0E">Jadwal Kuliah Hari Ini (${liveStatus.currentDay})</h3>
            <p class="text-xs" style="color:#8C7B6E">${items.length} mata kuliah terjadwal secara kronologis</p>
          </div>
          <span class="text-2xl">📚</span>
        </div>
    `;

    if (items.length === 0) {
      html += `
        <div class="p-10 text-center rounded-2xl border" style="background:#FFFBF7; border-color:#E8D5C0">
          <i class="fas fa-mug-hot text-3xl mb-2" style="color:#B89070"></i>
          <h4 class="font-bold text-xs sm:text-sm" style="color:#5E4230">Tidak ada jadwal kuliah hari ini</h4>
          <p class="text-xs mt-1" style="color:#8C7B6E">Waktu luang untuk belajar mandiri atau beristirahat.</p>
        </div>
      `;
    } else {
      items.forEach(item => {
        html += this.renderScheduleCard(item, true);
      });
    }

    html += `</div>`;
    container.innerHTML = html;
  },

  renderScheduleCard(item, isWide = false) {
    const hasConflict = this.data.conflicts.has(item.id);
    const conflictClass = hasConflict ? 'conflict-card' : '';

    let badgeClass = 'badge-kuliah';
    if (item.category === 'Praktikum') badgeClass = 'badge-praktikum';
    else if (item.category === 'Core Prodi') badgeClass = 'badge-core';
    else if (item.category === 'MKWU') badgeClass = 'badge-mkwu';
    else if (item.category === 'Tutorial') badgeClass = 'badge-tutorial';
    else if (item.category === 'Responsi') badgeClass = 'badge-responsi';

    const startTime24 = format24h(item.start_time);
    const endTime24 = format24h(item.end_time);
    const isAdmin = Auth.isAdmin();

    return `
      <div class="relative glass-card p-3.5 rounded-2xl shadow-xs border border-[#E8D5C0] hover:border-[#D4B896] transition-all ${conflictClass}" style="background:#FFFBF7">
        
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${badgeClass}">
              ${item.category || 'Kuliah'}
            </span>
            ${(item.is_core_prodi || item.category === 'Core Prodi') && item.core_class ? `
              <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-xs" style="${item.core_class === 'A' ? 'background:#FEF3C7; color:#92400E; border:1px solid #FCD34D' : item.core_class === 'B' ? 'background:#D1FAE5; color:#065F46; border:1px solid #6EE7B7' : item.core_class === 'C' ? 'background:#EDE9FE; color:#5B21B6; border:1px solid #C4B5FD' : 'background:#F2E8DA; color:#5E4230; border:1px solid #E8D5C0'}">
                KELAS ${item.core_class}
              </span>
            ` : ''}
          </div>
          ${item.isAdminEdited ? `
            <span class="text-[9px] font-bold px-1.5 py-0.2 rounded" style="background:#EDE0D0; color:#5E4230" title="Diubah oleh Admin: ${item.changed_by_name || ''}">
              EDITED
            </span>
          ` : (item.prodi || item.core_prodi_name ? `
            <span class="text-[10px] text-[#8C7B6E] font-medium truncate max-w-[130px]" title="${item.prodi || item.core_prodi_name}">
              ${item.prodi || item.core_prodi_name}
            </span>
          ` : '')}
        </div>

        <h4 class="font-bold text-xs sm:text-sm leading-snug mb-2" style="color:#2C1A0E">
          ${item.course_name}
        </h4>

        <!-- High-readability Info Chips for Mobile & Desktop -->
        <div class="grid grid-cols-2 gap-1.5 mb-2">
          <div class="flex items-center gap-1.5 font-mono text-[11px] font-bold px-2 py-1 rounded-lg truncate" style="background:#F2E8DA; color:#7C5C40" title="Waktu Kuliah">
            <i class="far fa-clock text-[10px] shrink-0"></i>
            <span class="truncate">${startTime24} - ${endTime24}</span>
          </div>

          <div class="flex items-center gap-1.5 text-[11px] font-bold px-2 py-1 rounded-lg truncate" style="background:#F2E8DA; color:#5E4230" title="Ruangan">
            <i class="fas fa-map-marker-alt text-[10px] text-[#7C5C40] shrink-0"></i>
            <span class="truncate">${item.room || 'Ruang -'}</span>
          </div>
        </div>

        <div class="space-y-1 text-xs" style="color:#5E4230">
          ${item.lecturer ? `
            <div class="flex items-center gap-1.5 text-[11px]" style="color:#8C7B6E">
              <i class="fas fa-chalkboard-teacher text-[10px] shrink-0"></i>
              <span class="truncate" title="${item.lecturer}">${item.lecturer}</span>
            </div>
          ` : ''}

          ${item.note ? `
            <div class="text-[10px] italic p-1.5 rounded-lg bg-[#F2E8DA] text-[#5E4230] leading-tight">
              📌 ${item.note}
            </div>
          ` : ''}
        </div>

        <div class="mt-2.5 pt-2 border-t border-[#E8D5C0] flex items-center justify-between gap-1">
          <div>
            ${item.link ? `
              <a href="${item.link}" target="_blank" class="px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-1 shadow-2xs">
                <i class="fab fa-whatsapp"></i> Grup WA
              </a>
            ` : ''}
          </div>

          ${isAdmin ? `
            <button onclick="TPBApp.openEditModal('${item.id}')" class="px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-sm flex items-center gap-1 ml-auto" style="background:#7C5C40" title="Edit Jadwal Kelas (Admin)">
              <i class="fas fa-pen text-[10px]"></i> Edit
            </button>
          ` : ''}
        </div>
      </div>
    `;
  },

  // ─────────────────────────────────────────────
  // ADMIN EDIT SCHEDULE
  // ─────────────────────────────────────────────

  openEditModal(itemId) {
    if (!Auth.isAdmin()) {
      alert('Hanya Ketua Kelas & Penanggung Jawab Matkul yang dapat mengedit jadwal.');
      return;
    }

    const schedules = this.getActiveSchedule();
    const item = schedules.find(s => s.id === itemId);
    if (!item) return;

    this.data.editingItem = item;

    document.getElementById('editCourseTitle').textContent = item.course_name;
    document.getElementById('editDay').value = item.day || 'Senin';
    document.getElementById('editStartTime').value = format24h(item.start_time) || '08:00';
    document.getElementById('editEndTime').value = format24h(item.end_time) || '09:40';
    document.getElementById('editRoom').value = item.room || '';
    document.getElementById('editLecturer').value = item.lecturer || '';
    document.getElementById('editLink').value = item.link || '';
    document.getElementById('editNote').value = item.note || '';

    this.updateModalConflictPreview();

    const modal = document.getElementById('editScheduleModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeEditModal() {
    const modal = document.getElementById('editScheduleModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    this.data.editingItem = null;
  },

  updateModalConflictPreview() {
    if (!this.data.editingItem) return;

    const day = document.getElementById('editDay').value;
    const start = format24h(document.getElementById('editStartTime').value);
    const end = format24h(document.getElementById('editEndTime').value);

    const dummyItem = {
      id: this.data.editingItem.id,
      day: day,
      start_time: start,
      end_time: end
    };

    const schedules = this.getActiveSchedule();
    const conflicting = schedules.filter(s => window.ConflictDetector.isOverlapping(dummyItem, s));

    const previewEl = document.getElementById('editConflictWarning');
    if (conflicting.length > 0) {
      previewEl.classList.remove('hidden');
      previewEl.innerHTML = `⚠️ <strong>Peringatan Bentrok:</strong> Jadwal ini bertabrakan dengan <b>${conflicting.map(c => c.course_name).join(', ')}</b> di hari ${day} (${format24h(conflicting[0].start_time)} - ${format24h(conflicting[0].end_time)} WIB)`;
    } else {
      previewEl.classList.add('hidden');
    }
  },

  async saveEditedSchedule() {
    if (!this.data.editingItem) return;

    const currentClass = this.data.currentClass.trim().toUpperCase();
    const day = document.getElementById('editDay').value;
    const start = format24h(document.getElementById('editStartTime').value);
    const end = format24h(document.getElementById('editEndTime').value);
    const room = document.getElementById('editRoom').value.trim();
    const lecturer = document.getElementById('editLecturer').value.trim();
    const link = document.getElementById('editLink').value.trim();
    const note = document.getElementById('editNote').value.trim();

    try {
      const res = await Auth.authFetch('/api/admin/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: this.data.editingItem.id,
          class_name: currentClass,
          day: day,
          start_time: start,
          end_time: end,
          room: room,
          lecturer: lecturer,
          link: link,
          note: note
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Gagal menyimpan perubahan jadwal.');
      }

      this.closeEditModal();
      await this.refreshClassData();
      this.render();
      alert('Berhasil! Perubahan jadwal tersimpan di server dan berlaku untuk seluruh anggota kelas.');
    } catch (e) {
      alert(e.message);
    }
  },

  async deleteScheduleItem() {
    if (!this.data.editingItem) return;
    if (!confirm(`Hapus jadwal "${this.data.editingItem.course_name}" dari tampilan kelas?`)) return;

    try {
      const res = await Auth.authFetch('/api/admin/schedule', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: this.data.editingItem.id,
          class_name: this.data.currentClass
        })
      });

      if (!res.ok) throw new Error('Gagal menghapus jadwal.');

      this.closeEditModal();
      await this.refreshClassData();
      this.render();
      alert('Jadwal berhasil dihapus dari tampilan kelas.');
    } catch (e) {
      alert(e.message);
    }
  },

  // ─────────────────────────────────────────────
  // ANNOUNCEMENTS
  // ─────────────────────────────────────────────

  openAnnouncementModal() {
    document.getElementById('annTitle').value = '';
    document.getElementById('annContent').value = '';
    document.getElementById('annPinned').checked = true;

    const modal = document.getElementById('announcementModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeAnnouncementModal() {
    const modal = document.getElementById('announcementModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  async saveAnnouncement() {
    const title = document.getElementById('annTitle').value.trim();
    const content = document.getElementById('annContent').value.trim();
    const isPinned = document.getElementById('annPinned').checked;

    if (!title || !content) {
      alert('Judul dan isi pengumuman wajib diisi.');
      return;
    }

    try {
      const res = await Auth.authFetch('/api/admin/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_name: this.data.currentClass,
          title: title,
          content: content,
          is_pinned: isPinned
        })
      });

      if (!res.ok) throw new Error('Gagal mengirim pengumuman.');

      this.closeAnnouncementModal();
      await this.refreshClassData();
      this.render();
      alert('Pengumuman berhasil disiarkan ke seluruh kelas.');
    } catch (e) {
      alert(e.message);
    }
  },

  async deleteAnnouncement(annId) {
    if (!confirm('Hapus pengumuman ini?')) return;
    try {
      const res = await Auth.authFetch(`/api/admin/announcement/${annId}`, { method: 'DELETE' });
      if (res.ok) {
        await this.refreshClassData();
        this.render();
      }
    } catch (e) {
      alert(e.message);
    }
  },

  // ─────────────────────────────────────────────
  // TASKS
  // ─────────────────────────────────────────────

  renderTasks() {
    const container = document.getElementById('tasksListContainer');
    if (!container) return;

    const localTasks = window.TaskManager.getTasks();
    const adminTasks = this.data.adminTasks || [];

    if (localTasks.length === 0 && adminTasks.length === 0) {
      container.innerHTML = `
        <div class="p-12 text-center rounded-2xl border" style="background:#FFFBF7; border-color:#E8D5C0">
          <i class="fas fa-clipboard-check text-4xl mb-3" style="color:#B89070"></i>
          <h4 class="font-bold text-sm" style="color:#5E4230">Belum ada tugas atau deadline</h4>
          <p class="text-xs mt-1" style="color:#8C7B6E">Klik tombol "Tambah Tugas" untuk mencatat tugas baru.</p>
        </div>
      `;
      return;
    }

    let html = `<div class="flex flex-col gap-2.5">`;

    // Render Admin Tasks first
    adminTasks.forEach(t => {
      html += `
        <div class="p-3.5 rounded-xl border flex items-center justify-between gap-3 shadow-sm" style="background:#FFFBF7; border-color:#D4B896">
          <div class="flex items-center gap-3">
            <span class="w-2.5 h-2.5 rounded-full" style="background:#7C5C40"></span>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style="background:#7C5C40">RESMI DARI ADMIN / PJ</span>
                <h4 class="text-xs sm:text-sm font-bold" style="color:#2C1A0E">${t.title}</h4>
              </div>
              <div class="flex items-center gap-2 text-xs mt-1" style="color:#8C7B6E">
                <span class="px-2 py-0.5 rounded font-medium" style="background:#F2E8DA; color:#5E4230">${t.course_name}</span>
                ${t.deadline ? `<span class="text-rose-600 font-semibold font-mono">⏰ Deadline: ${t.deadline}</span>` : ''}
                <span>• Oleh: ${t.created_by_name}</span>
              </div>
              ${t.notes ? `<p class="text-xs mt-1" style="color:#5E4230">${t.notes}</p>` : ''}
            </div>
          </div>
          ${Auth.isAdmin() ? `
            <button onclick="TPBApp.deleteAdminTask(${t.id})" class="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg text-xs" title="Hapus Tugas Kelas">
              <i class="fas fa-trash-alt"></i>
            </button>
          ` : ''}
        </div>
      `;
    });

    // Render Personal Local Tasks
    localTasks.forEach(t => {
      const isDone = t.completed;
      html += `
        <div class="p-3.5 rounded-xl border flex items-center justify-between gap-3 ${isDone ? 'opacity-60' : ''}" style="background:#FFFBF7; border-color:#E8D5C0">
          <div class="flex items-center gap-3">
            <input type="checkbox" ${isDone ? 'checked' : ''} onchange="TPBApp.toggleTask('${t.id}')" class="w-4 h-4 rounded text-[#7C5C40] cursor-pointer">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded" style="background:#F2E8DA; color:#8C7B6E">CATATAN PRIBADI</span>
                <h4 class="text-xs sm:text-sm font-bold ${isDone ? 'line-through' : ''}" style="color:#2C1A0E">${t.title}</h4>
              </div>
              <div class="flex items-center gap-2 text-xs mt-1" style="color:#8C7B6E">
                <span class="px-2 py-0.5 rounded font-medium" style="background:#F2E8DA; color:#5E4230">${t.course_name}</span>
                ${t.deadline ? `<span class="text-rose-600 font-semibold font-mono">⏰ Deadline: ${t.deadline}</span>` : ''}
              </div>
            </div>
          </div>
          <button onclick="TPBApp.deleteTask('${t.id}')" class="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg text-xs" title="Hapus Catatan">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;
  },

  openAddTaskModal(prefillCourse = '') {
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskCourse').value = prefillCourse || '';
    document.getElementById('taskDeadline').value = '';
    document.getElementById('taskNotes').value = '';

    const scopeBadge = document.getElementById('taskModalScopeBadge');
    if (scopeBadge) {
      scopeBadge.textContent = Auth.isAdmin() ? 'TUGAS RESMI KELAS (ADMIN)' : 'TUGAS PRIBADI';
    }

    const modal = document.getElementById('addTaskModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeAddTaskModal() {
    const modal = document.getElementById('addTaskModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  async saveTask() {
    const title = document.getElementById('taskTitle').value.trim();
    if (!title) {
      alert('Judul tugas wajib diisi!');
      return;
    }

    const course = document.getElementById('taskCourse').value.trim() || 'Umum';
    const deadline = document.getElementById('taskDeadline').value;
    const notes = document.getElementById('taskNotes').value.trim();

    if (Auth.isAdmin()) {
      // Save globally for class
      try {
        const res = await Auth.authFetch('/api/admin/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            class_name: this.data.currentClass,
            title: title,
            course_name: course,
            deadline: deadline,
            notes: notes
          })
        });
        if (!res.ok) throw new Error('Gagal menyimpan tugas kelas.');
        this.closeAddTaskModal();
        await this.refreshClassData();
        this.renderTasks();
        alert('Tugas berhasil disiarkan ke seluruh anggota kelas.');
      } catch (e) {
        alert(e.message);
      }
    } else {
      // Save personally in localStorage
      window.TaskManager.addTask({
        title: title,
        course_name: course,
        deadline: deadline,
        notes: notes
      });
      this.closeAddTaskModal();
      this.renderTasks();
    }
  },

  async deleteAdminTask(taskId) {
    if (!confirm('Hapus tugas kelas ini?')) return;
    try {
      const res = await Auth.authFetch(`/api/admin/task/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        await this.refreshClassData();
        this.renderTasks();
      }
    } catch (e) {
      alert(e.message);
    }
  },

  toggleTask(taskId) {
    window.TaskManager.toggleTask(taskId);
    this.renderTasks();
  },

  deleteTask(taskId) {
    window.TaskManager.deleteTask(taskId);
    this.renderTasks();
  },

  // ─────────────────────────────────────────────
  // CHANGE PASSWORD
  // ─────────────────────────────────────────────

  openChangePasswordModal() {
    document.getElementById('oldPwInput').value = '';
    document.getElementById('newPwInput').value = '';
    const msgEl = document.getElementById('changePwMsg');
    if (msgEl) msgEl.classList.add('hidden');

    const modal = document.getElementById('changePasswordModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeChangePasswordModal() {
    const modal = document.getElementById('changePasswordModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  async submitChangePassword() {
    const oldPassword = document.getElementById('oldPwInput').value;
    const newPassword = document.getElementById('newPwInput').value;
    const msgEl = document.getElementById('changePwMsg');

    if (!oldPassword || !newPassword) {
      alert('Semua field wajib diisi.');
      return;
    }

    try {
      const res = await Auth.authFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Gagal mengubah password.');
      }

      msgEl.className = 'p-3 rounded-xl text-xs bg-emerald-50 text-emerald-800 border border-emerald-200';
      msgEl.textContent = 'Password berhasil diubah!';
      msgEl.classList.remove('hidden');
      setTimeout(() => this.closeChangePasswordModal(), 1200);
    } catch (e) {
      msgEl.className = 'p-3 rounded-xl text-xs bg-rose-50 text-rose-800 border border-rose-200';
      msgEl.textContent = e.message;
      msgEl.classList.remove('hidden');
    }
  },

  // ─────────────────────────────────────────────
  // USER MANAGEMENT (Super Admin)
  // ─────────────────────────────────────────────

  async openUserManagementModal() {
    if (!Auth.isSuperAdmin()) return;
    const modal = document.getElementById('userManagementModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    await this.loadAllUsers();
  },

  closeUserManagementModal() {
    const modal = document.getElementById('userManagementModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  async loadAllUsers() {
    const container = document.getElementById('userListContainer');
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">Memuat data user...</div>';

    try {
      const res = await Auth.authFetch('/api/admin/users');
      if (res.ok) {
        const json = await res.json();
        this.data.allUsers = json.users || [];
        this.renderUserList(this.data.allUsers);
      }
    } catch (e) {
      container.innerHTML = `<div class="p-6 text-center text-xs text-rose-500">${e.message}</div>`;
    }
  },

  filterUserList() {
    const q = (document.getElementById('userFilterInput').value || '').trim().toLowerCase();
    const filtered = this.data.allUsers.filter(u => {
      return (u.nim || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q) || (u.class_name || '').toLowerCase().includes(q);
    });
    this.renderUserList(filtered);
  },

  renderUserList(users) {
    const container = document.getElementById('userListContainer');
    if (!container) return;

    if (users.length === 0) {
      container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">Tidak ada user ditemukan.</div>';
      return;
    }

    let html = '';
    users.forEach(u => {
      html += `
        <div class="p-3 rounded-xl border flex items-center justify-between gap-3 text-xs" style="background:#FFFBF7; border-color:#E8D5C0">
          <div>
            <p class="font-bold" style="color:#2C1A0E">${u.name}</p>
            <p class="text-[11px]" style="color:#8C7B6E">NIM: ${u.nim} • ${u.class_name || '-'} • ${u.prodi || '-'}</p>
          </div>
          <div class="flex items-center gap-2">
            <select onchange="TPBApp.changeUserRole('${u.nim}', this.value)" class="px-2 py-1 rounded-lg border text-xs font-semibold outline-none" style="background:#F2E8DA; border-color:#E8D5C0; color:#5E4230">
              <option value="member" ${u.role === 'member' ? 'selected' : ''}>Member</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin (Ketua/PJ)</option>
              <option value="super_admin" ${u.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>
            </select>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  },

  async changeUserRole(nim, newRole) {
    try {
      const res = await Auth.authFetch(`/api/admin/users/${nim}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) throw new Error('Gagal mengubah role.');
      alert(`Role ${nim} berhasil diubah menjadi ${newRole.toUpperCase()}.`);
      await this.loadAllUsers();
    } catch (e) {
      alert(e.message);
    }
  },

  // ─────────────────────────────────────────────
  // CORE CATALOG & OTHER VIEWS
  // ─────────────────────────────────────────────

  renderCoreCatalog(searchQuery = '') {
    const container = document.getElementById('coreCatalogContainer');
    if (!container) return;

    let coreSchedules = this.data.masterSchedule.filter(s => s.sheet === 'CORE PRODI');

    if (coreSchedules.length === 0) {
      container.innerHTML = '<div class="p-8 text-center text-slate-400">Tidak ada data Core Prodi.</div>';
      return;
    }

    const q = (searchQuery || '').trim().toLowerCase();
    if (q) {
      coreSchedules = coreSchedules.filter(s => {
        return (s.prodi || '').toLowerCase().includes(q) ||
               (s.course_name || '').toLowerCase().includes(q) ||
               (s.course_code || '').toLowerCase().includes(q) ||
               (s.class_name || '').toLowerCase().includes(q) ||
               (s.lecturer || '').toLowerCase().includes(q) ||
               (s.room || '').toLowerCase().includes(q) ||
               (s.day || '').toLowerCase().includes(q);
      });
    }

    const groupedProdi = {};
    coreSchedules.forEach(item => {
      const p = item.prodi || 'Lainnya';
      if (!groupedProdi[p]) groupedProdi[p] = [];
      groupedProdi[p].push(item);
    });

    const totalMatches = coreSchedules.length;

    let html = `
      <div class="glass-card p-4 rounded-2xl space-y-3 shadow-sm mb-4 border border-[#E8D5C0]" style="background:#FFFBF7">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="font-bold text-base" style="color:#2C1A0E">Katalog Lengkap Jadwal Core Prodi</h3>
            <p class="text-xs" style="color:#8C7B6E">Daftar seluruh jadwal mata kuliah keilmuan pengantar program studi semester gasal.</p>
          </div>
          <span class="text-xs font-bold px-3 py-1 rounded-full" style="background:#F2E8DA; color:#7C5C40">
            ${totalMatches} Kelas Ditemukan
          </span>
        </div>

        <div class="relative">
          <i class="fas fa-search absolute left-3.5 top-3 text-xs" style="color:#B89070"></i>
          <input 
            type="text" 
            id="coreCatalogSearchInput" 
            value="${searchQuery}" 
            placeholder="Cari Program Studi (misal: Informatika, Sipil, Fisika), Nama Matkul, Dosen, atau Ruangan..." 
            class="w-full pl-9 pr-4 py-2 text-xs rounded-xl outline-none transition-all shadow-inner"
            style="background:#F2E8DA; color:#2C1A0E; border:1px solid #E8D5C0"
          >
        </div>
      </div>
      <div class="space-y-4">
    `;

    if (totalMatches === 0) {
      html += `
        <div class="p-12 text-center rounded-2xl border" style="background:#FFFBF7; border-color:#E8D5C0">
          <i class="fas fa-search text-3xl mb-2" style="color:#B89070"></i>
          <h4 class="font-bold text-xs sm:text-sm" style="color:#5E4230">Tidak ada jadwal Core Prodi yang cocok</h4>
          <p class="text-xs mt-1" style="color:#8C7B6E">Coba gunakan kata kunci pencarian lain.</p>
        </div>
      `;
    } else {
      Object.keys(groupedProdi).sort().forEach(prodiName => {
        const items = groupedProdi[prodiName].sort((a, b) => timeToMinutes24(a.start_time) - timeToMinutes24(b.start_time));
        html += `
          <div class="glass-card p-4 rounded-2xl border border-[#E8D5C0]" style="background:#FFFBF7">
            <div class="flex items-center justify-between pb-2 mb-3 border-b border-[#E8D5C0]">
              <h4 class="font-bold text-xs sm:text-sm flex items-center gap-2" style="color:#2C1A0E">
                <span class="w-2.5 h-2.5 rounded-full" style="background:#7C5C40"></span>
                ${prodiName}
              </h4>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full" style="background:#F2E8DA; color:#7C5C40">
                ${items.length} Kelas
              </span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        `;

        items.forEach(item => {
          html += `
            <div class="p-3 rounded-xl border border-[#E8D5C0]" style="background:#FFFBF7">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="font-bold" style="color:#7C5C40">${item.class_name}</span>
                <span class="text-[11px]" style="color:#8C7B6E">${item.sks} SKS</span>
              </div>
              <p class="font-bold text-xs" style="color:#2C1A0E">${item.course_name} (${item.course_code || '-'})</p>
              <p class="text-xs mt-1 font-mono font-semibold" style="color:#5E4230">
                <i class="far fa-clock text-[10px] mr-1" style="color:#7C5C40"></i> ${item.day || '-'}, ${format24h(item.start_time)} - ${format24h(item.end_time)} WIB
              </p>
              <p class="text-[11px] mt-0.5" style="color:#8C7B6E">
                <i class="fas fa-map-marker-alt text-[10px] mr-1"></i> ${item.room || '-'}
              </p>
            </div>
          `;
        });

        html += `</div></div>`;
      });
    }

    html += `</div>`;
    container.innerHTML = html;

    const searchInput = document.getElementById('coreCatalogSearchInput');
    if (searchInput) {
      let timeout = null;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const val = e.target.value;
        timeout = setTimeout(() => {
          this.renderCoreCatalog(val);
          const newInput = document.getElementById('coreCatalogSearchInput');
          if (newInput) {
            newInput.focus();
            newInput.setSelectionRange(val.length, val.length);
          }
        }, 150);
      });
    }
  },

  async renderClassmates() {
    const container = document.getElementById('classmatesListContainer');
    if (!container) return;

    container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">Memuat daftar anggota kelas...</div>';

    try {
      const res = await fetch(`/api/classmates/${encodeURIComponent(this.data.currentClass)}`);
      const json = await res.json();
      const students = json.students || [];

      if (students.length === 0) {
        container.innerHTML = `
          <div class="p-8 text-center text-xs text-slate-400">
            <p>Data mahasiswa untuk ${this.data.currentClass} belum terdaftar.</p>
          </div>
        `;
        return;
      }

      let html = `
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold text-sm" style="color:#2C1A0E">Daftar Mahasiswa ${this.data.currentClass} (${students.length} Mahasiswa)</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
      `;

      students.forEach((s, idx) => {
        html += `
          <div class="p-3 rounded-xl border flex items-center justify-between" style="background:#FFFBF7; border-color:#E8D5C0">
            <div class="flex items-center gap-2.5">
              <span class="text-xs font-bold text-slate-400 w-5 text-right">${idx + 1}.</span>
              <div>
                <p class="font-bold text-xs" style="color:#2C1A0E">${s.name}</p>
                <p class="text-[11px]" style="color:#8C7B6E">${s.nim} • ${s.prodi}</p>
                ${s.core1 ? `<span class="text-[10px] font-semibold" style="color:#7C5C40">Core: Kelas ${s.core1}</span>` : ''}
              </div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
      container.innerHTML = html;
    } catch (e) {
      console.error(e);
    }
  },

  searchRoomSchedule(selectedRoom) {
    const room = selectedRoom || (this.dropdownInstances.room ? this.dropdownInstances.room.getValue() : '');
    const resultsContainer = document.getElementById('roomResultsContainer');
    if (!room) {
      resultsContainer.innerHTML = '<div class="p-4 text-xs text-slate-400 text-center">Silakan pilih ruangan</div>';
      return;
    }

    const matches = window.SearchTools.searchByRoom(this.data.masterSchedule, room).sort((a, b) => timeToMinutes24(a.start_time) - timeToMinutes24(b.start_time));
    if (matches.length === 0) {
      resultsContainer.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Tidak ada jadwal pemakaian di ruangan <b>${room}</b>.</div>`;
      return;
    }

    let html = `
      <div class="mb-3 flex items-center justify-between">
        <h4 class="font-bold text-sm" style="color:#2C1A0E">Jadwal Pemakaian Ruangan: ${room} (${matches.length} Kelas)</h4>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
    `;

    matches.forEach(item => {
      html += `
        <div class="p-3 rounded-xl border" style="background:#FFFBF7; border-color:#E8D5C0">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="font-bold font-mono" style="color:#7C5C40">${item.day}, ${format24h(item.start_time)} - ${format24h(item.end_time)} WIB</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background:#F2E8DA; color:#5E4230">${item.class_name}</span>
          </div>
          <p class="font-bold text-xs" style="color:#2C1A0E">${item.course_name}</p>
          <p class="text-[11px]" style="color:#8C7B6E">${item.lecturer || 'Dosen -'}</p>
        </div>
      `;
    });

    html += `</div>`;
    resultsContainer.innerHTML = html;
  },

  searchLecturerSchedule() {
    const query = document.getElementById('lecturerSearchInput').value;
    const resultsContainer = document.getElementById('lecturerResultsContainer');
    if (!query || query.trim().length < 2) {
      resultsContainer.innerHTML = '<div class="p-4 text-xs text-slate-400 text-center">Ketik minimal 2 huruf nama dosen</div>';
      return;
    }

    const matches = window.SearchTools.searchByLecturer(this.data.masterSchedule, query).sort((a, b) => timeToMinutes24(a.start_time) - timeToMinutes24(b.start_time));
    if (matches.length === 0) {
      resultsContainer.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Dosen tidak ditemukan.</div>`;
      return;
    }

    let html = `
      <div class="mb-3 flex items-center justify-between">
        <h4 class="font-bold text-sm" style="color:#2C1A0E">Jadwal Mengajar Dosen (${matches.length} Kelas Ditemukan)</h4>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
    `;

    matches.forEach(item => {
      html += `
        <div class="p-3 rounded-xl border" style="background:#FFFBF7; border-color:#E8D5C0">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="font-bold font-mono" style="color:#7C5C40">${item.day}, ${format24h(item.start_time)} - ${format24h(item.end_time)} WIB</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background:#F2E8DA; color:#5E4230">${item.class_name}</span>
          </div>
          <p class="font-bold text-xs" style="color:#2C1A0E">${item.course_name}</p>
          <p class="text-[11px]" style="color:#8C7B6E">📍 Ruang: ${item.room || '-'}</p>
          <p class="text-[11px] font-medium" style="color:#7C5C40">👨‍🏫 ${item.lecturer}</p>
        </div>
      `;
    });

    html += `</div>`;
    resultsContainer.innerHTML = html;
  },

  async searchStudents(query) {
    const resultsContainer = document.getElementById('studentSearchResults');
    if (!resultsContainer) return;

    if (!query || query.trim().length < 2) {
      resultsContainer.classList.add('hidden');
      return;
    }

    try {
      const res = await fetch(`/api/student/search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      const results = json.results || [];

      if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="p-3 text-xs text-slate-400 text-center">Mahasiswa tidak ditemukan</div>';
      } else {
        let html = '';
        results.forEach(s => {
          html += `
            <div class="p-2.5 hover:bg-[#F2E8DA] cursor-pointer border-b border-[#E8D5C0] flex items-center justify-between text-xs">
              <div>
                <p class="font-bold" style="color:#2C1A0E">${s.name}</p>
                <p class="text-[11px]" style="color:#8C7B6E">NIM: ${s.nim} • ${s.prodi}</p>
              </div>
              <span class="text-xs font-bold px-2 py-0.5 rounded" style="background:#F2E8DA; color:#7C5C40">
                ${s.tpb_class || 'TPB -'}
              </span>
            </div>
          `;
        });
        resultsContainer.innerHTML = html;
      }
      resultsContainer.classList.remove('hidden');
    } catch (e) {
      console.error(e);
    }
  },

  // ─────────────────────────────────────────────
  // ADD CLASS MODAL (Admin)
  // ─────────────────────────────────────────────

  openAddClassModal() {
    if (!Auth.isAdmin()) {
      alert('Hanya Admin yang dapat menambah jadwal.');
      return;
    }
    // Reset semua field
    document.getElementById('newCourseName').value = '';
    document.getElementById('newCategory').value = 'Kuliah';
    document.getElementById('newDay').value = 'Senin';
    document.getElementById('newStartTime').value = '08:00';
    document.getElementById('newEndTime').value = '09:40';
    document.getElementById('newRoom').value = '';
    document.getElementById('newLecturer').value = '';
    document.getElementById('newNote').value = '';
    document.getElementById('newTutorialClass').value = '';
    document.getElementById('newTutorialProdi').value = '';
    // Sembunyikan extra fields
    document.getElementById('tutorialExtraFields').classList.add('hidden');

    const modal = document.getElementById('addClassModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  },

  closeAddClassModal() {
    const modal = document.getElementById('addClassModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  },

  onNewCategoryChange() {
    const cat = document.getElementById('newCategory').value;
    const extraFields = document.getElementById('tutorialExtraFields');
    const showExtra = ['Tutorial', 'Core Prodi'].includes(cat);
    if (showExtra) {
      extraFields.classList.remove('hidden');
    } else {
      extraFields.classList.add('hidden');
      document.getElementById('newTutorialClass').value = '';
      document.getElementById('newTutorialProdi').value = '';
    }
  },

  async saveNewClass() {
    const courseName = document.getElementById('newCourseName').value.trim();
    if (!courseName) {
      alert('Nama mata kuliah / sesi wajib diisi!');
      return;
    }

    const category    = document.getElementById('newCategory').value;
    const day         = document.getElementById('newDay').value;
    const startTime   = document.getElementById('newStartTime').value.trim();
    const endTime     = document.getElementById('newEndTime').value.trim();
    const room        = document.getElementById('newRoom').value.trim();
    const lecturer    = document.getElementById('newLecturer').value.trim();
    const note        = document.getElementById('newNote').value.trim();
    const tutorClass  = document.getElementById('newTutorialClass').value.trim();
    const tutorProdi  = document.getElementById('newTutorialProdi').value.trim();

    if (!startTime || !endTime) {
      alert('Jam mulai dan jam selesai wajib diisi!');
      return;
    }

    try {
      const res = await Auth.authFetch('/api/admin/schedule/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          class_name:    this.data.currentClass,
          course_name:   courseName,
          category:      category,
          day:           day,
          start_time:    startTime,
          end_time:      endTime,
          room:          room || null,
          lecturer:      lecturer || null,
          note:          note || null,
          tutorial_class: tutorClass || null,
          prodi:          tutorProdi || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Gagal menambah jadwal.');
      }

      this.closeAddClassModal();
      await this.refreshClassData();
      this.render();
      alert(`Jadwal "${courseName}" berhasil ditambahkan ke ${this.data.currentClass}.`);
    } catch (e) {
      alert(e.message);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  TPBApp.init();
});
