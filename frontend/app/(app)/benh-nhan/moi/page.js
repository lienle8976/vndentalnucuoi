'use client';
// UC05 — Đăng ký bệnh nhân mới; UC08 — chuyển hồ sơ giấy
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { ngay } from '@/lib/format';
import BenhNhanForm, { BN_RONG } from '@/components/BenhNhanForm';
import { PageHeader, Card, Alert, thongBao } from '@/components/ui';

function BenhNhanMoi() {
  const router = useRouter();
  const sp = useSearchParams();
  const [f, setF] = useState({ ...BN_RONG, so_dien_thoai: sp.get('sdt') ?? '' });
  const [trung, setTrung] = useState(null);
  const [dangGui, setDangGui] = useState(false);

  async function luu(xacNhan = false) {
    setDangGui(true);
    try {
      const r = await api('/benh-nhan', { method: 'POST', body: { ...f, xac_nhan_nguoi_khac: xacNhan } });
      thongBao(`Đã tạo bệnh nhân ${r.ma_benh_nhan}`);
      router.push(sp.get('quay_lai') === 'dat-lich' ? `/lich-hen/dat?benh_nhan_id=${r.id}` : `/benh-nhan/${r.id}`);
    } catch (e) {
      if (e.status === 409 && e.data?.can_xac_nhan) setTrung(e.data.trung);
      else thongBao(e.message, 'loi');
      setDangGui(false);
    }
  }

  return (
    <>
      <PageHeader title="Đăng ký bệnh nhân mới" />
      <Card>
        <form onSubmit={(e) => { e.preventDefault(); luu(false); }}>
          {trung && (
            <Alert loai="canh-bao">
              <div style={{ width: '100%' }}>
                <b>Số {f.so_dien_thoai} đã có {trung.length} người dùng:</b>
                <ul style={{ margin: '6px 0' }}>
                  {trung.map((t) => (
                    <li key={t.id}>
                      <a href={`/benh-nhan/${t.id}`} target="_blank" rel="noreferrer">{t.ma_benh_nhan} — {t.ho_ten}</a>
                      {' '}(sinh {ngay(t.ngay_sinh)}{t.nguoi_giam_ho ? `, giám hộ: ${t.nguoi_giam_ho}` : ''})
                    </li>
                  ))}
                </ul>
                Nếu đúng là một trong những người trên, hãy mở hồ sơ đó thay vì tạo mới.
                <div className="gap mt">
                  <button type="button" className="btn btn-primary" disabled={dangGui} onClick={() => luu(true)}>Đây là người khác — vẫn tạo mới</button>
                  <button type="button" className="btn" onClick={() => setTrung(null)}>Sửa lại thông tin</button>
                </div>
              </div>
            </Alert>
          )}
          <BenhNhanForm value={f} onChange={(v) => { setF(v); if (v.so_dien_thoai !== f.so_dien_thoai) setTrung(null); }} moi />
          <div className="gap mt">
            <button className="btn btn-primary" disabled={dangGui}>Lưu bệnh nhân</button>
            <button type="button" className="btn" onClick={() => router.back()}>Hủy</button>
          </div>
        </form>
      </Card>
    </>
  );
}

export default function Page() {
  return <Suspense><BenhNhanMoi /></Suspense>;
}
