-- HIU Y Quan V16 — additive Ministry-backed content expansion and pharmacy rotation.
-- 70 medicinal plants reuse the existing QD4664-2014 catalog. No plant catalog is duplicated.
-- 30 additional simulated clinical patterns are sourced internally from MOH QD3991/2025 terminology.
-- Source provenance is private and intentionally not exposed in game RPC payloads.

alter table private.hiu_y_quan_syndrome_catalog add column if not exists source_code text;
alter table private.hiu_y_quan_syndrome_catalog add column if not exists source_ref text;
update private.hiu_y_quan_syndrome_catalog
set source_code=coalesce(source_code,'HIU-YQ-BASE'),source_ref=coalesce(source_ref,'Legacy educational pattern catalog')
where source_code is null or source_ref is null;

insert into private.hiu_y_quan_syndrome_catalog(code,label,vong,van_am,van_hoi,thiet,explanation,source_code,source_ref) values
('VM_PHE_TY_KHI_HU','Viêm mũi – Phế Tỳ khí hư','Sắc mặt nhợt; niêm mạc mũi nhạt, hơi phù; lưỡi nhạt, rêu trắng.','Tiếng nói nhỏ, hơi thở yếu.','Hắt hơi, chảy mũi trong tái diễn; dễ mệt, ăn kém, tự ra mồ hôi.','Mạch hư nhược.','Mô phỏng thể Phế Tỳ khí hư trong bệnh cảnh viêm mũi; nhận diện bằng tổng hợp Tứ chẩn.','QD3991-2025','Tập II – Viêm mũi do vận mạch và dị ứng'),
('VM_TA_CUU_LUU_HUYET_HU','Viêm mũi – Tà khí cửu lưu, huyết hư','Niêm mạc mũi nhạt hoặc ám; lưỡi nhạt.','Giọng nói nhỏ, hơi thở không mạnh.','Nghẹt mũi kéo dài, khứu giác giảm; dễ mệt, sắc mặt kém tươi.','Mạch tế nhược.','Mô phỏng bệnh cảnh tà lưu lâu ngày kèm huyết hư.','QD3991-2025','Tập II – Viêm mũi do vận mạch và dị ứng'),
('VM_KHI_TRE_HUYET_U','Viêm mũi – Khí trệ huyết ứ','Niêm mạc mũi ám, có thể tím; lưỡi ám hoặc có điểm ứ.','Hơi thở qua mũi không thông.','Nghẹt mũi cố định, kéo dài; có thể đau tức vùng mũi đầu.','Mạch huyền hoặc sáp.','Mô phỏng thể khí trệ huyết ứ trong bệnh cảnh viêm mũi.','QD3991-2025','Tập II – Viêm mũi do vận mạch và dị ứng'),
('VM_THAN_HU_PHE_MAT_ON','Viêm mũi – Thận hư, Phế mất ôn dưỡng','Sắc mặt nhợt; lưỡi nhạt, rêu trắng.','Tiếng nói nhỏ, hơi thở yếu.','Chảy mũi trong kéo dài, sợ lạnh; có thể kèm mỏi lưng gối.','Mạch trầm nhược.','Mô phỏng thể Thận hư làm Phế mất ôn dưỡng.','QD3991-2025','Tập II – Viêm mũi do vận mạch và dị ứng'),
('GERD_NGOAI_TA_PHAM_VI','Trào ngược – Ngoại tà phạm Vị','Lưỡi rêu mỏng, có thể trắng hoặc hơi vàng.','Ợ hơi, có thể nấc.','Ợ chua, nóng rát hoặc đầy tức thượng vị xuất hiện tương đối cấp.','Mạch phù hoặc huyền tùy tà khí.','Mô phỏng ngoại tà ảnh hưởng công năng hòa giáng của Vị.','QD3991-2025','Tập II – Bệnh trào ngược dạ dày thực quản'),
('GERD_CAN_KHI_PHAM_VI','Trào ngược – Can khí phạm Vị','Lưỡi bình thường hoặc hơi đỏ hai bên.','Hay thở dài, ợ hơi.','Ợ chua, đầy tức ngực sườn hoặc thượng vị; triệu chứng tăng khi căng thẳng.','Mạch huyền.','Mô phỏng Can khí uất ảnh hưởng Vị khí hòa giáng.','QD3991-2025','Tập II – Bệnh trào ngược dạ dày thực quản'),
('GERD_TY_VI_HU_HAN','Trào ngược – Tỳ Vị hư hàn','Sắc mặt nhợt; lưỡi nhạt, rêu trắng.','Giọng nhỏ, ợ hơi yếu.','Đầy bụng, ăn kém, ợ chua; thích ấm, dễ lạnh bụng, đại tiện lỏng.','Mạch trầm trì nhược.','Mô phỏng Tỳ Vị hư hàn trong bệnh cảnh trào ngược.','QD3991-2025','Tập II – Bệnh trào ngược dạ dày thực quản'),
('IBS_CAN_TY_BAT_HOA','Đại tràng kích thích – Can Tỳ bất hòa','Lưỡi nhạt hoặc hơi đỏ hai bên, rêu mỏng.','Hay thở dài; bụng sôi có thể nghe rõ.','Đau bụng liên quan đại tiện, chướng bụng; rối loạn phân tăng khi căng thẳng.','Mạch huyền.','Mô phỏng Can khí ảnh hưởng vận hóa của Tỳ.','QD3991-2025','Tập II – Hội chứng ruột kích thích'),
('IBS_DAI_TRUONG_THAP_NHIET','Đại tràng kích thích – Đại trường thấp nhiệt','Lưỡi đỏ, rêu vàng nhớt.','Hơi thở có thể nặng mùi; bụng sôi.','Đau quặn, mót rặn, đại tiện lỏng nhiều lần, có thể có nhầy; cảm giác nóng rát.','Mạch hoạt sác.','Mô phỏng thấp nhiệt uẩn kết ở Đại trường.','QD3991-2025','Tập II – Hội chứng ruột kích thích'),
('TAO_BON_KHI_TRE','Táo bón – Khí trệ','Bụng đầy; lưỡi rêu mỏng.','Hay ợ hoặc thở dài.','Muốn đại tiện nhưng khó đi, bụng chướng, ợ hơi; triệu chứng liên quan cảm xúc.','Mạch huyền.','Mô phỏng khí cơ không thông làm truyền tống Đại trường kém.','QD3991-2025','Tập II – Táo bón'),
('TAO_BON_CAN_UAT_KHI_TRE','Táo bón – Can uất khí trệ','Hai bên lưỡi có thể hơi đỏ; rêu mỏng.','Hay thở dài.','Táo bón kèm đầy tức ngực sườn, dễ cáu hoặc căng thẳng, bụng chướng.','Mạch huyền.','Mô phỏng Can uất dẫn đến khí trệ và rối loạn truyền đạo.','QD3991-2025','Tập II – Táo bón'),
('TAO_BON_DAI_TRUONG_TAO_NHIET','Táo bón – Đại trường táo nhiệt','Chất lưỡi đỏ, rêu vàng, ít tân dịch.','Hơi thở hôi.','Phân khô cứng, đau bụng khi đại tiện, miệng khô.','Mạch sác.','Mô phỏng lý thực nhiệt ở Đại trường với táo nhiệt làm tổn tân dịch.','QD3991-2025','Tập II – Táo bón'),
('TAO_BON_HAN_NHIET_THAC_TAP','Táo bón – Hàn nhiệt thác tạp','Lưỡi có biểu hiện hàn nhiệt xen kẽ, rêu không đồng nhất.','Âm thanh bụng có thể thay đổi.','Táo bón kéo dài với biểu hiện nóng lạnh xen kẽ, bụng đầy, tiêu hóa thất thường.','Mạch có thể huyền hoặc trầm, không thuần nhất.','Mô phỏng hàn nhiệt cùng tồn tại trong bệnh cảnh táo bón mạn.','QD3991-2025','Tập II – Táo bón'),
('DAI_DAM_TY_PHE_HU','Đái dầm – Tỳ Phế hư tổn','Sắc mặt nhợt; lưỡi nhạt.','Tiếng nói nhỏ.','Đái dầm, dễ mệt, ăn kém; có thể dễ cảm lạnh.','Mạch hư nhược.','Mô phỏng Tỳ Phế khí hư làm khí hóa và cố nhiếp kém.','QD3991-2025','Tập II – Đái dầm'),
('DAI_DAM_TAM_THAN_BAT_GIAO','Đái dầm – Tâm Thận bất giao','Lưỡi có thể hơi đỏ, ít rêu.','Khó ngủ, ngủ không yên.','Đái dầm kèm ngủ không yên, dễ thức giấc hoặc tâm phiền.','Mạch tế.','Mô phỏng Tâm Thận mất điều hòa trong bệnh cảnh đái dầm.','QD3991-2025','Tập II – Đái dầm'),
('DAI_DAM_THAP_NHIET_CAN','Đái dầm – Thấp nhiệt ở kinh Can','Lưỡi đỏ, rêu vàng nhớt.','Có thể dễ cáu, nói nhanh.','Tiểu vàng, có cảm giác nóng hoặc bứt rứt; dễ cáu.','Mạch huyền sác hoặc hoạt sác.','Mô phỏng thấp nhiệt uẩn ở kinh Can ảnh hưởng đường niệu.','QD3991-2025','Tập II – Đái dầm'),
('SOI_TN_KHI_TRE_HUYET_U','Sỏi tiết niệu – Khí trệ huyết ứ','Lưỡi ám hoặc có điểm ứ.','Rên đau khi cơn đau tăng.','Đau vùng hông lưng hoặc đường niệu, đau tương đối cố định; tiểu khó hoặc tiểu máu có thể gặp.','Mạch huyền sáp.','Mô phỏng khí trệ huyết ứ trong bệnh cảnh sỏi tiết niệu.','QD3991-2025','Tập II – Sỏi tiết niệu'),
('SOI_TN_THAP_NHIET','Sỏi tiết niệu – Thấp nhiệt','Lưỡi đỏ, rêu vàng nhớt.','Hơi thở có thể nặng.','Tiểu buốt, rắt, nước tiểu vàng; đau hông lưng, cảm giác nóng.','Mạch hoạt sác.','Mô phỏng thấp nhiệt hạ tiêu trong bệnh cảnh sỏi tiết niệu.','QD3991-2025','Tập II – Sỏi tiết niệu'),
('SOI_TN_THAN_HU','Sỏi tiết niệu – Thận hư','Sắc mặt kém tươi; lưỡi nhạt hoặc đỏ ít rêu tùy thiên âm/dương.','Tiếng nói nhỏ, hơi thở yếu.','Đau mỏi lưng gối kéo dài, tiểu tiện rối loạn, dễ mệt.','Mạch trầm tế hoặc trầm nhược.','Mô phỏng Thận hư làm khí hóa đường niệu suy giảm.','QD3991-2025','Tập II – Sỏi tiết niệu'),
('BPH_THAN_KHI_HU','Phì đại tiền liệt tuyến – Thận khí hư','Lưỡi nhạt, rêu trắng.','Tiếng nói nhỏ.','Tiểu khó, tia tiểu yếu, tiểu đêm; mỏi lưng gối, dễ mệt.','Mạch trầm nhược.','Mô phỏng Thận khí hư trong bệnh cảnh rối loạn tiểu tiện do phì đại tiền liệt tuyến.','QD3991-2025','Tập II – Phì đại lành tính tuyến tiền liệt'),
('BPH_DAM_TRE_HUYET_U','Phì đại tiền liệt tuyến – Đàm trệ huyết ứ','Lưỡi ám, có thể có điểm ứ; rêu nhớt.','Hơi thở nặng, tiếng nói trầm.','Tiểu khó kéo dài, cảm giác tức nặng vùng hạ vị, triệu chứng tương đối cố định.','Mạch huyền sáp hoặc hoạt.','Mô phỏng đàm và huyết ứ cản trở khí hóa bàng quang.','QD3991-2025','Tập II – Phì đại lành tính tuyến tiền liệt'),
('BPH_THAP_NHIET','Phì đại tiền liệt tuyến – Thấp nhiệt','Lưỡi đỏ, rêu vàng nhớt.','Có thể hơi thở nặng.','Tiểu khó kèm tiểu gấp, rắt hoặc nóng; nước tiểu vàng.','Mạch hoạt sác.','Mô phỏng thấp nhiệt hạ tiêu trong bệnh cảnh rối loạn tiểu tiện.','QD3991-2025','Tập II – Phì đại lành tính tuyến tiền liệt'),
('LX_THAN_TINH_BAT_TUC','Loãng xương – Thận tinh bất túc','Sắc mặt kém tươi; tóc bạc sớm; lưỡi nhạt hoặc ít rêu.','Tiếng nói nhỏ.','Đau mỏi lưng gối, giảm sức, có thể ù tai hoặc chóng mặt.','Mạch trầm tế.','Mô phỏng Thận tinh bất túc trong bệnh cảnh loãng xương.','QD3991-2025','Tập II – Loãng xương'),
('LX_CAN_THAN_HU_PHONG_THAP','Loãng xương – Can Thận khuy hư, phong thấp','Dáng đi chậm; lưỡi nhạt, rêu trắng.','Tiếng nói nhỏ.','Đau mỏi xương khớp, lưng gối yếu; đau tăng khi thời tiết ẩm lạnh.','Mạch trầm huyền hoặc nhu.','Mô phỏng Can Thận khuy hư kèm phong thấp xâm nhập.','QD3991-2025','Tập II – Loãng xương'),
('DTD_PHE_VI_TAO_NHIET','Đái tháo đường – Phế Vị táo nhiệt','Da khô; lưỡi đỏ, rêu vàng mỏng.','Hơi thở có thể khô, tiếng nói rõ.','Miệng khô khát, uống nhiều, mau đói, đại tiện táo.','Mạch hoạt sác.','Mô phỏng Phế Vị táo nhiệt trong chứng Tiêu khát.','QD3991-2025','Tập II – Đái tháo đường típ 2'),
('DTD_KHI_AM_LUONG_HU','Đái tháo đường – Khí âm lưỡng hư','Sắc mặt mệt, da khô; lưỡi hơi đỏ, ít rêu.','Tiếng nói nhỏ, hơi thở yếu.','Khát, mệt, tự ra mồ hôi, tiểu nhiều; sức giảm.','Mạch tế nhược hoặc hư sác.','Mô phỏng đồng thời khí hư và âm dịch hao tổn.','QD3991-2025','Tập II – Đái tháo đường típ 2'),
('DTD_AM_DUONG_LUONG_HU','Đái tháo đường – Âm dương lưỡng hư','Sắc mặt nhợt tối; lưỡi nhạt hoặc hơi ám.','Giọng yếu.','Mệt nhiều, sợ lạnh nhưng có thể khô miệng, tiểu tiện rối loạn, lưng gối yếu.','Mạch trầm tế nhược.','Mô phỏng âm dương đều suy trong bệnh cảnh Tiêu khát kéo dài.','QD3991-2025','Tập II – Đái tháo đường típ 2'),
('MAT_NGU_CAN_UAT_HOA_HOA','Mất ngủ – Can uất hóa hỏa','Mặt có thể đỏ; lưỡi đỏ, rêu vàng.','Nói nhanh, hay thở dài.','Khó ngủ, dễ cáu, tâm phiền, đầu căng hoặc miệng đắng.','Mạch huyền sác.','Mô phỏng Can uất lâu ngày hóa hỏa làm nhiễu Tâm thần.','QD3991-2025','Tập II – Mất ngủ'),
('MAT_NGU_DAM_NHIET_NOI_NHIEU','Mất ngủ – Đàm nhiệt nội nhiễu','Lưỡi đỏ, rêu vàng nhớt.','Hơi thở nặng, có thể khò khè do đàm.','Ngủ không yên, nhiều mộng, bứt rứt; ngực bụng đầy, có đàm.','Mạch hoạt sác.','Mô phỏng đàm nhiệt quấy nhiễu Tâm thần.','QD3991-2025','Tập II – Mất ngủ'),
('CHONG_MAT_CAN_DUONG_THUONG_CANG','Chóng mặt – Can dương thượng cang','Mặt đỏ hoặc mắt đỏ; lưỡi đỏ.','Giọng nói có thể to, gấp.','Chóng mặt, đau đầu, dễ cáu, có thể ù tai; triệu chứng tăng khi căng thẳng.','Mạch huyền sác hoặc huyền hữu lực.','Mô phỏng Can dương thượng cang trong bệnh cảnh rối loạn chức năng tiền đình.','QD3991-2025','Tập II – Rối loạn chức năng tiền đình')
on conflict(code) do update set label=excluded.label,vong=excluded.vong,van_am=excluded.van_am,van_hoi=excluded.van_hoi,thiet=excluded.thiet,explanation=excluded.explanation,source_code=excluded.source_code,source_ref=excluded.source_ref;

