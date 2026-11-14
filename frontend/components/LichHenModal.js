'use client';
// Chi tiết một lịch hẹn + thao tác: check-in (UC18), không đến (UC19), đổi (UC14), hủy (UC15)
import { useState } from 'react';
import Link from 'next/link';
import { api, useData } from '@/lib/api';
import { ngay, gio, thoiDiem } from '@/lib/format';
import { TRANG_THAI_LICH, KET_QUA_NHAC, BEN_HUY, NGUON_LICH } from '@/lib/nhan';
import { useNguoiDung, coVaiTro } from './Shell';
import { Modal, TrangThai, Field, Loading, chay } from './ui';

export default function LichHenModal({ id, onClose, onChanged }) {
  const user = useNguoiDung();
  const { data: l, reload } = useData(`/lich-hen/${id}`);
  const { data: dm } = useData('/danh-muc');
  const [huy, setHuy] = useState(null);
  const leTan = coVaiTro(user, 'LE_TAN', 'QUAN_LY');
  const bacSi = coVaiTro(user, 'BAC_SI', 'QUAN_LY');

  async function lam(path, body, msg) {
    const r = await chay(() => api(`/lich-hen/${id}/${path}`, { method: 'POST', body }), msg);
    if (r) { reload(); onChanged?.(); }
    return r;
  }

  const chuaDen = l && ['DA_DAT', 'DA_NHAC'].includes(l.trang_thai);

  return (
    <Modal title="Lịch hẹn" onClose={onClose} wide
      footer={l && (
        <>
          {leTan && chuaDen && !huy && <>
            <button className="btn btn-danger" onClick={() => setHuy({ ly_do_huy_id: '', ben_huy: 'BENH_NHAN', ly_do_huy_ghi_chu: '' })}>Hủy lịch</button>
            <button className="btn" onClick={() => lam('khong-den', undefined, 'Đã ghi nhận không đến')}>Không đến</button>
            <Link className="btn" href={`/lich-hen/dat?doi=${id}`}>Đổi lịch</Link>
            <button className="btn btn-primary" onClick={() => lam('check-in', undefined, 'Đã tiếp đón bệnh nhân')}>Check-in (đã đến)</button>
          </>}
          {bacSi && ['DA_DEN', 'DANG_KHAM', 'HOAN_THANH'].includes(l.trang_thai) && <Link className="btn btn-primary" href="/kham">Đến danh sách khám</Link>}
          {!huy && <button className="btn" onClick={onClose}>Đóng</button>}
        </>
      )}>
      {!l ? <Loading /> : (
        <>
          <dl className="dl">
            <dt>Bệnh nhân</dt><dd><Link href={`/benh-nhan/${l.benh_nhan_id}`}><b>{l.benh_nhan}</b></Link> · {l.ma_benh_nhan} · sinh {ngay(l.ngay_sinh)}
              {l.nguoi_giam_ho && <span className="muted"> · giám hộ {l.nguoi_giam_ho}</span>}</dd>
            <dt>Số điện thoại</dt><dd>{l.so_dien_thoai}</dd>
            <dt>Thời gian</dt><dd>{ngay(l.ngay, true)}, {gio(l.gio_bat_dau)}–{gio(l.gio_ket_thuc)} · Ghế {l.ma_ghe}</dd>
            <dt>Bác sĩ</dt><dd>{l.bac_si}</dd>
            <dt>Việc cần làm</dt><dd>{l.dich_vu_du_kien}{l.ghi_chu && <span className="muted"> — {l.ghi_chu}</span>}</dd>
            <dt>Trạng thái</dt><dd><TrangThai ma={l.trang_thai} bang={TRANG_THAI_LICH} /> <span className="muted small">Nguồn: {NGUON_LICH[l.nguon]} · Đặt bởi {l.nguoi_dat} lúc {thoiDiem(l.tao_luc)}</span></dd>
            {l.trang_thai === 'DA_HUY' && <>
              <dt>Hủy</dt><dd>{l.ly_do_huy} ({BEN_HUY[l.ben_huy]}){l.ly_do_huy_ghi_chu && ` — ${l.ly_do_huy_ghi_chu}`}<br />
                <span className="muted small">{l.nguoi_huy} · {thoiDiem(l.huy_luc)}</span></dd>
            </>}
          </dl>

          {huy && (
            <div className="card mt" style={{ background: '#fef3f2' }}>
              <h3>Hủy lịch hẹn</h3>
              <div className="form-grid">
                <Field label="Lý do" required>
                  <select value={huy.ly_do_huy_id} onChange={(e) => setHuy({ ...huy, ly_do_huy_id: e.target.value })}>
                    <option value="">— Chọn lý do —</option>
                    {dm?.ly_do_huy.map((x) => <option key={x.id} value={x.id}>{x.ten}</option>)}
                  </select>
                </Field>
                <Field label="Bên yêu cầu hủy" required>
                  <select value={huy.ben_huy} onChange={(e) => setHuy({ ...huy, ben_huy: e.target.value })}>
                    <option value="BENH_NHAN">Bệnh nhân</option><option value="PHONG_KHAM">Phòng khám</option>
                  </select>
                </Field>
                <Field label="Ghi chú" wide><input value={huy.ly_do_huy_ghi_chu} onChange={(e) => setHuy({ ...huy, ly_do_huy_ghi_chu: e.target.value })} /></Field>
              </div>
              <div className="gap mt">
                <button className="btn btn-danger" disabled={!huy.ly_do_huy_id}
                  onClick={async () => { if (await lam('huy', huy, 'Đã hủy lịch, khung giờ được giải phóng')) setHuy(null); }}>Xác nhận hủy</button>
                <button className="btn" onClick={() => setHuy(null)}>Thôi</button>
              </div>
            </div>
          )}

          {l.nhac.length > 0 && <>
            <h3 className="mt">Nhắc lịch</h3>
            <table className="table"><tbody>{l.nhac.map((n, i) => (
              <tr key={i}><td className="nowrap">{thoiDiem(n.thoi_diem)}</td><td><TrangThai ma={n.ket_qua} bang={KET_QUA_NHAC} /></td>
                <td>{n.noi_dung ?? n.ghi_chu ?? ''}</td><td className="muted">{n.nguoi_nhac}</td></tr>))}</tbody></table>
          </>}

          <h3 className="mt">Lịch sử thay đổi</h3>
          <table className="table"><tbody>{l.lich_su.map((s, i) => (
            <tr key={i}>
              <td className="nowrap">{thoiDiem(s.thoi_diem)}</td>
              <td>{s.hanh_dong === 'TAO' ? 'Tạo lịch' : s.hanh_dong === 'DOI_LICH' ? 'Đổi lịch' : 'Đổi trạng thái'}</td>
              <td>{s.hanh_dong === 'DOI_TRANG_THAI'
                ? `${TRANG_THAI_LICH[s.gia_tri_cu?.trang_thai]?.ten} → ${TRANG_THAI_LICH[s.gia_tri_moi?.trang_thai]?.ten}`
                : s.hanh_dong === 'DOI_LICH'
                  ? `${ngay(s.gia_tri_cu.ngay)} ${gio(s.gia_tri_cu.gio_bat_dau)} → ${ngay(s.gia_tri_moi.ngay)} ${gio(s.gia_tri_moi.gio_bat_dau)}`
                  : `${ngay(s.gia_tri_moi.ngay)} ${gio(s.gia_tri_moi.gio_bat_dau)}`}</td>
              <td className="muted">{s.nguoi_thao_tac}</td>
            </tr>))}</tbody></table>
        </>
      )}
    </Modal>
  );
}
