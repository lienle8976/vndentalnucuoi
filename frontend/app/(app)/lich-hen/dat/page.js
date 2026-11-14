'use client';
// UC13 — Đặt lịch hẹn (gồm UC04 tìm bệnh nhân, UC12 tìm khung trống); UC14 — Đổi lịch (?doi=id)
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, useData } from '@/lib/api';
import { ngay, gio, homNay, tien } from '@/lib/format';
import { PageHeader, Card, Field, Loading, Empty, Alert, chay } from '@/components/ui';

function ChonBenhNhan({ onChon }) {
  const [tu, setTu] = useState('');
  const [tim, setTim] = useState('');
  useEffect(() => { const t = setTimeout(() => setTim(tu.trim()), 300); return () => clearTimeout(t); }, [tu]);
  const { data } = useData(tim ? `/benh-nhan?q=${encodeURIComponent(tim)}` : null);
  const laSdt = /^0\d{9,10}$/.test(tim);
  return (
    <Card title="1. Bệnh nhân">
      <input autoFocus placeholder="Khách đọc số điện thoại, hoặc gõ tên / mã BN" value={tu} onChange={(e) => setTu(e.target.value)} />
      {data && (data.length === 0 ? (
        <div className="mt"><Empty text="Không tìm thấy." />
          <Link className="btn btn-primary" href={`/benh-nhan/moi?quay_lai=dat-lich${laSdt ? `&sdt=${tim}` : ''}`}>+ Đăng ký bệnh nhân mới</Link></div>
      ) : (
        <>
          {data.length > 1 && laSdt && <Alert loai="info">Số này có {data.length} người dùng chung — chọn theo tên và ngày sinh.</Alert>}
          <table className="table mt"><tbody>
            {data.filter((b) => b.dang_hoat_dong).map((b) => (
              <tr key={b.id} className="clickable" onClick={() => onChon(b)}>
                <td><b>{b.ho_ten}</b><div className="muted small">{b.ma_benh_nhan}</div></td>
                <td>{ngay(b.ngay_sinh)} ({b.tuoi} tuổi)</td><td>{b.so_dien_thoai}</td>
                <td className="muted">{b.nguoi_giam_ho ? `Giám hộ: ${b.nguoi_giam_ho}` : ''}</td>
                <td className="right"><button className="btn btn-sm btn-primary">Chọn</button></td>
              </tr>
            ))}
          </tbody></table>
          <Link className="btn btn-sm mt" href={`/benh-nhan/moi?quay_lai=dat-lich${laSdt ? `&sdt=${tim}` : ''}`}>+ Người khác — đăng ký mới</Link>
        </>
      ))}
    </Card>
  );
}

