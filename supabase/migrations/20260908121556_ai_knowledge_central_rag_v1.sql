create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.ai_knowledge_items(
  id text primary key,
  kind text not null check(kind in ('formula','herb','acupoint')),
  name text not null,
  aliases text[] not null default '{}'::text[],
  content_text text not null,
  source_ref text not null,
  search_ascii text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_knowledge_id_len check(char_length(id) between 3 and 120),
  constraint ai_knowledge_name_len check(char_length(name) between 1 and 240),
  constraint ai_knowledge_content_len check(char_length(content_text) between 10 and 12000)
);

alter table public.ai_knowledge_items enable row level security;
revoke all on table public.ai_knowledge_items from anon, authenticated;

create or replace function private.ai_knowledge_prepare_v1()
returns trigger
language plpgsql
security definer
set search_path='public','extensions','pg_catalog'
as $$
begin
  new.search_ascii := regexp_replace(
    lower(extensions.unaccent(concat_ws(' ',new.name,array_to_string(new.aliases,' '),new.content_text))),
    '[^a-z0-9 ]+',' ','g'
  );
  new.search_ascii := regexp_replace(new.search_ascii,'[[:space:]]+',' ','g');
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function private.ai_knowledge_prepare_v1() from public, anon, authenticated;

drop trigger if exists ai_knowledge_prepare_v1 on public.ai_knowledge_items;
create trigger ai_knowledge_prepare_v1
before insert or update of name,aliases,content_text
on public.ai_knowledge_items
for each row execute function private.ai_knowledge_prepare_v1();

create index if not exists ai_knowledge_kind_idx on public.ai_knowledge_items(kind) where published;
create index if not exists ai_knowledge_fts_idx on public.ai_knowledge_items using gin(to_tsvector('simple',search_ascii));

