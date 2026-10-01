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
    // --- Layout constants ---
    const W = 1080;
    const PAD_X = 64;
    const CARD_W = W - PAD_X * 2;
    const DAY_HEADER_H = 52;
    const DAY_HEADER_MB = 14;
    const CARD_H = 148;
    const CARD_MB = 14;
    const DAY_MB = 36;
    const HEADER_H = 290;
    const FOOTER_H = 90;
    const TOP_PAD = 70;
    const BOTTOM_PAD = 60;

    const isDarkTheme = document.documentElement.classList.contains('dark');
    const theme = isDarkTheme ? {
      start: '#1C130D', middle: '#261A12', end: '#3D2A1D',
      accent: '#D4A57A', heading: '#F5EFE6', muted: '#B9A090',
      line: 'rgba(212,165,122,0.28)', card: 'rgba(42,28,19,0.90)',
      body: '#F0E2D5', room: '#E8C3A0', footer: 'rgba(185,160,144,0.72)',
      cardBorder: 'rgba(232,195,160,0.20)', praktikum: '#D9826B',
      core: '#C4946A', mkwu: '#86B58C', dayText: '#1C130D'
    } : {
      start: '#F5EFE6', middle: '#FFFBF7', end: '#E8D5C0',
      accent: '#7C5C40', heading: '#2C1A0E', muted: '#8C7B6E',
      line: 'rgba(124,92,64,0.22)', card: 'rgba(255,251,247,0.94)',
      body: '#2C1A0E', room: '#5E4230', footer: 'rgba(94,66,48,0.65)',
      cardBorder: 'rgba(124,92,64,0.22)', praktikum: '#A85545',
      core: '#7C5C40', mkwu: '#527A5A', dayText: '#FFFBF7'
    };

    // --- Group and sort schedules by day ---
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const grouped = {};
    days.forEach(d => (grouped[d] = []));
    schedules.forEach(item => {
      const d = item.day || '';
      const normDay = days.find(
        x => x.toLowerCase() === d.toLowerCase() ||
             (x === 'Jumat' && d.toLowerCase().includes('jum'))
      );
      if (normDay) grouped[normDay].push(item);
    });
    days.forEach(d =>
      grouped[d].sort((a, b) => this.timeToMinutes(a.start_time) - this.timeToMinutes(b.start_time))
    );

    // --- Compute canvas height dynamically ---
    let contentH = 0;
    days.forEach(day => {
      const items = grouped[day];
      if (!items || items.length === 0) return;
      contentH += DAY_HEADER_H + DAY_HEADER_MB;
      contentH += items.length * (CARD_H + CARD_MB);
      contentH += DAY_MB;
    });
    const totalH = TOP_PAD + HEADER_H + contentH + FOOTER_H + BOTTOM_PAD;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = Math.max(totalH, 1920);
    const H = canvas.height;
    const ctx = canvas.getContext('2d');

    // --- Background ---
    const gradient = ctx.createLinearGradient(0, 0, W, H);
    gradient.addColorStop(0, theme.start);
    gradient.addColorStop(0.45, theme.middle);
    gradient.addColorStop(1, theme.end);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Subtle diagonal decoration bands
    const drawBand = (y1a, y1b, y2a, y2b, color) => {
      ctx.beginPath();
      ctx.moveTo(0, y1a); ctx.lineTo(W, y1b);
      ctx.lineTo(W, y2b); ctx.lineTo(0, y2a);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    };
    const bandColor = isDarkTheme ? 'rgba(200,149,106,0.07)' : 'rgba(124,92,64,0.06)';
    drawBand(TOP_PAD + HEADER_H - 40, TOP_PAD + HEADER_H - 70, TOP_PAD + HEADER_H + 30, TOP_PAD + HEADER_H, bandColor);

    // --- Header ---
    ctx.textAlign = 'center';

    ctx.fillStyle = theme.accent;
    ctx.font = '500 30px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('JADWAL KULIAH — GASAL 2026/2027', W / 2, TOP_PAD + 52);

    ctx.fillStyle = theme.heading;
    ctx.font = '800 82px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(className, W / 2, TOP_PAD + 152);

    ctx.fillStyle = theme.muted;
    ctx.font = '400 27px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('Tahap Persiapan Bersama \u2022 Institut Teknologi Sumatera', W / 2, TOP_PAD + 202);

    // Divider
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(PAD_X + 20, TOP_PAD + HEADER_H - 16);
    ctx.lineTo(W - PAD_X - 20, TOP_PAD + HEADER_H - 16);
    ctx.stroke();

    // --- Cards ---
    let curY = TOP_PAD + HEADER_H;

    days.forEach(day => {
      const items = grouped[day];
      if (!items || items.length === 0) return;

      // Day pill
      const pillW = 240;
      const pillH = 44;
      this.roundRect(ctx, PAD_X, curY, pillW, pillH, 12);
      ctx.fillStyle = theme.accent;
      ctx.fill();

      ctx.textAlign = 'left';
      ctx.fillStyle = theme.dayText;
      ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(day.toUpperCase(), PAD_X + 18, curY + 30);

      // Count badge on pill
      const countLabel = `${items.length}`;
      ctx.font = '700 17px "Plus Jakarta Sans", sans-serif';
      const countW = ctx.measureText(countLabel).width + 20;
      const countX = PAD_X + pillW - countW - 10;
      const countY = curY + (pillH - 28) / 2;
      this.roundRect(ctx, countX, countY, countW, 28, 7);
      ctx.fillStyle = isDarkTheme ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.35)';
      ctx.fill();
      ctx.fillStyle = theme.dayText;
      ctx.textAlign = 'center';
      ctx.fillText(countLabel, countX + countW / 2, countY + 20);

      curY += DAY_HEADER_H + DAY_HEADER_MB;

      items.forEach(item => {
        // Card body
        ctx.fillStyle = theme.card;
        this.roundRect(ctx, PAD_X, curY, CARD_W, CARD_H, 18);
        ctx.fill();
        ctx.strokeStyle = theme.cardBorder;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Accent sidebar
        let accentColor = theme.accent;
        if (item.category === 'Praktikum') accentColor = theme.praktikum;
        else if (item.category === 'Core Prodi') accentColor = theme.core;
        else if (item.category === 'MKWU') accentColor = theme.mkwu;

        ctx.fillStyle = accentColor;
        this.roundRect(ctx, PAD_X, curY, 10, CARD_H, { tl: 18, bl: 18, tr: 0, br: 0 });
        ctx.fill();

        const IX = PAD_X + 26; // inner left
        const IW = CARD_W - 26; // inner width

        // Category badge (top-right corner)
        const catLabel = item.category || 'Kuliah';
        ctx.font = '600 19px "Plus Jakarta Sans", sans-serif';
        const catBW = ctx.measureText(catLabel).width + 22;
        const catBX = PAD_X + CARD_W - catBW - 14;
        const catBY = curY + 18;
        const catBH = 30;
        this.roundRect(ctx, catBX, catBY, catBW, catBH, 7);
        ctx.fillStyle = accentColor;
        ctx.globalAlpha = 0.15;
        ctx.fill();
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = accentColor;
        ctx.textAlign = 'center';
        ctx.fillText(catLabel, catBX + catBW / 2, catBY + catBH / 2 + 7);

        // Course name — truncated so it doesn't overlap category badge
        ctx.textAlign = 'left';
        ctx.fillStyle = theme.body;
        ctx.font = '700 29px "Plus Jakarta Sans", sans-serif';
        const maxNameW = catBX - IX - 12;
        ctx.fillText(this.truncateText(ctx, item.course_name || '-', maxNameW), IX, curY + 46);

        // Time (left)
        ctx.fillStyle = theme.accent;
        ctx.font = '600 25px "JetBrains Mono", "Courier New", monospace';
        const sTime = this.format24h(item.start_time) || '--:--';
        const eTime = this.format24h(item.end_time) || '--:--';
        ctx.fillText(`${sTime}  \u2013  ${eTime} WIB`, IX, curY + 88);

        // Room (right)
        ctx.fillStyle = theme.room;
        ctx.font = '600 23px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'right';
        const roomLabel = item.room || '-';
        ctx.fillText(this.truncateText(ctx, roomLabel, 260), PAD_X + CARD_W - 18, curY + 88);

        // Lecturer (bottom row)
        if (item.lecturer) {
          ctx.textAlign = 'left';
          ctx.fillStyle = theme.muted;
          ctx.font = '400 21px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(this.truncateText(ctx, item.lecturer, IW - 20), IX, curY + 126);
        }

        curY += CARD_H + CARD_MB;
      });

      curY += DAY_MB;
    });

    // --- Footer ---
    const footerLineY = H - BOTTOM_PAD - 46;
    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_X + 20, footerLineY);
    ctx.lineTo(W - PAD_X - 20, footerLineY);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = theme.footer;
    ctx.font = '400 21px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('TPB Schedule Portal \u2022 Institut Teknologi Sumatera \u2022 Gasal 2026/2027', W / 2, H - BOTTOM_PAD - 14);

    // --- Download ---
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Wallpaper_Jadwal_${className.replace(/\s+/g, '_')}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  truncateText(ctx, text, maxWidth) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '\u2026').width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t + '\u2026';
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
