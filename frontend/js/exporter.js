// Exporter Module (Lockscreen Wallpaper, Print, Image)
window.ScheduleExporter = {
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

  generateWallpaper(schedules, className = 'TPB 44') {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 2400;
    const ctx = canvas.getContext('2d');
    const isDarkTheme = document.documentElement.classList.contains('dark');
    const theme = isDarkTheme ? {
      start: '#1C130D',
      middle: '#261A12',
      end: '#3D2A1D',
      accent: '#D4A57A',
      heading: '#F5EFE6',
      muted: '#B9A090',
      line: 'rgba(212, 165, 122, 0.28)',
      card: 'rgba(42, 28, 19, 0.88)',
      body: '#F0E2D5',
      room: '#E8C3A0',
      footer: 'rgba(185, 160, 144, 0.72)',
      cardBorder: 'rgba(232, 195, 160, 0.18)',
      praktikum: '#D9826B',
      core: '#D4A57A',
      mkwu: '#86B58C'
    } : {
      start: '#F5EFE6',
      middle: '#FFFBF7',
      end: '#E8D5C0',
      accent: '#7C5C40',
      heading: '#2C1A0E',
      muted: '#8C7B6E',
      line: 'rgba(124, 92, 64, 0.22)',
      card: 'rgba(255, 251, 247, 0.82)',
      body: '#2C1A0E',
      room: '#5E4230',
      footer: 'rgba(94, 66, 48, 0.65)',
      cardBorder: 'rgba(124, 92, 64, 0.22)',
      praktikum: '#A85545',
      core: '#A08060',
      mkwu: '#527A5A'
    };

    const gradient = ctx.createLinearGradient(0, 0, 1080, 2400);
    gradient.addColorStop(0, theme.start);
    gradient.addColorStop(0.5, theme.middle);
    gradient.addColorStop(1, theme.end);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 2400);

    ctx.beginPath();
    ctx.moveTo(0, 520);
    ctx.lineTo(1080, 380);
    ctx.lineTo(1080, 520);
    ctx.lineTo(0, 660);
    ctx.closePath();
    ctx.fillStyle = isDarkTheme ? 'rgba(200, 149, 106, 0.10)' : 'rgba(124, 92, 64, 0.08)';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, 1980);
    ctx.lineTo(1080, 1840);
    ctx.lineTo(1080, 1980);
    ctx.lineTo(0, 2120);
    ctx.closePath();
    ctx.fillStyle = isDarkTheme ? 'rgba(232, 195, 160, 0.08)' : 'rgba(200, 149, 106, 0.10)';
    ctx.fill();

    // Header Title
    ctx.textAlign = 'center';
    ctx.fillStyle = theme.accent;
    ctx.font = '600 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('JADWAL KULIAH TPB GASAL 2026/2027', 540, 180);

    ctx.fillStyle = theme.heading;
    ctx.font = '800 68px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(className, 540, 270);

    ctx.fillStyle = theme.muted;
    ctx.font = '400 30px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Tahap Persiapan Bersama • ITERA', 540, 330);

    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 380);
    ctx.lineTo(980, 380);
    ctx.stroke();

    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const grouped = {};
    days.forEach(d => grouped[d] = []);

    schedules.forEach(item => {
      const d = item.day || 'Lainnya';
      const normDay = days.find(x => x.toLowerCase() === d.toLowerCase() || (x === 'Jumat' && d.toLowerCase().includes('jum')));
      if (normDay) {
        grouped[normDay].push(item);
      }
    });

    let currentY = 430;
    const cardWidth = 880;
    const startX = 100;

    days.forEach(day => {
      // Sort day items strictly chronologically
      const daySchedules = grouped[day].sort((a, b) => this.timeToMinutes(a.start_time) - this.timeToMinutes(b.start_time));
      if (!daySchedules || daySchedules.length === 0) return;

      // Day Header Badge
      ctx.textAlign = 'left';
      ctx.fillStyle = theme.accent;
      ctx.font = '700 38px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`📅 ${day.toUpperCase()}`, startX, currentY);
      currentY += 45;

      daySchedules.forEach(item => {
        const itemHeight = 135;
        ctx.fillStyle = theme.card;
        this.roundRect(ctx, startX, currentY, cardWidth, itemHeight, 20);
        ctx.fill();
        ctx.strokeStyle = theme.cardBorder;
        ctx.lineWidth = 2;
        ctx.stroke();

        let accentColor = theme.accent;
        if (item.category === 'Praktikum') accentColor = theme.praktikum;
        else if (item.category === 'Core Prodi') accentColor = theme.core;
        else if (item.category === 'MKWU') accentColor = theme.mkwu;

        ctx.fillStyle = accentColor;
        this.roundRect(ctx, startX, currentY, 12, itemHeight, { tl: 20, bl: 20, tr: 0, br: 0 });
        ctx.fill();

        ctx.fillStyle = theme.body;
        ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
        const courseText = item.course_name.length > 34 ? item.course_name.substr(0, 32) + '...' : item.course_name;
        ctx.fillText(courseText, startX + 35, currentY + 45);

        // Time in 24h & Room
        ctx.fillStyle = theme.accent;
        ctx.font = '600 26px "Plus Jakarta Sans", monospace';
        const sTime = this.format24h(item.start_time);
        const eTime = this.format24h(item.end_time);
        const timeStr = `${sTime || '-'} - ${eTime || '-'} WIB`;
        ctx.fillText(`🕒 ${timeStr}`, startX + 35, currentY + 85);

        ctx.fillStyle = theme.room;
        ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
        const roomStr = item.room ? `📍 ${item.room}` : '📍 -';
        ctx.fillText(roomStr.length > 22 ? roomStr.substr(0, 21) + '...' : roomStr, startX + 390, currentY + 85);

        ctx.fillStyle = theme.muted;
        ctx.font = '400 22px "Plus Jakarta Sans", sans-serif';
        const lecStr = item.lecturer ? `👨‍🏫 ${item.lecturer}` : '';
        if (lecStr) {
          ctx.fillText(lecStr.length > 48 ? lecStr.substr(0, 46) + '...' : lecStr, startX + 35, currentY + 118);
        }

        currentY += itemHeight + 16;
      });

      currentY += 25;
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = theme.footer;
    ctx.font = '400 22px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Generated with TPB Schedule Portal • Always Stay Ahead', 540, 2340);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Wallpaper_Jadwal_${className.replace(/\s+/g, '_')}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  roundRect(ctx, x, y, width, height, radius) {
    if (typeof radius === 'number') {
      radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
      radius = { tl: radius.tl || 0, tr: radius.tr || 0, br: radius.br || 0, bl: radius.bl || 0 };
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
  },

  printSchedule() {
    window.print();
  }
};
