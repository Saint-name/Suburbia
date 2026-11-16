// Suburbia (1st edition base game) tile & goal data.
// Types: R = Residential, C = Commercial, I = Industrial, V = Civic
// Condition scopes:
//   adj    — tiles sharing an edge with this tile (same borough)
//   own    — "each of your": tiles in the owner's borough (incl. itself)
//   all    — "every" / unspecified: tiles in every borough (incl. itself)
//   others — "each other borough": tiles in other players' boroughs only
// Specials:
//   afterThis  — penalty to owner for each matching tile placed later (any borough)
//   redline    — bonus to owner each time owner crosses a red line upward
//   waterfront — $2 per (own lake, own adjacent building) pair

export const TYPE_INFO = {
  R: { ko: '주거', en: 'Residential', color: '#5fae4e' },
  C: { ko: '상업', en: 'Commercial', color: '#3f86c9' },
  I: { ko: '산업', en: 'Industrial', color: '#d9b43a' },
  V: { ko: '공공', en: 'Civic', color: '#8f969c' },
  X: { ko: '재개발', en: 'Placeholder', color: '#2b2b2b' },
};

export const ICON_INFO = {
  restaurant: { ko: '식당', glyph: '🍴' },
  office: { ko: '사무실', glyph: '💼' },
  school: { ko: '학교', glyph: '✏️' },
  airport: { ko: '공항', glyph: '✈️' },
  skyscraper: { ko: '마천루', glyph: '🏙️' },
  car: { ko: '자동차', glyph: '🚗' },
};

const t = (id, stack, count, type, cost, ko, en, imm = {}, cond = [], icon = null) =>
  ({ id, stack, count, type, cost, ko, en, imm, cond, icon });

const c = (res, amt, scope, match = {}, extra = {}) => ({ res, amt, scope, ...match, ...extra });

