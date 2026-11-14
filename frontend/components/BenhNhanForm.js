'use client';
// Form thông tin bệnh nhân — dùng cho đăng ký mới (UC05, UC08) và cập nhật (UC06)
import { Field } from './ui';

export const BN_RONG = {
  ho_ten: '', ngay_sinh: '', gioi_tinh: '', so_dien_thoai: '', dia_chi: '', nguoi_giam_ho: '', quan_he_giam_ho: '',
  tien_su_benh: '', di_ung: '', ghi_chu: '', nguon_ho_so: 'MOI', so_ho_so_giay: '', ngay_kham_gan_nhat_giay: '',
};

export function tuoiTu(ngaySinh) {
  if (!ngaySinh) return null;
  const s = new Date(`${ngaySinh}T00:00:00`);
  const n = new Date();
  let t = n.getFullYear() - s.getFullYear();
  if (n.getMonth() < s.getMonth() || (n.getMonth() === s.getMonth() && n.getDate() < s.getDate())) t -= 1;
  return t;
}

export default function BenhNhanForm({ value: f, onChange, moi = false }) {
  const set = (k) => (e) => onChange({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const tuoi = tuoiTu(f.ngay_sinh);
  const treEm = tuoi !== null && tuoi < 15;

  return (
    <div className="form-grid">
      <Field label="Họ tên" required><input value={f.ho_ten} onChange={set('ho_ten')} required /></Field>
      <Field label="Ngày sinh" required hint={tuoi !== null ? `${tuoi} tuổi${treEm ? ' — dưới 15 tuổi, ghi người giám hộ' : ''}` : 'Bắt buộc, để phân biệt người dùng chung SĐT'}>
        <input type="date" value={f.ngay_sinh ?? ''} onChange={set('ngay_sinh')} required />
      </Field>
      <Field label="Giới tính">
        <select value={f.gioi_tinh ?? ''} onChange={set('gioi_tinh')}>
          <option value="">—</option><option value="NAM">Nam</option><option value="NU">Nữ</option><option value="KHAC">Khác</option>
        </select>
      </Field>
      <Field label="Số điện thoại" required hint="Trẻ chưa có số riêng thì ghi số của bố/mẹ">
        <input inputMode="tel" value={f.so_dien_thoai} onChange={set('so_dien_thoai')} required pattern="0[0-9]{9,10}" />
      </Field>
      <Field label="Địa chỉ" wide><input value={f.dia_chi ?? ''} onChange={set('dia_chi')} /></Field>
      {(treEm || f.nguoi_giam_ho) && (
        <>
          <Field label="Người giám hộ" required={treEm}><input value={f.nguoi_giam_ho ?? ''} onChange={set('nguoi_giam_ho')} required={treEm} /></Field>
          <Field label="Quan hệ" required={treEm || Boolean(f.nguoi_giam_ho)}>
            <input list="quan-he" value={f.quan_he_giam_ho ?? ''} onChange={set('quan_he_giam_ho')} required={treEm || Boolean(f.nguoi_giam_ho)} />
            <datalist id="quan-he"><option value="Mẹ" /><option value="Bố" /><option value="Ông" /><option value="Bà" /><option value="Người thân" /></datalist>
          </Field>
        </>
      )}
      <Field label="Tiền sử bệnh" wide><textarea value={f.tien_su_benh ?? ''} onChange={set('tien_su_benh')} rows={2} /></Field>
      <Field label="Dị ứng" hint="Ghi rõ “Không ghi nhận” nếu đã hỏi và không có">
        <input value={f.di_ung ?? ''} onChange={set('di_ung')} />
      </Field>
      <Field label="Ghi chú"><input value={f.ghi_chu ?? ''} onChange={set('ghi_chu')} /></Field>

      {moi && (
        <div className="field wide">
          <label className="check">
            <input type="checkbox" checked={f.nguon_ho_so === 'HO_SO_GIAY'}
              onChange={(e) => onChange({ ...f, nguon_ho_so: e.target.checked ? 'HO_SO_GIAY' : 'MOI' })} />
            Bệnh nhân cũ — chuyển từ hồ sơ giấy (UC08)
          </label>
        </div>
      )}
      {moi && f.nguon_ho_so === 'HO_SO_GIAY' && (
        <>
          <Field label="Số hồ sơ giấy"><input value={f.so_ho_so_giay} onChange={set('so_ho_so_giay')} placeholder="VD: HS-2019-0457" /></Field>
          <Field label="Ngày khám gần nhất (theo phiếu giấy)" hint="Dùng cho báo cáo quá 6 tháng chưa quay lại">
            <input type="date" value={f.ngay_kham_gan_nhat_giay} onChange={set('ngay_kham_gan_nhat_giay')} />
          </Field>
        </>
      )}
    </div>
  );
}
