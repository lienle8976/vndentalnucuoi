// Chuyển lỗi PostgreSQL / nghiệp vụ thành thông báo tiếng Việt cho giao diện
import { LoiNghiepVu } from './db.js';

const RANG_BUOC = {
  ux_lich_hen_ghe_khung: 'Ghế này đã có lịch trong khung giờ đã chọn',
  ux_lich_hen_bac_si_khung: 'Bác sĩ đã có lịch trong khung giờ đã chọn',
  ux_nhan_vien_ten_dang_nhap: 'Tên đăng nhập đã tồn tại',
  nhan_vien_ma_nhan_vien_key: 'Mã nhân viên đã tồn tại',
  ux_hoa_don_phieu: 'Phiếu điều trị này đã có hóa đơn',
  ux_hoa_don_dot: 'Đợt thanh toán này đã có hóa đơn',
  ex_ca_truc_khong_chong: 'Ca trực bị chồng giờ với một ca khác của cùng nhân viên',
  ck_lich_hen_khung_30: 'Giờ hẹn phải bắt đầu ở phút :00 hoặc :30',
  dong_dieu_tri_rang_check: 'Số răng không hợp lệ: dùng ký hiệu FDI (11–48, 51–85) hoặc chọn vùng',
  benh_nhan_so_dien_thoai_check: 'Số điện thoại phải bắt đầu bằng 0 và có 10–11 chữ số',
  benh_nhan_check1: 'Đã nhập người giám hộ thì phải ghi quan hệ',
  don_thuoc_phieu_dieu_tri_id_thuoc_id_key: 'Thuốc này đã có trong đơn',
  vat_tu_su_dung_phieu_dieu_tri_id_thuoc_vat_tu_id_key: 'Vật tư này đã có trong danh sách',
  chot_ket_check: 'Tiền đếm được lệch với hệ thống: hãy ghi giải trình',
  chot_ket_ca_truc_id_key: 'Ca này đã chốt két',
  bang_gia_dich_vu_dich_vu_id_hieu_luc_tu_key: 'Dịch vụ đã có giá với ngày hiệu lực này',
  bang_gia_thuoc_thuoc_id_hieu_luc_tu_key: 'Thuốc đã có giá với ngày hiệu lực này',
  ty_le_an_chia_bac_si_id_hieu_luc_tu_key: 'Bác sĩ đã có tỷ lệ với ngày hiệu lực này',
  dich_vu_ma_dich_vu_key: 'Mã dịch vụ đã tồn tại',
  thuoc_vat_tu_ma_key: 'Mã mặt hàng đã tồn tại',
  ghe_ma_ghe_key: 'Mã ghế đã tồn tại',
  ly_do_huy_ten_key: 'Lý do hủy đã tồn tại',
  ngay_nghi_pkey: 'Ngày nghỉ này đã có',
  dong_hoa_don_check: 'Giảm giá không được lớn hơn tiền của dòng',
  dong_hoa_don_check1: 'Giảm giá dòng phải có lý do',
  hoa_don_check2: 'Giảm giá tổng phải có lý do',
};

export function xuLyLoi(err, req, res, _next) {
  if (err instanceof LoiNghiepVu) return res.status(err.status).json({ loi: err.message });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ loi: 'Dữ liệu gửi lên không hợp lệ' });

  const code = err?.code;
  if (code === 'P0001') return res.status(400).json({ loi: err.message }); // RAISE EXCEPTION trong trigger
  if (code === '23505' || code === '23514' || code === '23P01') {
    const msg = RANG_BUOC[err.constraint];
    return res.status(code === '23505' ? 409 : 400).json({
      loi: msg ?? `Dữ liệu vi phạm ràng buộc (${err.constraint ?? err.detail ?? code})`,
    });
  }
  if (code === '23502') return res.status(400).json({ loi: `Thiếu thông tin bắt buộc: ${err.column}` });
  if (code === '23503') return res.status(400).json({ loi: 'Dữ liệu tham chiếu không tồn tại' });
  if (code?.startsWith('22')) return res.status(400).json({ loi: `Giá trị không hợp lệ: ${err.message}` });

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ loi: 'Lỗi máy chủ, vui lòng thử lại' });
}