export const TILES = [
  // ── Basic tiles ──
  t('suburbs', 'basic', 8, 'R', 3, '교외 주택가', 'Suburbs', { pop: 2 }),
  t('park', 'basic', 8, 'V', 4, '공원', 'Community Park', { income: -1 },
    [c('rep', 1, 'adj', { types: ['R', 'C', 'I'] })]),
  t('factory', 'basic', 8, 'I', 3, '중공업 공장', 'Heavy Factory', { income: 1 },
    [c('rep', -1, 'adj', { types: ['R', 'V'] })]),

  // ── A ──
  t('bss', 'A', 2, 'C', 8, '사무용품점', 'Business Supply Store', { income: 1 },
    [c('income', 1, 'all', { icon: 'office' })]),
  t('conv', 'A', 2, 'C', 6, '편의점', 'Convenience Store', { income: 1 }),
  t('fancy', 'A', 3, 'C', 9, '고급 레스토랑', 'Fancy Restaurant', { income: 3 },
    [c('income', -1, 'all', { icon: 'restaurant' }, { special: 'afterThis' })], 'restaurant'),
  t('farm', 'A', 2, 'I', 9, '농장', 'Farm', { rep: -1 },
    [c('income', 1, 'all', { icon: 'restaurant' })]),
  t('fastfood', 'A', 2, 'C', 7, '패스트푸드점', 'Fast Food Restaurant', { income: 1 },
    [c('pop', 3, 'adj', { types: ['R'] })], 'restaurant'),
  t('freeway', 'A', 2, 'I', 5, '고속도로', 'Freeway', {},
    [c('rep', -1, 'adj', { types: ['R'] }), c('income', 1, 'adj', { types: ['C'] })]),
  t('landfill', 'A', 2, 'I', 4, '쓰레기 매립지', 'Landfill', { income: 2 },
    [c('rep', -1, 'adj', { types: ['R', 'C', 'I', 'V'] })]),
  t('hoa', 'A', 2, 'R', 5, '주택소유자협회', "Homeowner's Association", { pop: 1 },
    [c('money', 2, 'all', { types: ['R'] })]),
  t('mint', 'A', 2, 'V', 15, '조폐국', 'Mint', { income: 3 },
    [c('money', 2, 'own', { types: ['V'] })]),
  t('mobile', 'A', 2, 'R', 4, '이동식 주택단지', 'Mobile Home Community', { pop: 6 }),
  t('muniair', 'A', 2, 'I', 6, '지역 공항', 'Municipal Airport', {},
    [c('income', 1, 'all', { icon: 'airport' }), c('rep', -1, 'adj', { types: ['R'] })], 'airport'),
  t('office', 'A', 3, 'C', 9, '오피스 빌딩', 'Office Building', { income: 1 },
    [c('income', 1, 'adj', { types: ['C'] })], 'office'),
  t('parking', 'A', 2, 'C', 12, '주차장', 'Parking Lot', { income: 1 },
    [c('income', 1, 'adj', { types: ['C', 'V'] })]),
  t('slaughter', 'A', 2, 'I', 5, '도축장', 'Slaughterhouse', { rep: -2 },
    [c('income', 1, 'all', { icon: 'restaurant' })]),
  t('waterfront', 'A', 2, 'C', 6, '호숫가 부동산', 'Waterfront Realty', {},
    [c('money', 2, 'own', {}, { special: 'waterfront' })]),

  // ── B ──
  t('burg', 'B', 2, 'R', 12, '알스파흐 성', 'Burg von Alsspach', { pop: 3 },
    [c('rep', 1, 'adj', { types: ['R'] })]),
  t('domair', 'B', 3, 'I', 11, '국내선 공항', 'Domestic Airport', { income: 1 },
    [c('rep', 1, 'all', { icon: 'airport' }), c('rep', -1, 'adj', { types: ['R'] })], 'airport'),
  t('elem', 'B', 3, 'V', 5, '초등학교', 'Elementary School', { rep: 1 },
    [c('pop', 1, 'own', { types: ['R'] })], 'school'),
  t('gas', 'B', 2, 'C', 7, '주유소', 'Gas Station', { income: 1 },
    [c('pop', 1, 'adj', { types: ['R'] })]),
  t('hostel', 'B', 2, 'R', 0, '호스텔', 'Hostel', { pop: 2 },
    [c('rep', -1, 'adj', { types: ['C'] })]),
  t('projects', 'B', 2, 'R', 8, '공공 임대주택', 'Housing Projects', { pop: 10 },
    [c('rep', -2, 'adj', { types: ['V', 'R', 'C'] })]),
  t('movie', 'B', 2, 'C', 10, '영화관', 'Movie Theater', { income: 1 },
    [c('income', 1, 'adj', { types: ['R'] })]),
  t('casino', 'B', 2, 'C', 22, '카지노', 'Casino', { rep: -3 },
    [c('income', 1, 'own', {}, { special: 'redline' })]),
  t('museum', 'B', 2, 'V', 8, '박물관', 'Museum', { rep: 1 },
    [c('rep', 1, 'adj', { types: ['V'] })]),
  t('bureau', 'B', 2, 'V', 9, '관료 사무소', 'Office of Bureaucracy', { rep: -2 },
    [c('income', 1, 'own', { types: ['V'] })], 'office'),
  t('postal', 'B', 2, 'V', 12, '우체국', 'Postal Service', {},
    [c('income', 1, 'own', { types: ['C'] })]),
  t('power', 'B', 2, 'V', 11, '발전소', 'Power Station', {},
    [c('income', 1, 'own', { types: ['I'] })]),
  t('retire', 'B', 2, 'R', 8, '은퇴자 마을', 'Retirement Village', { pop: 5 }),
  t('sky', 'B', 2, 'C', 11, '마천루', 'Skyscraper', { income: 3 },
    [c('income', -1, 'all', { icon: 'skyscraper' }, { special: 'afterThis' })], 'skyscraper'),
  t('shipping', 'B', 2, 'C', 16, '물류 센터', 'Shipping Center', { income: 1 },
    [c('money', 2, 'all', { types: ['C'] })]),
  t('stadium', 'B', 2, 'V', 16, '경기장', 'Stadium', { income: 1 },
    [c('rep', 2, 'adj', { types: ['R'] })]),
  t('warehouse', 'B', 2, 'I', 13, '창고', 'Warehouse', { rep: -1 },
    [c('income', 2, 'adj', { types: ['C'] })]),

  // ── C ──
  t('apart', 'C', 2, 'R', 12, '아파트', 'Apartments', { pop: 5 },
    [c('pop', 2, 'adj', { types: ['C'] })]),
  t('bnb', 'C', 2, 'R', 9, 'B&B 민박', 'Bed & Breakfast', { pop: 2 },
    [c('pop', 1, 'own', { types: ['R'] })]),
  t('boutique', 'C', 2, 'C', 9, '부티크', 'Boutique', { income: 1 },
    [c('rep', 1, 'adj', { types: ['R'] })]),
  t('chip', 'C', 2, 'I', 18, '반도체 공장', 'Chip Fabrication Factory', { rep: 2 },
    [c('income', 1, 'adj', { types: ['C'] })]),
  t('condo', 'C', 2, 'R', 14, '콘도미니엄', 'Condominium', { pop: 5 },
    [c('pop', 3, 'adj', { types: ['C'] })]),
  t('high', 'C', 3, 'V', 18, '고등학교', 'High School', { rep: 1 },
    [c('pop', 3, 'own', { types: ['R'] })], 'school'),
  t('hotel', 'C', 2, 'C', 13, '호텔', 'Hotel', { income: 1 },
    [c('pop', 1, 'others', { types: ['R'] })]),
  t('intlair', 'C', 2, 'I', 18, '국제공항', 'International Airport', {},
    [c('income', 1, 'all', { icon: 'airport' }, { excludeSelf: true }),
     c('rep', 1, 'all', { icon: 'airport' }, { excludeSelf: true }),
     c('rep', -1, 'adj', { types: ['R'] })], 'airport'),
  t('epa', 'C', 2, 'V', 12, '지역 환경청', 'Local EPA Office', { rep: 1 },
    [c('money', 2, 'all', { types: ['I'] })], 'office'),
  t('middle', 'C', 3, 'V', 10, '중학교', 'Middle School', { rep: 1 },
    [c('pop', 2, 'own', { types: ['R'] })], 'school'),
  t('car', 'C', 2, 'C', 12, '신차 대리점', 'New Car Dealership', { income: 5 },
    [c('income', -2, 'all', { icon: 'car' }, { special: 'afterThis' })], 'car'),
  t('pr', 'C', 2, 'C', 20, '홍보 회사', 'PR Firm', { income: -2 },
    [c('rep', 1, 'own', {}, { special: 'redline' })]),
  t('recycle', 'C', 2, 'I', 17, '재활용 공장', 'Recycling Plant', { rep: 1 },
    [c('rep', 2, 'adj', { types: ['I'] })]),
  t('resort', 'C', 2, 'C', 16, '리조트', 'Resort', { income: 1 },
    [c('pop', 1, 'all', { types: ['R'] })]),
  t('univ', 'C', 2, 'V', 15, '대학교', 'University', { income: 2 },
    [c('rep', 1, 'all', { icon: 'school' })]),

  // ── Suburbia Inc. ──
  inc(t('cemetery', 'A', 2, 'V', 4, '묘지', 'Cemetery', { pop: -2 },
    [c('income', 1, 'adj', { types: ['R'] })]), { req: 'pop2' }),
  inc(t('assessor', 'A', 2, 'V', 11, '군 감정평가소', 'County Assessor', { rep: 1 },
    [c('money', 2, 'own', { types: ['R', 'C', 'I', 'V'] })])),
  inc(t('law', 'A', 2, 'C', 14, '법률 사무소', 'Law Office', { income: 2 },
    [], 'office'), { special: 'lawOffice' }),
  inc(t('invprop', 'A', 2, 'R', 8, '투자용 부동산', 'Investment Property', { pop: 1 },
    [c('income', 1, 'adj', { types: ['R'] })])),
  inc(t('planner', 'A', 2, 'X', 7, '재개발 예정지', 'Redevelopment Planner', {}, []), { special: 'planner', noInvest: true }),
  inc(t('checkpoint', 'B', 2, 'V', 14, '검문소', 'Checkpoint', { rep: 4 },
    [c('money', 2, 'all', { border: true })]), { req: 'adjBorder' }),
  inc(t('lightrail', 'B', 2, 'I', 12, '경전철', 'Light Rail', { rep: 1 },
    [c('income', 1, 'adj', { types: ['C', 'R'] }), c('rep', 1, 'adj', { types: ['C', 'R'] })])),
  inc(t('newcon', 'B', 3, 'R', 4, '신축 단지', 'New Construction', {},
    [c('pop', 2, 'adj', { types: ['I', 'V', 'R', 'C'] })])),
  inc(t('waterpur', 'B', 3, 'I', 7, '정수장', 'Water Purification Plant', { rep: 7 },
    [c('money', -2, 'all', { types: ['I'] })])),
  inc(t('lakehouse', 'C', 2, 'R', 18, '호숫가 별장', 'Lake House', { rep: 3 },
    [c('pop', 2, 'own', { types: ['R'] })]), { req: 'adjLake' }),
  inc(t('mall', 'C', 2, 'C', 22, '실내 쇼핑몰', 'Indoor Mall', { income: 2 },
    [c('rep', 1, 'own', { types: ['C'] })])),
  inc(t('redistrict', 'C', 2, 'V', 6, '선거구 조정국', 'Redistricting Office', {},
    [], 'office'), { special: 'redistrict', costPerPlayer: 6 }),
];

