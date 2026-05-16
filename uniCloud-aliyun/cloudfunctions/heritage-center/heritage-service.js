const CATEGORY_ENUM = [
  '传统技艺', '民俗', '曲艺', '传统音乐', '传统舞蹈',
  '传统美术', '传统医药', '民间文学', '传统体育', '传统戏剧'
]

const HERITAGE_UPDATE_WHITELIST = [
  'title', 'category', 'summary', 'story', 'images',
  'inheritorName', 'inheritorBio', 'inheritorPhoto',
  'relatedMarkerIds', 'status', 'videoUrl', 'videoCover'
]

function toStr(v) { return typeof v === 'string' ? v : '' }

const REGEX_META = /[.*+?^${}()|[\]\\]/g
function escapeRegExp(s) {
  return (typeof s === 'string' ? s : '').replace(REGEX_META, '\\$&')
}
function toIntArray(v) {
  if (!Array.isArray(v)) return []
  return v.map((x) => Number(x)).filter((n) => Number.isFinite(n))
}
function toStrArray(v) {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string')
}

function validateHeritageInput(data) {
  if (data == null) return { ok: false, msg: '缺少内容' }
  const markerId = Number(data.markerId)
  if (!Number.isFinite(markerId)) return { ok: false, msg: '缺少关联打卡点' }
  if (!CATEGORY_ENUM.includes(data.category)) return { ok: false, msg: '非遗类别非法' }
  return { ok: true, msg: '' }
}

function buildHeritageDoc(data, now) {
  return {
    markerId: Number(data.markerId),
    category: data.category,
    title: toStr(data.title),
    summary: toStr(data.summary),
    story: toStr(data.story),
    images: toStrArray(data.images),
    inheritorName: toStr(data.inheritorName),
    inheritorBio: toStr(data.inheritorBio),
    inheritorPhoto: toStr(data.inheritorPhoto),
    relatedMarkerIds: toIntArray(data.relatedMarkerIds),
    status: data.status === 'published' ? 'published' : 'draft',
    videoUrl: toStr(data.videoUrl),
    videoCover: toStr(data.videoCover),
    createdAt: now,
    updatedAt: now
  }
}

function buildHeritageUpdate(data, now) {
  const out = {}
  for (const key of HERITAGE_UPDATE_WHITELIST) {
    if (data[key] === undefined) continue
    if (key === 'images') { out.images = toStrArray(data.images); continue }
    if (key === 'relatedMarkerIds') { out.relatedMarkerIds = toIntArray(data.relatedMarkerIds); continue }
    if (key === 'category' && !CATEGORY_ENUM.includes(data.category)) continue
    if (key === 'status') { out.status = data.status === 'published' ? 'published' : 'draft'; continue }
    out[key] = data[key]
  }
  out.updatedAt = now
  return out
}

function normalizeHeritageDetail(doc) {
  return {
    _id: toStr(doc && doc._id),
    markerId: Number((doc && doc.markerId) || 0),
    category: toStr(doc && doc.category),
    title: toStr(doc && doc.title),
    summary: toStr(doc && doc.summary),
    story: toStr(doc && doc.story),
    images: toStrArray(doc && doc.images),
    inheritorName: toStr(doc && doc.inheritorName),
    inheritorBio: toStr(doc && doc.inheritorBio),
    inheritorPhoto: toStr(doc && doc.inheritorPhoto),
    relatedMarkerIds: toIntArray(doc && doc.relatedMarkerIds),
    status: (doc && doc.status === 'published') ? 'published' : 'draft',
    videoUrl: toStr(doc && doc.videoUrl),
    videoCover: toStr(doc && doc.videoCover)
  }
}

// F2 搜索：把 { category, keyword } 规范化为查询描述对象。
// category 非法则丢弃；keyword trim 后为空则丢弃，否则转义正则元字符。
function buildHeritageQuery(input) {
  const f = input || {}
  const out = {}
  if (typeof f.category === 'string' && CATEGORY_ENUM.includes(f.category)) {
    out.category = f.category
  }
  const kw = (typeof f.keyword === 'string' ? f.keyword : '').trim()
  if (kw.length > 0) {
    out.keyword = escapeRegExp(kw)
  }
  return out
}

