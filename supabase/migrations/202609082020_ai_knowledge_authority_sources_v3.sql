begin;

create table if not exists public.ai_knowledge_authority_sources(
  id text primary key,
  knowledge_id text null references public.ai_knowledge_items(id) on delete cascade,
  applies_to_kinds text[] not null default '{}'::text[],
  global_scope boolean not null default false,
  provider text not null check(provider in ('who','nccih','cochrane')),
  source_type text not null check(source_type in ('global_strategy','technical_standard','evidence_summary','safety_guidance','systematic_review')),
  title text not null,
  citation_text text not null,
  publication_year integer not null check(publication_year between 1900 and 2100),
  identifier text not null default '',
  source_url text not null check(source_url like 'https://%'),
  authority_tier integer not null check(authority_tier between 1 and 3),
  authority_note text not null default '',
  verified boolean not null default true,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_authority_scope_check check(
    global_scope or knowledge_id is not null or cardinality(applies_to_kinds)>0
  ),
  constraint ai_knowledge_authority_kinds_check check(
    applies_to_kinds <@ array['formula','herb','acupoint']::text[]
  )
);

alter table public.ai_knowledge_authority_sources enable row level security;
revoke all on table public.ai_knowledge_authority_sources from anon,authenticated;

insert into public.ai_knowledge_authority_sources(
  id,knowledge_id,applies_to_kinds,global_scope,provider,source_type,title,citation_text,
  publication_year,identifier,source_url,authority_tier,authority_note,verified,checked_at
) values
('auth-who-tm-strategy-2025-2034',null,array[]::text[],true,'who','global_strategy',
 'Global traditional medicine strategy 2025-2034',
 'World Health Organization. Global traditional medicine strategy 2025-2034. Geneva: WHO; 2025. ISBN 978-92-4-011317-6.',
 2025,'ISBN 978-92-4-011317-6','https://www.who.int/publications/i/item/9789240113176',1,
 'Khung chiến lược cấp WHO nhấn mạnh tăng cường bằng chứng, an toàn, quản lý và tích hợp TCIM dựa trên bằng chứng; dùng để đặt chuẩn governance cho RAG, không phải bằng chứng hiệu quả của một can thiệp cụ thể.',true,now()),
('auth-who-acupuncture-practice-2021',null,array['acupoint'],false,'who','technical_standard',
 'WHO benchmarks for the practice of acupuncture',
 'World Health Organization. WHO benchmarks for the practice of acupuncture. Geneva: WHO; 2021. ISBN 9789240016880.',
 2021,'ISBN 9789240016880','https://www.who.int/westernpacific/publications/i/item/978-92-4-001688-0',1,
 'Chuẩn thực hành châm cứu của WHO, tập trung quy trình, hạ tầng tối thiểu và an toàn. Dùng làm nguồn chuẩn an toàn/thực hành, không thay thế đánh giá hiệu quả theo bệnh.',true,now()),
('auth-who-acupuncture-training-2021',null,array['acupoint'],false,'who','technical_standard',
 'WHO benchmarks for the training of acupuncture',
 'World Health Organization. WHO benchmarks for the training of acupuncture. Geneva: WHO; 2021. ISBN 9789240017962.',
 2021,'ISBN 9789240017962','https://www.who.int/publications/i/item/9789240017962',1,
 'Chuẩn đào tạo châm cứu của WHO với các mô-đun năng lực và lộ trình đào tạo. Dùng để củng cố cảnh báo rằng định vị/châm kim cần người được đào tạo.',true,now()),
('auth-nccih-tcm-overview',null,array['formula','herb','acupoint'],false,'nccih','evidence_summary',
 'Traditional Chinese Medicine: What You Need To Know',
 'National Center for Complementary and Integrative Health. Traditional Chinese Medicine: What You Need To Know. NIH/NCCIH.',
 2026,'NIH/NCCIH','https://www.nccih.nih.gov/health/traditional-chinese-medicine-what-you-need-to-know',2,
 'Tổng quan bằng chứng và an toàn từ NCCIH: kết quả nghiên cứu với dược liệu Trung y còn hỗn hợp, nhiều nghiên cứu chất lượng thấp; đồng thời nhấn mạnh rủi ro chất lượng sản phẩm và không trì hoãn chăm sóc chuẩn.',true,now()),
('auth-nccih-acupuncture-safety',null,array['acupoint'],false,'nccih','evidence_summary',
 'Acupuncture: Effectiveness and Safety',
 'National Center for Complementary and Integrative Health. Acupuncture: Effectiveness and Safety. NIH/NCCIH.',
 2026,'NIH/NCCIH','https://www.nccih.nih.gov/health/acupuncture-effectiveness-and-safety',2,
 'Tổng quan thực chứng và an toàn; nhấn mạnh biến cố nghiêm trọng có thể xảy ra khi dùng kim không vô khuẩn hoặc thực hành không đúng kỹ thuật.',true,now()),
