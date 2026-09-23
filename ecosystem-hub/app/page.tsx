import EcosystemMap from "@/components/EcosystemMap";
import { ecosystemApps } from "@/data/apps";

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top"><span className="brandMark">HIU</span><span>YHCT ECOSYSTEM</span></a>
        <nav>
          <a href="#ecosystem">Hệ sinh thái</a>
          <a href="#about">Giới thiệu</a>
          <a href="#community">Cộng đồng</a>
        </nav>
      </header>
      <div id="top"><EcosystemMap /></div>
      <section id="ecosystem" className="contentSection">
        <p className="sectionKicker">Hệ sinh thái</p>
        <h2>Bốn không gian, một hành trình YHCT HIU</h2>
        <div className="appGrid">
          {ecosystemApps.map((app) => (
            <article className="appCard" key={app.slug}>
              <span>{app.status}</span>
              <h3>{app.name}</h3>
              <p>{app.description}</p>
              <a href={`/ecosystem/${app.slug}/`}>Xem chi tiết →</a>
            </article>
          ))}
        </div>
      </section>
      <section id="about" className="storySection">
        <div><p className="sectionKicker">Tinh thần chung</p><h2>Tri thức cổ truyền, trải nghiệm số hiện đại.</h2></div>
        <p>Trang Hub đóng vai trò điểm xuất phát để sinh viên, thành viên câu lạc bộ và khách tham quan hiểu toàn bộ hệ sinh thái trước khi bước vào từng ứng dụng chuyên biệt.</p>
      </section>
      <section id="community" className="communitySection">
        <p className="sectionKicker">Cộng đồng HIU YHCT</p>
        <h2>Học cùng nhau. Chia sẻ kinh nghiệm. Cùng xây dựng.</h2>
        <p>Không gian chung hướng đến học tập, kết nối hoạt động câu lạc bộ và giới thiệu các sản phẩm công nghệ Y học cổ truyền do hệ sinh thái phát triển.</p>
      </section>
      <footer>HIU YHCT Ecosystem · Cổng khám phá hệ sinh thái số</footer>
    </main>
  );
}
