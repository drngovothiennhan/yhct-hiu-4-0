create table if not exists public.smart_herbs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  vietnamese_name text not null,
  latin_name text not null,
  chinese_name text not null default '',
  identification text not null default '',
  part_used text not null default '',
  traditional_summary text not null default '',
  evidence_summary text not null default '',
  safety_note text not null default '',
  evidence_level text not null default 'educational' check (evidence_level in ('educational','preclinical','mixed','clinical_review')),
  source_urls jsonb not null default '[]'::jsonb,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.smart_herbs enable row level security;

grant select on table public.smart_herbs to anon, authenticated;
revoke insert, update, delete on table public.smart_herbs from anon, authenticated;

drop policy if exists "smart herbs public read" on public.smart_herbs;
create policy "smart herbs public read"
on public.smart_herbs
for select
to anon, authenticated
using (active = true);

insert into public.smart_herbs (
  slug,vietnamese_name,latin_name,chinese_name,identification,part_used,traditional_summary,evidence_summary,safety_note,evidence_level,source_urls,active
) values
(
  'duong-quy','Đương quy','Angelica sinensis','当归',
  'Rễ khô có mùi thơm đặc trưng; mặt cắt thường vàng trắng đến vàng nâu. Dùng mẫu chuẩn có nguồn gốc rõ ràng để học nhận diện.',
  'Rễ (Radix Angelicae Sinensis).',
  'Trong Y học cổ truyền Đông Á, Đương quy được học trong nhóm dược liệu liên quan đến huyết. Nội dung này phục vụ học tập và không thay thế chỉ định điều trị.',
  'Tài liệu tổng quan gần đây mô tả thành phần hóa học và các hướng nghiên cứu dược lý, nhưng mức độ bằng chứng khác nhau theo từng chỉ định. Không suy diễn kết quả tiền lâm sàng thành hiệu quả điều trị ở người.',
  'Cần xem xét tương tác thuốc, thai kỳ, nguy cơ chảy máu và bệnh nền theo từng trường hợp. Không tự sử dụng để điều trị chỉ dựa trên thông tin của nền tảng.',
  'mixed',
  '[{"label":"PubMed – Review 2026 về Đương quy và thành phần hoạt tính","url":"https://pubmed.ncbi.nlm.nih.gov/41976194/","pmid":"41976194"}]'::jsonb,
  true
),
(
  'sinh-khuong','Sinh khương (Gừng tươi)','Zingiber officinale','生姜',
  'Thân rễ tươi phân nhánh, mùi thơm và vị cay đặc trưng. Cần phân biệt mẫu tươi, khô và chế biến khi học dược liệu.',
  'Thân rễ tươi.',
  'Gừng được dùng rộng rãi trong ẩm thực và nhiều hệ thống y học truyền thống. Hồ sơ này tập trung vào nhận diện, học thuật và truy xuất bằng chứng.',
  'Các tổng quan ghi nhận nhiều nghiên cứu tiền lâm sàng và một số dữ liệu lâm sàng tùy lĩnh vực; vẫn còn khoảng trống bằng chứng với nhiều tuyên bố sức khỏe.',
  'Không mặc định “tự nhiên” đồng nghĩa “an toàn tuyệt đối”. Liều dùng, tương tác thuốc và bệnh nền cần được đánh giá trong bối cảnh chuyên môn.',
  'mixed',
  '[{"label":"PubMed – Review 2024 về Zingiber officinale","url":"https://pubmed.ncbi.nlm.nih.gov/39199328/","pmid":"39199328"}]'::jsonb,
  true
),
(
  'cam-thao','Cam thảo','Glycyrrhiza uralensis','甘草',
  'Rễ hình trụ, mặt ngoài vàng nâu đến nâu đỏ; vị ngọt rõ. Việc xác định loài cần dựa vào mẫu chuẩn và tài liệu dược liệu chính thống.',
  'Rễ và thân rễ.',
  'Cam thảo là dược liệu xuất hiện trong nhiều bài thuốc cổ truyền. Nền tảng chỉ trình bày kiến thức học thuật, không đưa ra phác đồ cá nhân.',
  'Glycyrrhizic acid và các thành phần của Glycyrrhiza đang được nghiên cứu rộng rãi. Phần lớn cơ chế không đồng nghĩa với bằng chứng hiệu quả cho mọi chỉ định lâm sàng.',
  'Cam thảo có thể gây tác dụng bất lợi và tương tác thuốc, đặc biệt khi dùng kéo dài hoặc liều cao. Cần chú ý huyết áp, kali máu và thuốc đang sử dụng.',
  'mixed',
  '[{"label":"PubMed – Review 2026 về glycyrrhizic acid","url":"https://pubmed.ncbi.nlm.nih.gov/42543293/","pmid":"42543293"}]'::jsonb,
  true
)
on conflict (slug) do update set
  vietnamese_name = excluded.vietnamese_name,
  latin_name = excluded.latin_name,
  chinese_name = excluded.chinese_name,
  identification = excluded.identification,
  part_used = excluded.part_used,
  traditional_summary = excluded.traditional_summary,
  evidence_summary = excluded.evidence_summary,
  safety_note = excluded.safety_note,
  evidence_level = excluded.evidence_level,
  source_urls = excluded.source_urls,
  active = excluded.active,
  updated_at = now();
