export default function NotFound() {
  return (
    <main className="detailPage">
      <a className="backLink" href="/">← Về bản đồ</a>
      <div className="detailPanel">
        <p className="sectionKicker">HIU TMC ECOSYSTEM</p>
        <h1>Không tìm thấy địa danh</h1>
        <p>Liên kết này chưa tồn tại hoặc đã được thay đổi. Hãy quay lại bản đồ hệ sinh thái để tiếp tục khám phá.</p>
        <div className="detailActions">
          <a className="primaryBtn" href="/">Mở bản đồ</a>
        </div>
      </div>
    </main>
  );
}