do $$
declare n integer;
begin
  select count(*) into n from private.hiu_y_quan_syndrome_catalog;
  if n<>50 then raise exception 'V16 requires exactly 50 active syndrome patterns; found %',n; end if;
end $$;

-- Freeze the original 12 fully-curated herb learning cards so V15 challenge/mastery remains stable.
create table if not exists private.hiu_y_quan_learning_herbs_v16(
  herb_key text primary key,
  name text not null,
  latin_name text not null,
  nature_flavor text not null,
  meridians text not null,
  actions text not null,
  indications text not null
);
insert into private.hiu_y_quan_learning_herbs_v16(herb_key,name,latin_name,nature_flavor,meridians,actions,indications)
select herb_key,name,latin_name,nature_flavor,meridians,actions,indications from public.hiu_y_quan_herbs_v14()
on conflict(herb_key) do update set name=excluded.name,latin_name=excluded.latin_name,nature_flavor=excluded.nature_flavor,meridians=excluded.meridians,actions=excluded.actions,indications=excluded.indications;
revoke all on table private.hiu_y_quan_learning_herbs_v16 from public,anon,authenticated;

-- Keep the legacy RPC name/shape so V14 UI requires no new API surface, but load 12 random plants from the official 70-item QD4664 pool.
create or replace function public.hiu_y_quan_herbs_v14()
returns table(herb_key text,name text,latin_name text,nature_flavor text,meridians text,actions text,indications text)
language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id();
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  return query
  select g.seed_key,
         initcap(lower(g.name)),
         coalesce(g.botanical_name,''),
         ''::text,
         ''::text,
         case when strpos(coalesce(g.traditional_actions,''),'Chữa')>0 then btrim(substring(g.traditional_actions from 1 for strpos(g.traditional_actions,'Chữa')-1)) else btrim(coalesce(g.traditional_actions,'')) end,
         case when strpos(coalesce(g.traditional_actions,''),'Chữa')>0 then btrim(substring(g.traditional_actions from strpos(g.traditional_actions,'Chữa'))) else btrim(coalesce(g.traditional_actions,'')) end
  from private.herb_garden_species g
  where g.source_code='QD4664-2014' and g.seedable
  order by random()
  limit 12;
