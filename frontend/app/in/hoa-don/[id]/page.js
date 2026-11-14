'use client';
// UC35 — In hóa đơn / biên lai (trang riêng, không có menu)
import { useParams } from 'next/navigation';
import { useData } from '@/lib/api';
import { ngay, tien, so, thoiDiem } from '@/lib/format';
import { LOAI_HD, HINH_THUC_TT } from '@/lib/nhan';

export default function InHoaDon() {
  const { id } = useParams();
  const { data: h, error } = useData(`/thanh-toan/hoa-don/${id}`);
  if (error) return <div className="bien-lai">{error.message}</div>;
  if (!h) return <div className="bien-lai">Đang tải…</div>;
  const tamTinh = h.dong.reduce((s, d) => s + Math.round(d.don_gia * d.so_luong), 0);
  const giamDong = h.dong.reduce((s, d) => s + d.giam_gia_dong, 0);

  return (
    <div className="bien-lai">
      <div className="khong-in gap mb">
        <button className="btn btn-primary" onClick={() => window.print()}>In</button>
        <button className="btn" onClick={() => window.close()}>Đóng</button>
      </div>
      <div className="center">
        <b style={{ fontSize: 18 }}>NHA KHOA NỤ CƯỜI VIỆT</b>
        <div className="muted small">Hóa đơn thanh toán dịch vụ nha khoa</div>
      </div>
      <h1 className="mt">HÓA ĐƠN {h.ma_hoa_don}</h1>
      <p className="center muted">{LOAI_HD[h.loai]} · Ngày lập {ngay(h.ngay_lap)}{h.trang_thai === 'DA_HUY' && ' · ĐÃ HỦY'}</p>
      <dl className="dl mt">
        <dt>Bệnh nhân</dt><dd>{h.benh_nhan} ({h.ma_benh_nhan})</dd>
        <dt>Số điện thoại</dt><dd>{h.so_dien_thoai}</dd>
        {h.dia_chi && <><dt>Địa chỉ</dt><dd>{h.dia_chi}</dd></>}
        {h.ma_phieu && <><dt>Phiếu điều trị</dt><dd>{h.ma_phieu} — ngày {ngay(h.ngay_kham)}</dd></>}
      </dl>
      <table className="table mt">
        <thead><tr><th>#</th><th>Nội dung</th><th className="num">Đơn giá</th><th className="num">SL</th><th className="num">Giảm</th><th className="num">Thành tiền</th></tr></thead>
        <tbody>{h.dong.map((d, i) => (
          <tr key={d.id}><td>{i + 1}</td><td>{d.mo_ta}{d.bac_si && <div className="small muted">BS {d.bac_si}</div>}</td>
            <td className="num">{tien(d.don_gia)}</td><td className="num">{so(d.so_luong)}</td>
            <td className="num">{d.giam_gia_dong ? tien(d.giam_gia_dong) : ''}</td>
            <td className="num">{tien(Math.round(d.don_gia * d.so_luong) - d.giam_gia_dong)}</td></tr>))}</tbody>
      </table>
      <div className="tong-hd mt">
        <div className="dong"><span>Tạm tính</span><span>{tien(tamTinh)}</span></div>
        {giamDong > 0 && <div className="dong"><span>Giảm theo dòng</span><span>−{tien(giamDong)}</span></div>}
        {h.giam_gia_tong > 0 && <div className="dong"><span>Giảm giá{h.ly_do_giam_gia ? ` (${h.ly_do_giam_gia})` : ''}</span><span>−{tien(h.giam_gia_tong)}</span></div>}
        <div className="dong lon"><span>Tổng cộng</span><span>{tien(h.tong_tien)}</span></div>
        <div className="dong"><span>Đã thanh toán</span><span>{tien(h.da_thu)}</span></div>
        <div className="dong bold"><span>Còn lại</span><span>{tien(h.con_no)}</span></div>
      </div>
      {h.thanh_toan.length > 0 && (
        <>
          <h3 className="mt">Biên lai thu tiền</h3>
          <table className="table"><tbody>{h.thanh_toan.map((t) => (
            <tr key={t.id}><td>{t.ma_phieu_thu}</td><td>{thoiDiem(t.thoi_diem)}</td><td>{HINH_THUC_TT[t.hinh_thuc]}</td>
              <td className="num">{tien(t.so_tien)}</td><td>Thu ngân: {t.nguoi_thu}</td></tr>))}</tbody></table>
        </>
      )}
      <div className="grid-2 center" style={{ marginTop: 40 }}>
        <div><b>Khách hàng</b><div className="muted small">(ký, ghi rõ họ tên)</div></div>
        <div><b>Thu ngân</b><div className="muted small">(ký, ghi rõ họ tên)</div></div>
      </div>
    </div>
  );
}
