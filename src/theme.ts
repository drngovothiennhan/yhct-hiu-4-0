export type ThemeName='duoc-ngoc'|'muc-tuyen'|'ngu-y'|'tcm-cartoon-2d'|'tcm-isometric-3d'|'tcm-spring-2d'|'tcm-cloud-2d'|'tcm-mint-modern';
export const THEME_OPTIONS:{id:ThemeName;name:string;description:string;swatches:string[]}[]=[
  {id:'duoc-ngoc',name:'Dược Ngọc – Son Đỏ',description:'Ngọc dược, đỏ son và giấy ngà; cân bằng truyền thống với giao diện học thuật hiện đại.',swatches:['#174C3C','#8B1E2D','#F7F1E5','#C99A45']},
  {id:'muc-tuyen',name:'Mực Tuyên – Giấy Ngà',description:'Mực tàu, giấy tuyên, xanh trà; tối giản, tập trung đọc dài và luyện thi.',swatches:['#202824','#5A6F61','#F5F1E8','#A77A3A']},
  {id:'ngu-y',name:'Ngự Y – Đồng Son',description:'Đỏ nâu, đồng cổ, kem ấm; trang trọng hơn cho điều hành và nội dung chuyên môn.',swatches:['#651F24','#8B5A2B','#F4E8D3','#B88942']},
  {id:'tcm-cartoon-2d',name:'2D Flat YHCT',description:'Ngọc bích tươi, vàng hoàng cúc, chu sa dịu và cam quế; vector phương Đông trẻ trung.',swatches:['#159A84','#F5C453','#C8554F','#D9824A']},
  {id:'tcm-isometric-3d',name:'3D Isometric YHCT',description:'Khối nổi isometric, bóng đổ nhiều tầng và chất liệu giấy dược liệu, chỉ dành cho phiên Admin.',swatches:['#176B5A','#D9AA45','#A8463E','#F4EEDF']},
  {id:'tcm-spring-2d',name:'Xuân Dược 2D',description:'Hoạt hình 2D sáng, xanh dược liệu và sắc hoa nhẹ; tối ưu cho CLB và thiết bị phổ thông.',swatches:['#147D67','#E65F68','#F3FBF7','#F3BD4B']},
  {id:'tcm-cloud-2d',name:'Vân Lam 2D',description:'Xanh trời sáng, hồng dược hoa và nền trắng sạch; hiện đại, nhẹ mắt, phù hợp nội dung học thuật.',swatches:['#376F9F','#D76A7F','#F4F9FD','#E4B85D']},
  {id:'tcm-mint-modern',name:'Mint YHCT Modern',description:'Xanh mint hiện đại, tương phản rõ, khối giao diện sạch và nhẹ; ưu tiên hiệu năng và khả năng đọc.',swatches:['#0F766E','#F06F57','#F5FAF8','#E6B84E']}
];
const KEY='yhct-hiu-ui-theme-v1';
export function readTheme():ThemeName{if(typeof window==='undefined')return'duoc-ngoc';const v=window.localStorage.getItem(KEY);return THEME_OPTIONS.some(x=>x.id===v)?v as ThemeName:'duoc-ngoc'}
export function applyTheme(theme:ThemeName,persist=true){if(typeof document!=='undefined')document.documentElement.dataset.theme=theme;if(persist&&typeof window!=='undefined')window.localStorage.setItem(KEY,theme)}