function inc(tile, extra = {}) { return { ...tile, exp: 'inc', ...extra }; }

// Cost of a tile in a game with n players (Redistricting Office scales with players).
export const tileCostN = (tile, n) => (tile.costPerPlayer ? tile.costPerPlayer * n : tile.cost);

// ── Suburbia Inc. Borders ── adjacency = hex tiles in the border's 4 slots
const b = (id, cost, ko, en, imm, cond) => ({ id, cost, ko, en, imm, cond, border: true });
const bc = (res, amt, types, lake = false) => ({ res, amt, scope: 'badj', types, lake });
const ALL4 = ['I', 'V', 'R', 'C'];
export const BORDERS = [
  b('amusement', 15, '놀이공원', 'Amusement Park', { rep: 2 }, [bc('income', 2, ['I', 'R'])]),
  b('bay', 13, '만', 'Bay', { rep: 1 }, [bc('money', 8, ALL4)]),
  b('beach', 12, '해변', 'Beach', { rep: 3 }, [bc('pop', 3, ['R', 'C'])]),
  b('desert', 6, '사막', 'Desert', { income: 5 }, [bc('money', -10, ALL4)]),
  b('forest', 9, '숲', 'Forest', {}, [bc('rep', 1, ['V', 'R', 'C'])]),
  b('military', 12, '군사 기지', 'Military Base', { income: 1 }, [bc('pop', 5, ['V'])]),
  b('mountains', 18, '산맥', 'Mountains', {}, [bc('rep', 2, ALL4)]),
  b('natpark', 15, '국립공원', 'National Park', { rep: 2 }, [bc('rep', 1, ALL4, true)]),
  b('orchard', 10, '과수원', 'Orchard', { rep: 1 }, [bc('income', 1, ['I', 'R', 'C'])]),
  b('radioactive', 7, '방사성 폐기물장', 'Radioactive Waste Site', { income: 5 }, [bc('pop', -7, ALL4, true)]),
  b('sports', 18, '종합 운동장', 'Sports Complex', { income: 3 }, [bc('income', 1, ['V', 'R'])]),
  b('train', 17, '철도', 'Train Tracks', { income: 3 }, [bc('income', 1, ['I', 'C'])]),
];
export const BORDER_BY_ID = Object.fromEntries(BORDERS.map((x) => [x.id, x]));

