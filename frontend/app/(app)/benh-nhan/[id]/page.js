'use client';
// UC07 — Hồ sơ bệnh nhân; UC06 — cập nhật thông tin
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, useData } from '@/lib/api';
import { ngay, gio, tien, thoiDiem } from '@/lib/format';
import { GIOI_TINH, TRANG_THAI_LICH, TRANG_THAI_HD, TRANG_THAI_PHIEU, TRANG_THAI_LIEU_TRINH, LOAI_HD } from '@/lib/nhan';
import { useNguoiDung, coVaiTro } from '@/components/Shell';
import BenhNhanForm from '@/components/BenhNhanForm';
import LieuTrinhModal from '@/components/LieuTrinhModal';
import { PageHeader, Card, Loading, ErrorBox, Empty, Tabs, TrangThai, Badge, Modal, Field, chay } from '@/components/ui';

export default function HoSoBenhNhan() {
  const { id } = useParams();
  const user = useNguoiDung();
  const { data, error, reload } = useData(`/benh-nhan/${id}`);
  const [tab, setTab] = useState('lich');
  const [sua, setSua] = useState(null);
  const [taoLieuTrinh, setTaoLieuTrinh] = useState(false);
  const [ngung, setNgung] = useState(null);
  const leTan = coVaiTro(user, 'LE_TAN', 'QUAN_LY');

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const b = data.benh_nhan;

  async function luuSua() {
    const r = await chay(() => api(`/benh-nhan/${id}`, { method: 'PUT', body: sua }), 'Đã cập nhật thông tin');
    if (r) { setSua(null); reload(); }
  }
  async function doiTrangThai(dangHoatDong, lyDo) {
    const r = await chay(() => api(`/benh-nhan/${id}`, { method: 'PUT', body: { dang_hoat_dong: dangHoatDong, ly_do_ngung: dangHoatDong ? null : lyDo } }),
      dangHoatDong ? 'Đã kích hoạt lại hồ sơ' : 'Đã ngừng hồ sơ');
    if (r) { setNgung(null); reload(); }
  }

  const tabs = [
    { id: 'lich', ten: 'Lịch hẹn', so: data.lich_hen.length },
    ...(data.xem_benh_an ? [{ id: 'kham', ten: 'Khám & điều trị', so: data.phieu.length }] : []),
    { id: 'hd', ten: 'Hóa đơn & công nợ', so: data.hoa_don.length },
    { id: 'lt', ten: 'Liệu trình', so: data.lieu_trinh.length },
    { id: 'giay', ten: 'Hồ sơ giấy', so: data.tai_lieu.length },
  ];

  return (
    <>
      <PageHeader title={b.ho_ten} sub={`${b.ma_benh_nhan} · ${b.tuoi} tuổi · ${b.so_dien_thoai}`}>
        {leTan && b.dang_hoat_dong && <Link className="btn btn-primary" href={`/lich-hen/dat?benh_nhan_id=${b.id}`}>+ Đặt lịch</Link>}
        {coVaiTro(user, 'BAC_SI', 'QUAN_LY') && b.dang_hoat_dong && <button className="btn" onClick={() => setTaoLieuTrinh(true)}>+ Liệu trình</button>}
        {leTan && <button className="btn" onClick={() => setSua({ ...b })}>Sửa thông tin</button>}
        {leTan && (b.dang_hoat_dong
          ? <button className="btn btn-danger" onClick={() => setNgung('')}>Ngừng hồ sơ</button>
          : <button className="btn" onClick={() => doiTrangThai(true)}>Kích hoạt lại</button>)}
      </PageHeader>

      {!b.dang_hoat_dong && <div className="alert alert-loi">Hồ sơ đã ngừng hoạt động: {b.ly_do_ngung ?? '—'} (dữ liệu vẫn được lưu tối thiểu 5 năm)</div>}
      {b.di_ung && !/không/i.test(b.di_ung) && <div className="alert alert-loi"><b>Dị ứng:</b> {b.di_ung}</div>}

      <div className="grid-2">
        <Card title="Thông tin hành chính">
          <dl className="dl">
            <dt>Ngày sinh</dt><dd>{ngay(b.ngay_sinh)} ({b.tuoi} tuổi)</dd>
            <dt>Giới tính</dt><dd>{GIOI_TINH[b.gioi_tinh] ?? '—'}</dd>
            <dt>Số điện thoại</dt><dd>{b.so_dien_thoai}
              {data.cung_sdt.length > 0 && <div className="small muted">Dùng chung với: {data.cung_sdt.map((x, i) => (
                <span key={x.id}>{i > 0 && ', '}<Link href={`/benh-nhan/${x.id}`}>{x.ho_ten}</Link></span>))}</div>}
            </dd>
            <dt>Địa chỉ</dt><dd>{b.dia_chi ?? '—'}</dd>
            {b.nguoi_giam_ho && <><dt>Người giám hộ</dt><dd>{b.nguoi_giam_ho} ({b.quan_he_giam_ho})</dd></>}
            <dt>Nguồn hồ sơ</dt><dd>{b.nguon_ho_so === 'HO_SO_GIAY' ? `Hồ sơ giấy ${b.so_ho_so_giay ?? ''} — khám gần nhất ${ngay(b.ngay_kham_gan_nhat_giay)}` : 'Tạo mới trên hệ thống'}</dd>
          </dl>
        </Card>
        <Card title="Sức khỏe & tình trạng">
          <dl className="dl">
            <dt>Tiền sử bệnh</dt><dd>{b.tien_su_benh ?? '—'}</dd>
            <dt>Dị ứng</dt><dd>{b.di_ung ?? '—'}</dd>
            <dt>Ghi chú</dt><dd>{b.ghi_chu ?? '—'}</dd>
            <dt>Lần khám cuối</dt><dd>{ngay(b.lan_kham_cuoi)}</dd>
            <dt>Lịch sắp tới</dt><dd>{b.lich_sap_toi ? thoiDiem(b.lich_sap_toi) : '—'}</dd>
            <dt>Công nợ</dt><dd className={b.cong_no > 0 ? 'text-do bold' : ''}>{tien(b.cong_no)}</dd>
          </dl>
        </Card>
      </div>

      <Card>
        <Tabs tabs={tabs} value={tab} onChange={setTab} />
        {tab === 'lich' && (data.lich_hen.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Ngày</th><th>Giờ</th><th>Ghế</th><th>Bác sĩ</th><th>Việc cần làm</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
            <tbody>{data.lich_hen.map((l) => (
              <tr key={l.id}>
                <td className="nowrap">{ngay(l.ngay, true)}</td><td>{gio(l.gio_bat_dau)}</td><td>{l.ma_ghe}</td><td>{l.bac_si}</td>
                <td>{l.dich_vu_du_kien}</td><td><TrangThai ma={l.trang_thai} bang={TRANG_THAI_LICH} /></td>
                <td>{l.ly_do_huy ? `Hủy: ${l.ly_do_huy}` : l.ghi_chu ?? ''}</td>
              </tr>))}</tbody>
          </table></div>
        ))}
        {tab === 'kham' && (data.phieu.length === 0 ? <Empty text="Chưa có lần khám nào trên hệ thống" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Phiếu</th><th>Ngày</th><th>Bác sĩ</th><th>Chẩn đoán</th><th>Việc đã làm</th><th>Đơn thuốc</th><th>Trạng thái</th></tr></thead>
            <tbody>{data.phieu.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/kham/phieu/${p.id}`}>{p.ma_phieu}</Link></td>
                <td className="nowrap">{ngay(p.ngay_kham)} {gio(p.gio_bat_dau)}</td>
                <td>{p.cac_bac_si_thuc_hien ?? p.bac_si_chinh}</td><td>{p.chan_doan ?? '—'}</td>
                <td>{p.cong_viec ?? '—'}</td><td>{p.don_thuoc ?? '—'}</td>
                <td><TrangThai ma={p.trang_thai} bang={TRANG_THAI_PHIEU} /></td>
              </tr>))}</tbody>
          </table></div>
        ))}
        {tab === 'hd' && (data.hoa_don.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Hóa đơn</th><th>Loại</th><th>Ngày</th><th className="num">Tổng</th><th className="num">Đã thu</th><th className="num">Còn nợ</th><th>Trạng thái</th></tr></thead>
            <tbody>{data.hoa_don.map((h) => (
              <tr key={h.id}>
                <td>{leTan ? <Link href={`/thanh-toan/hoa-don/${h.id}`}>{h.ma_hoa_don}</Link> : h.ma_hoa_don}</td>
                <td>{LOAI_HD[h.loai]}</td><td>{ngay(h.ngay_lap)}</td>
                <td className="num">{tien(h.tong_tien)}</td><td className="num">{tien(h.da_thu)}</td>
                <td className={`num ${h.con_no > 0 && h.trang_thai === 'DA_CHOT' ? 'text-do bold' : ''}`}>{h.trang_thai === 'DA_CHOT' ? tien(h.con_no) : '—'}</td>
                <td><TrangThai ma={h.trang_thai} bang={TRANG_THAI_HD} /></td>
              </tr>))}</tbody>
          </table></div>
        ))}
        {tab === 'lt' && (data.lieu_trinh.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Mã</th><th>Liệu trình</th><th>Bác sĩ phụ trách</th><th>Bắt đầu</th><th>Tiến độ</th><th className="num">Giá trọn gói</th><th className="num">Đã thu</th><th>Trạng thái</th></tr></thead>
            <tbody>{data.lieu_trinh.map((l) => (
              <tr key={l.id}>
                <td>{l.ma_lieu_trinh}</td><td>{l.ten}</td><td>{l.bac_si_phu_trach}</td><td>{ngay(l.ngay_bat_dau)}</td>
                <td>{l.so_buoi_da_lam}/{l.so_buoi_du_kien} buổi</td>
                <td className="num">{tien(l.gia_tron_goi)}</td><td className="num">{tien(l.da_thu)}</td>
                <td><TrangThai ma={l.trang_thai} bang={TRANG_THAI_LIEU_TRINH} /></td>
              </tr>))}</tbody>
          </table></div>
        ))}
        {tab === 'giay' && (data.tai_lieu.length === 0 ? <Empty text="Không có ảnh scan hồ sơ giấy" /> : (
          <table className="table">
            <thead><tr><th>Tệp</th><th>Mô tả</th><th>Đường dẫn lưu trữ</th><th>Ngày tải lên</th></tr></thead>
            <tbody>{data.tai_lieu.map((t) => (
              <tr key={t.id}><td>{t.ten_file}</td><td>{t.mo_ta}</td><td className="muted small">{t.duong_dan}</td><td>{thoiDiem(t.tai_len_luc)}</td></tr>))}</tbody>
          </table>
        ))}
      </Card>

      {sua && (
        <Modal title="Cập nhật thông tin bệnh nhân" onClose={() => setSua(null)} wide
          footer={<><button className="btn" onClick={() => setSua(null)}>Hủy</button><button className="btn btn-primary" onClick={luuSua}>Lưu</button></>}>
          <BenhNhanForm value={sua} onChange={setSua} />
        </Modal>
      )}
      {ngung !== null && (
        <Modal title="Ngừng hồ sơ bệnh nhân" onClose={() => setNgung(null)}
          footer={<><button className="btn" onClick={() => setNgung(null)}>Hủy</button>
            <button className="btn btn-danger" disabled={!ngung.trim()} onClick={() => doiTrangThai(false, ngung)}>Ngừng hồ sơ</button></>}>
          <p className="muted">Hồ sơ không bị xóa (giữ tối thiểu 5 năm), chỉ ẩn khỏi các thao tác mới.</p>
          <Field label="Lý do" required><input autoFocus value={ngung} onChange={(e) => setNgung(e.target.value)} /></Field>
        </Modal>
      )}
      {taoLieuTrinh && (
        <LieuTrinhModal benhNhanId={b.id} bacSiId={coVaiTro(user, 'BAC_SI') ? user.id : undefined}
          onClose={() => setTaoLieuTrinh(false)} onDone={() => { setTaoLieuTrinh(false); setTab('lt'); reload(); }} />
      )}
    </>
  );
}
