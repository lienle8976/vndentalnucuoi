'use client';
// UC44, UC45.1–UC45.8, UC46 — Báo cáo quản trị (tám câu hỏi hằng tháng)
import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useData } from '@/lib/api';
import { tien, pct, ngay, gio, so, thoiDiem, thangNay, homNay } from '@/lib/format';
import { BEN_HUY, LOAI_KHO } from '@/lib/nhan';
import { PageHeader, Card, Loading, ErrorBox, Empty, Tabs } from '@/components/ui';

const TABS = [
  { id: 'doanh-thu', ten: '1·8 Doanh thu & chia tiền' }, { id: 'ghe', ten: '2 Công suất ghế' },
  { id: 'qua6', ten: '3 Quá 6 tháng' }, { id: 'huy', ten: '4 Hủy lịch' }, { id: 'no', ten: '5 Công nợ' },
  { id: 'lt', ten: '6 Liệu trình dở' }, { id: 'kho', ten: '7 Sắp hết hàng' }, { id: 'ket', ten: 'Chốt két' },
];

function DoanhThu() {
  const [thang, setThang] = useState(thangNay());
  const { data, error } = useData(`/bao-cao/doanh-thu?thang=${thang}`);
  const rows = useMemo(() => (data?.so_sanh ?? []).map((s) => {
    const t = data.theo_bac_si.find((x) => x.bac_si_id === s.bac_si_id) ?? {};
    const c = data.chia_tien.find((x) => x.bac_si_id === s.bac_si_id) ?? {};
    return { ...s, ...t, tien_duoc_chia: c.tien_duoc_chia, ty_le: c.ty_le_ap_dung };
  }), [data]);
  const tong = (k) => rows.reduce((s, r) => s + (r[k] ?? 0), 0);
  return (
    <>
      <div className="gap mb"><span>Tháng</span><input type="month" value={thang} onChange={(e) => setThang(e.target.value)} style={{ width: 170 }} /></div>
      <ErrorBox error={error} />
      {!data ? <Loading /> : (
        <>
          <Card title="Câu 1 & 8 — Doanh thu theo bác sĩ, so với tháng trước; tiền được chia (UC44)">
            <div className="table-wrap"><table className="table">
              <thead><tr><th>Bác sĩ</th><th className="num">Dịch vụ</th><th className="num">Liệu trình</th><th className="num">Thuốc</th><th className="num">Doanh thu</th><th className="num">Tháng trước</th><th className="num">Thay đổi</th><th className="num">Tỷ lệ chia</th><th className="num">Được chia</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.bac_si_id}><td>{r.bac_si}</td><td className="num">{tien(r.tu_dich_vu ?? 0)}</td><td className="num">{tien(r.tu_lieu_trinh ?? 0)}</td><td className="num">{tien(r.tu_thuoc ?? 0)}</td>
                  <td className="num bold">{tien(r.doanh_thu)}</td><td className="num">{tien(r.doanh_thu_thang_truoc)}</td>
                  <td className={`num ${r.thay_doi_pct > 0 ? 'text-luc' : r.thay_doi_pct < 0 ? 'text-do' : ''}`}>{pct(r.thay_doi_pct)}</td>
                  <td className="num">{r.ty_le ?? '—'}</td><td className="num">{tien(r.tien_duoc_chia ?? 0)}</td></tr>))}</tbody>
              <tfoot><tr><td>Tổng</td><td className="num">{tien(tong('tu_dich_vu'))}</td><td className="num">{tien(tong('tu_lieu_trinh'))}</td><td className="num">{tien(tong('tu_thuoc'))}</td>
                <td className="num">{tien(tong('doanh_thu'))}</td><td className="num">{tien(tong('doanh_thu_thang_truoc'))}</td><td /><td /><td className="num">{tien(tong('tien_duoc_chia'))}</td></tr></tfoot>
            </table></div>
            <p className="muted small">Doanh thu = tổng thành tiền các dòng hóa đơn đã chốt (sau giảm giá), theo ngày làm dịch vụ; doanh thu đợt liệu trình tính cho bác sĩ phụ trách (A28).</p>
          </Card>
          <Card title="Xu hướng 12 tháng — doanh thu và thực thu">
            {data.xu_huong.length === 0 ? <Empty /> : (
              <table className="table"><thead><tr><th>Tháng</th><th className="num">Doanh thu</th><th className="num">So tháng trước</th><th className="num">Thực thu</th></tr></thead>
                <tbody>{data.xu_huong.map((x) => (
                  <tr key={x.thang}><td>{x.thang.slice(5, 7)}/{x.thang.slice(0, 4)}</td><td className="num">{tien(x.doanh_thu)}</td>
                    <td className={`num ${x.thay_doi_pct > 0 ? 'text-luc' : x.thay_doi_pct < 0 ? 'text-do' : ''}`}>{pct(x.thay_doi_pct)}</td><td className="num">{tien(x.thuc_thu)}</td></tr>))}</tbody></table>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function CongSuatGhe() {
  const [tu, setTu] = useState(`${thangNay()}-01`);
  const [den, setDen] = useState(homNay());
  const { data } = useData(`/bao-cao/cong-suat-ghe?tu=${tu}&den=${den}`);
  const ghe = [...new Set((data ?? []).map((r) => r.ma_ghe))].sort();
  const khung = [...new Set((data ?? []).map((r) => r.khung_gio))].sort();
  const o = (g, k) => data.find((r) => r.ma_ghe === g && r.khung_gio === k);
  const theoGhe = ghe.map((g) => {
    const rs = data.filter((r) => r.ma_ghe === g);
    const tong = rs.reduce((s, r) => s + r.so_khung, 0); const trong = rs.reduce((s, r) => s + r.so_khung_trong, 0);
    return { g, tong, trong, pct: tong ? Math.round((1000 * trong) / tong) / 10 : 0 };
  }).sort((a, b) => b.pct - a.pct);
  return (
    <Card title="Câu 2 — Ghế nào trống nhiều nhất, khung giờ nào (A30: lịch hủy / không đến vẫn tính là trống)">
      <div className="gap mb"><span>Từ</span><input type="date" value={tu} onChange={(e) => setTu(e.target.value)} style={{ width: 160 }} /><span>đến</span><input type="date" value={den} onChange={(e) => setDen(e.target.value)} style={{ width: 160 }} /></div>
      {!data ? <Loading /> : (
        <>
          <div className="gap mb">{theoGhe.map((x) => <span key={x.g} className="badge badge-xam">{x.g}: trống {x.pct}% ({x.trong}/{x.tong} khung)</span>)}</div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Khung giờ</th>{ghe.map((g) => <th key={g} className="num">{g} — % trống</th>)}</tr></thead>
            <tbody>{khung.map((k) => (
              <tr key={k}><td>{gio(k)}</td>{ghe.map((g) => {
                const r = o(g, k);
                return <td key={g} className={`num ${r?.ty_le_trong_pct >= 90 ? 'text-do' : r?.ty_le_trong_pct <= 50 ? 'text-luc' : ''}`}>{r ? `${so(r.ty_le_trong_pct)}% (${r.so_khung_su_dung}/${r.so_khung})` : '—'}</td>;
              })}</tr>))}</tbody>
          </table></div>
        </>
      )}
    </Card>
  );
}

function Bang({ path, title, cols, empty }) {
  const { data, error } = useData(path);
  return (
    <Card title={title}>
      <ErrorBox error={error} />
      {!data ? <Loading /> : data.length === 0 ? <Empty text={empty} /> : (
        <div className="table-wrap"><table className="table">
          <thead><tr>{cols.map((c) => <th key={c.ten} className={c.num ? 'num' : ''}>{c.ten}</th>)}</tr></thead>
          <tbody>{data.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c.ten} className={c.num ? 'num' : ''}>{c.f(r)}</td>)}</tr>)}</tbody>
        </table></div>
      )}
    </Card>
  );
}

