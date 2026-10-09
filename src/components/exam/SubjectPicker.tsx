import {useEffect, useMemo, useState} from 'react';
import {OTHER_GROUP, SUBJECT_GROUPS, groupIdOf, normalizeSubject, type SubjectGroupId} from '../../config/subject-groups';
import './subject-picker.css';

type SubjectPickerProps = {
  label: string;
  subjects: string[];
  value: string;
  onChange: (subject: string) => void;
  disabled?: boolean;
  allLabel?: string;
};

type TabId = 'all' | SubjectGroupId;

const ALL_GROUPS = [...SUBJECT_GROUPS, OTHER_GROUP];

// Bộ chọn thư mục theo nhóm: hàng tab nhóm, ô tìm kiếm, rồi danh sách môn của nhóm đang mở.
// Thay cho <select> dài, vốn hiện ra thành một danh sách phẳng khó dò trên điện thoại.
export default function SubjectPicker({label, subjects, value, onChange, disabled = false, allLabel = 'Tất cả thư mục HIU'}: SubjectPickerProps) {
  const uniqueSubjects = useMemo(
    () => [...new Map(subjects.map((s) => [normalizeSubject(s), s] as const)).values()].sort((a, b) => a.localeCompare(b, 'vi')),
    [subjects],
  );

  const grouped = useMemo(() => {
    const map = new Map<SubjectGroupId, string[]>();
    for (const subject of uniqueSubjects) {
      const id = groupIdOf(subject);
      map.set(id, [...(map.get(id) ?? []), subject]);
    }
    return map;
  }, [uniqueSubjects]);

  const tabs = ALL_GROUPS.filter((group) => (grouped.get(group.id)?.length ?? 0) > 0);

  const [tab, setTab] = useState<TabId>(() => (value ? groupIdOf(value) : 'all'));
  const [query, setQuery] = useState('');

  // Khi giá trị đổi từ bên ngoài (ví dụ khôi phục lựa chọn đã lưu), mở đúng nhóm của nó.
  useEffect(() => {
    if (value) setTab(groupIdOf(value));
  }, [value]);

  const visible = useMemo(() => {
    const base = tab === 'all' ? uniqueSubjects : grouped.get(tab) ?? [];
    const q = normalizeSubject(query);
    return q ? base.filter((s) => normalizeSubject(s).includes(q)) : base;
  }, [tab, query, uniqueSubjects, grouped]);

  const current = value ? value : allLabel;

  return (
    <div className="subject-picker">
      <span className="subject-picker__label">{label}</span>

      <div className="subject-picker__tabs" role="tablist" aria-label={`${label}: nhóm môn`}>
        <button type="button" role="tab" aria-selected={tab === 'all'} disabled={disabled}
          className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>
          Tất cả <small>{uniqueSubjects.length}</small>
        </button>
        {tabs.map((group) => (
          <button key={group.id} type="button" role="tab" aria-selected={tab === group.id} disabled={disabled}
            className={tab === group.id ? 'active' : ''} onClick={() => setTab(group.id)}>
            {group.label} <small>{grouped.get(group.id)?.length ?? 0}</small>
          </button>
        ))}
      </div>

      <input className="subject-picker__search" type="search" value={query} disabled={disabled}
        placeholder="Tìm thư mục…" aria-label="Tìm thư mục" onChange={(e) => setQuery(e.target.value)} />

      <div className="subject-picker__list" role="radiogroup" aria-label={label}>
        {tab === 'all' && !query && (
          <button type="button" role="radio" aria-checked={!value} disabled={disabled}
            className={`subject-picker__item${!value ? ' selected' : ''}`} onClick={() => onChange('')}>
            <span>{allLabel}</span>
          </button>
        )}
        {visible.map((subject) => {
          const selected = value === subject;
          return (
            <button key={subject} type="button" role="radio" aria-checked={selected} disabled={disabled}
              className={`subject-picker__item${selected ? ' selected' : ''}`} onClick={() => onChange(subject)}>
              <span>{subject}</span>
            </button>
          );
        })}
        {visible.length === 0 && <p className="subject-picker__empty">Không có thư mục khớp.</p>}
      </div>

      <p className="subject-picker__current">Đang chọn: <b>{current}</b></p>
    </div>
  );
}