// 种子打卡点：澳门 5 个（markerId 1001-1005）+ 湖南 5 个（1101-1105），真实坐标。
// 由 heritage-center.seedDefaults() 幂等写入 tourism_markers。
const DEFAULT_SEED_MARKERS = [
  { id: 1001, title: '鱼行醉龙节', latitude: 22.1968, longitude: 113.5397 },
  { id: 1002, title: '澳门神像雕刻', latitude: 22.1986, longitude: 113.5404 },
  { id: 1003, title: '凉茶', latitude: 22.1995, longitude: 113.5440 },
  { id: 1004, title: '土生土语话剧', latitude: 22.1923, longitude: 113.5377 },
  { id: 1005, title: '道教科仪音乐', latitude: 22.2008, longitude: 113.5450 },
  { id: 1101, title: '湘绣', latitude: 28.3306, longitude: 112.9805 },
  { id: 1102, title: '花鼓戏', latitude: 28.2278, longitude: 112.9389 },
  { id: 1103, title: '滩头年画', latitude: 27.1480, longitude: 111.0420 },
  { id: 1104, title: '江永女书', latitude: 25.2730, longitude: 111.3470 },
  { id: 1105, title: '醴陵釉下五彩瓷烧制技艺', latitude: 27.6460, longitude: 113.4970 }
]