insert into public.ai_knowledge_items(id,kind,name,aliases,content_text,source_ref) values
('formula-si-jun-zi-tang','formula','Tứ Quân Tử Thang',array['Si Jun Zi Tang','Tứ quân tử'],$c$Thành phần: Nhân sâm, Bạch truật, Phục linh, Chích cam thảo. Liều tham khảo học tập: Nhân sâm 9 g, Bạch truật 9 g, Phục linh 9 g, Chích cam thảo 6 g; liều thực hành phải theo dược điển/giáo trình và người hành nghề. Tác dụng theo phương tễ học: ích khí, kiện tỳ. Chỉ định học tập: chứng Tỳ khí hư với mệt, ăn kém, sắc mặt nhợt, đại tiện lỏng, mạch hư nhược. Cảnh báo: không tự dùng để điều trị; cần biện chứng, rà soát bệnh nền, thai kỳ, tương tác và nguồn dược liệu. Nguồn ghi chú: dữ liệu học tập tóm tắt từ phương tễ học kinh điển; liều có thể khác giữa giáo trình và dược điển.$c$,'src/data/ai-kb/formulas.ts'),
('formula-liu-wei-di-huang-wan','formula','Lục Vị Địa Hoàng Hoàn',array['Liu Wei Di Huang Wan','Lục vị'],$c$Thành phần: Thục địa hoàng, Sơn thù du, Sơn dược, Trạch tả, Mẫu đơn bì, Phục linh. Tỷ lệ kinh điển thường gặp 8:4:4:3:3:3; dạng hoàn/thang và liều cụ thể phải theo chuyên luận, giáo trình hoặc chỉ định chuyên môn. Tác dụng: tư âm, bổ thận. Chỉ định học tập: mẫu phương cho Thận âm hư với các biểu hiện phù hợp biện chứng. Cảnh báo: không suy diễn dùng cho mọi trường hợp “thận hư”; thận trọng khi tiêu hóa kém, đang dùng thuốc khác hoặc có bệnh mạn tính. Nguồn ghi chú: tóm tắt học thuật, không phải đơn thuốc cá thể hóa.$c$,'src/data/ai-kb/formulas.ts'),
('formula-bu-zhong-yi-qi-tang','formula','Bổ Trung Ích Khí Thang',array['Bu Zhong Yi Qi Tang','Bổ trung ích khí'],$c$Thành phần: Hoàng kỳ, Nhân sâm, Bạch truật, Chích cam thảo, Đương quy, Trần bì, Thăng ma, Sài hồ. Liều thay đổi đáng kể theo giáo trình và dạng bào chế; ứng dụng thực hành phải đối chiếu chuyên luận chính thức. Tác dụng: bổ trung ích khí, thăng dương cử hãm. Chỉ định học tập: Trung khí hạ hãm/Tỳ khí hư phù hợp biện chứng. Cảnh báo: không dùng theo tên bệnh đơn thuần; cần đánh giá sốt, viêm, tăng huyết áp, thai kỳ và thuốc đang sử dụng. Nguồn ghi chú: tóm tắt phương tễ học phục vụ tra cứu nhanh.$c$,'src/data/ai-kb/formulas.ts'),
('formula-gui-zhi-tang','formula','Quế Chi Thang',array['Gui Zhi Tang','Quế chi thang'],$c$Thành phần: Quế chi, Bạch thược, Sinh khương, Đại táo, Chích cam thảo. Tỷ lệ kinh điển thường gặp: Quế chi 9 g, Bạch thược 9 g, Sinh khương 9 g, Đại táo 4 quả, Chích cam thảo 6 g; cần đối chiếu giáo trình/dược điển trước thực hành. Tác dụng: giải cơ, điều hòa dinh vệ. Chỉ định học tập: biểu hư trúng phong theo biện chứng. Cảnh báo: không dùng như thuốc cảm thông thường cho mọi trường hợp; cần đánh giá sốt cao, mất nước, thai kỳ và bệnh nền. Nguồn ghi chú: tóm tắt kinh điển phục vụ học tập.$c$,'src/data/ai-kb/formulas.ts'),
('formula-er-chen-tang','formula','Nhị Trần Thang',array['Er Chen Tang','Nhị trần'],$c$Thành phần: Bán hạ chế, Trần bì, Phục linh, Chích cam thảo; thường phối Sinh khương, Ô mai tùy bản phương. Liều và cách chế biến Bán hạ phải theo dược điển/giáo trình; không sử dụng dược liệu sống không đạt chuẩn. Tác dụng: táo thấp hóa đàm, lý khí hòa trung. Chỉ định học tập: đàm thấp phù hợp biện chứng. Cảnh báo: Bán hạ cần chế biến đạt chuẩn; không tự dùng trong thai kỳ hoặc khi chưa đánh giá tương tác/chống chỉ định. Nguồn ghi chú: dữ liệu giáo dục, nhấn mạnh an toàn dược liệu.$c$,'src/data/ai-kb/formulas.ts'),
('formula-xiao-yao-san','formula','Tiêu Dao Tán',array['Xiao Yao San','Tiêu dao tán'],$c$Thành phần: Sài hồ, Đương quy, Bạch thược, Bạch truật, Phục linh, Chích cam thảo; bản cổ có Sinh khương, Bạc hà. Liều khác nhau theo bản phương và dạng bào chế; phải đối chiếu nguồn chuẩn trước ứng dụng. Tác dụng: sơ can giải uất, dưỡng huyết kiện tỳ. Chỉ định học tập: Can uất, huyết hư, Tỳ hư theo biện chứng. Cảnh báo: không dùng như thuốc an thần hoặc điều trị rối loạn tâm thần; cần đánh giá lâm sàng và thuốc đang dùng. Nguồn ghi chú: tóm tắt học thuật từ phương tễ học kinh điển.$c$,'src/data/ai-kb/formulas.ts'),
('herb-hoang-ky','herb','Hoàng kỳ',array['Astragalus membranaceus','Huang Qi'],$c$Nhóm: Bổ khí. Tính vị: vị ngọt, tính hơi ấm. Quy kinh: Tỳ, Phế. Tác dụng theo YHCT: bổ khí thăng dương, ích vệ cố biểu, lợi thủy, sinh cơ. Liều tham khảo học tập thường gặp 9–30 g/ngày ở dạng thang; phải đối chiếu dược điển/giáo trình và chế phẩm cụ thể. Cảnh báo: không tự tăng liều; cần rà soát bệnh tự miễn, thuốc ức chế miễn dịch, thai kỳ và bệnh nền trước sử dụng. Nguồn ghi chú: tóm tắt giáo dục, không thay thế chuyên luận dược liệu hoặc tư vấn chuyên môn.$c$,'src/data/ai-kb/herbs.ts'),
('herb-dang-sam','herb','Đảng sâm',array['Codonopsis pilosula','Dang Shen'],$c$Nhóm: Bổ khí. Tính vị: vị ngọt, tính bình. Quy kinh: Tỳ, Phế. Tác dụng theo YHCT: bổ trung ích khí, sinh tân, dưỡng huyết. Liều tham khảo học tập thường gặp 9–30 g/ngày; liều phụ thuộc nguồn dược liệu và dạng bào chế. Cảnh báo: cần phân biệt đúng dược liệu và kiểm tra tương tác với thuốc đang dùng. Nguồn ghi chú: dữ liệu học thuật thu gọn.$c$,'src/data/ai-kb/herbs.ts'),
('herb-dang-quy','herb','Đương quy',array['Angelica sinensis','Dang Gui'],$c$Nhóm: Bổ huyết. Tính vị: vị ngọt, cay, tính ấm. Quy kinh: Can, Tâm, Tỳ. Tác dụng theo YHCT: bổ huyết hoạt huyết, điều kinh, nhuận tràng. Liều tham khảo học tập thường gặp 6–12 g/ngày; cần đối chiếu chuyên luận chính thức. Cảnh báo: thận trọng khi đang dùng thuốc chống đông/kháng kết tập tiểu cầu, có nguy cơ chảy máu hoặc trong thai kỳ. Nguồn ghi chú: tóm tắt giáo dục, không phải chỉ định dùng thuốc.$c$,'src/data/ai-kb/herbs.ts'),
('herb-bach-thuat','herb','Bạch truật',array['Atractylodes macrocephala','Bai Zhu'],$c$Nhóm: Bổ khí / kiện Tỳ. Tính vị: vị đắng, ngọt, tính ấm. Quy kinh: Tỳ, Vị. Tác dụng theo YHCT: kiện Tỳ ích khí, táo thấp lợi thủy, chỉ hãn. Liều tham khảo học tập thường gặp 6–12 g/ngày. Cảnh báo: không áp dụng máy móc khi âm hư táo nhiệt; cần đánh giá thể trạng và thuốc dùng kèm. Nguồn ghi chú: tóm tắt dược học cổ truyền phục vụ học tập.$c$,'src/data/ai-kb/herbs.ts'),
('herb-phuc-linh','herb','Phục linh',array['Poria cocos','Fu Ling'],$c$Nhóm: Lợi thủy thẩm thấp. Tính vị: vị ngọt, nhạt, tính bình. Quy kinh: Tâm, Tỳ, Phế, Thận. Tác dụng theo YHCT: lợi thủy thẩm thấp, kiện Tỳ, an thần. Liều tham khảo học tập thường gặp 9–15 g/ngày. Cảnh báo: liều và chế phẩm cần theo chuyên luận; theo dõi tình trạng dịch và điện giải ở người có bệnh nền liên quan. Nguồn ghi chú: dữ liệu học tập thu gọn.$c$,'src/data/ai-kb/herbs.ts'),
('herb-cam-thao','herb','Cam thảo',array['Glycyrrhiza uralensis','Gan Cao'],$c$Nhóm: Bổ khí / điều hòa. Tính vị: vị ngọt, tính bình hoặc hơi ấm tùy chế. Quy kinh: Tâm, Phế, Tỳ, Vị. Tác dụng theo YHCT: bổ Tỳ ích khí, nhuận Phế, thanh nhiệt giải độc, điều hòa phương. Liều tham khảo học tập thường gặp 2–10 g/ngày tùy mục đích và chế phẩm. Cảnh báo: dùng kéo dài/liều cao có thể liên quan giữ natri, hạ kali và tăng huyết áp; thận trọng với bệnh tim-thận, tăng huyết áp, lợi tiểu, digoxin; rà soát Thập Bát Phản. Nguồn ghi chú: tóm tắt giáo dục với cảnh báo an toàn nổi bật.$c$,'src/data/ai-kb/herbs.ts'),
('herb-gung-sinh-khuong','herb','Sinh khương',array['Gừng tươi','Zingiber officinale','Sheng Jiang'],$c$Nhóm: Tân ôn giải biểu. Tính vị: vị cay, tính ấm. Quy kinh: Phế, Tỳ, Vị. Tác dụng theo YHCT: phát hãn giải biểu, ôn trung chỉ ẩu, ôn Phế chỉ khái. Liều tham khảo học tập thường gặp 3–10 g/ngày dạng dược liệu tươi; chế phẩm khác có liều khác. Cảnh báo: thận trọng khi có nguy cơ chảy máu hoặc đang dùng thuốc chống đông; không thay thế đánh giá nguyên nhân nôn, đau bụng hoặc sốt. Nguồn ghi chú: dữ liệu giáo dục.$c$,'src/data/ai-kb/herbs.ts'),
('herb-hoang-cam','herb','Hoàng cầm',array['Scutellaria baicalensis','Huang Qin'],$c$Nhóm: Thanh nhiệt táo thấp. Tính vị: vị đắng, tính hàn. Quy kinh: Phế, Đởm, Tỳ, Đại trường. Tác dụng theo YHCT: thanh nhiệt táo thấp, tả hỏa giải độc, chỉ huyết, an thai. Liều tham khảo học tập thường gặp 3–10 g/ngày; cần đối chiếu dược điển/giáo trình. Cảnh báo: không tự dùng kéo dài; cần đánh giá chức năng gan, tiêu hóa, thai kỳ và tương tác thuốc. Nguồn ghi chú: tóm tắt học thuật phục vụ tra cứu nhanh.$c$,'src/data/ai-kb/herbs.ts'),
('herb-tran-bi','herb','Trần bì',array['Citrus reticulata pericarpium','Chen Pi'],$c$Nhóm: Lý khí. Tính vị: vị cay, đắng, tính ấm. Quy kinh: Tỳ, Phế. Tác dụng theo YHCT: lý khí kiện Tỳ, táo thấp hóa đàm. Liều tham khảo học tập thường gặp 3–10 g/ngày. Cảnh báo: thận trọng trong âm hư táo nhiệt; cần phân biệt dược liệu đúng chuẩn và kiểm tra thuốc dùng kèm. Nguồn ghi chú: dữ liệu giáo dục thu gọn.$c$,'src/data/ai-kb/herbs.ts'),
('herb-bach-thuoc','herb','Bạch thược',array['Paeonia lactiflora','Bai Shao'],$c$Nhóm: Bổ huyết / liễm âm. Tính vị: vị đắng, chua, tính hơi hàn. Quy kinh: Can, Tỳ. Tác dụng theo YHCT: dưỡng huyết liễm âm, nhu Can chỉ thống, bình Can dương. Liều tham khảo học tập thường gặp 6–15 g/ngày. Cảnh báo: cần biện chứng; rà soát phối ngũ, bệnh nền và thuốc đang dùng trước thực hành. Nguồn ghi chú: tóm tắt học thuật, không phải đơn điều trị.$c$,'src/data/ai-kb/herbs.ts'),
('acupoint-li4-hegu','acupoint','Hợp Cốc',array['Hegu','Hợp cốc'],$c$Mã huyệt: LI4. Kinh: Thủ Dương minh Đại trường. Vị trí: mu bàn tay, vùng giữa xương bàn I và II, gần điểm cao nhất của khối cơ khi khép ngón cái vào ngón trỏ. Cách xác định: khép ngón cái và ngón trỏ, xác định ụ cơ nổi ở mu bàn tay rồi thả lỏng trước khi day ấn. Ứng dụng học tập: nhóm huyệt điều trị vùng đầu mặt, đau và biểu chứng theo lý luận châm cứu. An toàn: có thể day ấn nhẹ 30–60 giây nếu dễ chịu; dừng khi đau tăng, tê kéo dài hoặc chóng mặt; không tự châm kim; thai kỳ cần tránh tự kích thích mạnh LI4 và hỏi người hành nghề có chuyên môn. Nguồn ghi chú: mô tả học thuật, không thay thế định vị trực tiếp bởi giảng viên/người hành nghề.$c$,'src/data/ai-kb/acupoints.ts'),
('acupoint-st36-zusanli','acupoint','Túc Tam Lý',array['Zusanli','Túc tam lý'],$c$Mã huyệt: ST36. Kinh: Túc Dương minh Vị. Vị trí: mặt trước-ngoài cẳng chân, dưới ST35 khoảng 3 thốn, ngoài bờ trước xương chày khoảng một khoát ngón tay. Cách xác định: xác định hõm ngoài gân bánh chè ST35, đo xuống khoảng 3 thốn theo tỷ lệ cơ thể và lệch ra ngoài bờ trước xương chày. Ứng dụng học tập: bệnh lý Vị-trường, điều hòa khí huyết và hỗ trợ chính khí theo lý luận châm cứu. An toàn: day ấn nhẹ-vừa, không ấn lên vùng viêm, tổn thương da hoặc chấn thương; không tự châm kim. Nguồn ghi chú: mô tả vị trí theo mốc giải phẫu và tỷ lệ thốn; cần thực hành dưới hướng dẫn chuyên môn.$c$,'src/data/ai-kb/acupoints.ts'),
('acupoint-sp6-sanyinjiao','acupoint','Tam Âm Giao',array['Sanyinjiao','Tam âm giao'],$c$Mã huyệt: SP6. Kinh: Túc Thái âm Tỳ; giao hội ba kinh âm ở chân. Vị trí: mặt trong cẳng chân, trên đỉnh mắt cá trong khoảng 3 thốn, sát bờ sau xương chày. Cách xác định: đặt bốn khoát ngón tay của chính người được xác định phía trên đỉnh mắt cá trong, tìm vùng ngay sau bờ trong xương chày. Ứng dụng học tập: nhóm huyệt Tỳ, Can, Thận và các chỉ định phụ khoa theo lý luận châm cứu. An toàn: chỉ day ấn nhẹ nếu phù hợp; thai kỳ không tự kích thích mạnh SP6; không tự châm kim; vùng đau/sưng cần được đánh giá trước. Nguồn ghi chú: dữ liệu giáo dục có cảnh báo thai kỳ.$c$,'src/data/ai-kb/acupoints.ts'),
('acupoint-pc6-neiguan','acupoint','Nội Quan',array['Neiguan','Nội quan'],$c$Mã huyệt: PC6. Kinh: Thủ Quyết âm Tâm bào. Vị trí: mặt trước cẳng tay, trên nếp gấp cổ tay khoảng 2 thốn, giữa gân cơ gan tay dài và gân cơ gấp cổ tay quay. Cách xác định: từ nếp cổ tay đo lên khoảng ba khoát ngón tay theo tỷ lệ cơ thể, tìm rãnh giữa hai gân nổi khi gấp cổ tay nhẹ. Ứng dụng học tập: triệu chứng vùng ngực, hồi hộp, buồn nôn và an thần theo lý luận châm cứu. An toàn: day ấn nhẹ-vừa; tránh vùng có tổn thương da, đường truyền hoặc chấn thương; không tự châm kim. Nguồn ghi chú: mô tả học thuật dựa trên mốc giải phẫu.$c$,'src/data/ai-kb/acupoints.ts'),
('acupoint-lr3-taichong','acupoint','Thái Xung',array['Taichong','Thái xung'],$c$Mã huyệt: LR3. Kinh: Túc Quyết âm Can. Vị trí: mu bàn chân, phía sau kẽ ngón I-II, trong chỗ lõm trước điểm tiếp giáp nền xương bàn I và II. Cách xác định: lần theo khe giữa xương bàn I và II từ kẽ ngón chân hướng về cổ chân tới chỗ lõm trước khi hai xương gặp nhau. Ứng dụng học tập: sơ Can, điều khí và các biểu hiện đau đầu/chóng mặt theo lý luận châm cứu. An toàn: day ấn nhẹ-vừa nếu không có chấn thương bàn chân; không tự châm kim. Nguồn ghi chú: dữ liệu giáo dục.$c$,'src/data/ai-kb/acupoints.ts'),
('acupoint-gv20-baihui','acupoint','Bách Hội',array['Baihui','Bách hội'],$c$Mã huyệt: GV20. Kinh: Mạch Đốc. Vị trí: đỉnh đầu, gần giao điểm đường giữa đầu với đường nối hai đỉnh vành tai. Cách xác định: dùng đường giữa đầu và tưởng tượng đường nối điểm cao nhất của hai vành tai; giao điểm là vùng tham chiếu của GV20. Ứng dụng học tập: thanh khiếu, thăng dương và an thần theo lý luận châm cứu. An toàn: chỉ xoa/day rất nhẹ; không tự châm kim ở vùng đầu; nếu có chấn thương đầu, đau đầu dữ dội mới xuất hiện hoặc triệu chứng thần kinh cần khám y tế. Nguồn ghi chú: mô tả học thuật, ưu tiên an toàn vùng đầu.$c$,'src/data/ai-kb/acupoints.ts'),
('acupoint-li11-quchi','acupoint','Khúc Trì',array['Quchi','Khúc trì'],$c$Mã huyệt: LI11. Kinh: Thủ Dương minh Đại trường. Vị trí: đầu ngoài nếp gấp khuỷu khi gấp khuỷu khoảng 90 độ, trong chỗ lõm gần lồi cầu ngoài xương cánh tay. Cách xác định: gấp khuỷu nhẹ, xác định đầu ngoài nếp khuỷu và vùng lõm kế cận. Ứng dụng học tập: thanh nhiệt, khu phong và bệnh vùng chi trên theo lý luận châm cứu. An toàn: day ấn nhẹ-vừa, tránh vùng viêm khớp cấp/chấn thương; không tự châm kim. Nguồn ghi chú: dữ liệu giáo dục.$c$,'src/data/ai-kb/acupoints.ts'),
('acupoint-cv12-zhongwan','acupoint','Trung Quản',array['Zhongwan','Trung quản'],$c$Mã huyệt: CV12. Kinh: Mạch Nhâm. Vị trí: đường giữa bụng trên, khoảng giữa mũi ức và rốn, thường quy 4 thốn trên rốn. Cách xác định: xác định đường giữa từ mũi ức tới rốn và lấy điểm giữa làm mốc tham chiếu. Ứng dụng học tập: mộ huyệt của Vị, dùng trong nhóm bệnh lý tiêu hóa theo lý luận châm cứu. An toàn: chỉ day ấn nhẹ; không ấn mạnh khi đau bụng chưa rõ nguyên nhân, sau phẫu thuật, trong thai kỳ hoặc khi có khối bất thường; không tự châm kim vùng bụng. Nguồn ghi chú: mô tả học thuật với cảnh báo vùng bụng.$c$,'src/data/ai-kb/acupoints.ts'),
('acupoint-bl23-shenshu','acupoint','Thận Du',array['Shenshu','Thận du'],$c$Mã huyệt: BL23. Kinh: Túc Thái dương Bàng quang. Vị trí: lưng dưới, ngang mức khe gian đốt L2-L3, cách đường giữa sau khoảng 1,5 thốn mỗi bên. Cách xác định: định vị đốt sống cần kỹ năng giải phẫu; tự tra cứu chỉ nên dùng để hiểu tương quan vùng lưng, không dùng để tự châm. Ứng dụng học tập: nhóm huyệt bổ Thận và bệnh vùng thắt lưng theo lý luận châm cứu. An toàn: có thể xoa bóp nhẹ vùng cơ cạnh sống nếu dễ chịu; đau lưng kèm yếu chân, rối loạn cơ tròn, sốt hoặc chấn thương cần khám y tế; không tự châm kim. Nguồn ghi chú: dữ liệu giáo dục; định vị chính xác cần người được đào tạo.$c$,'src/data/ai-kb/acupoints.ts'),
('acupoint-gb20-fengchi','acupoint','Phong Trì',array['Fengchi','Phong trì'],$c$Mã huyệt: GB20. Kinh: Túc Thiếu dương Đởm. Vị trí: vùng gáy, trong chỗ lõm giữa cơ ức-đòn-chũm và cơ thang, dưới xương chẩm. Cách xác định: sờ bờ dưới xương chẩm và tìm vùng lõm hai bên gáy giữa hai khối cơ; chỉ dùng mốc này để học và day ấn nhẹ. Ứng dụng học tập: đau đầu, cổ gáy, phong chứng và các triệu chứng vùng mắt/tai theo lý luận châm cứu. An toàn: day ấn nhẹ, tránh ấn sâu hoặc kéo dài ở vùng cổ; không tự châm kim do có cấu trúc mạch-thần kinh quan trọng. Nguồn ghi chú: mô tả học thuật với ưu tiên an toàn cổ gáy.$c$,'src/data/ai-kb/acupoints.ts')
on conflict(id) do update set
 kind=excluded.kind,
 name=excluded.name,
 aliases=excluded.aliases,
 content_text=excluded.content_text,
 source_ref=excluded.source_ref,
 published=true;

