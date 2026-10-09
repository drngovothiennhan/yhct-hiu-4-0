// Phân nhóm các thư mục HIU để hiển thị trong bộ chọn môn.
// Tên môn lấy từ Drive qua API; nếu một môn chưa có trong bảng này, nó sẽ nằm ở nhóm "Khác"
// nên không bao giờ bị mất khỏi danh sách. Khi thêm môn mới, chỉ cần thêm tên vào đây.

export type SubjectGroupId = 'co-so' | 'chuyen-nganh' | 'yhct' | 'ky-nang' | 'khac';

export type SubjectGroup = {
  id: SubjectGroupId;
  label: string;
  subjects: string[];
};

export const SUBJECT_GROUPS: SubjectGroup[] = [
  { id: 'co-so', label: 'Y học cơ sở', subjects: ['Sinh lý', 'Sinh lý bệnh', 'Hóa học', 'Ký sinh trùng'] },
  { id: 'chuyen-nganh', label: 'Chuyên ngành', subjects: ['Điều dưỡng cơ bản', 'Sức khỏe môi trường'] },
  { id: 'yhct', label: 'Y học cổ truyền', subjects: ['Châm cứu', 'Thuốc yhct', 'YHCT cơ sở', 'YHCT co sở', 'Dược liệu & Phương tễ'] },
  { id: 'ky-nang', label: 'Kỹ năng & đại cương', subjects: ['Phương pháp NCKH', 'Tâm lý đạo đức'] },
];

export const OTHER_GROUP: SubjectGroup = { id: 'khac', label: 'Khác', subjects: [] };

// So khớp không phân biệt hoa thường, dấu Unicode và khoảng trắng thừa.
export const normalizeSubject = (value: string): string =>
  value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');

const GROUP_BY_SUBJECT = new Map<string, SubjectGroupId>(
  SUBJECT_GROUPS.flatMap((group) => group.subjects.map((subject) => [normalizeSubject(subject), group.id] as const)),
);

export const groupIdOf = (subject: string): SubjectGroupId => GROUP_BY_SUBJECT.get(normalizeSubject(subject)) ?? 'khac';