end $$;
revoke all on function public.hiu_y_quan_herbs_v14() from public,anon;
grant execute on function public.hiu_y_quan_herbs_v14() to authenticated;

-- V15 60-second challenge continues to use the frozen detailed 12-card learning set, so random pharmacy rotation never degrades quiz quality.
create or replace function public.hiu_y_quan_herb_challenge_start_v15()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  mid uuid:=private.current_member_id(); d date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
  s public.hiu_y_quan_herb_challenge_sessions%rowtype; herb_keys text[]; n integer; base_seed bigint; i integer; target_pos integer; target_key text; target_name text; field_key text; field_label text; raw_opts text[]; ordered_opts text[]; options_json jsonb; correct_idx integer; questions_json jsonb:='[]'::jsonb;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid);
  select * into s from public.hiu_y_quan_herb_challenge_sessions where member_id=mid and challenge_date=d;
  if found then
    if s.finished_at is null and s.expires_at<=now() then update public.hiu_y_quan_herb_challenge_sessions set finished_at=expires_at,combo=0 where id=s.id returning * into s; end if;
    return jsonb_build_object('session_id',s.id,'challenge_date',d,'expires_at',s.expires_at,'current_index',s.current_index,'score',s.score,'combo',s.combo,'best_combo',s.best_combo,'finished',s.finished_at is not null,'question',case when s.finished_at is null then private.hiu_y_quan_challenge_question_v15(s.questions,s.current_index) else null end);
  end if;
  select array_agg(herb_key order by herb_key) into herb_keys from private.hiu_y_quan_learning_herbs_v16;
  n:=coalesce(array_length(herb_keys,1),0); if n<8 then raise exception 'Herb learning catalog is not ready'; end if;
  base_seed:=(hashtext(mid::text||':'||d::text||':herb60-v15')::bigint & 2147483647);
  for i in 0..7 loop
    target_pos:=((base_seed+i*5)%n)::integer+1; target_key:=herb_keys[target_pos];
    select h.name into target_name from private.hiu_y_quan_learning_herbs_v16 h where h.herb_key=target_key;
    field_key:=case ((base_seed/13+i)%3)::integer when 0 then 'nature_flavor' when 1 then 'meridians' else 'actions' end;
    field_label:=case field_key when 'nature_flavor' then 'Tính vị' when 'meridians' then 'Quy kinh' else 'Công năng' end;
    raw_opts:=array[target_key,herb_keys[((target_pos+1-1)%n)+1],herb_keys[((target_pos+4-1)%n)+1],herb_keys[((target_pos+7-1)%n)+1]];
    select array_agg(x order by (hashtext(mid::text||':'||d::text||':'||i::text||':'||x)::bigint & 2147483647),x) into ordered_opts from unnest(raw_opts) x;
    select jsonb_agg(case field_key when 'nature_flavor' then to_jsonb(h.nature_flavor) when 'meridians' then to_jsonb(h.meridians) else to_jsonb(h.actions) end order by u.ord)
      into options_json from unnest(ordered_opts) with ordinality u(x,ord) join private.hiu_y_quan_learning_herbs_v16 h on h.herb_key=x;
    correct_idx:=array_position(ordered_opts,target_key)-1;
    questions_json:=questions_json||jsonb_build_array(jsonb_build_object('herb_key',target_key,'name',target_name,'field',field_key,'field_label',field_label,'prompt','Chọn '||lower(field_label)||' phù hợp với '||target_name||'.','options',options_json,'correct_index',correct_idx));
  end loop;
  insert into public.hiu_y_quan_herb_challenge_sessions(member_id,challenge_date,started_at,expires_at,questions) values(mid,d,now(),now()+interval '60 seconds',questions_json) returning * into s;
  return jsonb_build_object('session_id',s.id,'challenge_date',d,'expires_at',s.expires_at,'current_index',0,'score',0,'combo',0,'best_combo',0,'finished',false,'question',private.hiu_y_quan_challenge_question_v15(s.questions,0));