// 种子非遗内容：澳门 + 湖南真实国家级非物质文化遗产项目，与 DEFAULT_SEED_MARKERS 一一对应。
const DEFAULT_SEED_HERITAGE = [
  {
    markerId: 1001, category: '民俗', status: 'published', title: '鱼行醉龙节',
    summary: '澳门鱼行醉龙节是鲜鱼行业从业者于每年农历四月初八举行的传统节庆，又称"舞醉龙"。舞者饮酒后舞动木雕龙头龙尾巡游街市，并派发"龙船头饭"，祈求行业兴旺、市民平安。2011年列入国家级非物质文化遗产名录。',
    story: '醉龙舞源于明清时期珠江三角洲的鱼行习俗，相传可驱瘟避疫。澳门鲜鱼行总会自二十世纪初延续这一传统，每逢佛诞日组织行内同仁舞醉龙、设龙船宴。舞者半醉之态、刚柔并济的身段使醉龙舞别具一格，如今已成为澳门最具代表性的社区节庆之一，由鲜鱼行总会世代传承。',
    relatedMarkerIds: [1002, 1005]
  },
  {
    markerId: 1002, category: '传统美术', status: 'published', title: '澳门神像雕刻',
    summary: '澳门神像雕刻是以樟木、檀木等雕造道释神佛造像及装饰的传统手工技艺，工序涵盖开料、粗坯、修光、髹漆贴金、开面等。匠师融汇广东金漆木雕与本地庙宇需求，作品远销海内外。2008年列入国家级非物质文化遗产名录。',
    story: '澳门开埠以来庙宇众多，对神像与神龛的需求催生了专业造像作坊，多集中于关前街、果栏街一带。老字号造像店将岭南木雕技艺与澳门中西交融的审美结合，既造妈祖、观音等传统造像，也承接旧像修复。一尊大型神像往往需数月乃至经年方成，技艺多以师徒及家族方式相传。',
    relatedMarkerIds: [1001]
  },
  {
    markerId: 1003, category: '传统医药', status: 'published', title: '凉茶',
    summary: '凉茶是流行于岭南地区、以中草药煎煮而成的传统饮品，用以清热祛湿、消暑解燥。澳门凉茶铺历史悠久，配方多为家族世代相传。2006年由粤港澳三地联合申报，列入首批国家级非物质文化遗产名录。',
    story: '岭南气候湿热，先民依据中医药理择取夏枯草、金银花、布渣叶等草药配制凉茶，世代相沿。澳门街巷的凉茶铺自十九世纪起便是市民日常消暑祛病之所，铜葫芦招牌与大铜壶是其标志。各家配方与火候皆为独门秘传，凉茶文化承载着岭南民众"治未病"的养生智慧。',
    relatedMarkerIds: []
  },
  {
    markerId: 1004, category: '传统戏剧', status: 'published', title: '土生土语话剧',
    summary: '土生土语话剧是澳门土生葡人以"澳门土语"（Patuá，葡语与粤语、马来语等混合而成的方言）演出的方言喜剧。剧目多取材本地生活，诙谐讽喻，是澳门中葡文化交融的独特见证。2021年列入国家级非物质文化遗产名录。',
    story: '澳门土语是十六世纪以来葡萄牙人、土生葡人与华人长期共处所孕育的混合语言。二十世纪中叶起，土生葡人社群以这种濒危方言编演话剧，于澳门艺术节等场合演出，借幽默剧情留住乡音与集体记忆。由于通晓土语者日渐稀少，土生土语话剧的传承尤为珍贵。',
    relatedMarkerIds: [1005]
  },
  {
    markerId: 1005, category: '传统音乐', status: 'published', title: '道教科仪音乐',
    summary: '澳门道教科仪音乐是道教法事中诵唱、器乐与科仪程式相结合的音乐传统，曲目丰富、保存完整，融合广东道乐与澳门本地风格。2011年列入国家级非物质文化遗产名录。',
    story: '澳门道教科仪音乐以吴庆云道院等宫观为传承核心，吴氏家族数代保存了大量手抄科仪曲本。其音乐涵盖经韵诵唱与笛、笙、锣鼓等器乐伴奏，应用于祈福、超度等法事。这批曲本与活态演奏被视为研究岭南道教音乐的重要遗产，近年经整理、记谱得以系统保存与传习。',
    relatedMarkerIds: [1001, 1004]
  },
  {
    markerId: 1101, category: '传统美术', status: 'published', title: '湘绣',
    summary: '湘绣是以湖南长沙为中心的传统刺绣，与苏绣、粤绣、蜀绣并称中国四大名绣。以丝绒线绣制、掺针技法见长，绣品形象生动、富有质感，尤以狮虎题材著称。2006年列入首批国家级非物质文化遗产名录。',
    story: '湘绣源于湖南民间刺绣，清末在长沙逐渐形成行业。绣工吸收中国画的笔墨意趣，独创"掺针"绣法使色彩浓淡自然过渡；又以"鬅毛针"表现狮虎毛发的蓬松质感，"绣花花生香、绣鸟能听声"之誉由此而来。长沙沙坪被称为"中国湘绣之乡"，湘绣技艺至今以师徒相授延续。',
    relatedMarkerIds: [1103]
  },
  {
    markerId: 1102, category: '传统戏剧', status: 'published', title: '花鼓戏',
    summary: '花鼓戏是流行于湖南各地的地方戏曲剧种，以长沙花鼓戏最具代表性。它从民间歌舞"地花鼓"发展而来，唱腔活泼、乡土气息浓厚，多演生活小戏。长沙花鼓戏于2008年列入国家级非物质文化遗产名录。',
    story: '花鼓戏由湖南农村的山歌、民间小调与"打花鼓"歌舞逐步演变，清代中后期形成戏曲形态。其表演贴近乡土生活，《刘海砍樵》《打铜锣》等剧目家喻户晓，方言道白与明快锣鼓使其极富感染力。长沙、岳阳、常德等地各有流派，花鼓戏至今仍是湖南民众喜闻乐见的地方戏。',
    relatedMarkerIds: []
  },
  {
    markerId: 1103, category: '传统美术', status: 'published', title: '滩头年画',
    summary: '滩头年画是产于湖南邵阳隆回县滩头镇的传统木版年画，以手工抄纸、套色木版印刷与开脸技艺著称，色彩艳丽、造型饱满。代表作《老鼠娶亲》《门神》久负盛名。2006年列入首批国家级非物质文化遗产名录。',
    story: '滩头镇盛产楠竹，当地以手工抄制"土纸"为年画提供独特纸基。滩头年画自明末清初兴起，鼎盛时作坊林立，工序包括抄纸、刻版、套印、开脸描金等二十余道，全凭手工。其门神形象威武、设色浓烈，深受南方乡村喜爱。近年传承人致力于复原古版与配方，使这一古老技艺得以延续。',
    relatedMarkerIds: [1101]
  },
  {
    markerId: 1104, category: '民间文学', status: 'published', title: '江永女书',
    summary: '江永女书是流传于湖南永州江永县及周边、由女性创造并专供女性使用的音节文字，字形修长秀丽，被称为世界上唯一的性别文字。女书作品多书于纸、扇、帕之上，记录女性的歌谣与情感。2006年列入首批国家级非物质文化遗产名录。',
    story: '女书在江永上江圩一带的妇女间秘密流传。过去女性无缘学堂，便以这种自创文字书写"三朝书"、结交"老同"、倾诉衷肠，并在出嫁、节庆时吟诵。女书依附于当地方言，按音成字，世代由母女、姊妹相传。随着最后一批自然传人离世，女书的抢救、记录与活态传承成为重要课题。',
    relatedMarkerIds: []
  },
  {
    markerId: 1105, category: '传统技艺', status: 'published', title: '醴陵釉下五彩瓷烧制技艺',
    summary: '醴陵釉下五彩瓷是湖南醴陵的代表性瓷艺，以釉下彩绘、高温一次烧成著称，色彩丰富而温润，画面经久不褪、无铅毒。其烧制技艺于2008年列入国家级非物质文化遗产名录。',
    story: '醴陵制瓷历史悠久，清末民初当地艺人在传统釉下青花基础上研制出多种釉下颜料，突破单色局限，创烧出釉下五彩瓷。瓷器经成型、彩绘、施釉、高温烧成，颜料被透明釉层包覆，故画面莹润如玉、永不褪色。醴陵釉下五彩瓷曾屡获国际大奖，烧制技艺以师徒与厂坊方式传承至今。',
    relatedMarkerIds: [1101]
  }
]

module.exports = {
  CATEGORY_ENUM,
  HERITAGE_UPDATE_WHITELIST,
  validateHeritageInput,
  buildHeritageDoc,
  buildHeritageUpdate,
  normalizeHeritageDetail,
  buildHeritageQuery,
  DEFAULT_SEED_MARKERS,
  DEFAULT_SEED_HERITAGE
}
