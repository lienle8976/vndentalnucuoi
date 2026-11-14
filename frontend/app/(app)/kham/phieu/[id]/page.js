'use client';
// UC21 Lập phiếu điều trị · UC22 Kê đơn · UC23/24 Liệu trình · UC25 Bác sĩ cùng làm
// UC26 Vật tư · UC27 Chỉ định tái khám · UC28 Sửa phiếu
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, useData } from '@/lib/api';
import { ngay, gio, tien, so } from '@/lib/format';
import { tenRang, TRANG_THAI_PHIEU, TRANG_THAI_HD } from '@/lib/nhan';
import { useNguoiDung } from '@/components/Shell';
import RangPicker from '@/components/RangPicker';
import LieuTrinhModal from '@/components/LieuTrinhModal';
import { PageHeader, Card, Loading, ErrorBox, Empty, TrangThai, Modal, Field, Alert, Badge, chay } from '@/components/ui';

export default function PhieuDieuTri() {
  const { id } = useParams();
  const user = useNguoiDung();
  const { data, error, reload } = useData(`/kham/phieu/${id}`);
  const { data: dm } = useData('/danh-muc');
  const [chanDoan, setChanDoan] = useState({ chan_doan: '', ghi_chu: '' });
  const [dong, setDong] = useState(null);          // form thêm / sửa dòng điều trị
  const [thuoc, setThuoc] = useState({ thuoc_id: '', lieu_dung: '', so_luong: '' });
  const [vtMoi, setVtMoi] = useState({ thuoc_vat_tu_id: '', so_luong: '' });
  const [chiDinh, setChiDinh] = useState({ sau_so_ngay: 180, dich_vu_id: '', ghi_chu: '' });
  const [taoLt, setTaoLt] = useState(false);

  useEffect(() => {
    if (data) setChanDoan({ chan_doan: data.phieu.chan_doan ?? '', ghi_chu: data.phieu.ghi_chu ?? '' });
  }, [data?.phieu.chan_doan, data?.phieu.ghi_chu]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data || !dm) return <Loading />;

  const { phieu: p, benh_nhan: bn } = data;
  const hoanTat = p.trang_thai === 'HOAN_TAT';
  const khoaDong = Boolean(data.hoa_don); // A24: có hóa đơn → không sửa dòng (đã thu: khóa hẳn; chưa thu: hủy HĐ trước)
  const thuoc_ds = dm.mat_hang.filter((m) => m.loai === 'THUOC');
  const tai = (fn, msg) => chay(fn, msg).then((r) => { if (r) reload(); return r; });

  const luuChanDoan = () => tai(() => api(`/kham/phieu/${id}`, { method: 'PATCH', body: chanDoan }), 'Đã lưu chẩn đoán');

  function moDong(d) {
    setDong(d ? {
      id: d.id, dich_vu_id: d.dich_vu_id, rang: d.rang, so_luong: d.so_luong, bac_si_thuc_hien_id: d.bac_si_thuc_hien_id,
      lieu_trinh_id: d.lieu_trinh_id ?? '', buoi_thu: d.buoi_thu ?? '', ghi_chu: d.ghi_chu ?? '',
    } : {
      dich_vu_id: p.dich_vu_du_kien_id, rang: '', so_luong: 1, bac_si_thuc_hien_id: p.bac_si_chinh_id, lieu_trinh_id: '', buoi_thu: '', ghi_chu: '',
    });
  }
  async function luuDong() {
    const r = await tai(() => (dong.id
      ? api(`/kham/phieu/${id}/dong/${dong.id}`, { method: 'PUT', body: dong })
      : api(`/kham/phieu/${id}/dong`, { method: 'POST', body: dong })), dong.id ? 'Đã sửa dòng điều trị' : 'Đã thêm dòng điều trị');
    if (r) setDong(null);
  }
  function chonLieuTrinh(ltId) {
    const lt = data.lieu_trinh.find((x) => String(x.id) === String(ltId));
    setDong({ ...dong, lieu_trinh_id: ltId, buoi_thu: lt ? lt.buoi_lon_nhat + 1 : '' });
  }

  async function hoanTatPhieu() {
    if (!data.dong.length) return chay(async () => { throw new Error('Phiếu phải có ít nhất một dòng điều trị'); });
    if (!data.vat_tu.length && data.goi_y_vat_tu.length) {
      if (!confirm('Chưa xác nhận vật tư đã dùng. Áp dụng số lượng gợi ý theo định mức rồi hoàn tất phiếu?')) return;
      if (!(await chay(() => api(`/kham/phieu/${id}/vat-tu/goi-y`, { method: 'POST' })))) return;
    } else if (!confirm('Hoàn tất phiếu? Hệ thống sẽ trừ kho thuốc & vật tư, phiếu chuyển sang chờ lập hóa đơn.')) return;
    tai(() => api(`/kham/phieu/${id}/hoan-tat`, { method: 'POST' }), 'Đã hoàn tất phiếu điều trị');
  }

  const dichVuDong = dong && dm.dich_vu.find((d) => String(d.id) === String(dong.dich_vu_id));

  return (
    <>
      <PageHeader title={`Phiếu điều trị ${p.ma_phieu}`}
        sub={`${ngay(p.ngay_kham, true)} · ${gio(p.gio_bat_dau)} · Ghế ${p.ma_ghe} · BS chính: ${p.bac_si_chinh}`}>
        <TrangThai ma={p.trang_thai} bang={TRANG_THAI_PHIEU} />
        <Link className="btn" href={`/kham/phieu/${id}/lich-su`}>Lịch sử chỉnh sửa</Link>
        {!hoanTat && <button className="btn btn-primary" onClick={hoanTatPhieu}>Hoàn tất phiếu</button>}
      </PageHeader>

      {hoanTat && data.hoa_don && (
        <Alert loai={data.hoa_don.da_thu > 0 ? 'canh-bao' : 'info'}>
          Hóa đơn {data.hoa_don.ma_hoa_don} (<TrangThai ma={data.hoa_don.trang_thai} bang={TRANG_THAI_HD} />, đã thu {tien(data.hoa_don.da_thu)}).
          {data.hoa_don.da_thu > 0 ? ' Đã thu tiền: chỉ còn sửa được chẩn đoán và ghi chú (A24).' : ' Muốn sửa dòng điều trị thì lễ tân hủy hóa đơn trước, sửa xong lập lại.'}
        </Alert>
      )}
      {hoanTat && !data.hoa_don && <Alert loai="ok">Phiếu đã hoàn tất, đang chờ lễ tân lập hóa đơn. Vẫn sửa được các dòng điều trị cho tới khi có hóa đơn; mọi lần sửa đều được ghi lịch sử.</Alert>}

      <div className="layout-side">
        <div>
          <Card title="Chẩn đoán">
            <div className="form-grid">
              <Field label="Chẩn đoán" wide><textarea rows={2} value={chanDoan.chan_doan} onChange={(e) => setChanDoan({ ...chanDoan, chan_doan: e.target.value })} /></Field>
              <Field label="Ghi chú" wide><textarea rows={2} value={chanDoan.ghi_chu} onChange={(e) => setChanDoan({ ...chanDoan, ghi_chu: e.target.value })} /></Field>
            </div>
            <button className="btn btn-sm mt" onClick={luuChanDoan}>Lưu chẩn đoán</button>
          </Card>

          <Card title="Việc đã làm" actions={!khoaDong && <button className="btn btn-sm btn-primary" onClick={() => moDong(null)}>+ Thêm dòng</button>}>
            {data.dong.length === 0 ? <Empty text="Chưa có dòng điều trị. Mỗi việc ghi dịch vụ + răng số mấy." /> : (
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Dịch vụ</th><th>Răng / vùng</th><th className="num">SL</th><th>Bác sĩ thực hiện</th><th>Liệu trình</th><th className="num">Giá tham khảo</th><th></th></tr></thead>
                <tbody>{data.dong.map((d) => (
                  <tr key={d.id}>
                    <td>{d.dich_vu}{d.ghi_chu && <div className="small muted">{d.ghi_chu}</div>}</td>
                    <td>{tenRang(d.rang)}</td>
                    <td className="num">{so(d.so_luong)}</td>
                    <td>{d.bac_si_thuc_hien}{d.bac_si_thuc_hien_id !== p.bac_si_chinh_id && <> <Badge nhan="cùng làm" mau="xanh" /></>}</td>
                    <td>{d.lieu_trinh ? <>{d.ma_lieu_trinh} · buổi {d.buoi_thu}</> : '—'}</td>
                    <td className="num">{d.lieu_trinh_id ? <span className="muted">trong gói</span> : tien(d.don_gia_tham_khao * d.so_luong)}</td>
                    <td className="right nowrap">{!khoaDong && <>
                      <button className="btn btn-sm" onClick={() => moDong(d)}>Sửa</button>{' '}
                      <button className="btn btn-sm btn-danger" onClick={() => confirm('Xóa dòng này?') && tai(() => api(`/kham/phieu/${id}/dong/${d.id}`, { method: 'DELETE' }), 'Đã xóa dòng')}>×</button>
                    </>}</td>
                  </tr>))}</tbody>
              </table></div>
            )}
          </Card>

          <Card title="Đơn thuốc (phát tại phòng khám)">
            {data.don_thuoc.length > 0 && (
              <table className="table"><thead><tr><th>Thuốc</th><th>Liều dùng</th><th className="num">SL</th><th className="num">Tồn</th><th className="num">Đơn giá</th><th></th></tr></thead>
                <tbody>{data.don_thuoc.map((t) => (
                  <tr key={t.id}><td>{t.ten}</td><td>{t.lieu_dung}</td><td className="num">{so(t.so_luong)} {t.don_vi_tinh}</td>
                    <td className="num">{so(t.ton_kho)}</td><td className="num">{tien(t.don_gia)}</td>
                    <td className="right">{!hoanTat && <button className="btn btn-sm btn-danger" onClick={() => tai(() => api(`/kham/phieu/${id}/thuoc/${t.id}`, { method: 'DELETE' }))}>×</button>}</td></tr>))}</tbody></table>
            )}
            {!hoanTat ? (
              <div className="form-grid mt">
                <Field label="Thuốc">
                  <select value={thuoc.thuoc_id} onChange={(e) => setThuoc({ ...thuoc, thuoc_id: e.target.value })}>
                    <option value="">— Chọn thuốc —</option>
                    {thuoc_ds.map((m) => <option key={m.id} value={m.id}>{m.ten} (tồn {so(m.ton_kho)} {m.don_vi_tinh})</option>)}
                  </select>
                </Field>
                <Field label="Liều dùng"><input value={thuoc.lieu_dung} onChange={(e) => setThuoc({ ...thuoc, lieu_dung: e.target.value })} placeholder="Uống 1 viên x 3 lần/ngày sau ăn" /></Field>
                <Field label="Số lượng"><input type="number" min={1} value={thuoc.so_luong} onChange={(e) => setThuoc({ ...thuoc, so_luong: e.target.value })} /></Field>
                <div className="field" style={{ justifyContent: 'flex-end' }}>
                  <button className="btn" disabled={!thuoc.thuoc_id || !thuoc.lieu_dung || !thuoc.so_luong}
                    onClick={async () => { if (await tai(() => api(`/kham/phieu/${id}/thuoc`, { method: 'POST', body: thuoc }), 'Đã kê thuốc')) setThuoc({ thuoc_id: '', lieu_dung: '', so_luong: '' }); }}>+ Kê thuốc</button>
                </div>
              </div>
            ) : data.don_thuoc.length === 0 && <p className="muted">Không kê thuốc.</p>}
          </Card>

          <Card title="Vật tư đã dùng" actions={!hoanTat && data.goi_y_vat_tu.length > 0 &&
            <button className="btn btn-sm" onClick={() => tai(() => api(`/kham/phieu/${id}/vat-tu/goi-y`, { method: 'POST' }), 'Đã áp dụng gợi ý theo định mức')}>Lấy gợi ý theo định mức</button>}>
            {data.vat_tu.length === 0 && data.goi_y_vat_tu.length > 0 && !hoanTat && (
              <p className="muted small">Gợi ý theo định mức: {data.goi_y_vat_tu.map((g) => `${g.ten} ${so(g.so_luong_goi_y)} ${g.don_vi_tinh}`).join('; ')}</p>
            )}
            {data.vat_tu.length > 0 && (
              <table className="table"><thead><tr><th>Vật tư</th><th className="num">Định mức</th><th>Thực dùng</th><th className="num">Tồn kho</th><th></th></tr></thead>
                <tbody>{data.vat_tu.map((v) => (
                  <tr key={v.id} className={v.ton_kho <= v.nguong_toi_thieu ? 'row-warn' : ''}>
                    <td>{v.ten}</td><td className="num">{v.so_luong_dinh_muc !== null ? so(v.so_luong_dinh_muc) : '—'}</td>
                    <td>{hoanTat ? `${so(v.so_luong)} ${v.don_vi_tinh}` : (
                      <input className="inline-input" type="number" step="0.5" min="0.5" defaultValue={v.so_luong}
                        onBlur={(e) => Number(e.target.value) !== v.so_luong && tai(() => api(`/kham/phieu/${id}/vat-tu`, { method: 'PUT', body: { thuoc_vat_tu_id: v.thuoc_vat_tu_id, so_luong: e.target.value } }), 'Đã cập nhật số lượng')} />
                    )}</td>
                    <td className="num">{so(v.ton_kho)} {v.don_vi_tinh}</td>
                    <td className="right">{!hoanTat && <button className="btn btn-sm btn-danger" onClick={() => tai(() => api(`/kham/phieu/${id}/vat-tu/${v.id}`, { method: 'DELETE' }))}>×</button>}</td>
                  </tr>))}</tbody></table>
            )}
            {!hoanTat && (
              <div className="gap mt">
                <select value={vtMoi.thuoc_vat_tu_id} onChange={(e) => setVtMoi({ ...vtMoi, thuoc_vat_tu_id: e.target.value })} style={{ maxWidth: 280 }}>
                  <option value="">— Thêm vật tư khác —</option>
                  {dm.mat_hang.filter((m) => m.loai === 'VAT_TU').map((m) => <option key={m.id} value={m.id}>{m.ten} ({m.don_vi_tinh})</option>)}
                </select>
                <input className="inline-input" type="number" step="0.5" min="0.5" placeholder="SL" value={vtMoi.so_luong} onChange={(e) => setVtMoi({ ...vtMoi, so_luong: e.target.value })} />
                <button className="btn btn-sm" disabled={!vtMoi.thuoc_vat_tu_id || !vtMoi.so_luong}
                  onClick={async () => { if (await tai(() => api(`/kham/phieu/${id}/vat-tu`, { method: 'PUT', body: vtMoi }))) setVtMoi({ thuoc_vat_tu_id: '', so_luong: '' }); }}>Thêm</button>
              </div>
            )}
            {hoanTat && <p className="muted small">Đã trừ kho khi hoàn tất phiếu. Sai lệch xử lý bằng kiểm kê.</p>}
          </Card>

          <Card title="Chỉ định tái khám">
            {data.chi_dinh.map((c) => (
              <div key={c.id} className="gap" style={{ padding: '4px 0' }}>
                <span>Sau <b>{c.sau_so_ngay ?? '—'}</b> ngày{c.ngay_du_kien && ` (ngày ${ngay(c.ngay_du_kien)})`} — {c.dich_vu ?? 'Tái khám'}{c.ghi_chu && `: ${c.ghi_chu}`}</span>
                {c.da_dat_ngay ? <Badge nhan={`Đã đặt lịch ${ngay(c.da_dat_ngay)}`} mau="luc" /> : <Badge nhan="Lễ tân đặt lịch khi thanh toán" />}
                {!c.da_dat_ngay && <button className="btn btn-sm btn-danger" onClick={() => tai(() => api(`/kham/phieu/${id}/chi-dinh/${c.id}`, { method: 'DELETE' }))}>×</button>}
              </div>
            ))}
            <div className="gap mt">
              <span>Hẹn sau</span>
              <input className="inline-input" type="number" min={1} value={chiDinh.sau_so_ngay} onChange={(e) => setChiDinh({ ...chiDinh, sau_so_ngay: e.target.value })} />
              <span>ngày, làm</span>
              <select value={chiDinh.dich_vu_id} onChange={(e) => setChiDinh({ ...chiDinh, dich_vu_id: e.target.value })} style={{ maxWidth: 240 }}>
                <option value="">Tái khám</option>
                {dm.dich_vu.map((d) => <option key={d.id} value={d.id}>{d.ten}</option>)}
              </select>
              <input placeholder="Ghi chú" value={chiDinh.ghi_chu} onChange={(e) => setChiDinh({ ...chiDinh, ghi_chu: e.target.value })} style={{ maxWidth: 220 }} />
              <button className="btn btn-sm" onClick={async () => { if (await tai(() => api(`/kham/phieu/${id}/chi-dinh`, { method: 'POST', body: chiDinh }), 'Đã ghi chỉ định tái khám')) setChiDinh({ sau_so_ngay: 180, dich_vu_id: '', ghi_chu: '' }); }}>+ Ghi chỉ định</button>
            </div>
          </Card>
        </div>

        <div>
          <Card title="Bệnh nhân">
            <Link href={`/benh-nhan/${bn.id}`}><b>{bn.ho_ten}</b></Link>
            <div className="muted">{bn.ma_benh_nhan} · {bn.tuoi} tuổi · {bn.so_dien_thoai}</div>
            {bn.nguoi_giam_ho && <div className="muted small">Giám hộ: {bn.nguoi_giam_ho} ({bn.quan_he_giam_ho})</div>}
            <dl className="dl mt" style={{ gridTemplateColumns: '90px 1fr' }}>
              <dt>Dị ứng</dt><dd>{bn.di_ung && !/không/i.test(bn.di_ung) ? <span className="di-ung">{bn.di_ung}</span> : bn.di_ung ?? '—'}</dd>
              <dt>Tiền sử</dt><dd>{bn.tien_su_benh ?? '—'}</dd>
              <dt>Ghi chú</dt><dd>{bn.ghi_chu ?? '—'}</dd>
              <dt>Lý do hẹn</dt><dd>{p.dich_vu_du_kien}{p.ghi_chu_lich && ` — ${p.ghi_chu_lich}`}</dd>
            </dl>
          </Card>
          <Card title="Liệu trình đang thực hiện" actions={<button className="btn btn-sm" onClick={() => setTaoLt(true)}>+ Tạo</button>}>
            {data.lieu_trinh.length === 0 ? <p className="muted">Không có.</p> : data.lieu_trinh.map((l) => (
              <div key={l.id} style={{ padding: '4px 0' }}>
                <b>{l.ma_lieu_trinh}</b> {l.ten}
                <div className="small muted">Đã tới buổi {l.buoi_lon_nhat}/{l.so_buoi_du_kien} · {tien(l.gia_tron_goi)} · BS {l.bac_si_phu_trach}</div>
              </div>
            ))}
          </Card>
          <Card title="Lần khám trước">
            {data.lich_su_kham.length === 0 ? <p className="muted">Lần khám đầu tiên trên hệ thống.</p> : data.lich_su_kham.map((h) => (
              <div key={h.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <Link href={`/kham/phieu/${h.id}`}>{ngay(h.ngay_kham)}</Link> <span className="muted small">· {h.bac_si}</span>
                <div className="small">{h.chan_doan}</div>
                <div className="small muted">{h.cong_viec}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {dong && (
        <Modal title={dong.id ? 'Sửa dòng điều trị' : 'Thêm dòng điều trị'} onClose={() => setDong(null)} wide
          footer={<><button className="btn" onClick={() => setDong(null)}>Hủy</button>
            <button className="btn btn-primary" disabled={!dong.dich_vu_id || !dong.rang} onClick={luuDong}>Lưu</button></>}>
          <div className="form-grid">
            <Field label="Dịch vụ" required>
              <select value={dong.dich_vu_id} onChange={(e) => setDong({ ...dong, dich_vu_id: e.target.value })}>
                {dm.dich_vu.filter((d) => !d.la_lieu_trinh).map((d) => <option key={d.id} value={d.id}>{d.nhom} · {d.ten}</option>)}
              </select>
            </Field>
            <Field label="Số lượng"><input type="number" min={1} value={dong.so_luong} onChange={(e) => setDong({ ...dong, so_luong: e.target.value })} /></Field>
            <Field label="Bác sĩ thực hiện" hint="Người làm việc này và được tính doanh thu (QĐ1)">
              <select value={dong.bac_si_thuc_hien_id} onChange={(e) => setDong({ ...dong, bac_si_thuc_hien_id: e.target.value })}>
                {dm.bac_si.map((b) => <option key={b.id} value={b.id}>{b.ho_ten}{b.id === p.bac_si_chinh_id ? ' (bác sĩ chính)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Thuộc liệu trình" hint="Dòng trong liệu trình không tính tiền riêng (A20)">
              <select value={dong.lieu_trinh_id} onChange={(e) => chonLieuTrinh(e.target.value)}>
                <option value="">Không</option>
                {data.lieu_trinh.map((l) => <option key={l.id} value={l.id}>{l.ma_lieu_trinh} · {l.ten}</option>)}
              </select>
            </Field>
            {dong.lieu_trinh_id && <Field label="Buổi thứ"><input type="number" min={1} value={dong.buoi_thu} onChange={(e) => setDong({ ...dong, buoi_thu: e.target.value })} /></Field>}
            <Field label="Ghi chú"><input value={dong.ghi_chu} onChange={(e) => setDong({ ...dong, ghi_chu: e.target.value })} /></Field>
          </div>
          <div className="mt">
            <div className="field-label mb">Răng / vùng: <b>{dong.rang ? tenRang(dong.rang) : 'chưa chọn'}</b></div>
            <RangPicker value={dong.rang} onChange={(r) => setDong({ ...dong, rang: r })} />
          </div>
          {dichVuDong && !dong.lieu_trinh_id && <p className="muted small mt">Giá hiện hành: {tien(dichVuDong.don_gia)} / {dichVuDong.don_vi_tinh}</p>}
        </Modal>
      )}
      {taoLt && <LieuTrinhModal benhNhanId={bn.id} bacSiId={user.id} onClose={() => setTaoLt(false)} onDone={() => { setTaoLt(false); reload(); }} />}
    </>
  );
}
