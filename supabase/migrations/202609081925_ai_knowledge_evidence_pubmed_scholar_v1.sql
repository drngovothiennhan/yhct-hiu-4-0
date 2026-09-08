begin;

create table if not exists public.ai_knowledge_evidence(
  id text primary key,
  knowledge_id text not null references public.ai_knowledge_items(id) on delete cascade,
  title text not null,
  citation_text text not null,
  journal text not null default '',
  publication_year integer not null check(publication_year between 1900 and 2100),
  evidence_type text not null check(evidence_type in ('systematic_review','meta_analysis','systematic_review_meta_analysis','network_meta_analysis','review')),
  evidence_note text not null default '',
  pmid text not null check(pmid ~ '^[0-9]{6,9}$'),
  doi text not null default '',
  pubmed_url text not null check(pubmed_url like 'https://pubmed.ncbi.nlm.nih.gov/%'),
  google_scholar_url text not null check(google_scholar_url like 'https://scholar.google.com/scholar?%'),
  verified boolean not null default true,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(knowledge_id,pmid)
);

alter table public.ai_knowledge_evidence enable row level security;
revoke all on table public.ai_knowledge_evidence from anon,authenticated;

insert into public.ai_knowledge_evidence(id,knowledge_id,title,citation_text,journal,publication_year,evidence_type,evidence_note,pmid,doi,pubmed_url,google_scholar_url,verified,checked_at) values
('ev-herb-hoang-ky-40302232','herb-hoang-ky','Efficacy of Astragalus Membranaceus (Huang Qi) for Cancer-Related Fatigue: A Systematic Review and Meta-Analysis of Randomized Controlled Studies.','Xia S, Liu Y, Huang B, et al. Integr Cancer Ther. 2025;24:15347354241313344. PMID:40302232. doi:10.1177/15347354241313344.','Integrative Cancer Therapies',2025,'systematic_review_meta_analysis','Tổng quan và phân tích gộp RCT; tác giả kết luận tín hiệu hiệu quả có nhưng bằng chứng còn nhỏ và chất lượng thấp, chưa đủ để hỗ trợ mạnh cho sử dụng lâm sàng.','40302232','10.1177/15347354241313344','https://pubmed.ncbi.nlm.nih.gov/40302232/','https://scholar.google.com/scholar?q=10.1177%2F15347354241313344',true,now()),
('ev-herb-hoang-ky-31034954','herb-hoang-ky','Astragalus membranaceus (Huang Qi) as adjunctive therapy for diabetic kidney disease: An updated systematic review and meta-analysis.','Zhang L, Shergis JL, Yang L, et al. J Ethnopharmacol. 2019;239:111921. PMID:31034954. doi:10.1016/j.jep.2019.111921.','Journal of Ethnopharmacology',2019,'systematic_review_meta_analysis','Bằng chứng bổ trợ trong bệnh thận do đái tháo đường được đánh giá là chất lượng thấp, dị hợp cao và có nguy cơ thiên lệch công bố; chỉ dùng làm ngữ cảnh nghiên cứu.','31034954','10.1016/j.jep.2019.111921','https://pubmed.ncbi.nlm.nih.gov/31034954/','https://scholar.google.com/scholar?q=10.1016%2Fj.jep.2019.111921',true,now()),
('ev-herb-dang-quy-42366516','herb-dang-quy','Angelica sinensis: Botany, Traditional Uses, Phytochemistry, Pharmacology, Safety, and Applications.','Zhang Y, Zhu Z, Li X, et al. Am J Chin Med. 2026;54(4):1213-1251. PMID:42366516. doi:10.1142/S0192415X2650045X.','American Journal of Chinese Medicine',2026,'review','Tổng quan toàn diện về thực vật học, hóa thực vật, dược lý và an toàn; chính bài báo lưu ý bằng chứng lâm sàng chất lượng cao còn hạn chế.','42366516','10.1142/S0192415X2650045X','https://pubmed.ncbi.nlm.nih.gov/42366516/','https://scholar.google.com/scholar?q=10.1142%2FS0192415X2650045X',true,now()),
('ev-herb-dang-quy-27211015','herb-dang-quy','Angelica sinensis in China-A review of botanical profile, ethnopharmacology, phytochemistry and chemical analysis.','Wei WL, Zeng R, Gu CM, et al. J Ethnopharmacol. 2016;190:116-141. PMID:27211015. doi:10.1016/j.jep.2016.05.023.','Journal of Ethnopharmacology',2016,'review','Tổng quan nền tảng về sử dụng truyền thống, hóa thực vật, phân tích chất lượng và độc tính; không được diễn giải như bằng chứng hiệu quả điều trị cá thể.','27211015','10.1016/j.jep.2016.05.023','https://pubmed.ncbi.nlm.nih.gov/27211015/','https://scholar.google.com/scholar?q=10.1016%2Fj.jep.2016.05.023',true,now()),
('ev-formula-si-jun-zi-33407405','formula-si-jun-zi-tang','Efficacy and safety of Si-Jun-Zi-Tang-based therapies for functional (non-ulcer) dyspepsia: a meta-analysis of randomized controlled trials.','Wang Y, Liu B, Fu X, Tong T, Yu Z. BMC Complement Med Ther. 2021;21(1):11. PMID:33407405. doi:10.1186/s12906-020-03176-z.','BMC Complementary Medicine and Therapies',2021,'meta_analysis','Phân tích 12 RCT cho thấy tín hiệu lợi ích nhưng toàn bộ nghiên cứu được đánh giá nguy cơ sai lệch cao; cần RCT chuẩn hóa, quy mô lớn.','33407405','10.1186/s12906-020-03176-z','https://pubmed.ncbi.nlm.nih.gov/33407405/','https://scholar.google.com/scholar?q=10.1186%2Fs12906-020-03176-z',true,now()),
('ev-formula-liu-wei-23258998','formula-liu-wei-di-huang-wan','Chinese patent medicine liu wei di huang wan combined with antihypertensive drugs for essential hypertension: a systematic review of randomized controlled trials.','Wang J, Yao K, Yang X, et al. 2012;2012:714805. PMID:23258998. doi:10.1155/2012/714805.','Evidence-Based Complementary and Alternative Medicine',2012,'systematic_review','Tổng quan RCT về phối hợp với thuốc hạ áp; chỉ lưu làm bằng chứng nghiên cứu lịch sử và không dùng để suy diễn chỉ định cho người dùng.','23258998','10.1155/2012/714805','https://pubmed.ncbi.nlm.nih.gov/23258998/','https://scholar.google.com/scholar?q=10.1155%2F2012%2F714805',true,now()),
('ev-formula-liu-wei-30797417','formula-liu-wei-di-huang-wan','Characteristics of the traditional Liu-Wei-Di-Huang prescription reassessed in modern pharmacology.','Cheng XR, Qi CH, Wang TX, Zhou WX, Zhang YX. Chin J Nat Med. 2019;17(2):103-121. PMID:30797417. doi:10.1016/S1875-5364(19)30013-5.','Chinese Journal of Natural Medicines',2019,'review','Tổng quan dược lý, kiểm soát chất lượng, dược động học và độc tính; phù hợp để giải thích cơ chế/nghiên cứu, không thay thế bằng chứng lâm sàng.','30797417','10.1016/S1875-5364(19)30013-5','https://pubmed.ncbi.nlm.nih.gov/30797417/','https://scholar.google.com/scholar?q=10.1016%2FS1875-5364%2819%2930013-5',true,now()),
('ev-acupoint-pc6-40938065','acupoint-pc6-neiguan','Stimulation of the wrist acupuncture point PC6 for preventing postoperative nausea and vomiting: a network meta-analysis.','Lee A, et al. Cochrane Database Syst Rev. 2025. PMID:40938065. doi:10.1002/14651858.CD003281.pub5.','Cochrane Database of Systematic Reviews',2025,'network_meta_analysis','Cochrane network meta-analysis gồm 77 thử nghiệm; kết quả phụ thuộc kỹ thuật và chất lượng bằng chứng, vì vậy RAG phải giữ ngữ cảnh và mức độ chắc chắn.','40938065','10.1002/14651858.CD003281.pub5','https://pubmed.ncbi.nlm.nih.gov/40938065/','https://scholar.google.com/scholar?q=10.1002%2F14651858.CD003281.pub5',true,now()),
('ev-acupoint-pc6-33613810','acupoint-pc6-neiguan','Electrical Stimulation of PC 6 to Control Chemotherapy-Induced Nausea and Vomiting in Patients with Cancer: A Systematic Review and Meta-Analysis.','Garcia GT, Ribeiro RF, Santos IBF, Gomes FC, Melo-Neto JS. Med Acupunct. 2021;33(1):22-44. PMID:33613810. doi:10.1089/acu.2020.1431.','Medical Acupuncture',2021,'systematic_review_meta_analysis','Tổng quan và phân tích gộp về điện kích thích PC6 trong buồn nôn/nôn do hóa trị; dùng làm nguồn nghiên cứu, không làm hướng dẫn điều trị cá thể.','33613810','10.1089/acu.2020.1431','https://pubmed.ncbi.nlm.nih.gov/33613810/','https://scholar.google.com/scholar?q=10.1089%2Facu.2020.1431',true,now()),
('ev-acupoint-st36-32215037','acupoint-st36-zusanli','Acupuncture at Zusanli (ST36) for Experimental Sepsis: A Systematic Review.','Lai F, Ren Y, Lai C, et al. 2020;2020:3620741. PMID:32215037. doi:10.1155/2020/3620741.','Evidence-Based Complementary and Alternative Medicine',2020,'systematic_review','Tổng quan về mô hình sepsis thực nghiệm; đây là bằng chứng tiền lâm sàng, không được dùng để khẳng định hiệu quả điều trị sepsis ở người.','32215037','10.1155/2020/3620741','https://pubmed.ncbi.nlm.nih.gov/32215037/','https://scholar.google.com/scholar?q=10.1155%2F2020%2F3620741',true,now())
on conflict(knowledge_id,pmid) do update set
  title=excluded.title,citation_text=excluded.citation_text,journal=excluded.journal,publication_year=excluded.publication_year,
  evidence_type=excluded.evidence_type,evidence_note=excluded.evidence_note,doi=excluded.doi,pubmed_url=excluded.pubmed_url,
  google_scholar_url=excluded.google_scholar_url,verified=excluded.verified,checked_at=excluded.checked_at,updated_at=now();

