import '../../styles/YearlyRanking.css';

const artistLinks = [
  ['一身五病', 'https://baike.baidu.com/item/Lady%20Gaga/6824820'],
  ['84路公交', 'https://baike.baidu.com/item/泰勒·斯威夫特/8472307?fromtitle=Taylor%20Swift&fromid=10164559'],
  ['大树之母', 'https://baike.baidu.com/item/凯蒂·佩里/1239613?fromtitle=Katy%20Perry&fromid=4087745&fromModule=lemma_search-box'],
  ['流行猪尊', 'https://baike.baidu.com/item/阿黛尔·阿德金斯?fromtitle=Adele&fromid=1261146&fromModule=lemma_search-box'],
  ['包包多斯', 'https://baike.baidu.com/item/蕾哈娜/5226798?fromtitle=Rihanna&fromid=1701433&fromModule=lemma_search-box'],
];

export function ArtistRecommendations() {
  return (
    <div className="artist-recommendations-page yearly-ranking-page">
      <h2>艺人推荐</h2>
      <p className="platform-position">欧美百家粉呀 主要是理智嘎迷</p>
      <div className="artist-banner">
        <img src="/artists/images/banner.jpg" alt="新专大比特比 banner" />
        <img src="/artists/images/banner2.jpg" alt="表情包" />
      </div>
      <div className="artist-nav">
        {artistLinks.map(([label, href]) => (
          <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="nav-link">{label}</a>
        ))}
      </div>
      <div className="ranking-container">
        <div className="artist-sidebar ranking-form">
          <h3>新专大比特比</h3>
          <div className="comparison-table-container">
            <table className="comparison-table">
              <thead><tr><th />{comparison.artists.map(artist => <th key={artist}>{artist}</th>)}</tr></thead>
              <tbody>
                {comparison.labels.map((label, index) => (
                  <tr key={label}><td>{label}</td>{comparison.values[index].map((value, column) => <td key={column}>{value}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="artist-avatars">
            {artists.map(artist => <div key={artist.id} className="avatar-container"><img src={artist.avatar} alt={artist.name} /></div>)}
          </div>
        </div>
        <div className="artist-albums ranking-display">
          {artists.map(artist => (
            <div key={artist.id} className="album-item user-rank-item">
              <div className="album-cover user-rank-cover"><img src={artist.cover} alt={`${artist.name} - ${artist.album}`} /></div>
              <div className="album-info user-rank-content">
                <h4 className="album-title user-rank-title">{artist.name} - {artist.album}</h4>
                <p className="album-nickname">【爱称】{artist.nickname}</p>
                <p className="album-blackname">【黑称】{artist.blackName}</p>
                <p className="album-description user-rank-review">{artist.description}</p>
              </div>
            </div>
          ))}
          <div className="bottom-image"><img src="/artists/images/400w.jpg" alt="首周400w大过天" /></div>
        </div>
      </div>
    </div>
  );
}

// Restored from the deployed MeloRank artist recommendations page.
const artists = [{ id: 1, name: "Lady Gaga", album: "MAYHEM", nickname: "尖尖、死胎姐", blackName: "嘎嘎、老鳖、绿豆糕糕", description: "全能巨星Lady Gaga第七张录音室专辑《MAYHEM》将于3月7日正式全球发行。专辑收录14首重磅曲目，由Lady Gaga与金牌制作人Andrew Watt共同担任执行制作，更集结Cirkut、Gesaffelstein等顶尖音乐人倾力打造。从斩获格莱美「最佳流行合唱」奖的现象级热单《Die With A Smile》，到引发乐评界热议的艺术佳作《Disease》，再到席卷全球舞池的狂欢圣曲《Abracadabra》，每一首都彰显着Gaga独有的音乐魅力。", cover: "/artists/images/LG2.jpg", avatar: "/artists/images/LG1.jpg" }, { id: 2, name: "Taylor Swift", album: "The Life of a Showgirl", nickname: "交交、交淫畜", blackName: "霉霉、幸幸", description: "《The Life of a Showgirl》是美国歌手兼词曲创作人泰勒·斯威夫特发行的第十二张录音室专辑。斯威夫特在2024年欧洲巡演期间创作了这张专辑，灵感来源于她作为娱乐者的生活。她将其描述为一个充满活力和生机的项目，摆脱了前一张专辑《The Tortured Poets Department》（2024）中的阴郁歌词风格。", cover: "/artists/images/TS2.jpg", avatar: "/artists/images/TS1.jpg" }, { id: 3, name: "Katy Perry", album: "143", nickname: "厕粿、树姐、水鬼姐", blackName: "水果姐", description: '《143》是凯蒂·佩里时隔五年推出的第六张录音室专辑，以"数字密码"为概念，收录12首融合流行、 disco 与抒情的多元曲目。专辑主打歌《143》以简单数字传递爱意，上线首日便登顶全球18国音乐榜单；深度合作曲《Treehouse》邀请独立音乐人Bon Iver跨刀，歌词探讨自然与内心的联结，被乐评人评为"佩里职业生涯最具艺术性的作品之一"。', cover: "/artists/images/KP2.jpg", avatar: "/artists/images/KP1.jpg" }, { id: 4, name: "Adele", album: "30", nickname: "猪戴尔", blackName: "阿呆", description: "《30》是阿黛尔·阿德金斯的第四张录音室专辑，以她30岁的人生阶段为创作核心，探讨离婚、自我重建与母性的主题。专辑制作历时三年，邀请Greg Kurstin、Max Martin等金牌制作人参与，主打歌《Easy On Me》上线首周便创下全球流媒体播放量纪录，专辑更是以首周30万张的销量空降多国专辑榜冠军，成为2021年全球最畅销专辑之一。", cover: "/artists/images/A2.jpg", avatar: "/artists/images/A1.jpg" }, { id: 5, name: "Rihanna", album: "ANTI", nickname: "沙包", blackName: "晶晶、日日", description: '《ANTI》是蕾哈娜的第八张录音室专辑，打破其以往流行舞曲风格，融入R&B、灵魂乐与摇滚元素，展现更具实验性的音乐表达。专辑主打歌《Work》feat. Drake蝉联美国公告牌百强单曲榜9周冠军，《Love On The Brain》则成为蕾哈娜职业生涯第22首TOP 10单曲。《ANTI》不仅获得格莱美提名，更被《滚石》杂志评为"21世纪100张最佳专辑"之一。', cover: "/artists/images/R2.jpg", avatar: "/artists/images/R1.jpg" }], comparison = { labels: ["销量", "乐评", "流媒"], artists: ["尖", "交", "粿", "猪", "沙包"], values: [[.99, 84, 143, 348, 78], [78, 60, 36, 80, 70], ["LG8", "TS13", "KP7", "A5", "R9"]] };
