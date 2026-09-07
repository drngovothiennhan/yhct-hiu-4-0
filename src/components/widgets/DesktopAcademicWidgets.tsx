import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FlaskConical,
  Search,
  Users,
} from 'lucide-react';
import type { Member } from '../../types';
import { supabase } from '../../services/authService';

type DrlSemester = {
  semester_code: string;
  semester_title: string;
  total_points: number;
};

type ProfileSummary = {
  drl_semesters?: DrlSemester[];
};

type DeadlineRow = {
  semester_code: string;
  semester_title: string;
  lock_at: string | null;
  is_locked: boolean;
  starts_on: string | null;
  ends_on: string | null;
};

type Interaction = {
  id: string;
  herb_name: string;
  drug_name: string;
  severity: 'info' | 'caution' | 'high';
  evidence_summary: string;
  source_title: string;
  source_url: string | null;
  verified_at: string;
};

type ResearchOpportunity = {
  id: string;
  title: string;
  summary: string;
  slots: number;
  deadline_at: string | null;
  applicant_count: number;
  my_status: string | null;
};

type ScheduleItem = {
  id: string;
  kind: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string;
  is_assigned: boolean;
  checked_in: boolean;
  can_check_in: boolean;
};

const SOLAR_TERMS = [
  'Xuân phân',
  'Thanh minh',
  'Cốc vũ',
  'Lập hạ',
  'Tiểu mãn',
  'Mang chủng',
  'Hạ chí',
  'Tiểu thử',
  'Đại thử',
  'Lập thu',
  'Xử thử',
  'Bạch lộ',
  'Thu phân',
  'Hàn lộ',
  'Sương giáng',
  'Lập đông',
  'Tiểu tuyết',
  'Đại tuyết',
  'Đông chí',
  'Tiểu hàn',
  'Đại hàn',
  'Lập xuân',
  'Vũ thủy',
  'Kinh trập',
] as const;

const MERIDIAN_WINDOWS = [
  { from: 23, to: 1, branch: 'Tý', meridian: 'Đởm' },
  { from: 1, to: 3, branch: 'Sửu', meridian: 'Can' },
  { from: 3, to: 5, branch: 'Dần', meridian: 'Phế' },
  { from: 5, to: 7, branch: 'Mão', meridian: 'Đại trường' },
  { from: 7, to: 9, branch: 'Thìn', meridian: 'Vị' },
  { from: 9, to: 11, branch: 'Tỵ', meridian: 'Tỳ' },
  { from: 11, to: 13, branch: 'Ngọ', meridian: 'Tâm' },
  { from: 13, to: 15, branch: 'Mùi', meridian: 'Tiểu trường' },
  { from: 15, to: 17, branch: 'Thân', meridian: 'Bàng quang' },
  { from: 17, to: 19, branch: 'Dậu', meridian: 'Thận' },
  { from: 19, to: 21, branch: 'Tuất', meridian: 'Tâm bào' },
  { from: 21, to: 23, branch: 'Hợi', meridian: 'Tam tiêu' },
] as const;

const mod = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

function apparentSolarLongitude(date: Date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const l0 = mod(280.46646 + t * (36000.76983 + t * 0.0003032), 360);
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const equation =
    Math.sin(rad(meanAnomaly)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * meanAnomaly)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * meanAnomaly)) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  return mod(l0 + equation - 0.00569 - 0.00478 * Math.sin(rad(omega)), 360);
}

function solarTerm(date: Date) {
  const longitude = apparentSolarLongitude(date);
  const index = Math.floor(longitude / 15) % 24;
  return { longitude, term: SOLAR_TERMS[index], index };
}

function meridianWindow(date: Date) {
  const hour = date.getHours() + date.getMinutes() / 60;
  return (
    MERIDIAN_WINDOWS.find((item) =>
      item.from > item.to
        ? hour >= item.from || hour < item.to
        : hour >= item.from && hour < item.to,
    ) || MERIDIAN_WINDOWS[0]
  );
}

function seasonAdvice(index: number) {
  if (index >= 21 || index <= 2) {
    return 'Duy trì vận động vừa sức, ngủ đủ và điều chỉnh trang phục theo nhiệt độ.';
  }
  if (index <= 8) {
    return 'Ưu tiên bù nước theo nhu cầu và tránh gắng sức kéo dài dưới nắng nóng.';
  }
  if (index <= 14) {
    return 'Uống đủ nước, giữ môi trường sinh hoạt thông thoáng và duy trì vận động đều.';
  }
  return 'Giữ ấm, khởi động kỹ trước vận động và duy trì giờ ngủ ổn định.';
}

function safeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function countdown(target: string | null, now: Date) {
  if (!target) return 'Chưa công bố hạn khóa sổ';
  const milliseconds = new Date(target).getTime() - now.getTime();
  if (!Number.isFinite(milliseconds)) return 'Chưa công bố hạn khóa sổ';
  if (milliseconds <= 0) return 'Đã đến hạn khóa sổ';
  const days = Math.floor(milliseconds / 86400000);
  const hours = Math.floor((milliseconds % 86400000) / 3600000);
  return days > 0 ? `${days} ngày ${hours} giờ` : `${hours} giờ`;
}

function kindLabel(kind: string) {
  return kind === 'herb_garden' ? 'Vườn dược liệu' : kind === 'clinic' ? 'Lâm sàng' : 'CLB';
}

function SolarTermWidget({ now }: { now: Date }) {
  const current = useMemo(
    () => solarTerm(now),
    [now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()],
  );
  const currentWindow = useMemo(
    () => meridianWindow(now),
    [now.getHours()],
  );

  return (
    <section className="desktop-widget solar-term-widget">
      <header>
        <Clock3 />
        <div>
          <h3>Tiết khí & dưỡng sinh</h3>
          <small>24 tiết khí · thời trực học thuật</small>
        </div>
      </header>
      <div className="widget-highlight">
        <b>{current.term}</b>
        <span>Kinh độ Mặt Trời ≈ {current.longitude.toFixed(1)}°</span>
      </div>
      <div className="widget-pair">
        <span>
          <small>Giờ địa chi</small>
          <b>{currentWindow.branch}</b>
        </span>
        <span>
          <small>Kinh lạc theo giờ</small>
          <b>{currentWindow.meridian}</b>
        </span>
      </div>
      <p>{seasonAdvice(current.index)}</p>
      <small className="widget-disclaimer">
        Thông tin tiết khí/kinh lạc dùng cho học tập YHCT; lời khuyên sinh hoạt là sức khỏe chung,
        không thay thế chỉ định y khoa.
      </small>
    </section>
  );
}

