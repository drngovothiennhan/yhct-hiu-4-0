import EcosystemMap from "@/components/EcosystemMap";
import { ecosystemApps } from "@/data/apps";
import { ecosystemPrinciples, learningPaths } from "@/data/community";

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top"><span className="brandMark">HIU</span><span>TMC ECOSYSTEM</span></a>
        <nav>
          <a href="#ecosystem">Hệ sinh thái</a>
          <a href="#journey">Hành trình học</a>
          <a href="#about">Giới thiệu</a>
          <a href="#community">Cộng đồng</a>
        </nav>
      </header>

      <div id="top"><EcosystemMap /></div>

      <section id="ecosystem" className="contentSection">
        <p className="sectionKicker">Hệ sinh thái</p>
        <h2>Bốn không gian, một hành trình Y học cổ truyền HIU.</h2>
        <p className="sectionLead">Mỗi ứng dụng giải quyết một nhu cầu học tập khác nhau; Hub giữ vai trò điều hướng để người dùng không phải ghi nhớ nhiều địa chỉ hay tách rời trải nghiệm.</p>
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

      <section id="journey" className="journeySection">
        <div className="sectionIntro">
          <p className="sectionKicker">Hành trình học</p>
          <h2>Khám phá theo mục tiêu, không theo cấu trúc kỹ thuật.</h2>
          <p>Sinh viên có thể bắt đầu ở bất kỳ điểm nào rồi quay lại Hub để nối tiếp hành trình. Các ứng dụng vẫn độc lập, nhưng trải nghiệm được tổ chức thành một hệ sinh thái thống nhất.</p>
        </div>
        <div className="journeyGrid">
          {learningPaths.map((path, index) => (
            <article className="journeyCard" key={path.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{path.title}</h3>
              <p>{path.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="about" className="storySection">
        <div>
          <p className="sectionKicker">Tinh thần chung</p>
          <h2>Tri thức cổ truyền, trải nghiệm số hiện đại.</h2>
        </div>
        <div>
          <p>HIU TMC Ecosystem được tổ chức như một điểm xuất phát chung để sinh viên, thành viên câu lạc bộ và khách tham quan hiểu các sản phẩm trước khi bước vào từng ứng dụng chuyên biệt.</p>
          <ul className="principleList">
            {ecosystemPrinciples.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section id="community" className="communitySection">
        <p className="sectionKicker">Cộng đồng HIU YHCT</p>
        <h2>Học cùng nhau. Chia sẻ kinh nghiệm. Cùng xây dựng.</h2>
        <p>Trang chủ được thiết kế để dần trở thành nơi kết nối hoạt động học thuật, tài nguyên và các sản phẩm số của câu lạc bộ. Những nội dung chưa có nguồn công khai xác minh sẽ không được tự động đưa lên trang.</p>
        <a className="communityCta" href="#top">Quay lại bản đồ khám phá ↑</a>
      </section>

      <footer>
        <strong>HIU TMC Ecosystem</strong>
        <span>hiutmc.com · Cổng khám phá hệ sinh thái số Y học cổ truyền HIU</span>
      </footer>
    </main>
  );
}
