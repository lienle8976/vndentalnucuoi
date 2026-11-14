'use client';
// UC31/UC33 hóa đơn · UC32 giảm giá (dòng / tổng, nhập % hoặc số tiền — QĐ3) · UC34 thu tiền · UC35 in · A23 hủy
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, useData } from '@/lib/api';
import { ngay, tien, so, thoiDiem, homNay } from '@/lib/format';
import { LOAI_HD, TRANG_THAI_HD, HINH_THUC_TT } from '@/lib/nhan';
import ChonCa from '@/components/ChonCa';
import { PageHeader, Card, Loading, ErrorBox, TrangThai, Modal, Field, Alert, MoneyInput, chay } from '@/components/ui';

/** Hộp nhập giảm giá: chọn % hoặc số tiền, luôn trả về số tiền */
function GiamGiaModal({ title, coSo, giaTri, lyDo, onClose, onSave }) {
  const [kieu, setKieu] = useState('tien');
  const [nhap, setNhap] = useState(giaTri || '');
  const [ld, setLd] = useState(lyDo ?? '');
  const soTien = kieu === 'pct' ? Math.round((coSo * (Number(nhap) || 0)) / 100) : Number(nhap) || 0;
  return (
    <Modal title={title} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Hủy</button>
        <button className="btn btn-primary" disabled={soTien > coSo || (soTien > 0 && !ld.trim())} onClick={() => onSave(soTien, ld)}>Áp dụng</button></>}>
      <div className="gap mb">
        <label className="check"><input type="radio" checked={kieu === 'tien'} onChange={() => setKieu('tien')} /> Số tiền</label>
        <label className="check"><input type="radio" checked={kieu === 'pct'} onChange={() => { setKieu('pct'); setNhap(''); }} /> Phần trăm</label>
      </div>
      <div className="form-grid">
        <Field label={kieu === 'pct' ? 'Giảm (%)' : 'Giảm (đ)'} hint={`Tính trên ${tien(coSo)}. Hệ thống luôn lưu thành số tiền.`}>
          {kieu === 'pct'
            ? <input type="number" min={0} max={100} value={nhap} onChange={(e) => setNhap(e.target.value)} />
            : <MoneyInput value={nhap} onChange={setNhap} />}
        </Field>
        <Field label="Lý do" required={soTien > 0}><input value={ld} onChange={(e) => setLd(e.target.value)} placeholder="Khách quen, khuyến mãi…" /></Field>
      </div>
      <p>Số tiền giảm: <b>{tien(soTien)}</b> {soTien > coSo && <span className="text-do">— vượt quá {tien(coSo)}</span>}</p>
    </Modal>
  );
}

