'use client';
// Chọn răng theo ký hiệu FDI (A15): răng vĩnh viễn 11–48, răng sữa 51–85, hoặc cả vùng
import { useState } from 'react';
import { VUNG_RANG } from '@/lib/nhan';

const VINH_VIEN = [
  [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
];
const RANG_SUA = [
  [null, null, null, 55, 54, 53, 52, 51, 61, 62, 63, 64, 65, null, null, null],
  [null, null, null, 85, 84, 83, 82, 81, 71, 72, 73, 74, 75, null, null, null],
];

export default function RangPicker({ value, onChange }) {
  const [sua, setSua] = useState(value && Number(value) >= 51);
  const bang = sua ? RANG_SUA : VINH_VIEN;
  return (
    <div>
      <div className="gap mb">
        <label className="check"><input type="radio" checked={!sua} onChange={() => setSua(false)} /> Răng vĩnh viễn</label>
        <label className="check"><input type="radio" checked={sua} onChange={() => setSua(true)} /> Răng sữa</label>
        <span className="spacer" />
        {Object.entries(VUNG_RANG).map(([ma, ten]) => (
          <button type="button" key={ma} className={`btn btn-sm ${value === ma ? 'btn-primary' : ''}`} onClick={() => onChange(ma)}>{ten}</button>
        ))}
      </div>
      <div className="small muted" style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 528 }}><span>Phải bệnh nhân</span><span>Hàm trên</span><span>Trái bệnh nhân</span></div>
      <div className="rang-chart">
        {bang[0].map((r, i) => <RangBtn key={`t${i}`} r={r} value={value} onChange={onChange} />)}
        <div className="vach" />
        {bang[1].map((r, i) => <RangBtn key={`d${i}`} r={r} value={value} onChange={onChange} />)}
      </div>
      <div className="small muted center" style={{ maxWidth: 528 }}>Hàm dưới</div>
    </div>
  );
}

function RangBtn({ r, value, onChange }) {
  if (!r) return <span className="rang trong" />;
  return (
    <button type="button" className={`rang ${String(value) === String(r) ? 'chon' : ''}`} onClick={() => onChange(String(r))}>{r}</button>
  );
}
