// Conflict Detector Module
window.ConflictDetector = {
  // Convert "08:00" to minutes from midnight
  timeToMinutes(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
  },

  // Check if two schedule items overlap on the same day
  isOverlapping(itemA, itemB) {
    if (!itemA.day || !itemB.day) return false;
    if (itemA.day.toLowerCase() !== itemB.day.toLowerCase()) return false;
    if (itemA.id === itemB.id) return false;

    // ATURAN KHUSUS: Studium Generale = cari seminar mandiri, waktu fleksibel
    // → tidak pernah dianggap bentrok dengan jadwal apapun
    const FLEKSIBEL = ['studium generale', 'stadium generale'];
    const nameA = (itemA.course_name || '').toLowerCase();
    const nameB = (itemB.course_name || '').toLowerCase();
    if (FLEKSIBEL.some(k => nameA.includes(k)) || FLEKSIBEL.some(k => nameB.includes(k))) {
      return false;
    }

    // Ekstraksi Tipe Kelas (A, B, C, D, RA, RB, dll)
    const extractClassType = (item) => {
      if (item.core_class) return String(item.core_class).toUpperCase().trim();
      if (item.tutorial_class) return String(item.tutorial_class).toUpperCase().trim();
      const name = item.class_name || '';
      const match = name.match(/kelas\s+([A-Za-z0-9]+)/i) || name.match(/\b(R[A-Z0-9]+)\b/i);
      return match ? match[1].toUpperCase() : '';
    };

    const classA = extractClassType(itemA);
    const classB = extractClassType(itemB);

    // ATURAN 1: Jika keduanya memiliki tipe kelas berbeda (A vs B vs C vs D) -> Mahasiswa berbeda -> TIDAK BENTROK
    if (classA && classB && classA !== classB) {
      return false;
    }

    // Ekstraksi Program Studi Spesifik
    const extractProdi = (item) => {
      const p = String(item.prodi || item.core_prodi_name || '').toLowerCase();
      if (p.includes('sains data') && !p.includes('energi')) return 'sains data';
      if ((p.includes('sistem energi') || p.includes('energi')) && !p.includes('sains data')) return 'teknik sistem energi';
      return p.trim();
    };

    const prodiA = extractProdi(itemA);
    const prodiB = extractProdi(itemB);

    // ATURAN 2: Jika prodi spesifik berbeda (Sains Data vs TSE) -> Anggota berbeda -> TIDAK BENTROK
    if (prodiA && prodiB && prodiA !== prodiB) {
      return false;
    }

    const startA = this.timeToMinutes(itemA.start_time);
    const endA   = this.timeToMinutes(itemA.end_time);
    const startB = this.timeToMinutes(itemB.start_time);
    const endB   = this.timeToMinutes(itemB.end_time);

    if (startA === null || endA === null || startB === null || endB === null) return false;

    // Overlap condition: startA < endB and startB < endA
    return startA < endB && startB < endA;
  },

  // Detect all conflicts within a list of schedules
  detectConflicts(schedules) {
    const conflicts = new Map(); // id -> array of conflicting items

    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const a = schedules[i];
        const b = schedules[j];
        if (this.isOverlapping(a, b)) {
          if (!conflicts.has(a.id)) conflicts.set(a.id, []);
          if (!conflicts.has(b.id)) conflicts.set(b.id, []);
          conflicts.get(a.id).push(b);
          conflicts.get(b.id).push(a);
        }
      }
    }
    return conflicts;
  }
};