function DatLich() {
  const router = useRouter();
  const sp = useSearchParams();
  const doiId = sp.get('doi');
  const { data: dm } = useData('/danh-muc');
  const { data: lichCu } = useData(doiId ? `/lich-hen/${doiId}` : null);
  const bnId = sp.get('benh_nhan_id') ?? lichCu?.benh_nhan_id;
  const { data: hoSo } = useData(bnId && !doiId ? `/benh-nhan/${bnId}` : null);

  const [bn, setBn] = useState(null);
  const [f, setF] = useState({
    dich_vu_du_kien_id: sp.get('dich_vu_id') ?? '', bac_si_id: sp.get('bac_si_id') ?? '', ngay: sp.get('ngay') ?? homNay(1),
    nguon: 'DIEN_THOAI', ghi_chu: '',
  });
  const [chon, setChon] = useState(null); // { bac_si_id, gio_bat_dau, ghe_id }
  const [dangGui, setDangGui] = useState(false);

  useEffect(() => { if (hoSo) setBn(hoSo.benh_nhan); }, [hoSo]);
  useEffect(() => {
    if (lichCu) {
      setBn({ id: lichCu.benh_nhan_id, ho_ten: lichCu.benh_nhan, ma_benh_nhan: lichCu.ma_benh_nhan, ngay_sinh: lichCu.ngay_sinh, so_dien_thoai: lichCu.so_dien_thoai });
      setF((x) => ({ ...x, dich_vu_du_kien_id: lichCu.dich_vu_du_kien_id, bac_si_id: String(lichCu.bac_si_id), ngay: lichCu.ngay, ghi_chu: lichCu.ghi_chu ?? '' }));
    }
  }, [lichCu]);

  const { data: khung, loading } = useData(f.ngay ? `/lich-hen/khung-trong?ngay=${f.ngay}&bac_si_id=${f.bac_si_id}` : null);

  // Gom theo giờ: mỗi giờ có các bác sĩ còn trống
  const theoGio = useMemo(() => {
    const m = new Map();
    for (const k of khung ?? []) {
      if (!m.has(k.gio_bat_dau)) m.set(k.gio_bat_dau, []);
      m.get(k.gio_bat_dau).push(k);
    }
    return [...m.entries()];
  }, [khung]);

  // Chọn sẵn khi bấm ô trống từ lưới lịch (?gio=&ghe=)
  useEffect(() => {
    const g = sp.get('gio'); const ghe = Number(sp.get('ghe'));
    if (!g || !khung || chon) return;
    const k = khung.find((x) => x.gio_bat_dau === g && (!ghe || x.ghe_trong_id.includes(ghe)));
    if (k) setChon({ bac_si_id: k.bac_si_id, gio_bat_dau: k.gio_bat_dau, ghe_id: ghe || k.ghe_trong_id[0] });
  }, [khung]); // eslint-disable-line react-hooks/exhaustive-deps

  const khungChon = khung?.find((k) => chon && k.bac_si_id === chon.bac_si_id && k.gio_bat_dau === chon.gio_bat_dau);
  const dichVu = dm?.dich_vu.find((d) => String(d.id) === String(f.dich_vu_du_kien_id));
  const homNayChon = f.ngay === homNay();

  async function luu() {
    setDangGui(true);
    const body = { ...f, benh_nhan_id: bn.id, bac_si_id: chon.bac_si_id, gio_bat_dau: chon.gio_bat_dau, ghe_id: chon.ghe_id,
      vang_lai: f.nguon === 'VANG_LAI', chi_dinh_tai_kham_id: sp.get('chi_dinh_id') ?? undefined };
    const r = await chay(() => (doiId
      ? api(`/lich-hen/${doiId}/doi-lich`, { method: 'POST', body })
      : api('/lich-hen', { method: 'POST', body })), doiId ? 'Đã đổi lịch hẹn' : 'Đã đặt lịch hẹn');
    setDangGui(false);
    if (r) router.push(`/lich-hen?ngay=${f.ngay}`);
  }

  if (!dm || (doiId && !lichCu)) return <Loading />;

  return (
    <>
      <PageHeader title={doiId ? 'Đổi lịch hẹn' : 'Đặt lịch hẹn'}
        sub="Một lịch = 1 bác sĩ + 1 ghế + 1 khung 30 phút, trong ca trực của bác sĩ" />
      {doiId && lichCu && <Alert loai="info">Lịch hiện tại: {ngay(lichCu.ngay, true)} {gio(lichCu.gio_bat_dau)} · {lichCu.bac_si} · Ghế {lichCu.ma_ghe}</Alert>}
      {sp.get('chi_dinh_id') && <Alert loai="info">Đặt lịch theo chỉ định tái khám của bác sĩ.</Alert>}

      {!bn ? <ChonBenhNhan onChon={setBn} /> : (
        <Card title="1. Bệnh nhân" actions={!doiId && <button className="btn btn-sm" onClick={() => setBn(null)}>Đổi bệnh nhân</button>}>
          <b>{bn.ho_ten}</b> · {bn.ma_benh_nhan} · sinh {ngay(bn.ngay_sinh)} · {bn.so_dien_thoai}
          {bn.nguoi_giam_ho && <span className="muted"> · giám hộ {bn.nguoi_giam_ho}</span>}
        </Card>
      )}

      {bn && (
        <>
          <Card title="2. Việc cần làm, bác sĩ, ngày">
            <div className="form-grid">
              <Field label="Việc cần làm (dịch vụ dự kiến)" required>
                <select value={f.dich_vu_du_kien_id} onChange={(e) => setF({ ...f, dich_vu_du_kien_id: e.target.value })}>
                  <option value="">— Chọn dịch vụ —</option>
                  {dm.dich_vu.map((d) => <option key={d.id} value={d.id}>{d.nhom} · {d.ten}</option>)}
                </select>
              </Field>
              <Field label="Bác sĩ">
                <select value={f.bac_si_id} onChange={(e) => { setF({ ...f, bac_si_id: e.target.value }); setChon(null); }}>
                  <option value="">Bác sĩ nào cũng được</option>
                  {dm.bac_si.map((b) => <option key={b.id} value={b.id}>{b.ho_ten}{b.ban_thoi_gian ? ' (bán thời gian)' : ''}</option>)}
                </select>
              </Field>
              <Field label="Ngày" required>
                <input type="date" min={homNay()} value={f.ngay} onChange={(e) => { setF({ ...f, ngay: e.target.value }); setChon(null); }} />
              </Field>
              {!doiId && (
                <Field label="Nguồn">
                  <select value={f.nguon} onChange={(e) => setF({ ...f, nguon: e.target.value })}>
                    <option value="DIEN_THOAI">Khách gọi điện</option>
                    <option value="TAI_QUAY">Đặt tại quầy</option>
                    {homNayChon && <option value="VANG_LAI">Khách vãng lai — check-in ngay</option>}
                  </select>
                </Field>
              )}
              <Field label="Ghi chú" wide><input value={f.ghi_chu} onChange={(e) => setF({ ...f, ghi_chu: e.target.value })} placeholder="Triệu chứng, yêu cầu của khách…" /></Field>
            </div>
            {dichVu && <p className="muted small">Giá tham khảo: {tien(dichVu.don_gia)} / {dichVu.don_vi_tinh}. Việc cần lâu hơn 30 phút thì đặt thêm lịch liền kề.</p>}
          </Card>

          <Card title={`3. Khung trống — ${ngay(f.ngay, true)}`}>
            {loading ? <Loading /> : theoGio.length === 0 ? (
              <Empty text="Không còn khung trống (bác sĩ không trực, hết chỗ hoặc phòng khám nghỉ). Thử ngày khác hoặc bác sĩ khác." />
            ) : (
              <div style={{ display: 'grid', gap: 8 }}>
                {theoGio.map(([g, ds]) => (
                  <div key={g} className="gap">
                    <b style={{ width: 52 }}>{gio(g)}</b>
                    <div className="slot-list">
                      {ds.map((k) => {
                        const daChon = chon?.bac_si_id === k.bac_si_id && chon?.gio_bat_dau === g;
                        return (
                          <button key={k.bac_si_id} className={`slot ${daChon ? 'chon' : ''}`}
                            onClick={() => setChon({ bac_si_id: k.bac_si_id, gio_bat_dau: g, ghe_id: k.ghe_trong_id[0] })}>
                            {k.bac_si}<small>Ghế trống: {k.ghe_trong.join(', ')}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {khungChon && (
            <Card title="4. Xác nhận">
              <div className="gap">
                <span><b>{gio(chon.gio_bat_dau)}</b> ngày {ngay(f.ngay, true)} với <b>{khungChon.bac_si}</b> — Ghế:</span>
                {khungChon.ghe_trong_id.map((gid, i) => (
                  <label key={gid} className="check">
                    <input type="radio" name="ghe" checked={chon.ghe_id === gid} onChange={() => setChon({ ...chon, ghe_id: gid })} />
                    {khungChon.ghe_trong[i]}
                  </label>
                ))}
              </div>
              <div className="gap mt">
                <button className="btn btn-primary" disabled={dangGui || !f.dich_vu_du_kien_id} onClick={luu}>
                  {doiId ? 'Xác nhận đổi lịch' : f.nguon === 'VANG_LAI' ? 'Đặt lịch & check-in' : 'Đặt lịch'}
                </button>
                {!f.dich_vu_du_kien_id && <span className="text-do small">Chọn việc cần làm</span>}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}

export default function Page() {
  return <Suspense><DatLich /></Suspense>;
}