create or replace function public.ai_knowledge_search_v1(
  p_query text,
  p_kinds text[] default null,
  p_limit integer default 8
)
returns jsonb
language plpgsql
security definer
set search_path='public','extensions','pg_catalog'
as $$
declare
  v_query text;
  v_limit integer;
  v_out jsonb;
begin
  v_query := regexp_replace(lower(extensions.unaccent(trim(coalesce(p_query,'')))),'[^a-z0-9 ]+',' ','g');
  v_query := trim(regexp_replace(v_query,'[[:space:]]+',' ','g'));
  v_limit := greatest(1,least(coalesce(p_limit,8),20));
  if char_length(v_query)<2 then return '[]'::jsonb; end if;
  if exists(select 1 from unnest(coalesce(p_kinds,array[]::text[])) k where k not in ('formula','herb','acupoint')) then
    raise exception 'Invalid knowledge kind';
  end if;

  with scored as(
    select k.*,
      greatest(
        case when regexp_replace(lower(extensions.unaccent(k.name)),'[^a-z0-9 ]+',' ','g')=v_query then 1.0 else 0.0 end,
        case when regexp_replace(lower(extensions.unaccent(k.name)),'[^a-z0-9 ]+',' ','g') like v_query||'%' then 0.96 else 0.0 end,
        case when k.search_ascii like '%'||v_query||'%' then 0.88 else 0.0 end,
        least(0.86,extensions.similarity(k.search_ascii,v_query)),
        least(0.84,ts_rank_cd(to_tsvector('simple',k.search_ascii),websearch_to_tsquery('simple',v_query))*2.5)
      )::real as score
    from public.ai_knowledge_items k
    where k.published
      and (p_kinds is null or cardinality(p_kinds)=0 or k.kind=any(p_kinds))
      and (
        k.search_ascii like '%'||v_query||'%'
        or to_tsvector('simple',k.search_ascii) @@ websearch_to_tsquery('simple',v_query)
        or extensions.similarity(k.search_ascii,v_query)>=0.08
      )
  ), limited as(
    select * from scored where score>=0.12 order by score desc,name asc limit v_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'record',jsonb_build_object('id',id,'kind',kind,'name',name,'aliases',to_jsonb(aliases),'ragText',content_text,'sourceRef',source_ref),
    'score',score
  ) order by score desc,name asc),'[]'::jsonb) into v_out from limited;
  return v_out;
end;
$$;

revoke all on function public.ai_knowledge_search_v1(text,text[],integer) from public;
grant execute on function public.ai_knowledge_search_v1(text,text[],integer) to anon, authenticated;

create or replace function public.ai_knowledge_stats_v1()
returns jsonb
language sql
stable
security definer
set search_path='public','pg_catalog'
as $$
  select jsonb_build_object(
    'total',count(*) filter(where published),
    'formula',count(*) filter(where published and kind='formula'),
    'herb',count(*) filter(where published and kind='herb'),
    'acupoint',count(*) filter(where published and kind='acupoint')
  ) from public.ai_knowledge_items;
$$;

revoke all on function public.ai_knowledge_stats_v1() from public;
grant execute on function public.ai_knowledge_stats_v1() to anon, authenticated;
