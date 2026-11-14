'use client';
// UC36 — Công nợ bệnh nhân; A22 — khách trả gộp: gợi ý chia vào các hóa đơn, cũ trước
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, useData } from '@/lib/api';
import { ngay, tien } from '@/lib/format';
import { LOAI_HD, HINH_THUC_TT } from '@/lib/nhan';
import ChonCa from '@/components/ChonCa';
import { PageHeader, Card, Loading, ErrorBox, Empty, Field, MoneyInput, chay } from '@/components/ui';

function ThuGop({ benhNhanId, onDone }) {
  const [soTien, setSoTien] = useState('');
  const [debounce, setDebounce] = useState('');
  const [hinhThuc, setHinhThuc] = useState('TIEN_MAT');
  const [maGd, setMaGd] = useState('');
  const [ca, setCa] = useState(null);
  useEffect(() => { const t = setTimeout(() => setDebounce(soTien), 300); return () => clearTimeout(t); }, [soTien]);
  const { data, reload } = useData(`/thanh-toan/cong-no/${benhNhanId}?so_tien=${debounce || 0}`);
  if (!data) return <Loading />;
  const tongNo = data.hoa_don.reduce((s, h) => s + h.con_no, 0);

  async function thu() {
    const r = await chay(() => api(`/thanh-toan/cong-no/${benhNhanId}/thu-gop`, {
      method: 'POST', body: { so_tien: soTien, hinh_thuc: hinhThuc, ma_giao_dich_ngan_hang: maGd, ca_truc_id: ca },
    }), 'Đã thu tiền và chia vào các hóa đơn');
    if (r) { setSoTien(''); reload(); onDone(); }
  }

  return (
    <Card title={`Công nợ — ${data.benh_nhan.ho_ten}`} actions={<Link className="btn btn-sm" href={`/benh-nhan/${benhNhanId}`}>Hồ sơ</Link>}>
      <table className="table"><thead><tr><th>Hóa đơn</th><th>Loại</th><th>Ngày</th><th className="num">Tổng</th><th className="num">Đã thu</th><th className="num">Còn nợ</th><th className="num">Thu lần này</th></tr></thead>
        <tbody>{data.hoa_don.map((h) => {
          const g = data.goi_y.find((x) => x.hoa_don_id === h.id);
          return (
            <tr key={h.id}><td><Link href={`/thanh-toan/hoa-don/${h.id}`}>{h.ma_hoa_don}</Link></td><td>{LOAI_HD[h.loai]}</td><td>{ngay(h.ngay_lap)}</td>
              <td className="num">{tien(h.tong_tien)}</td><td className="num">{tien(h.da_thu)}</td><td className="num text-do">{tien(h.con_no)}</td>
              <td className="num bold text-luc">{g ? tien(g.so_tien_thu) : ''}</td></tr>
          );
        })}</tbody>
        <tfoot><tr><td colSpan={5}>Tổng nợ</td><td className="num">{tien(tongNo)}</td><td className="num">{tien(data.goi_y.reduce((s, g) => s + g.so_tien_thu, 0))}</td></tr></tfoot>
      </table>
      {data.hoa_don.length > 0 && (
        <div className="form-grid mt">
          <Field label="Khách trả" hint="Chia vào các hóa đơn cũ nhất trước">
            <MoneyInput value={soTien} onChange={setSoTien} />
          </Field>
          <Field label="Hình thức">
            <select value={hinhThuc} onChange={(e) => setHinhThuc(e.target.value)}>
              {Object.entries(HINH_THUC_TT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          {hinhThuc === 'CHUYEN_KHOAN' && <Field label="Mã giao dịch"><input value={maGd} onChange={(e) => setMaGd(e.target.value)} /></Field>}
          <Field label="Ca lễ tân"><ChonCa value={ca} onChange={setCa} /></Field>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" disabled={!soTien || soTien > tongNo || !ca} onClick={thu}>Thu {tien(soTien || 0)}</button>
          </div>
        </div>
      )}
      {soTien > tongNo && <p className="text-do small">Số tiền vượt tổng nợ.</p>}
    </Card>
  );
}

export default function CongNo() {
  const { data, error, reload } = useData('/thanh-toan/cong-no');
  const [chon, setChon] = useState(null);
  const tong = data?.reduce((s, x) => s + x.tong_no, 0) ?? 0;
  return (
    <>
      <PageHeader title="Công nợ bệnh nhân" sub={data ? `${data.length} bệnh nhân còn nợ · tổng ${tien(tong)}` : ''} />
      <ErrorBox error={error} onRetry={reload} />
      <div className="grid-2">
        <Card>
          {!data ? <Loading /> : data.length === 0 ? <Empty text="Không có công nợ" /> : (
            <table className="table"><thead><tr><th>Bệnh nhân</th><th>SĐT</th><th className="num">Số HĐ</th><th>Nợ từ</th><th className="num">Tổng nợ</th></tr></thead>
              <tbody>{data.map((b) => (
                <tr key={b.benh_nhan_id} className="clickable" onClick={() => setChon(b.benh_nhan_id)} style={chon === b.benh_nhan_id ? { background: 'var(--primary-soft)' } : undefined}>
                  <td><b>{b.ho_ten}</b> <span className="muted small">{b.ma_benh_nhan}</span></td><td>{b.so_dien_thoai}</td>
                  <td className="num">{b.so_hoa_don_con_no}</td><td>{ngay(b.no_tu_ngay)}</td><td className="num text-do bold">{tien(b.tong_no)}</td></tr>))}</tbody>
              <tfoot><tr><td colSpan={4}>Tổng</td><td className="num">{tien(tong)}</td></tr></tfoot>
            </table>
          )}
        </Card>
        <div>{chon ? <ThuGop key={chon} benhNhanId={chon} onDone={reload} /> : <Card><Empty text="Chọn một bệnh nhân để xem chi tiết và thu nợ" /></Card>}</div>
      </div>
    </>
  );
}
