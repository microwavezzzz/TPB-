// Calendar Integration & Live Class Countdown Module
window.CalendarManager = {
  DAY_MAP: {
    'senin': 1,
    'selasa': 2,
    'rabu': 3,
    'kamis': 4,
    'jumat': 5,
    'jum\'at': 5,
    'sabtu': 6,
    'minggu': 7
  },

  format24h(timeStr) {
    if (!timeStr) return '';
    const clean = timeStr.toString().trim().replace('.', ':');
    const match = clean.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = match[2];
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    return timeStr;
  },

  timeToMinutes(timeStr) {
    if (!timeStr) return 9999;
    const formatted = this.format24h(timeStr);
    const parts = formatted.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        return h * 60 + m;
      }
    }
    return 9999;
  },

  generateICS(schedules, className = 'TPB') {
    let ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TPB Schedule Portal//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:Jadwal Kuliah ${className}`,
      'X-WR-TIMEZONE:Asia/Jakarta'
    ];

    const today = new Date();

    schedules.forEach(item => {
      const start24 = this.format24h(item.start_time);
      const end24 = this.format24h(item.end_time);
      if (!item.day || !start24 || !end24) return;

      const dayKey = item.day.toLowerCase();
      const targetDayNum = this.DAY_MAP[dayKey];
      if (!targetDayNum) return;

      const currentDayNum = (today.getDay() === 0) ? 7 : today.getDay();
      let diffDays = targetDayNum - currentDayNum;
      if (diffDays < 0) diffDays += 7;

      const eventDate = new Date(today);
      eventDate.setDate(today.getDate() + diffDays);

      const [startH, startM] = start24.split(':');
      const [endH, endM] = end24.split(':');

      const dtStart = new Date(eventDate);
      dtStart.setHours(parseInt(startH), parseInt(startM), 0, 0);

      const dtEnd = new Date(eventDate);
      dtEnd.setHours(parseInt(endH), parseInt(endM), 0, 0);

      const formatICSDate = (d) => {
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      const uid = `tpb-${item.id}-${Math.random().toString(36).substr(2, 6)}@tpbschedule.id`;
      const summary = `${item.course_name} (${item.class_name || className})`;
      const location = item.room || 'Kampus TPB ITERA';
      const description = `Waktu: ${start24} - ${end24} WIB\\nDosen: ${item.lecturer || '-'}\\nSKS: ${item.sks || '-'}\\nKode MK: ${item.course_code || '-'}\\nLink: ${item.link || '-'}`;

      ics.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatICSDate(new Date())}`,
        `DTSTART:${formatICSDate(dtStart)}`,
        `DTEND:${formatICSDate(dtEnd)}`,
        'RRULE:FREQ=WEEKLY;COUNT=16',
        `SUMMARY:${summary}`,
        `LOCATION:${location}`,
        `DESCRIPTION:${description}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Pengingat Kuliah (15 Menit): ${item.course_name}`,
        'END:VALARM',
        'END:VEVENT'
      );
    });

    ics.push('END:VCALENDAR');
    return ics.join('\r\n');
  },

  downloadICS(schedules, className = 'TPB') {
    const icsData = this.generateICS(schedules, className);
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `Jadwal_${className.replace(/\s+/g, '_')}_Semester_Gasal.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  getTodayStatus(schedules) {
    const now = new Date();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const currentDayName = dayNames[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const todaySchedules = schedules.filter(s => {
      if (!s.day) return false;
      const d = s.day.toLowerCase();
      return d === currentDayName.toLowerCase() || (currentDayName === 'Jumat' && d.includes('jum'));
    }).sort((a, b) => {
      return this.timeToMinutes(a.start_time) - this.timeToMinutes(b.start_time);
    });

    let ongoing = null;
    let nextUp = null;

    for (const item of todaySchedules) {
      const startMin = this.timeToMinutes(item.start_time);
      const endMin = this.timeToMinutes(item.end_time);

      if (startMin !== null && endMin !== null) {
        if (currentMinutes >= startMin && currentMinutes <= endMin) {
          ongoing = { item, endsInMinutes: endMin - currentMinutes };
        } else if (currentMinutes < startMin && !nextUp) {
          nextUp = { item, startsInMinutes: startMin - currentMinutes };
        }
      }
    }

    return {
      currentDay: currentDayName,
      todaySchedules,
      ongoing,
      nextUp
    };
  }
};
