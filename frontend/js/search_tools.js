// Lecturer & Room Search Tools Module
window.SearchTools = {
  // Find all classes taught by a lecturer
  searchByLecturer(allSchedules, query) {
    if (!query || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    return allSchedules.filter(s => {
      const lec = (s.lecturer || '').toLowerCase();
      return lec.includes(q);
    });
  },

  // Find all classes in a specific room
  searchByRoom(allSchedules, roomName) {
    if (!roomName) return [];
    const r = roomName.toLowerCase().trim();
    return allSchedules.filter(s => {
      const room = (s.room || '').toLowerCase();
      return room.includes(r);
    }).sort((a, b) => {
      const dayOrder = { 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6 };
      const dayA = dayOrder[(a.day || '').toLowerCase()] || 99;
      const dayB = dayOrder[(b.day || '').toLowerCase()] || 99;
      if (dayA !== dayB) return dayA - dayB;
      return (a.start_time || '').localeCompare(b.start_time || '');
    });
  }
};
