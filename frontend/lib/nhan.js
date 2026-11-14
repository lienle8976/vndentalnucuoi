// Nhãn hiển thị cho các mã trạng thái / loại trong DB

export const VAI_TRO = { LE_TAN: 'Lễ tân', BAC_SI: 'Bác sĩ', QUAN_LY: 'Quản lý' };

export const TRANG_THAI_LICH = {
  DA_DAT: { ten: 'Đã đặt', mau: 'xam' },
  DA_NHAC: { ten: 'Đã nhắc', mau: 'xanh' },
  DA_DEN: { ten: 'Đã đến', mau: 'vang' },
  DANG_KHAM: { ten: 'Đang khám', mau: 'cam' },
  HOAN_THANH: { ten: 'Hoàn thành', mau: 'luc' },
  DA_HUY: { ten: 'Đã hủy', mau: 'do' },
  KHONG_DEN: { ten: 'Không đến', mau: 'do' },
};

export const TRANG_THAI_HD = {
  NHAP: { ten: 'Nháp', mau: 'xam' },
  DA_CHOT: { ten: 'Đã chốt', mau: 'xanh' },
  DA_HUY: { ten: 'Đã hủy', mau: 'do' },
};

export const TRANG_THAI_PHIEU = {
  DANG_LAP: { ten: 'Đang lập', mau: 'cam' },
  HOAN_TAT: { ten: 'Hoàn tất', mau: 'luc' },
};

export const TRANG_THAI_LIEU_TRINH = {
  DANG_THUC_HIEN: { ten: 'Đang thực hiện', mau: 'cam' },
  HOAN_THANH: { ten: 'Hoàn thành', mau: 'luc' },
  DA_HUY: { ten: 'Đã hủy', mau: 'do' },
};

export const LOAI_HD = { LUOT_KHAM: 'Lượt khám', DOT_LIEU_TRINH: 'Đợt liệu trình' };
export const HINH_THUC_TT = { TIEN_MAT: 'Tiền mặt', CHUYEN_KHOAN: 'Chuyển khoản' };
export const BEN_HUY = { BENH_NHAN: 'Bệnh nhân', PHONG_KHAM: 'Phòng khám' };
export const NGUON_LICH = { DIEN_THOAI: 'Điện thoại', TAI_QUAY: 'Tại quầy', VANG_LAI: 'Vãng lai', TAI_KHAM: 'Tái khám' };
export const GIOI_TINH = { NAM: 'Nam', NU: 'Nữ', KHAC: 'Khác' };
export const LOAI_KHO = { THUOC: 'Thuốc', VAT_TU: 'Vật tư' };
export const LOAI_GIAO_DICH = {
  NHAP: 'Nhập kho', XUAT_DIEU_TRI: 'Xuất điều trị', XUAT_DON_THUOC: 'Xuất đơn thuốc', DIEU_CHINH: 'Điều chỉnh',
};

export const KET_QUA_NHAC = {
  XAC_NHAN: { ten: 'Đã xác nhận', mau: 'luc' },
  KHONG_NGHE_MAY: { ten: 'Không nghe máy', mau: 'vang' },
  XIN_DOI_LICH: { ten: 'Xin đổi lịch', mau: 'cam' },
  XIN_HUY: { ten: 'Xin hủy', mau: 'do' },
  SAI_SO: { ten: 'Sai số', mau: 'do' },
  SMS_CHO_GUI: { ten: 'SMS chờ gửi', mau: 'xam' },
  SMS_DA_GUI: { ten: 'Đã gửi SMS', mau: 'xanh' },
  SMS_LOI: { ten: 'SMS lỗi', mau: 'do' },
};

export const THU_TRONG_TUAN = { 1: 'Thứ Hai', 2: 'Thứ Ba', 3: 'Thứ Tư', 4: 'Thứ Năm', 5: 'Thứ Sáu', 6: 'Thứ Bảy', 7: 'Chủ nhật' };

export const VUNG_RANG = { HAM_TREN: 'Hàm trên', HAM_DUOI: 'Hàm dưới', TOAN_HAM: 'Toàn hàm' };
export const tenRang = (r) => VUNG_RANG[r] ?? `Răng ${r}`;

export const BANG_LICH_SU = {
  phieu_dieu_tri: 'Phiếu', dong_dieu_tri: 'Dòng điều trị', don_thuoc: 'Đơn thuốc',
  vat_tu_su_dung: 'Vật tư', chi_dinh_tai_kham: 'Chỉ định tái khám',
};
export const HANH_DONG_SUA = { THEM: 'Thêm', SUA: 'Sửa', XOA: 'Xóa' };