end $$;

-- Dynamic 50-pattern case selection, preserving the V14 public signature and all lifecycle semantics.
create or replace function public.hiu_y_quan_hourly_cases_v3()
returns table(case_key text,patient_age smallint,patient_gender text,patient_variant smallint,vong text,van_am text,van_hoi text,thiet text,options jsonb,completed boolean,correct boolean,credits_awarded smallint,appointment_offered boolean,appointment_status text,appointment_for_at timestamptz,appointment_decided_at timestamptz,care_status text,treatment_started_at timestamptz,recheck_due_at timestamptz,rechecked_at timestamptz,discharged_at timestamptz,recheck_count smallint)
language plpgsql security definer set search_path='' as $$
declare
  mid uuid:=private.current_member_id(); slot timestamptz:=date_trunc('hour',now()); cnt integer; i integer; seed bigint; picked_code text; key text; offer boolean; appt_at timestamptz; age_value smallint; variant_value smallint; syndrome_count integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles p where p.member_id=mid) then raise exception 'Hãy kích hoạt nhân vật HIU - Y - Quán trước.'; end if;
  select count(*)::integer into syndrome_count from private.hiu_y_quan_syndrome_catalog; if syndrome_count<4 then raise exception 'Syndrome catalog is not ready'; end if;
  update public.hiu_y_quan_cases c set care_status='recheck_due' where c.member_id=mid and c.archived_at is null and c.care_status='observing' and c.recheck_due_at<=now();
  cnt:=1+(((hashtext(mid::text||slot::text)::bigint & 2147483647)%2)::integer);
  for i in 1..cnt loop
    key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-'||i;
    offer:=private.hiu_y_quan_appointment_offer_v2(mid,slot,i::smallint); appt_at:=case when offer then private.hiu_y_quan_appointment_time_v2(mid,slot,i::smallint) else null end;
    if not exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.case_key=key) then
      seed:=(hashtext(mid::text||slot::text||':'||i)::bigint & 2147483647);
      select s.code into picked_code from private.hiu_y_quan_syndrome_catalog s order by s.code offset (seed%syndrome_count)::integer limit 1;
      age_value:=case (seed%4)::integer when 0 then (5+((seed/4)%8))::smallint when 1 then (13+((seed/32)%5))::smallint when 2 then (18+((seed/160)%42))::smallint else (60+((seed/6720)%31))::smallint end;
      variant_value:=(1+((seed/208320)%3))::smallint;
      insert into public.hiu_y_quan_cases(member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender,patient_variant,appointment_offered,appointment_status,appointment_for_at,care_status)
      values(mid,key,slot,i,picked_code,age_value,case when ((seed/624960)%2)=0 then 'female' else 'male' end,variant_value,offer,case when offer then 'pending' else 'none' end,appt_at,'waiting_diagnosis');
    else
      update public.hiu_y_quan_cases c set appointment_offered=offer,appointment_for_at=case when offer then coalesce(c.appointment_for_at,appt_at) else null end,appointment_status=case when offer and c.appointment_status='none' then 'pending' when not offer and c.appointment_status='pending' then 'none' else c.appointment_status end where c.member_id=mid and c.case_key=key and c.archived_at is null;
    end if;
  end loop;
  return query
  select c.case_key,c.patient_age,c.patient_gender,c.patient_variant,s.vong,s.van_am,s.van_hoi,s.thiet,
    (select jsonb_agg(jsonb_build_object('code',z.code,'label',z.label) order by z.rank_no) from (
      select s2.code,s2.label,0::bigint rank_no from private.hiu_y_quan_syndrome_catalog s2 where s2.code=c.syndrome_code
      union all select d.code,d.label,1+(hashtext(c.case_key||d.code)::bigint & 2147483647) from private.hiu_y_quan_syndrome_catalog d where d.code<>c.syndrome_code order by rank_no limit 4
    ) z) options,
    (a.id is not null),coalesce(a.correct,false),coalesce(a.credits_awarded,0)::smallint,c.appointment_offered,c.appointment_status,c.appointment_for_at,c.appointment_decided_at,c.care_status,c.treatment_started_at,c.recheck_due_at,c.rechecked_at,c.discharged_at,c.recheck_count
  from public.hiu_y_quan_cases c join private.hiu_y_quan_syndrome_catalog s on s.code=c.syndrome_code left join public.hiu_y_quan_attempts a on a.member_id=mid and a.case_id=c.id
  where c.member_id=mid and c.archived_at is null and (c.hour_slot=slot or c.care_status in ('awaiting_transfer','observing','recheck_due'))
  order by case c.care_status when 'recheck_due' then 0 when 'awaiting_transfer' then 1 when 'waiting_diagnosis' then 2 else 3 end,c.hour_slot,c.ordinal;
