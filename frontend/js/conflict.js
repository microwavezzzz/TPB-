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

    const startA = this.timeToMinutes(itemA.start_time);
    const endA = this.timeToMinutes(itemA.end_time);
    const startB = this.timeToMinutes(itemB.start_time);
    const endB = this.timeToMinutes(itemB.end_time);

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
