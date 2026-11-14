'use client';
// Trang chủ — việc cần làm theo vai trò
import Link from 'next/link';
import { useData } from '@/lib/api';
import { tien, pct, ngay, homNay } from '@/lib/format';
import { useNguoiDung, coVaiTro } from '@/components/Shell';
import { PageHeader, Stat, Card, Loading, ErrorBox } from '@/components/ui';

export default function TrangChu() {
  const user = useNguoiDung();
  const { data: d, error, reload } = useData('/tong-quan');
  const lt = coVaiTro(user, 'LE_TAN', 'QUAN_LY');
  const bs = coVaiTro(user, 'BAC_SI');
  const ql = coVaiTro(user, 'QUAN_LY');

  return (
    <>
      <PageHeader title={`Xin chào, ${user.ho_ten}`} sub={`Hôm nay ${ngay(homNay(), true)}`} />
      <ErrorBox error={error} onRetry={reload} />
      {!d ? <Loading /> : (
        <>
          <div className="stats">
            <Stat label="Lịch hẹn hôm nay" value={d.lich_hom_nay} sub={`${d.da_kham_xong} đã khám xong`} href="/lich-hen" />
            <Stat label="Đang chờ khám" value={d.dang_cho_kham} href={bs || ql ? '/kham' : '/lich-hen'} mau={d.dang_cho_kham ? 'cam' : undefined} />
            {bs && <Stat label="Chờ khám của tôi" value={d.cho_kham_cua_toi} href="/kham" mau={d.cho_kham_cua_toi ? 'cam' : undefined} />}
            {lt && <Stat label="Cần nhắc lịch ngày mai" value={d.can_nhac_lich} href="/lich-hen/nhac-lich" mau={d.can_nhac_lich ? 'xanh' : undefined} />}
            {lt && <Stat label="Phiếu chờ lập hóa đơn" value={d.phieu_cho_lap_hd} sub={`${d.hoa_don_nhap} hóa đơn nháp`} href="/thanh-toan" />}
            {lt && <Stat label="Tổng công nợ" value={tien(d.tong_cong_no)} href="/thanh-toan/cong-no" />}
            {ql && <Stat label="Doanh thu tháng này" value={tien(d.doanh_thu_thang ?? 0)} sub={`So với tháng trước: ${pct(d.doanh_thu_thay_doi_pct)}`} href="/bao-cao" />}
            {ql && <Stat label="Thuốc / vật tư sắp hết" value={d.canh_bao_kho} href="/kho" mau={d.canh_bao_kho ? 'do' : undefined} />}
            {ql && <Stat label="BN quá 6 tháng chưa quay lại" value={d.qua_6_thang} href="/bao-cao?tab=qua6" />}
          </div>

          <Card title="Thao tác nhanh">
            <div className="gap">
              {lt && <Link className="btn btn-primary" href="/lich-hen/dat">+ Đặt lịch hẹn</Link>}
              {lt && <Link className="btn" href="/benh-nhan/moi">+ Bệnh nhân mới</Link>}
              <Link className="btn" href="/lich-hen">Xem lịch hôm nay</Link>
              {(bs || ql) && <Link className="btn" href="/kham">Danh sách chờ khám</Link>}
              {lt && <Link className="btn" href="/thanh-toan">Quầy thanh toán</Link>}
              {lt && <Link className="btn" href="/thanh-toan/chot-ket">Chốt két cuối ca</Link>}
              {ql && <Link className="btn" href="/bao-cao">Báo cáo tháng</Link>}
            </div>
          </Card>
        </>
      )}
    </>
  );
}
