'use client';
// UC29 — Lịch sử chỉnh sửa phiếu: ai sửa, lúc nào, giá trị cũ → mới
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useData } from '@/lib/api';
import { thoiDiem } from '@/lib/format';
import { BANG_LICH_SU, HANH_DONG_SUA } from '@/lib/nhan';
import { PageHeader, Card, Loading, ErrorBox, Empty, Badge } from '@/components/ui';

const BO_QUA = new Set(['id', 'phieu_dieu_tri_id', 'tao_luc']);

function GiaTri({ obj }) {
  if (!obj) return <span className="muted">—</span>;
  const keys = Object.keys(obj).filter((k) => !BO_QUA.has(k));
  return (
    <div className="small">
      {keys.map((k) => <div key={k}><span className="muted">{k}:</span> {obj[k] === null ? <i className="muted">trống</i> : String(obj[k])}</div>)}
    </div>
  );
}

export default function LichSuPhieu() {
  const { id } = useParams();
  const { data, error, reload } = useData(`/kham/phieu/${id}/lich-su`);
  return (
    <>
      <PageHeader title="Lịch sử chỉnh sửa phiếu" sub="Mọi thao tác thêm / sửa / xóa trên phiếu đều được ghi lại tự động">
        <Link className="btn" href={`/kham/phieu/${id}`}>‹ Về phiếu</Link>
      </PageHeader>
      <ErrorBox error={error} onRetry={reload} />
      <Card>
        {!data ? <Loading /> : data.length === 0 ? <Empty /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Thời điểm</th><th>Người thao tác</th><th>Phần</th><th>Thao tác</th><th>Giá trị cũ</th><th>Giá trị mới</th></tr></thead>
            <tbody>{data.map((s) => (
              <tr key={s.id}>
                <td className="nowrap">{thoiDiem(s.thoi_diem)}</td>
                <td>{s.nguoi_sua ?? '—'}</td>
                <td>{BANG_LICH_SU[s.bang] ?? s.bang} <span className="muted small">#{s.ban_ghi_id}</span></td>
                <td><Badge nhan={HANH_DONG_SUA[s.hanh_dong]} mau={s.hanh_dong === 'XOA' ? 'do' : s.hanh_dong === 'SUA' ? 'cam' : 'luc'} /></td>
                <td><GiaTri obj={s.gia_tri_cu} /></td>
                <td><GiaTri obj={s.gia_tri_moi} /></td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Card>
    </>
  );
}