// ── Suburbia Inc. Bonus (Income, when A runs out) / Challenge (Reputation, when B runs out) ──
const bonusMetricKo = { borders: '보더', V: '공공 타일', C: '상업 타일', income: '수입', I: '산업 타일', lakes: '호수', money: '자금', pop: '인구', rep: '평판', R: '주거 타일', incTiles: 'Inc. 타일' };
export const BONUSES = [
  ['borders', 1, 3, 2, 4], ['V', 3, 3, 5, 3], ['C', 3, 2, 5, 3], ['income', 5, 2, 10, 3], ['I', 3, 2, 5, 3],
  ['lakes', 2, 3, 4, 3], ['money', 25, 2, 45, 3], ['pop', 13, 3, 40, 2], ['rep', 5, 3, 10, 2], ['R', 3, 4, 5, 3], ['incTiles', 3, 2, 5, 3],
].map(([metric, bNeed, bGain, cNeed, cGain]) => ({ id: metric, metric, ko: bonusMetricKo[metric], bonus: { need: bNeed, income: bGain }, challenge: { need: cNeed, rep: cGain } }));
export const BONUS_BY_ID = Object.fromEntries(BONUSES.map((x) => [x.id, x]));

export const TILE_BY_ID = Object.fromEntries(TILES.map((x) => [x.id, x]));
export const BASIC_IDS = ['suburbs', 'park', 'factory'];