export default function HoaDon() {
  const { id } = useParams();
  const { data: h, error, reload } = useData(`/thanh-toan/hoa-don/${id}`);
  const [giam, setGiam] = useState(null); // { loai: 'tong' } | { loai: 'dong', dong }
  const [thu, setThu] = useState({ so_tien: '', hinh_thuc: 'TIEN_MAT', ma_giao_dich_ngan_hang: '', ca_truc_id: null, ghi_chu: '' });
  const [huy, setHuy] = useState(null);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!h) return <Loading />;

  const nhap = h.trang_thai === 'NHAP';
  const chot = h.trang_thai === 'DA_CHOT';
  const tamTinh = h.dong.reduce((s, d) => s + Math.round(d.don_gia * d.so_luong), 0);
  const giamDong = h.dong.reduce((s, d) => s + d.giam_gia_dong, 0);
  const tai = (fn, msg) => chay(fn, msg).then((r) => { if (r) reload(); return r; });

  async function luuGiam(soTien, lyDo) {
    const r = giam.loai === 'tong'
      ? await tai(() => api(`/thanh-toan/hoa-don/${id}`, { method: 'PATCH', body: { giam_gia_tong: soTien, ly_do_giam_gia: lyDo } }), 'Đã áp dụng giảm giá tổng')
      : await tai(() => api(`/thanh-toan/hoa-don/${id}/dong/${giam.dong.id}`, { method: 'PATCH', body: { giam_gia_dong: soTien, ly_do_giam_gia_dong: lyDo } }), 'Đã áp dụng giảm giá dòng');
    if (r) setGiam(null);
  }

  async function thuTien() {
    const r = await tai(() => api(`/thanh-toan/hoa-don/${id}/thu-tien`, { method: 'POST', body: { ...thu, so_tien: thu.so_tien || h.con_no } }), 'Đã ghi phiếu thu');
    if (r) setThu({ ...thu, so_tien: '', ma_giao_dich_ngan_hang: '', ghi_chu: '' });
  }

  return (
    <>
      <PageHeader title={`Hóa đơn ${h.ma_hoa_don}`} sub={`${LOAI_HD[h.loai]} · lập ${ngay(h.ngay_lap)} bởi ${h.nguoi_lap}`}>
        <TrangThai ma={h.trang_thai} bang={TRANG_THAI_HD} />
        {chot && <a className="btn" href={`/in/hoa-don/${id}`} target="_blank" rel="noreferrer">In hóa đơn / biên lai</a>}
        {h.trang_thai !== 'DA_HUY' && h.da_thu === 0 && <button className="btn btn-danger" onClick={() => setHuy('')}>Hủy hóa đơn</button>}
        {nhap && <button className="btn btn-primary" onClick={() => confirm('Chốt hóa đơn? Sau khi chốt, giá và giảm giá không đổi được nữa.') && tai(() => api(`/thanh-toan/hoa-don/${id}/chot`, { method: 'POST' }), 'Đã chốt hóa đơn')}>Chốt hóa đơn</button>}
      </PageHeader>

      {h.trang_thai === 'DA_HUY' && <Alert loai="loi">Đã hủy bởi {h.nguoi_huy} lúc {thoiDiem(h.huy_luc)}: {h.ly_do_huy}</Alert>}
      {nhap && <Alert loai="info">Hóa đơn nháp: có thể giảm giá theo dòng hoặc giảm tổng. Khi chốt, giảm tổng được chia xuống từng dòng theo tỷ lệ (QĐ3).</Alert>}
      {h.tai_kham.length > 0 && h.trang_thai !== 'DA_HUY' && (
        <Alert loai="canh-bao">
          Bác sĩ chỉ định tái khám: {h.tai_kham.map((t) => `${t.dich_vu ?? 'Tái khám'} khoảng ngày ${ngay(t.ngay_du_kien)}`).join('; ')}.
          {h.tai_kham.map((t) => (
            <Link key={t.id} className="btn btn-sm btn-primary"
              href={`/lich-hen/dat?benh_nhan_id=${h.benh_nhan_id}&chi_dinh_id=${t.id}${t.dich_vu_id ? `&dich_vu_id=${t.dich_vu_id}` : ''}&bac_si_id=${t.bac_si_chinh_id}&ngay=${t.ngay_du_kien > homNay() ? t.ngay_du_kien : homNay(1)}`}>
              Đặt lịch tái khám
            </Link>
          ))}
        </Alert>
      )}

      <div className="layout-side">
        <div>
          <Card title="Chi tiết">
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Nội dung</th><th>Bác sĩ</th><th className="num">Đơn giá</th><th className="num">SL</th><th className="num">Giảm dòng</th><th className="num">Phân bổ giảm tổng</th><th className="num">Thành tiền</th>{nhap && <th />}</tr></thead>
              <tbody>{h.dong.map((d) => (
                <tr key={d.id}>
                  <td>{d.mo_ta}<div className="small muted">Ngày làm {ngay(d.ngay_thuc_hien)}</div></td>
                  <td>{d.bac_si ?? '—'}</td>
                  <td className="num">{tien(d.don_gia)}</td><td className="num">{so(d.so_luong)}</td>
                  <td className="num">{d.giam_gia_dong ? <span title={`${d.ly_do_giam_gia_dong} — ${d.nguoi_giam_gia_dong ?? ''}`}>−{tien(d.giam_gia_dong)}</span> : '—'}</td>
                  <td className="num">{d.giam_gia_phan_bo ? `−${tien(d.giam_gia_phan_bo)}` : '—'}</td>
                  <td className="num bold">{tien(d.thanh_tien)}</td>
                  {nhap && <td className="right"><button className="btn btn-sm" onClick={() => setGiam({ loai: 'dong', dong: d })}>Giảm</button></td>}
                </tr>))}</tbody>
            </table></div>
            <div className="tong-hd mt">
              <div className="dong"><span>Tạm tính</span><span>{tien(tamTinh)}</span></div>
              <div className="dong"><span>Giảm theo dòng</span><span>−{tien(giamDong)}</span></div>
              <div className="dong"><span>Giảm tổng {h.ly_do_giam_gia && <span className="muted small">({h.ly_do_giam_gia})</span>}
                {nhap && <button className="btn btn-sm btn-ghost" onClick={() => setGiam({ loai: 'tong' })}>Sửa</button>}</span>
                <span>−{tien(h.giam_gia_tong)}</span></div>
              <div className="dong lon"><span>Tổng cộng</span><span>{tien(h.tong_tien)}</span></div>
              {chot && <>
                <div className="dong"><span>Đã thu</span><span className="text-luc">{tien(h.da_thu)}</span></div>
                <div className="dong bold"><span>Còn nợ</span><span className={h.con_no > 0 ? 'text-do' : ''}>{tien(h.con_no)}</span></div>
              </>}
            </div>
          </Card>

          {h.thanh_toan.length > 0 && (
            <Card title="Các lần thu tiền">
              <table className="table"><thead><tr><th>Phiếu thu</th><th>Thời điểm</th><th>Hình thức</th><th className="num">Số tiền</th><th>Người thu · ca</th></tr></thead>
                <tbody>{h.thanh_toan.map((t) => (
                  <tr key={t.id}><td>{t.ma_phieu_thu}</td><td>{thoiDiem(t.thoi_diem)}</td>
                    <td>{HINH_THUC_TT[t.hinh_thuc]}{t.ma_giao_dich_ngan_hang && <div className="small muted">Mã GD: {t.ma_giao_dich_ngan_hang}</div>}</td>
                    <td className="num">{tien(t.so_tien)}</td><td>{t.nguoi_thu} · {t.ten_ca} {ngay(t.ngay_ca)}</td></tr>))}</tbody></table>
            </Card>
          )}
        </div>

        <div>
          <Card title="Bệnh nhân">
            <Link href={`/benh-nhan/${h.benh_nhan_id}`}><b>{h.benh_nhan}</b></Link>
            <div className="muted">{h.ma_benh_nhan} · {h.so_dien_thoai}</div>
            {h.ma_phieu && <div className="small mt">Phiếu {h.ma_phieu} — khám ngày {ngay(h.ngay_kham)}</div>}
            {h.ma_lieu_trinh && <div className="small mt">Liệu trình {h.ma_lieu_trinh} — {h.lieu_trinh}, đợt {h.dot_so}</div>}
            {chot && <div className="small muted mt">Chốt bởi {h.nguoi_chot} lúc {thoiDiem(h.chot_luc)}</div>}
          </Card>
          {chot && h.con_no > 0 && (
            <Card title="Thu tiền">
              <div style={{ display: 'grid', gap: 10 }}>
                <Field label="Số tiền" hint={`Còn nợ ${tien(h.con_no)} — có thể thu một phần`}>
                  <MoneyInput value={thu.so_tien} placeholder={new Intl.NumberFormat('vi-VN').format(h.con_no)} onChange={(v) => setThu({ ...thu, so_tien: v })} />
                </Field>
                <Field label="Hình thức">
                  <div className="gap">
                    {Object.entries(HINH_THUC_TT).map(([k, v]) => (
                      <label key={k} className="check"><input type="radio" checked={thu.hinh_thuc === k} onChange={() => setThu({ ...thu, hinh_thuc: k })} /> {v}</label>
                    ))}
                  </div>
                </Field>
                {thu.hinh_thuc === 'CHUYEN_KHOAN' && <Field label="Mã giao dịch ngân hàng"><input value={thu.ma_giao_dich_ngan_hang} onChange={(e) => setThu({ ...thu, ma_giao_dich_ngan_hang: e.target.value })} /></Field>}
                <Field label="Ca lễ tân"><ChonCa value={thu.ca_truc_id} onChange={(v) => setThu((x) => ({ ...x, ca_truc_id: v }))} /></Field>
                <Field label="Ghi chú"><input value={thu.ghi_chu} onChange={(e) => setThu({ ...thu, ghi_chu: e.target.value })} /></Field>
                <button className="btn btn-primary" disabled={!thu.ca_truc_id || Number(thu.so_tien || h.con_no) > h.con_no} onClick={thuTien}>
                  Thu {tien(thu.so_tien || h.con_no)}
                </button>
              </div>
            </Card>
          )}
          {chot && h.con_no === 0 && <Alert loai="ok">Hóa đơn đã thanh toán đủ.</Alert>}
        </div>
      </div>

      {giam && (
        <GiamGiaModal
          title={giam.loai === 'tong' ? 'Giảm giá tổng hóa đơn' : `Giảm giá: ${giam.dong.mo_ta}`}
          coSo={giam.loai === 'tong' ? tamTinh - giamDong : Math.round(giam.dong.don_gia * giam.dong.so_luong)}
          giaTri={giam.loai === 'tong' ? h.giam_gia_tong : giam.dong.giam_gia_dong}
          lyDo={giam.loai === 'tong' ? h.ly_do_giam_gia : giam.dong.ly_do_giam_gia_dong}
          onClose={() => setGiam(null)} onSave={luuGiam} />
      )}
      {huy !== null && (
        <Modal title="Hủy hóa đơn" onClose={() => setHuy(null)}
          footer={<><button className="btn" onClick={() => setHuy(null)}>Thôi</button>
            <button className="btn btn-danger" disabled={!huy.trim()} onClick={async () => { if (await tai(() => api(`/thanh-toan/hoa-don/${id}/huy`, { method: 'POST', body: { ly_do: huy } }), 'Đã hủy hóa đơn')) setHuy(null); }}>Hủy hóa đơn</button></>}>
          <p className="muted">Hóa đơn không bị xóa, chỉ chuyển sang trạng thái đã hủy (chỉ được hủy khi chưa thu đồng nào).</p>
          <Field label="Lý do" required><input autoFocus value={huy} onChange={(e) => setHuy(e.target.value)} placeholder="VD: Bác sĩ sửa lại phiếu điều trị" /></Field>
        </Modal>
      )}
    </>
  );
}