('auth-nccih-complementary-safety',null,array['formula','herb'],false,'nccih','safety_guidance',
 'Safe Use of Complementary Health Products and Practices',
 'National Center for Complementary and Integrative Health. Safe Use of Complementary Health Products and Practices. NIH/NCCIH.',
 2026,'NIH/NCCIH','https://www.nccih.nih.gov/health/safety',2,
 'Nguồn an toàn cấp liên bang Hoa Kỳ về tương tác, chất lượng và nhiễm tạp của sản phẩm bổ sung/thảo dược. Dùng làm guardrail an toàn chung cho formula/herb.',true,now()),
('auth-nccih-herbs-at-a-glance',null,array['herb'],false,'nccih','evidence_summary',
 'Herbs at a Glance',
 'National Center for Complementary and Integrative Health. Herbs at a Glance. NIH/NCCIH.',
 2026,'NIH/NCCIH','https://www.nccih.nih.gov/health/herbsataglance?link=title',2,
 'Bộ fact sheet chính thức tóm tắt tên dược liệu, bằng chứng, tác dụng phụ và cảnh báo; dùng như nguồn authority bổ sung, không thay cho chuyên luận dược điển.',true,now()),
('auth-cochrane-pc6-2025','acupoint-pc6-neiguan',array[]::text[],false,'cochrane','systematic_review',
 'Stimulation of the wrist acupuncture point PC6 for preventing postoperative nausea and vomiting: a network meta-analysis',
 'Lee A, Zhang JZ, Xie J, et al. Cochrane Database Syst Rev. 2025;9(9):CD003281. doi:10.1002/14651858.CD003281.pub5.',
 2025,'doi:10.1002/14651858.CD003281.pub5','https://doi.org/10.1002/14651858.CD003281.pub5',1,
 'Nguồn Cochrane độc lập ở cấp tổng quan hệ thống/network meta-analysis cho PC6; được dùng song song với PMID để giảm phụ thuộc vào một cổng chỉ mục.',true,now())
on conflict(id) do update set
  knowledge_id=excluded.knowledge_id,applies_to_kinds=excluded.applies_to_kinds,global_scope=excluded.global_scope,
  provider=excluded.provider,source_type=excluded.source_type,title=excluded.title,citation_text=excluded.citation_text,
  publication_year=excluded.publication_year,identifier=excluded.identifier,source_url=excluded.source_url,
  authority_tier=excluded.authority_tier,authority_note=excluded.authority_note,verified=excluded.verified,
  checked_at=excluded.checked_at,updated_at=now();

create index if not exists ai_knowledge_authority_knowledge_idx
  on public.ai_knowledge_authority_sources(knowledge_id,authority_tier,publication_year desc) where verified;
create index if not exists ai_knowledge_authority_provider_idx
  on public.ai_knowledge_authority_sources(provider,authority_tier,publication_year desc) where verified;

create or replace function public.ai_knowledge_search_v3(p_query text,p_kinds text[] default null,p_limit integer default 8)
returns jsonb
language sql
stable
security definer
set search_path='public','pg_catalog'
as $function$
  with base as(
    select value as item,ordinality as ord
    from jsonb_array_elements(public.ai_knowledge_search_v2(p_query,p_kinds,p_limit)) with ordinality
  ), enriched as(
    select ord,
      jsonb_set(item,'{record,authoritySources}',coalesce((
        select jsonb_agg(src.payload order by src.scope_rank,src.authority_tier,src.publication_year desc,src.id)
        from (
          select s.id,s.authority_tier,s.publication_year,
            case
              when s.knowledge_id=item->'record'->>'id' then 0
              when item->'record'->>'kind'=any(s.applies_to_kinds) then 1
              else 2
            end as scope_rank,
            jsonb_build_object(
              'id',s.id,'provider',s.provider,'sourceType',s.source_type,'title',s.title,
              'citation',s.citation_text,'publicationYear',s.publication_year,'identifier',s.identifier,
              'sourceUrl',s.source_url,'authorityTier',s.authority_tier,'authorityNote',s.authority_note,'verified',s.verified
            ) as payload
          from public.ai_knowledge_authority_sources s
          where s.verified and (
            s.knowledge_id=item->'record'->>'id'
            or item->'record'->>'kind'=any(s.applies_to_kinds)
            or s.global_scope
          )
          order by scope_rank,s.authority_tier,s.publication_year desc,s.id
          limit 4
        ) src
      ),'[]'::jsonb),true) as item
    from base
  )
  select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) from enriched;
$function$;

create or replace function public.ai_knowledge_stats_v3()
returns jsonb
language sql
stable
security definer
set search_path='public','pg_catalog'
as $function$
  select public.ai_knowledge_stats_v2() || jsonb_build_object(
    'authoritySources',count(*) filter(where verified),
    'whoVerified',count(*) filter(where verified and provider='who'),
    'nccihVerified',count(*) filter(where verified and provider='nccih'),
    'cochraneVerified',count(*) filter(where verified and provider='cochrane')
  ) from public.ai_knowledge_authority_sources;
$function$;

revoke all on function public.ai_knowledge_search_v3(text,text[],integer) from public;
revoke all on function public.ai_knowledge_stats_v3() from public;
grant execute on function public.ai_knowledge_search_v3(text,text[],integer) to anon,authenticated;
grant execute on function public.ai_knowledge_stats_v3() to anon,authenticated;

commit;