create index if not exists ai_knowledge_evidence_knowledge_year_idx on public.ai_knowledge_evidence(knowledge_id,publication_year desc) where verified;
create index if not exists ai_knowledge_evidence_pmid_idx on public.ai_knowledge_evidence(pmid);

create or replace function public.ai_knowledge_search_v2(p_query text,p_kinds text[] default null,p_limit integer default 8)
returns jsonb
language sql
stable
security definer
set search_path='public','pg_catalog'
as $function$
  with base as(
    select value as item,ordinality as ord
    from jsonb_array_elements(public.ai_knowledge_search_v1(p_query,p_kinds,p_limit)) with ordinality
  ), enriched as(
    select ord,
      jsonb_set(item,'{record,evidence}',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',e.id,'title',e.title,'citation',e.citation_text,'journal',e.journal,'publicationYear',e.publication_year,
          'evidenceType',e.evidence_type,'evidenceNote',e.evidence_note,'pmid',e.pmid,'doi',e.doi,
          'pubmedUrl',e.pubmed_url,'googleScholarUrl',e.google_scholar_url,'verified',e.verified
        ) order by e.publication_year desc,e.id)
        from public.ai_knowledge_evidence e
        where e.knowledge_id=item->'record'->>'id' and e.verified
      ),'[]'::jsonb),true) as item
    from base
  )
  select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) from enriched;
$function$;

create or replace function public.ai_knowledge_stats_v2()
returns jsonb
language sql
stable
security definer
set search_path='public','pg_catalog'
as $function$
  select public.ai_knowledge_stats_v1() || jsonb_build_object(
    'evidence',count(*) filter(where verified),
    'pubmedVerified',count(*) filter(where verified and pmid<>''),
    'googleScholarLinks',count(*) filter(where verified and google_scholar_url<>'')
  ) from public.ai_knowledge_evidence;
$function$;

revoke all on function public.ai_knowledge_search_v2(text,text[],integer) from public;
revoke all on function public.ai_knowledge_stats_v2() from public;
grant execute on function public.ai_knowledge_search_v2(text,text[],integer) to anon,authenticated;
grant execute on function public.ai_knowledge_stats_v2() to anon,authenticated;

commit;
