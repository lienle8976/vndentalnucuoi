'use client';
// Chọn ca lễ tân để gắn phiếu thu (A25: chốt két theo ca)
import { useEffect } from 'react';
import { useData } from '@/lib/api';
import { ngay, gio } from '@/lib/format';

export default function ChonCa({ value, onChange, chiCaMo = true }) {
  const { data } = useData('/ca-truc/le-tan');
  const ds = (data ?? []).filter((c) => !chiCaMo || !c.da_chot_ket);

  useEffect(() => {
    if (!value && ds.length) onChange((ds.find((c) => c.dang_dien_ra) ?? ds[0]).id);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (data && !ds.length) return <span className="text-do small">Không có ca lễ tân nào đang mở (7 ngày gần nhất). Quản lý cần xếp ca.</span>;
  return (
    <select value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))}>
      {ds.map((c) => (
        <option key={c.id} value={c.id}>
          {ngay(c.ngay)} · {c.ten_ca} {gio(c.gio_bat_dau)}–{gio(c.gio_ket_thuc)} · {c.ho_ten}{c.dang_dien_ra ? ' (đang diễn ra)' : ''}{c.da_chot_ket ? ' · đã chốt' : ''}
        </option>
      ))}
    </select>
  );
}
