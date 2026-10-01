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

    // Smart exclusion: skip pairs that are guaranteed to have different members.
    //
    // Two Core Prodi or Tutorial items are attended by different students if:
    //   1. They have different class types (A vs B vs C vs D), OR
    //   2. They are from different prodi / core_prodi_name
    //      (e.g. Sains Data vs Teknik Sistem Energi)
    //
    // A Core Prodi / Tutorial item CAN conflict with a jadwal umum because
    // every student also attends umum.
    const isGroupA = itemA.is_core_prodi || itemA.category === 'Core Prodi' || itemA.category === 'Tutorial';
    const isGroupB = itemB.is_core_prodi || itemB.category === 'Core Prodi' || itemB.category === 'Tutorial';

    if (isGroupA && isGroupB) {
      // Different class type (A / B / C / D) → different group of students → no conflict
      const classA = (itemA.core_class || itemA.tutorial_class || '').toUpperCase().trim();
      const classB = (itemB.core_class || itemB.tutorial_class || '').toUpperCase().trim();
      if (classA && classB && classA !== classB) return false;

      // Different prodi → completely different students → no conflict
      const prodiA = (itemA.prodi || itemA.core_prodi_name || '').toLowerCase().trim();
      const prodiB = (itemB.prodi || itemB.core_prodi_name || '').toLowerCase().trim();
      if (prodiA && prodiB && prodiA !== prodiB) return false;
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
