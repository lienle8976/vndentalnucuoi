'use client';
// UC11 — Lịch hẹn theo ngày: lưới ghế × khung 30 phút (thay sổ hẹn A3)
import { Fragment, Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useData } from '@/lib/api';
import { ngay, gio, homNay, congNgay } from '@/lib/format';
import { TRANG_THAI_LICH, BEN_HUY } from '@/lib/nhan';
import { useNguoiDung, coVaiTro } from '@/components/Shell';
import LichHenModal from '@/components/LichHenModal';
import { PageHeader, Card, Loading, ErrorBox, TrangThai, Alert, Badge } from '@/components/ui';

function sinhKhung(mo, dong) {
  const out = [];
  if (!mo || !dong) return out;
  let [h, m] = mo.split(':').map(Number);
  const [hd, md] = dong.split(':').map(Number);
  while (h * 60 + m + 30 <= hd * 60 + md) {
    out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
    m += 30; if (m === 60) { h += 1; m = 0; }
  }
  return out;
}

function LichNgay() {
  const user = useNguoiDung();
  const router = useRouter();
  const sp = useSearchParams();
  const ngayChon = sp.get('ngay') ?? homNay();
  const [bacSi, setBacSi] = useState('');
  const [mo, setMo] = useState(null);
  const { data, error, reload } = useData(`/lich-hen?ngay=${ngayChon}`);
  const { data: dm } = useData('/danh-muc');
  const leTan = coVaiTro(user, 'LE_TAN', 'QUAN_LY');
  const diNgay = (d) => router.push(`/lich-hen?ngay=${d}`);

  const khung = useMemo(() => sinhKhung(data?.gio_mo_cua?.gio_mo, data?.gio_mo_cua?.gio_dong), [data]);
  const lichHienThi = (data?.lich ?? []).filter((l) => !bacSi || String(l.bac_si_id) === bacSi);
  const conHieuLuc = lichHienThi.filter((l) => l.trang_thai !== 'DA_HUY');
  const daHuy = lichHienThi.filter((l) => l.trang_thai === 'DA_HUY');
  const bacSiTruc = (data?.ca ?? []).filter((c) => c.vai_tro_ma === 'BAC_SI');
  const leTanTruc = (data?.ca ?? []).filter((c) => c.vai_tro_ma === 'LE_TAN');
  const dongCua = data && (data.gio_mo_cua?.nghi || data.gio_mo_cua?.ngay_nghi);
  const quaKhu = ngayChon < homNay();

  const dem = (tt) => conHieuLuc.filter((l) => tt.includes(l.trang_thai)).length;

  return (
    <>
      <PageHeader title="Lịch hẹn" sub={ngay(ngayChon, true)}>
        <button className="btn" onClick={() => diNgay(congNgay(ngayChon, -1))}>‹ Hôm trước</button>
        <input type="date" value={ngayChon} onChange={(e) => e.target.value && diNgay(e.target.value)} style={{ width: 160 }} />
        <button className="btn" onClick={() => diNgay(homNay())}>Hôm nay</button>
        <button className="btn" onClick={() => diNgay(congNgay(ngayChon, 1))}>Hôm sau ›</button>
        {leTan && <Link className="btn btn-primary" href={`/lich-hen/dat?ngay=${ngayChon}`}>+ Đặt lịch</Link>}
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      {!data ? <Loading /> : (
        <div className="layout-side">
          <div>
            {dongCua && <Alert loai="canh-bao">Phòng khám nghỉ ngày này{data.gio_mo_cua?.ngay_nghi ? `: ${data.gio_mo_cua.ngay_nghi}` : ''}.</Alert>}
            <div className="gap mb">
              <select value={bacSi} onChange={(e) => setBacSi(e.target.value)} style={{ width: 220 }}>
                <option value="">Tất cả bác sĩ</option>
                {dm?.bac_si.map((b) => <option key={b.id} value={b.id}>{b.ho_ten}</option>)}
              </select>
              <span className="muted small">
                {conHieuLuc.length} lịch · {dem(['DA_DEN', 'DANG_KHAM'])} đang ở phòng khám · {dem(['HOAN_THANH'])} xong · {daHuy.length} đã hủy
              </span>
            </div>
            {!dongCua && (
              <div className="lich-grid" style={{ gridTemplateColumns: `64px repeat(${dm?.ghe.length ?? 3}, minmax(150px, 1fr))` }}>
                <div className="cell lich-head">Giờ</div>
                {dm?.ghe.map((g) => <div key={g.id} className="cell lich-head" title={g.ten}>{g.ma_ghe}</div>)}
                {khung.map((k) => (
                  <Fragment key={k}>
                    <div className="cell lich-time">{gio(k)}</div>
                    {dm?.ghe.map((g) => {
                      const o = conHieuLuc.filter((l) => l.gio_bat_dau === k && l.ghe_id === g.id);
                      const coTheDat = leTan && !quaKhu && o.every((x) => x.trang_thai === 'KHONG_DEN');
                      return (
                        <div key={g.id} className={`cell ${o.length === 0 && coTheDat ? 'lich-trong' : ''}`}
                          onClick={o.length === 0 && coTheDat ? () => router.push(`/lich-hen/dat?ngay=${ngayChon}&gio=${k}&ghe=${g.id}`) : undefined}>
                          {o.map((l) => (
                            <div key={l.id} className={`lich-item lich-${l.trang_thai}`} onClick={() => setMo(l.id)}>
                              <b>{l.benh_nhan}</b>
                              <div>{l.dich_vu_du_kien}</div>
                              <div className="muted">{l.bac_si} · {TRANG_THAI_LICH[l.trang_thai].ten}</div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            )}
          </div>

          <div>
            <Card title="Bác sĩ trực">
              {bacSiTruc.length === 0 ? <p className="muted">Không có bác sĩ trực.</p> : bacSiTruc.map((c) => (
                <div key={c.id} className="gap" style={{ justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>{c.ho_ten}</span><span className="muted">{gio(c.gio_bat_dau)}–{gio(c.gio_ket_thuc)}</span>
                </div>
              ))}
              <h3 className="mt">Lễ tân</h3>
              {leTanTruc.map((c) => (
                <div key={c.id} className="gap" style={{ justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>{c.ho_ten} <span className="muted small">({c.ten_ca})</span></span><span className="muted">{gio(c.gio_bat_dau)}–{gio(c.gio_ket_thuc)}</span>
                </div>
              ))}
            </Card>
            <Card title="Chú thích">
              <div className="gap">{Object.entries(TRANG_THAI_LICH).map(([k, v]) => <TrangThai key={k} ma={k} bang={TRANG_THAI_LICH} />)}</div>
            </Card>
            {daHuy.length > 0 && (
              <Card title={`Đã hủy (${daHuy.length})`}>
                {daHuy.map((l) => (
                  <div key={l.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => setMo(l.id)}>
                    <b>{gio(l.gio_bat_dau)} {l.benh_nhan}</b> <Badge nhan={BEN_HUY[l.ben_huy]} mau="do" />
                    <div className="muted small">{l.dich_vu_du_kien} — {l.ly_do_huy}</div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      )}
      {mo && <LichHenModal id={mo} onClose={() => setMo(null)} onChanged={reload} />}
    </>
  );
}

export default function Page() {
  return <Suspense><LichNgay /></Suspense>;
}