export const GOALS = [
  { id: 'atc', ko: '항공 관제사', en: 'Air Traffic Controller', bonus: 10, metric: 'airports', dir: 'max' },
  { id: 'aquatic', ko: '수상 기술자', en: 'Aquatic Engineer', bonus: 20, metric: 'lakes', dir: 'max' },
  { id: 'aquaphobe', ko: '물 공포증', en: 'Aquaphobian', bonus: 20, metric: 'lakes', dir: 'min' },
  { id: 'billionaire', ko: '억만장자', en: 'Billionaire', bonus: 10, metric: 'money', dir: 'max' },
  { id: 'spendthrift', ko: '낭비꾼', en: 'Spendthrift', bonus: 10, metric: 'money', dir: 'min' },
  { id: 'builder', ko: '건축가', en: 'Builder', bonus: 15, metric: 'R', dir: 'max' },
  { id: 'capitalist', ko: '자본가', en: 'Capitalist', bonus: 20, metric: 'R', dir: 'min' },
  { id: 'civil', ko: '토목 기사', en: 'Civil Engineer', bonus: 15, metric: 'V', dir: 'max' },
  { id: 'libertarian', ko: '자유주의자', en: 'Libertarian', bonus: 15, metric: 'V', dir: 'min' },
  { id: 'official', ko: '공무원', en: 'Public Official', bonus: 15, metric: 'civicCluster', dir: 'max' },
  { id: 'developer', ko: '개발업자', en: 'Developer', bonus: 10, metric: 'C', dir: 'max' },
  { id: 'socialist', ko: '사회주의자', en: 'Socialist', bonus: 10, metric: 'C', dir: 'min' },
  { id: 'industrialist', ko: '산업가', en: 'Industrialist', bonus: 15, metric: 'I', dir: 'max' },
  { id: 'environmentalist', ko: '환경운동가', en: 'Environmentalist', bonus: 15, metric: 'I', dir: 'min' },
  { id: 'harbormaster', ko: '항만 관리인', en: 'Harbormaster', bonus: 10, metric: 'lakeCluster', dir: 'max' },
  { id: 'employer', ko: '고용주', en: 'Employer', bonus: 15, metric: 'investments', dir: 'min' },
  { id: 'investor', ko: '투자자', en: 'Investor', bonus: 15, metric: 'income', dir: 'max' },
  { id: 'miser', ko: '구두쇠', en: 'Miser', bonus: 15, metric: 'income', dir: 'min' },
  { id: 'luminary', ko: '명사', en: 'Luminary', bonus: 10, metric: 'rep', dir: 'max' },
  { id: 'miscreant', ko: '악당', en: 'Miscreant', bonus: 20, metric: 'rep', dir: 'min' },
  // Suburbia Inc.
  { id: 'european', ko: '유럽인', en: 'European', bonus: 10, metric: 'borders', dir: 'min', exp: 'inc' },
  { id: 'guard', ko: '경비병', en: 'Guard', bonus: 15, metric: 'borders', dir: 'max', exp: 'inc' },
  { id: 'milton', ko: '사무직', en: 'Milton', bonus: 15, metric: 'offices', dir: 'max', exp: 'inc' },
  { id: 'nomad', ko: '유목민', en: 'Nomad', bonus: 15, metric: 'buildings', dir: 'min', exp: 'inc' },
  { id: 'settler', ko: '정착민', en: 'Settler', bonus: 10, metric: 'buildings', dir: 'max', exp: 'inc' },
  { id: 'entrepreneur', ko: '기업가', en: 'Entrepreneur', bonus: 20, metric: 'incTiles', dir: 'max', exp: 'inc' },
  { id: 'layabout', ko: '게으름뱅이', en: 'Layabout', bonus: 10, metric: 'incTiles', dir: 'min', exp: 'inc' },
];
export const GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));