function HuyLich() {
  const { data } = useData('/bao-cao/huy-lich');
  const gom = (k) => Object.entries((data ?? []).reduce((m, r) => ({ ...m, [r[k]]: (m[r[k]] ?? 0) + r.so_lan_huy }), {})).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="grid-2">
        <Card title="Câu 4 — Việc hay bị hủy nhất">{!data ? <Loading /> : gom('dich_vu').length === 0 ? <Empty /> :
          <table className="table"><tbody>{gom('dich_vu').map(([k, v]) => <tr key={k}><td>{k}</td><td className="num bold">{v}</td></tr>)}</tbody></table>}</Card>
        <Card title="Lý do hủy">{!data ? <Loading /> : gom('ly_do').length === 0 ? <Empty /> :
          <table className="table"><tbody>{gom('ly_do').map(([k, v]) => <tr key={k}><td>{k}</td><td className="num bold">{v}</td></tr>)}</tbody></table>}</Card>
      </div>
      <Bang path="/bao-cao/huy-lich" title="Chi tiết theo tháng" cols={[
        { ten: 'Tháng', f: (r) => `${r.thang.slice(5, 7)}/${r.thang.slice(0, 4)}` }, { ten: 'Dịch vụ', f: (r) => r.dich_vu },
        { ten: 'Lý do', f: (r) => r.ly_do }, { ten: 'Bên hủy', f: (r) => BEN_HUY[r.ben_huy] }, { ten: 'Số lần', num: true, f: (r) => r.so_lan_huy }]} />
    </>
  );
}

