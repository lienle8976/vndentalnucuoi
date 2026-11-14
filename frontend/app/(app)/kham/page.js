'use client';
// UC20 — Danh sách chờ khám (bệnh nhân đã check-in)
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, useData } from '@/lib/api';
import { gio, thoiDiem, homNay, ngay } from '@/lib/format';
import { TRANG_THAI_LICH } from '@/lib/nhan';
import { useNguoiDung, coVaiTro } from '@/components/Shell';
import { PageHeader, Card, Loading, ErrorBox, Empty, TrangThai, chay } from '@/components/ui';

export default function ChoKham() {
  const user = useNguoiDung();
  const router = useRouter();
  const ql = coVaiTro(user, 'QUAN_LY');
  const [bacSi, setBacSi] = useState('');
  const { data, error, reload } = useData(`/kham/cho-kham?bac_si_id=${bacSi}`);
  const { data: dm } = useData(ql ? '/danh-muc' : null);

  async function batDau(lichHenId) {
    const r = await chay(() => api('/kham/phieu', { method: 'POST', body: { lich_hen_id: lichHenId } }));
    if (r?.id) router.push(`/kham/phieu/${r.id}`);
  }

  const cho = data?.filter((l) => l.trang_thai !== 'HOAN_THANH') ?? [];
  const xong = data?.filter((l) => l.trang_thai === 'HOAN_THANH') ?? [];

  return (
    <>
      <PageHeader title="Danh sách chờ khám" sub={`${ngay(homNay(), true)} — bệnh nhân đã check-in${ql ? '' : ' của bạn'}`}>
        {ql && (
          <select value={bacSi} onChange={(e) => setBacSi(e.target.value)} style={{ width: 220 }}>
            <option value="">Tất cả bác sĩ</option>
            {dm?.bac_si.map((b) => <option key={b.id} value={b.id}>{b.ho_ten}</option>)}
          </select>
        )}
        <button className="btn" onClick={reload}>Làm mới</button>
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      <Card title={`Đang chờ / đang khám (${cho.length})`}>
        {!data ? <Loading /> : cho.length === 0 ? <Empty text="Chưa có bệnh nhân nào check-in" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Giờ hẹn</th><th>Đến lúc</th><th>Bệnh nhân</th><th>Việc cần làm</th><th>Bác sĩ · ghế</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>{cho.map((l) => (
              <tr key={l.id}>
                <td><b>{gio(l.gio_bat_dau)}</b></td>
                <td className="nowrap">{thoiDiem(l.den_luc).slice(-5)}</td>
                <td><Link href={`/benh-nhan/${l.benh_nhan_id}`}><b>{l.benh_nhan}</b></Link> <span className="muted">({l.tuoi} tuổi)</span>
                  {l.di_ung && !/không/i.test(l.di_ung) && <div><span className="di-ung">Dị ứng: {l.di_ung}</span></div>}</td>
                <td>{l.dich_vu_du_kien}{l.ghi_chu && <div className="small muted">{l.ghi_chu}</div>}</td>
                <td>{l.bac_si} · {l.ma_ghe}</td>
                <td><TrangThai ma={l.trang_thai} bang={TRANG_THAI_LICH} /></td>
                <td className="right">{l.phieu_id
                  ? <Link className="btn btn-sm btn-primary" href={`/kham/phieu/${l.phieu_id}`}>Tiếp tục phiếu</Link>
                  : <button className="btn btn-sm btn-primary" onClick={() => batDau(l.id)}>Bắt đầu khám</button>}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
      {xong.length > 0 && (
        <Card title={`Đã khám xong hôm nay (${xong.length})`}>
          <table className="table"><tbody>{xong.map((l) => (
            <tr key={l.id} className="row-muted">
              <td>{gio(l.gio_bat_dau)}</td><td>{l.benh_nhan}</td><td>{l.dich_vu_du_kien}</td><td>{l.bac_si}</td>
              <td className="right">{l.phieu_id && <Link className="btn btn-sm" href={`/kham/phieu/${l.phieu_id}`}>Xem / sửa phiếu</Link>}</td>
            </tr>))}</tbody></table>
        </Card>
      )}
    </>
  );
}