function DrlTrackerWidget({ member, now }: { member: Member | null; now: Date }) {
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [deadline, setDeadline] = useState<DeadlineRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!member) {
      setProfile(null);
      setDeadline(null);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    void Promise.all([
      supabase.rpc('member_profile_summary_v1'),
      supabase.rpc('drl_deadline_public_v1'),
    ])
      .then(([profileResponse, deadlineResponse]) => {
        if (!alive) return;
        if (!profileResponse.error) {
          setProfile((profileResponse.data || {}) as ProfileSummary);
        }
        if (!deadlineResponse.error) {
          const rows = Array.isArray(deadlineResponse.data) ? deadlineResponse.data : [];
          setDeadline((rows[0] || null) as DeadlineRow | null);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [member?.id]);

  const total = useMemo(
    () => profile?.drl_semesters?.reduce((sum, item) => sum + Number(item.total_points || 0), 0) || 0,
    [profile],
  );
  const semesterCount = profile?.drl_semesters?.length || 0;

  return (
    <section className="desktop-widget drl-tracker-widget">
      <header>
        <CalendarClock />
        <div>
          <h3>DRL Tracker</h3>
          <small>Điểm đã công bố · hạn khóa sổ</small>
        </div>
      </header>
      {!member ? (
        <p>Đăng nhập thành viên để xem DRL cá nhân.</p>
      ) : loading ? (
        <p>Đang đồng bộ DRL…</p>
      ) : (
        <>
          <div className="drl-widget-ring" aria-label={`${total} điểm DRL đã công bố`}>
            <strong>{total}</strong>
            <small>điểm / {semesterCount} kỳ</small>
          </div>
          {deadline ? (
            <div className="widget-deadline">
              <b>{deadline.semester_title}</b>
              <span>{deadline.is_locked ? 'Đã khóa sổ' : countdown(deadline.lock_at, now)}</span>
              {deadline.lock_at && (
                <small>Khóa: {new Date(deadline.lock_at).toLocaleString('vi-VN')}</small>
              )}
            </div>
          ) : (
            <p className="muted">Không có học kỳ đang mở được công bố lịch khóa sổ.</p>
          )}
        </>
      )}
    </section>
  );
}

function HerbDrugWidget() {
  const [herb, setHerb] = useState('');
  const [drug, setDrug] = useState('');
  const [items, setItems] = useState<Interaction[]>([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const herbQuery = herb.trim().replace(/[%_]/g, '');
    const drugQuery = drug.trim().replace(/[%_]/g, '');

    if (herbQuery.length < 2 || drugQuery.length < 2) {
      setItems([]);
      setSearched(false);
      setError('');
      return () => {
        alive = false;
      };
    }

    const timer = window.setTimeout(() => {
      setBusy(true);
      setError('');

      const runSearch = async () => {
        try {
          const { data, error: queryError } = await supabase
            .from('herb_drug_interactions')
            .select(
              'id,herb_name,drug_name,severity,evidence_summary,source_title,source_url,verified_at',
            )
            .ilike('herb_name', `%${herbQuery}%`)
            .ilike('drug_name', `%${drugQuery}%`)
            .order('verified_at', { ascending: false })
            .limit(5);

          if (!alive) return;
          if (queryError) {
            setError('Không thể truy vấn kho tương tác đã kiểm chứng.');
            setItems([]);
          } else {
            setItems((data || []) as Interaction[]);
          }
          setSearched(true);
        } finally {
          if (alive) setBusy(false);
        }
      };

      void runSearch();
    }, 300);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [herb, drug]);

  return (
    <section className="desktop-widget interaction-widget">
      <header>
        <FlaskConical />
        <div>
          <h3>Tương tác Đông – Tây y</h3>
          <small>Chỉ dữ liệu có nguồn đã kiểm chứng</small>
        </div>
      </header>
      <label>
        Vị thuốc
        <input value={herb} onChange={(event) => setHerb(event.target.value)} placeholder="Ví dụ: Nhân sâm" />
      </label>
      <label>
        Hoạt chất / thuốc
        <input value={drug} onChange={(event) => setDrug(event.target.value)} placeholder="Ví dụ: warfarin" />
      </label>
      {busy && (
        <p className="muted">
          <Search /> Đang tra cứu…
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {searched && !busy && !error && items.length === 0 && (
        <div className="widget-caution">
          <AlertTriangle />
          <span>
            Chưa có bản ghi đã kiểm chứng trong kho. Điều này <b>không chứng minh</b> rằng phối hợp là
            an toàn hoặc không có tương tác.
          </span>
        </div>
      )}
      <div className="interaction-results">
        {items.map((item) => {
          const sourceUrl = safeHttpUrl(item.source_url);
          return (
            <article key={item.id} className={`severity-${item.severity}`}>
              <div className="between">
                <b>
                  {item.herb_name} × {item.drug_name}
                </b>
                <span>
                  {item.severity === 'high'
                    ? 'Nguy cơ cao'
                    : item.severity === 'caution'
                      ? 'Thận trọng'
                      : 'Thông tin'}
                </span>
              </div>
              <p>{item.evidence_summary}</p>
              <small>
                Nguồn: {item.source_title} · kiểm chứng{' '}
                {new Date(item.verified_at).toLocaleDateString('vi-VN')}
              </small>
              {sourceUrl && (
                <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
                  Mở nguồn gốc
                </a>
              )}
            </article>
          );
        })}
      </div>
      <small className="widget-disclaimer">
        Không dùng widget này để tự quyết định bắt đầu, ngừng hoặc thay đổi thuốc. Cần đối chiếu
        dược sĩ/bác sĩ và nguồn gốc.
      </small>
    </section>
  );
}

function ResearchWidget({ member }: { member: Member | null }) {
  const [items, setItems] = useState<ResearchOpportunity[]>([]);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const { data, error } = await supabase.rpc('research_opportunities_feed_v1', { p_limit: 4 });
    if (error) throw error;
    setItems((Array.isArray(data) ? data : []) as ResearchOpportunity[]);
  };

  useEffect(() => {
    let alive = true;
    void load().catch(() => {
      if (alive) setMessage('Không thể tải bảng đề tài.');
    });
    return () => {
      alive = false;
    };
  }, [member?.id]);

  const apply = async (id: string) => {
    if (!member) {
      setMessage('Đăng nhập thành viên để xin tham gia đề tài.');
      return;
    }
    setBusyId(id);
    setMessage('');
    try {
      const { error } = await supabase.rpc('research_apply_v1', { p_opportunity_id: id });
      if (error) throw error;
      await load();
      setMessage('Đã gửi yêu cầu tham gia tới nhóm nghiên cứu.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể gửi yêu cầu.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="desktop-widget research-widget">
      <header>
        <BookOpen />
        <div>
          <h3>NCKH & tìm nhóm</h3>
          <small>Đề tài đang mở cộng sự</small>
        </div>
      </header>
      {items.length === 0 ? (
        <p className="muted">Chưa có đề tài đang mở đăng ký.</p>
      ) : (
        <div className="research-widget-list">
          {items.map((item) => (
            <article key={item.id}>
              <b>{item.title}</b>
              <p>{item.summary}</p>
              <small>
                {item.applicant_count}/{item.slots} yêu cầu/định biên
                {item.deadline_at
                  ? ` · hạn ${new Date(item.deadline_at).toLocaleDateString('vi-VN')}`
                  : ''}
              </small>
              <button
                type="button"
                disabled={
                  busyId === item.id || item.my_status === 'requested' || item.my_status === 'accepted'
                }
                onClick={() => void apply(item.id)}
              >
                <Users />
                {item.my_status === 'accepted'
                  ? 'Đã tham gia'
                  : item.my_status === 'requested'
                    ? 'Đã gửi yêu cầu'
                    : busyId === item.id
                      ? 'Đang gửi…'
                      : 'Xin tham gia'}
              </button>
            </article>
          ))}
        </div>
      )}
      {message && <small className="widget-status">{message}</small>}
    </section>
  );
}

function ScheduleWidget({ member }: { member: Member | null }) {
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    if (!member) {
      setItems([]);
      return;
    }
    const { data, error } = await supabase.rpc('member_upcoming_schedule_v2', { p_limit: 4 });
    if (error) throw error;
    setItems((Array.isArray(data) ? data : []) as ScheduleItem[]);
  };

  useEffect(() => {
    let alive = true;
    void load().catch(() => {
      if (alive) setMessage('Không thể tải lịch sắp tới.');
    });
    return () => {
      alive = false;
    };
  }, [member?.id]);

  const checkIn = async (id: string) => {
    setBusyId(id);
    setMessage('');
    try {
      const { error } = await supabase.rpc('schedule_checkin_v1', { p_schedule_id: id });
      if (error) throw error;
      await load();
      setMessage('Điểm danh thành công.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không thể điểm danh.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="desktop-widget schedule-widget">
      <header>
        <CalendarClock />
        <div>
          <h3>Ca trực & phòng thực hành</h3>
          <small>Lịch gần nhất của CLB</small>
        </div>
      </header>
      {!member ? (
        <p>Đăng nhập để xem lịch thành viên.</p>
      ) : items.length === 0 ? (
        <p className="muted">Không có ca/lịch sắp tới phù hợp.</p>
      ) : (
        <div className="schedule-widget-list">
          {items.map((item) => (
            <article key={item.id}>
              <div>
                <b>{item.title}</b>
                <span>{kindLabel(item.kind)}</span>
              </div>
              <small>
                {new Date(item.starts_at).toLocaleString('vi-VN')} ·{' '}
                {item.location || 'Chưa cập nhật địa điểm'}
              </small>
              {item.is_assigned && (
                <button
                  type="button"
                  disabled={item.checked_in || !item.can_check_in || busyId === item.id}
                  onClick={() => void checkIn(item.id)}
                >
                  {item.checked_in ? (
                    <>
                      <CheckCircle2 /> Đã điểm danh
                    </>
                  ) : busyId === item.id ? (
                    'Đang điểm danh…'
                  ) : item.can_check_in ? (
                    'Check-in'
                  ) : (
                    'Chưa đến giờ check-in'
                  )}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {message && <small className="widget-status">{message}</small>}
    </section>
  );
}

export default function DesktopAcademicWidgets({ member }: { member: Member | null }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <aside className="desktop-academic-widgets" aria-label="Tiện ích học thuật Desktop">
      <SolarTermWidget now={now} />
      <DrlTrackerWidget member={member} now={now} />
      <HerbDrugWidget />
      <ResearchWidget member={member} />
      <ScheduleWidget member={member} />
    </aside>
  );
}