export const METRIC_KO = {
  airports: '공항 수', lakes: '호수 수', money: '보유 자금', R: '주거 타일 수', V: '공공 타일 수',
  C: '상업 타일 수', I: '산업 타일 수', civicCluster: '연결된 공공 타일', lakeCluster: '연결된 호수',
  investments: '투자 마커 사용 수', income: '수입', rep: '평판',
  borders: '보더 수', offices: '사무실(💼) 타일 수', buildings: '건물 타일 수', incTiles: 'Inc. 타일 수',
};

// Red lines: crossing from N-1 to N triggers (read from the 1st-edition population board).
export const RED_LINES = [
  15, 22, 29, 35, 41, 47, 53, 59, 64, 69, 74, 78, 82, 86, 89, 92, 95, 98, 101,
  103, 105, 107, 109, 111, 113, 115, 117, 119, 121, 123, 125, 127, 129, 131, 133,
  135, 137, 139, 141, 143, 145, 147, 149,
];
for (let n = 152; n <= 600; n += 2) RED_LINES.push(n);

export const MARKET_COSTS = [10, 8, 6, 4, 2, 0, 0];

// Human-readable Korean description of a tile's effects.
const RES_KO = { income: '수입', rep: '평판', pop: '인구', money: '$' };
function amtStr(res, amt) {
  if (res === 'money') return `$${amt}`;
  return `${RES_KO[res]} ${amt > 0 ? '+' : ''}${amt}`;
}
function matchStr(cn) {
  if (cn.border) return '보더';
  if (cn.icon) return `${ICON_INFO[cn.icon].ko}`;
  if (cn.types) return cn.types.map((x) => TYPE_INFO[x].ko).join('/');
  return '';
}
export function describeImmediate(tile) {
  const parts = [];
  for (const k of ['income', 'rep', 'pop', 'money']) if (tile.imm[k]) parts.push(amtStr(k, tile.imm[k]));
  return parts.join(', ');
}
export function describeCond(cn) {
  if (cn.special === 'afterThis') return `이후 지어지는 ${matchStr(cn)}마다 ${amtStr(cn.res, cn.amt)} (모든 구역)`;
  if (cn.special === 'redline') return `레드라인을 넘을 때마다 ${amtStr(cn.res, cn.amt)}`;
  if (cn.special === 'waterfront') return `내 호수에 인접한 내 건물마다 $2 추가`;
  const m = matchStr(cn) + (cn.lake ? '/호수' : '');
  const scope = { adj: '인접한', own: '내 구역의', all: '모든 구역의', others: '다른 구역의', badj: '인접한' }[cn.scope];
  const self = cn.excludeSelf ? ' (자신 제외)' : '';
  return `${scope} ${m}마다 ${amtStr(cn.res, cn.amt)}${self}`;
}
const SPECIAL_KO = {
  lawOffice: '게임 종료 시 동점인 목표 1개를 단독 1위처럼 획득',
  planner: '이후 턴에 시장/기본 타일 하나로 무료 교체 (효과 없음)',
  redistrict: '다른 구역마다 인구 5를 빼앗음',
};
const REQ_KO = { pop2: '인구 2 이상일 때만 건설', adjBorder: '보더에 인접해야 건설', adjLake: '호수에 인접해야 건설' };
export function describeTile(tile) {
  const cond = tile.cond.map(describeCond);
  if (tile.special && SPECIAL_KO[tile.special]) cond.push(SPECIAL_KO[tile.special]);
  if (tile.req) cond.push(`※ ${REQ_KO[tile.req]}`);
  return { imm: describeImmediate(tile), cond };
}