end $$;
revoke all on function public.hiu_y_quan_hourly_cases_v3() from public,anon;
grant execute on function public.hiu_y_quan_hourly_cases_v3() to authenticated;

-- Busy shift also samples from the full dynamic 50-pattern catalog rather than the V15 hard-coded first 20.
create or replace function public.hiu_y_quan_busy_shift_v15()
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  mid uuid:=private.current_member_id(); slot timestamptz:=date_trunc('hour',now()); seed bigint; picked_code text; key text; age_value smallint; variant_value smallint; inserted integer:=0; total_now integer:=0; p public.hiu_y_quan_engagement_profiles%rowtype; syndrome_count integer;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  if not exists(select 1 from public.hiu_y_quan_profiles hp where hp.member_id=mid) then raise exception 'Hãy kích hoạt HIU - Y - Quán trước.'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid);
  if exists(select 1 from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.ordinal=3) then
    select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
    select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
    return jsonb_build_object('ok',true,'added',false,'reason','Ca đông khách trong giờ này đã được kích hoạt','active_cases',total_now,'level',case when p.xp>=150 then 3 when p.xp>=50 then 2 else 1 end);
  end if;
  select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
  if total_now>=3 then return jsonb_build_object('ok',true,'added',false,'reason','Đã đủ 3 ca mô phỏng trong giờ hiện tại','active_cases',total_now); end if;
  select count(*)::integer into syndrome_count from private.hiu_y_quan_syndrome_catalog; if syndrome_count<4 then raise exception 'Syndrome catalog is not ready'; end if;
  seed:=(hashtext(mid::text||slot::text||':busy-v15')::bigint & 2147483647);
  select s.code into picked_code from private.hiu_y_quan_syndrome_catalog s order by s.code offset (seed%syndrome_count)::integer limit 1;
  age_value:=case (seed%4)::integer when 0 then (5+((seed/4)%8))::smallint when 1 then (13+((seed/32)%5))::smallint when 2 then (18+((seed/160)%42))::smallint else (60+((seed/6720)%31))::smallint end;
  variant_value:=(1+((seed/208320)%3))::smallint;
  key:=to_char(slot at time zone 'Asia/Ho_Chi_Minh','YYYYMMDDHH24')||'-'||substr(replace(mid::text,'-',''),1,8)||'-busy3';
  insert into public.hiu_y_quan_cases(member_id,case_key,hour_slot,ordinal,syndrome_code,patient_age,patient_gender,patient_variant,appointment_offered,appointment_status,appointment_for_at,care_status)
  values(mid,key,slot,3,picked_code,age_value,case when ((seed/624960)%2)=0 then 'female' else 'male' end,variant_value,false,'none',null,'waiting_diagnosis') on conflict do nothing;
  get diagnostics inserted=row_count;
  select count(*)::integer into total_now from public.hiu_y_quan_cases c where c.member_id=mid and c.hour_slot=slot and c.archived_at is null;
  select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
  return jsonb_build_object('ok',true,'added',inserted=1,'active_cases',total_now,'level',case when p.xp>=150 then 3 when p.xp>=50 then 2 else 1 end,'message',case when inserted=1 then 'Đã mở Ca đông khách: thêm 1 bệnh nhân mô phỏng.' else 'Ca đông khách đã tồn tại; không tạo trùng.' end);