function BaoCao() {
  const [tab, setTab] = useState(useSearchParams().get('tab') ?? 'doanh-thu');
  return (
    <>
      <PageHeader title="Báo cáo quản trị" sub="Tám câu hỏi quản lý hằng tháng" />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'doanh-thu' && <DoanhThu />}
      {tab === 'ghe' && <CongSuatGhe />}
      {tab === 'qua6' && <Bang path="/bao-cao/qua-6-thang" title="Câu 3 — Bệnh nhân quá 6 tháng chưa quay lại và không có lịch sắp tới (A31)" empty="Không có" cols={[
        { ten: 'Bệnh nhân', f: (r) => <Link href={`/benh-nhan/${r.benh_nhan_id}`}>{r.ho_ten}</Link> }, { ten: 'Mã', f: (r) => r.ma_benh_nhan },
        { ten: 'SĐT', f: (r) => r.so_dien_thoai }, { ten: 'Giám hộ', f: (r) => r.nguoi_giam_ho ?? '' }, { ten: 'Lần khám cuối', f: (r) => ngay(r.lan_kham_cuoi) },
        { ten: 'Số ngày', num: true, f: (r) => so(r.so_ngay_chua_quay_lai) }, { ten: '', f: (r) => <Link className="btn btn-sm" href={`/lich-hen/dat?benh_nhan_id=${r.benh_nhan_id}`}>Đặt lịch</Link> }]} />}
      {tab === 'huy' && <HuyLich />}
      {tab === 'no' && <Bang path="/bao-cao/cong-no" title="Câu 5 — Tổng nợ, chia theo từng người" empty="Không có công nợ" cols={[
        { ten: 'Bệnh nhân', f: (r) => <Link href={`/benh-nhan/${r.benh_nhan_id}`}>{r.ho_ten}</Link> }, { ten: 'SĐT', f: (r) => r.so_dien_thoai },
        { ten: 'Số hóa đơn', num: true, f: (r) => r.so_hoa_don_con_no }, { ten: 'Nợ từ', f: (r) => ngay(r.no_tu_ngay) }, { ten: 'Tổng nợ', num: true, f: (r) => <b className="text-do">{tien(r.tong_no)}</b> }]} />}
      {tab === 'lt' && <Bang path="/bao-cao/lieu-trinh" title="Câu 6 — Liệu trình đang dở, còn mấy buổi" empty="Không có" cols={[
        { ten: 'Mã', f: (r) => r.ma_lieu_trinh }, { ten: 'Liệu trình', f: (r) => r.ten }, { ten: 'Bệnh nhân', f: (r) => <Link href={`/benh-nhan/${r.benh_nhan_id}`}>{r.benh_nhan}</Link> },
        { ten: 'BS phụ trách', f: (r) => r.bac_si_phu_trach }, { ten: 'Đã làm', num: true, f: (r) => `${r.so_buoi_da_lam}/${r.so_buoi_du_kien}` },
        { ten: 'Còn lại', num: true, f: (r) => <b>{r.so_buoi_con_lai}</b> }, { ten: 'Buổi gần nhất', f: (r) => ngay(r.buoi_gan_nhat) },
        { ten: 'Giá gói', num: true, f: (r) => tien(r.gia_tron_goi) }, { ten: 'Đã thu', num: true, f: (r) => tien(r.da_thu) }]} />}
      {tab === 'kho' && <Bang path="/bao-cao/ton-kho" title="Câu 7 — Thuốc, vật tư sắp hết (tồn ≤ ngưỡng)" empty="Không có mặt hàng dưới ngưỡng" cols={[
        { ten: 'Mặt hàng', f: (r) => r.ten }, { ten: 'Loại', f: (r) => LOAI_KHO[r.loai] }, { ten: 'Tồn', num: true, f: (r) => `${so(r.ton_kho)} ${r.don_vi_tinh}` },
        { ten: 'Ngưỡng', num: true, f: (r) => so(r.nguong_toi_thieu) }, { ten: 'Dùng TB/ngày', num: true, f: (r) => so(r.dung_tb_ngay ?? 0) },
        { ten: 'Ước còn (ngày)', num: true, f: (r) => r.uoc_tinh_con_ngay ?? '—' }]} />}
      {tab === 'ket' && <Bang path="/bao-cao/chot-ket" title="UC46 — Lịch sử chốt két" empty="Chưa có ca nào chốt két" cols={[
        { ten: 'Ngày', f: (r) => ngay(r.ngay) }, { ten: 'Ca', f: (r) => r.ten_ca }, { ten: 'Lễ tân', f: (r) => r.le_tan_ca },
        { ten: 'Tiền mặt thu', num: true, f: (r) => tien(r.tien_mat_thu_trong_ca) }, { ten: 'Đếm được', num: true, f: (r) => tien(r.tien_mat_dem_duoc) },
        { ten: 'Chênh lệch', num: true, f: (r) => <span className={r.chenh_lech ? 'text-do bold' : ''}>{tien(r.chenh_lech)}</span> },
        { ten: 'Giải trình', f: (r) => r.giai_trinh ?? '' }, { ten: 'Chuyển khoản', num: true, f: (r) => tien(r.tong_chuyen_khoan) }, { ten: 'Chốt lúc', f: (r) => thoiDiem(r.chot_luc) }]} />}
    </>
  );
}

export default function Page() {
  return <Suspense><BaoCao /></Suspense>;
}
