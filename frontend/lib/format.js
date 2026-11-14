// Định dạng tiền, ngày giờ theo kiểu Việt Nam

const nf = new Intl.NumberFormat('vi-VN');

export const tien = (n) => (n === null || n === undefined || n === '' ? '—' : `${nf.format(Math.round(Number(n)))} đ`);
export const so = (n) => (n === null || n === undefined ? '—' : nf.format(Number(n)));
export const pct = (n) => (n === null || n === undefined ? '—' : `${n > 0 ? '+' : ''}${nf.format(n)}%`);

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** 'YYYY-MM-DD' → 'dd/mm/yyyy' */
export function ngay(s, coThu = false) {
  if (!s) return '—';
  const [y, m, d] = String(s).slice(0, 10).split('-');
  const txt = `${d}/${m}/${y}`;
  if (!coThu) return txt;
  return `${THU[new Date(`${s.slice(0, 10)}T00:00:00`).getDay()]}, ${txt}`;
}

/** '09:30:00' → '09:30' */
export const gio = (s) => (s ? String(s).slice(0, 5) : '—');

/** timestamptz → 'dd/mm/yyyy HH:MM' giờ Việt Nam */
export function thoiDiem(s) {
  if (!s) return '—';
  return new Date(s).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** Ngày hôm nay theo giờ Việt Nam, dạng 'YYYY-MM-DD' (cộng thêm n ngày) */
export function homNay(n = 0) {
  const d = new Date(Date.now() + 7 * 3600 * 1000 + n * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

export function congNgay(s, n) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Thứ Hai của tuần chứa ngày s */
export function dauTuan(s) {
  const d = new Date(`${s}T00:00:00Z`);
  const thu = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - thu);
  return d.toISOString().slice(0, 10);
}

export const thangNay = () => homNay().slice(0, 7);
