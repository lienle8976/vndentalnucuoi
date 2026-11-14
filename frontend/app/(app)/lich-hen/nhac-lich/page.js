'use client';
// UC16 — Nhắc lịch hẹn ngày mai; UC17 — gửi SMS khi khách không nghe máy
import { useState } from 'react';
import Link from 'next/link';
import { api, useData } from '@/lib/api';
import { ngay, gio, homNay, thoiDiem } from '@/lib/format';
import { KET_QUA_NHAC, TRANG_THAI_LICH } from '@/lib/nhan';
import LichHenModal from '@/components/LichHenModal';
import { PageHeader, Card, Loading, ErrorBox, Empty, TrangThai, chay } from '@/components/ui';

const NUT_GOI = [
  ['XAC_NHAN', 'Xác nhận đến', 'btn-primary'],
  ['KHONG_NGHE_MAY', 'Không nghe máy', ''],
  ['XIN_DOI_LICH', 'Xin đổi lịch', ''],
  ['XIN_HUY', 'Xin hủy', ''],
  ['SAI_SO', 'Sai số', ''],
];

export default function NhacLich() {
  const [ngayNhac, setNgayNhac] = useState(homNay(1));
  const { data, error, reload } = useData(`/lich-hen/nhac-lich?ngay=${ngayNhac}`);
  const [mo, setMo] = useState(null);

  async function ghi(id, body, msg) {
    if (await chay(() => api(`/lich-hen/${id}/nhac-lich`, { method: 'POST', body }), msg)) reload();
  }

  const chuaXong = data?.filter((l) => !['XAC_NHAN', 'SMS_DA_GUI'].includes(l.lan_nhac_cuoi_ket_qua)).length ?? 0;

  return (
    <>
      <PageHeader title="Nhắc lịch hẹn" sub="Gọi điện cho từng khách; ai không nghe máy thì gửi SMS (tin nhắn ghi tên người được hẹn)">
        <input type="date" value={ngayNhac} onChange={(e) => setNgayNhac(e.target.value)} style={{ width: 170 }} />
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      <Card title={`Lịch ngày ${ngay(ngayNhac, true)}`} actions={data && <span className="muted">{chuaXong}/{data.length} chưa nhắc xong</span>}>
        {!data ? <Loading /> : data.length === 0 ? <Empty text="Không có lịch cần nhắc" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Giờ</th><th>Bệnh nhân</th><th>SĐT</th><th>Bác sĩ · việc</th><th>Lần nhắc gần nhất</th><th>Ghi kết quả gọi</th><th></th></tr></thead>
            <tbody>{data.map((l) => {
              const xong = ['XAC_NHAN', 'SMS_DA_GUI'].includes(l.lan_nhac_cuoi_ket_qua);
              return (
                <tr key={l.id} className={xong ? 'row-muted' : ''}>
                  <td className="nowrap"><b>{gio(l.gio_bat_dau)}</b><div className="small muted">Ghế {l.ma_ghe}</div></td>
                  <td><Link href={`/benh-nhan/${l.benh_nhan_id}`}>{l.benh_nhan}</Link>
                    {l.nguoi_giam_ho && <div className="small muted">Giám hộ: {l.nguoi_giam_ho}</div>}
                    <TrangThai ma={l.trang_thai} bang={TRANG_THAI_LICH} /></td>
                  <td className="nowrap"><a href={`tel:${l.so_dien_thoai}`}>{l.so_dien_thoai}</a></td>
                  <td>{l.bac_si}<div className="small muted">{l.dich_vu_du_kien}</div></td>
                  <td>{l.lan_nhac_cuoi_ket_qua
                    ? <><TrangThai ma={l.lan_nhac_cuoi_ket_qua} bang={KET_QUA_NHAC} /><div className="small muted">{thoiDiem(l.lan_nhac_cuoi_luc)} · {l.nguoi_nhac} ({l.so_lan_nhac} lần)</div></>
                    : <span className="muted">Chưa nhắc</span>}</td>
                  <td><div className="gap">
                    {NUT_GOI.map(([ma, ten, cls]) => (
                      <button key={ma} className={`btn btn-sm ${cls}`} onClick={() => ghi(l.id, { hinh_thuc: 'GOI_DIEN', ket_qua: ma }, `Đã ghi: ${ten}`)}>{ten}</button>
                    ))}
                  </div></td>
                  <td><div className="gap">
                    <button className="btn btn-sm" disabled={l.lan_nhac_cuoi_ket_qua === 'SMS_DA_GUI'}
                      onClick={() => ghi(l.id, { hinh_thuc: 'SMS' }, 'Đã gửi SMS nhắc lịch')}>Gửi SMS</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setMo(l.id)}>Đổi / hủy…</button>
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </Card>
      <p className="muted small">Chưa nối cổng SMS thật: hệ thống lưu nội dung tin nhắn và ghi nhận “Đã gửi SMS”.</p>
      {mo && <LichHenModal id={mo} onClose={() => setMo(null)} onChanged={reload} />}
    </>
  );
}