end $$;

-- Keep V15 collection stable for the original detailed herb-mastery set while exposing all 50 syndrome cards.
create or replace function public.hiu_y_quan_collection_v15()
returns jsonb language plpgsql security definer set search_path='' as $$
declare mid uuid:=private.current_member_id(); herb_cards jsonb; syndrome_cards jsonb; p public.hiu_y_quan_engagement_profiles%rowtype;
begin
  if mid is null or not private.is_approved() then raise exception 'Approved member required'; end if;
  perform private.hiu_y_quan_ensure_engagement_v15(mid); perform private.hiu_y_quan_sync_syndrome_mastery_v15(mid);
  select * into p from public.hiu_y_quan_engagement_profiles where member_id=mid;
  select coalesce(jsonb_agg(jsonb_build_object('key',h.herb_key,'name',h.name,'kind','herb','points',coalesce(m.points,0),'tier',private.hiu_y_quan_mastery_tier_v15(coalesce(m.points,0)),'unlocked',coalesce(m.points,0)>0,'badge',case private.hiu_y_quan_mastery_tier_v15(coalesce(m.points,0)) when 4 then 'Ngọc dược' when 3 then 'Tinh thông' when 2 then 'Thuần thục' when 1 then 'Đã nhận diện' else 'Chưa mở' end) order by h.name),'[]'::jsonb) into herb_cards
  from private.hiu_y_quan_learning_herbs_v16 h left join public.hiu_y_quan_mastery m on m.member_id=mid and m.item_type='herb' and m.item_key=h.herb_key;
  select coalesce(jsonb_agg(jsonb_build_object('key',s.code,'name',s.label,'kind','syndrome','points',coalesce(m.points,0),'tier',private.hiu_y_quan_mastery_tier_v15(coalesce(m.points,0)),'unlocked',coalesce(m.points,0)>0,'badge',case private.hiu_y_quan_mastery_tier_v15(coalesce(m.points,0)) when 4 then 'Biện chứng tinh thông' when 3 then 'Vững thể bệnh' when 2 then 'Thuần thục' when 1 then 'Đã nhận diện' else 'Chưa mở' end) order by coalesce(m.points,0) desc,s.label),'[]'::jsonb) into syndrome_cards
  from private.hiu_y_quan_syndrome_catalog s left join public.hiu_y_quan_mastery m on m.member_id=mid and m.item_type='syndrome' and m.item_key=s.code;
  return jsonb_build_object('xp',p.xp,'title',case when p.xp>=300 then 'Danh y mô phỏng' when p.xp>=150 then 'Cao thủ Tứ chẩn' when p.xp>=50 then 'Tân thủ Biện chứng' else 'Học đồ HIU' end,'herbs',herb_cards,'syndromes',syndrome_cards);
end $$;

revoke all on function public.hiu_y_quan_herb_challenge_start_v15() from public,anon;
revoke all on function public.hiu_y_quan_busy_shift_v15() from public,anon;
revoke all on function public.hiu_y_quan_collection_v15() from public,anon;
grant execute on function public.hiu_y_quan_herb_challenge_start_v15() to authenticated;
grant execute on function public.hiu_y_quan_busy_shift_v15() to authenticated;
grant execute on function public.hiu_y_quan_collection_v15() to authenticated;
