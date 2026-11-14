'use client';
// Quầy thanh toán: phiếu chờ lập hóa đơn (UC31), đợt liệu trình đến hạn (UC33), hóa đơn nháp, hóa đơn còn nợ
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, useData } from '@/lib/api';
import { ngay, tien, thoiDiem } from '@/lib/format';
import { LOAI_HD, TRANG_THAI_HD } from '@/lib/nhan';
import { PageHeader, Card, Loading, ErrorBox, Empty, Tabs, TrangThai, chay } from '@/components/ui';

export default function QuayThanhToan() {
  const router = useRouter();
  const { data, error, reload } = useData('/thanh-toan/cho-xu-ly');
  const [tab, setTab] = useState('cho');
  const [tu, setTu] = useState('');
  const [tim, setTim] = useState('');
  useEffect(() => { const t = setTimeout(() => setTim(tu.trim()), 300); return () => clearTimeout(t); }, [tu]);
  const { data: tra } = useData(tab === 'tra' ? `/thanh-toan/hoa-don?q=${encodeURIComponent(tim)}` : null);

  async function lap(path) {
    const r = await chay(() => api(path, { method: 'POST' }), 'Đã lập hóa đơn nháp');
    if (r?.id) router.push(`/thanh-toan/hoa-don/${r.id}`);
  }

  return (
    <>
      <PageHeader title="Thanh toán" sub="Lập hóa đơn từ phiếu điều trị đã hoàn tất hoặc từ đợt liệu trình; thu tiền nhiều lần" />
      <ErrorBox error={error} onRetry={reload} />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'cho', ten: 'Chờ xử lý', so: data ? data.phieu_cho_lap.length + data.dot_den_han.length + data.hoa_don_nhap.length : undefined },
        { id: 'no', ten: 'Hóa đơn còn nợ', so: data?.hoa_don_con_no.length },
        { id: 'tra', ten: 'Tra cứu hóa đơn' },
      ]} />
      {!data ? <Loading /> : tab === 'cho' ? (
        <>
          <Card title={`Phiếu điều trị chờ lập hóa đơn (${data.phieu_cho_lap.length})`}>
            {data.phieu_cho_lap.length === 0 ? <Empty text="Không có phiếu chờ" /> : (
              <table className="table"><thead><tr><th>Phiếu</th><th>Bệnh nhân</th><th>Ngày khám</th><th>Bác sĩ</th><th>Hoàn tất lúc</th><th></th></tr></thead>
                <tbody>{data.phieu_cho_lap.map((p) => (
                  <tr key={p.id}><td>{p.ma_phieu}</td><td><b>{p.benh_nhan}</b> <span className="muted small">{p.ma_benh_nhan}</span></td>
                    <td>{ngay(p.ngay_kham)}</td><td>{p.cac_bac_si_thuc_hien ?? p.bac_si_chinh}</td><td>{thoiDiem(p.hoan_tat_luc)}</td>
                    <td className="right"><button className="btn btn-sm btn-primary" onClick={() => lap(`/thanh-toan/hoa-don/tu-phieu/${p.id}`)}>Lập hóa đơn</button></td></tr>))}</tbody></table>
            )}
          </Card>
          <Card title={`Hóa đơn nháp — chưa chốt (${data.hoa_don_nhap.length})`}>
            {data.hoa_don_nhap.length === 0 ? <Empty /> : (
              <table className="table"><tbody>{data.hoa_don_nhap.map((h) => (
                <tr key={h.id} className="clickable" onClick={() => router.push(`/thanh-toan/hoa-don/${h.id}`)}>
                  <td>{h.ma_hoa_don}</td><td>{h.benh_nhan}</td><td>{LOAI_HD[h.loai]}</td><td>{ngay(h.ngay_lap)}</td>
                  <td className="num">{tien(h.tong_tien)}</td><td className="right"><button className="btn btn-sm">Mở</button></td></tr>))}</tbody></table>
            )}
          </Card>
          <Card title={`Đợt liệu trình đến hạn trong 7 ngày (${data.dot_den_han.length})`}>
            {data.dot_den_han.length === 0 ? <Empty /> : (
              <table className="table"><thead><tr><th>Liệu trình</th><th>Bệnh nhân</th><th>Đợt</th><th>Ngày dự kiến</th><th className="num">Số tiền</th><th></th></tr></thead>
                <tbody>{data.dot_den_han.map((d) => (
                  <tr key={d.id}><td>{d.ma_lieu_trinh} · {d.ten}</td><td><Link href={`/benh-nhan/${d.benh_nhan_id}`}>{d.benh_nhan}</Link> <span className="muted small">{d.so_dien_thoai}</span></td>
                    <td>Đợt {d.dot_so}</td><td>{ngay(d.ngay_du_kien)}</td><td className="num">{tien(d.so_tien)}</td>
                    <td className="right"><button className="btn btn-sm btn-primary" onClick={() => lap(`/thanh-toan/hoa-don/tu-dot/${d.id}`)}>Lập hóa đơn đợt</button></td></tr>))}</tbody></table>
            )}
          </Card>
        </>
      ) : tab === 'no' ? (
        <Card>
          {data.hoa_don_con_no.length === 0 ? <Empty text="Không có hóa đơn còn nợ" /> : (
            <table className="table"><thead><tr><th>Hóa đơn</th><th>Bệnh nhân</th><th>Loại</th><th>Ngày</th><th className="num">Tổng</th><th className="num">Đã thu</th><th className="num">Còn nợ</th><th></th></tr></thead>
              <tbody>{data.hoa_don_con_no.map((h) => (
                <tr key={h.id} className="clickable" onClick={() => router.push(`/thanh-toan/hoa-don/${h.id}`)}>
                  <td>{h.ma_hoa_don}</td><td>{h.benh_nhan} <span className="muted small">{h.so_dien_thoai}</span></td><td>{LOAI_HD[h.loai]}</td><td>{ngay(h.ngay_lap)}</td>
                  <td className="num">{tien(h.tong_tien)}</td><td className="num">{tien(h.da_thu)}</td><td className="num text-do bold">{tien(h.con_no)}</td>
                  <td className="right"><button className="btn btn-sm btn-primary">Thu tiền</button></td></tr>))}</tbody></table>
          )}
        </Card>
      ) : (
        <Card>
          <input autoFocus placeholder="Mã hóa đơn, SĐT hoặc tên bệnh nhân" value={tu} onChange={(e) => setTu(e.target.value)} style={{ maxWidth: 400 }} />
          {!tra ? <Loading /> : tra.length === 0 ? <Empty /> : (
            <table className="table mt"><thead><tr><th>Hóa đơn</th><th>Bệnh nhân</th><th>Loại</th><th>Ngày</th><th className="num">Tổng</th><th className="num">Còn nợ</th><th>Trạng thái</th></tr></thead>
              <tbody>{tra.map((h) => (
                <tr key={h.id} className="clickable" onClick={() => router.push(`/thanh-toan/hoa-don/${h.id}`)}>
                  <td>{h.ma_hoa_don}</td><td>{h.benh_nhan}</td><td>{LOAI_HD[h.loai]}</td><td>{ngay(h.ngay_lap)}</td>
                  <td className="num">{tien(h.tong_tien)}</td><td className="num">{h.trang_thai === 'DA_CHOT' ? tien(h.con_no) : '—'}</td>
                  <td><TrangThai ma={h.trang_thai} bang={TRANG_THAI_HD} /></td></tr>))}</tbody></table>
          )}
        </Card>
      )}
    </>
  );
}
