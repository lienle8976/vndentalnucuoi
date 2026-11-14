'use client';
// UC37 — Chốt két cuối ca: đối soát tiền mặt; chuyển khoản liệt kê để đối chiếu sao kê (A25)
import { useState } from 'react';
import { api, useData } from '@/lib/api';
import { tien, thoiDiem, ngay, gio } from '@/lib/format';
import { HINH_THUC_TT } from '@/lib/nhan';
import ChonCa from '@/components/ChonCa';
import { PageHeader, Card, Loading, Empty, Field, Alert, MoneyInput, chay } from '@/components/ui';

export default function ChotKet() {
  const [ca, setCa] = useState(null);
  const { data, reload } = useData(ca ? `/thanh-toan/chot-ket/${ca}` : null);
  const [f, setF] = useState({ tien_dau_ca: 1000000, tien_mat_dem_duoc: '', giai_trinh: '' });

  const tienMat = data?.thu.filter((t) => t.hinh_thuc === 'TIEN_MAT') ?? [];
  const chuyenKhoan = data?.thu.filter((t) => t.hinh_thuc === 'CHUYEN_KHOAN') ?? [];
  const thuTienMat = tienMat.reduce((s, t) => s + t.so_tien, 0);
  const phaiCo = (Number(f.tien_dau_ca) || 0) + thuTienMat;
  const chenh = f.tien_mat_dem_duoc === '' ? null : Number(f.tien_mat_dem_duoc) - phaiCo;

  async function chot() {
    if (!confirm('Chốt két và khóa ca? Sau khi chốt không thu thêm vào ca này được.')) return;
    if (await chay(() => api('/thanh-toan/chot-ket', { method: 'POST', body: { ...f, ca_truc_id: ca } }), 'Đã chốt két')) reload();
  }

  return (
    <>
      <PageHeader title="Chốt két cuối ca" sub="Đếm tiền trong két, so với tiền mặt hệ thống đã thu trong ca">
        <div style={{ minWidth: 360 }}><ChonCa value={ca} onChange={setCa} chiCaMo={false} /></div>
      </PageHeader>
      {!ca ? <Empty text="Chọn ca lễ tân" /> : !data ? <Loading /> : (
        <div className="layout-side">
          <div>
            <Card title={`Tiền mặt trong ca (${tienMat.length} phiếu)`}>
              {tienMat.length === 0 ? <Empty /> : <BangThu ds={tienMat} />}
            </Card>
            <Card title={`Chuyển khoản trong ca (${chuyenKhoan.length}) — đối chiếu sao kê ngân hàng`}>
              {chuyenKhoan.length === 0 ? <Empty /> : <BangThu ds={chuyenKhoan} />}
            </Card>
          </div>
          <div>
            {data.da_chot ? (
              <Card title="Đã chốt két">
                <dl className="dl" style={{ gridTemplateColumns: '150px 1fr' }}>
                  <dt>Người chốt</dt><dd>{data.da_chot.nguoi_chot}</dd>
                  <dt>Lúc</dt><dd>{thoiDiem(data.da_chot.chot_luc)}</dd>
                  <dt>Tiền đầu ca</dt><dd>{tien(data.da_chot.tien_dau_ca)}</dd>
                  <dt>Tiền mặt thu</dt><dd>{tien(data.da_chot.tien_mat_thu_trong_ca)}</dd>
                  <dt>Đếm được</dt><dd>{tien(data.da_chot.tien_mat_dem_duoc)}</dd>
                  <dt>Chênh lệch</dt><dd className={data.da_chot.chenh_lech ? 'text-do bold' : 'text-luc'}>{tien(data.da_chot.chenh_lech)}</dd>
                  {data.da_chot.giai_trinh && <><dt>Giải trình</dt><dd>{data.da_chot.giai_trinh}</dd></>}
                  <dt>Chuyển khoản</dt><dd>{tien(data.da_chot.tong_chuyen_khoan)} ({data.da_chot.so_giao_dich_chuyen_khoan} GD)</dd>
                </dl>
              </Card>
            ) : (
              <Card title={`Chốt ca ${data.ca.ten_ca} ${ngay(data.ca.ngay)} (${gio(data.ca.gio_bat_dau)}–${gio(data.ca.gio_ket_thuc)})`}>
                <div style={{ display: 'grid', gap: 10 }}>
                  <Field label="Tiền đầu ca (tiền lẻ để sẵn)"><MoneyInput value={f.tien_dau_ca} onChange={(v) => setF({ ...f, tien_dau_ca: v })} /></Field>
                  <div className="tong-hd" style={{ maxWidth: 'none' }}>
                    <div className="dong"><span>Tiền mặt thu trong ca</span><span>{tien(thuTienMat)}</span></div>
                    <div className="dong bold"><span>Két phải có</span><span>{tien(phaiCo)}</span></div>
                  </div>
                  <Field label="Tiền mặt đếm được" required><MoneyInput value={f.tien_mat_dem_duoc} onChange={(v) => setF({ ...f, tien_mat_dem_duoc: v })} /></Field>
                  {chenh !== null && (chenh === 0
                    ? <Alert loai="ok">Khớp — không chênh lệch.</Alert>
                    : <Alert loai="canh-bao">Chênh lệch {chenh > 0 ? 'thừa' : 'thiếu'} {tien(Math.abs(chenh))}. Bắt buộc ghi giải trình.</Alert>)}
                  {chenh !== null && chenh !== 0 && <Field label="Giải trình" required><textarea value={f.giai_trinh} onChange={(e) => setF({ ...f, giai_trinh: e.target.value })} /></Field>}
                  <div className="muted small">Chuyển khoản trong ca: {tien(chuyenKhoan.reduce((s, t) => s + t.so_tien, 0))} — in danh sách bên trái để đối chiếu sao kê.</div>
                  <button className="btn btn-primary" disabled={f.tien_mat_dem_duoc === '' || (chenh !== 0 && !f.giai_trinh.trim())} onClick={chot}>Chốt két & khóa ca</button>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function BangThu({ ds }) {
  return (
    <table className="table"><thead><tr><th>Phiếu thu</th><th>Thời điểm</th><th>Hóa đơn · bệnh nhân</th><th>Hình thức</th><th className="num">Số tiền</th></tr></thead>
      <tbody>{ds.map((t) => (
        <tr key={t.id}><td>{t.ma_phieu_thu}</td><td>{thoiDiem(t.thoi_diem)}</td><td>{t.ma_hoa_don} · {t.benh_nhan}</td>
          <td>{HINH_THUC_TT[t.hinh_thuc]}{t.ma_giao_dich_ngan_hang && <div className="small muted">{t.ma_giao_dich_ngan_hang}</div>}</td>
          <td className="num">{tien(t.so_tien)}</td></tr>))}</tbody>
      <tfoot><tr><td colSpan={4}>Tổng</td><td className="num">{tien(ds.reduce((s, t) => s + t.so_tien, 0))}</td></tr></tfoot>
    </table>
  );
}
