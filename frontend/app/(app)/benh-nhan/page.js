'use client';
// UC04 — Tra cứu bệnh nhân (SĐT, tên không dấu, mã BN)
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useData } from '@/lib/api';
import { ngay, tien, thoiDiem } from '@/lib/format';
import { useNguoiDung, coVaiTro } from '@/components/Shell';
import { PageHeader, Card, Loading, ErrorBox, Empty, Badge } from '@/components/ui';

export default function DanhSachBenhNhan() {
  const user = useNguoiDung();
  const router = useRouter();
  const [tu, setTu] = useState('');
  const [tim, setTim] = useState('');
  useEffect(() => { const t = setTimeout(() => setTim(tu.trim()), 300); return () => clearTimeout(t); }, [tu]);
  const { data, error, loading, reload } = useData(`/benh-nhan?q=${encodeURIComponent(tim)}`);

  return (
    <>
      <PageHeader title="Bệnh nhân" sub="Tìm theo số điện thoại, tên (gõ không dấu được) hoặc mã bệnh nhân">
        {coVaiTro(user, 'LE_TAN', 'QUAN_LY') && <Link className="btn btn-primary" href="/benh-nhan/moi">+ Bệnh nhân mới</Link>}
      </PageHeader>
      <Card>
        <input autoFocus placeholder="VD: 0912345678, le bao ngoc, BN000005" value={tu} onChange={(e) => setTu(e.target.value)} style={{ maxWidth: 420 }} />
        {data?.length > 1 && /^\d{10,11}$/.test(tim) && (
          <p className="muted small">Số này có {data.length} người dùng chung — chọn đúng người theo tên và ngày sinh.</p>
        )}
        <ErrorBox error={error} onRetry={reload} />
        {loading && !data ? <Loading /> : data?.length === 0 ? <Empty text="Không tìm thấy bệnh nhân. Hãy tạo bệnh nhân mới." /> : (
          <div className="table-wrap mt">
            <table className="table">
              <thead>
                <tr><th>Mã BN</th><th>Họ tên</th><th>Ngày sinh</th><th>SĐT</th><th>Giám hộ</th><th>Lần khám cuối</th><th>Lịch sắp tới</th><th className="num">Công nợ</th></tr>
              </thead>
              <tbody>
                {data?.map((b) => (
                  <tr key={b.id} className={`clickable ${b.dang_hoat_dong ? '' : 'row-muted'}`} onClick={() => router.push(`/benh-nhan/${b.id}`)}>
                    <td className="nowrap">{b.ma_benh_nhan}</td>
                    <td><b>{b.ho_ten}</b> {b.nguon_ho_so === 'HO_SO_GIAY' && <Badge nhan="Hồ sơ giấy" />} {!b.dang_hoat_dong && <Badge nhan="Ngừng" mau="do" />}</td>
                    <td className="nowrap">{ngay(b.ngay_sinh)} <span className="muted">({b.tuoi})</span></td>
                    <td>{b.so_dien_thoai}</td>
                    <td>{b.nguoi_giam_ho ? `${b.nguoi_giam_ho} (${b.quan_he_giam_ho})` : '—'}</td>
                    <td>{ngay(b.lan_kham_cuoi)}</td>
                    <td>{b.lich_sap_toi ? thoiDiem(b.lich_sap_toi) : '—'}</td>
                    <td className={`num ${b.cong_no > 0 ? 'text-do bold' : ''}`}>{b.cong_no > 0 ? tien(b.cong_no) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
