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

  // ── Suburbia 5★ (one of each; stars = gold stars moved on the Star Track) ──
  five(t('bungee', 'A', 1, 'V', 7, '번지 브리지', 'Bungee Bridge', { rep: 1 }), 1),
  five(t('cornmaze', 'A', 1, 'I', 11, '옥수수밭 미로', 'Cornfield Maze', { rep: 1 }, [c('income', 1, 'adj', { types: ['R'] })]), 1),
  five(t('crystal', 'A', 1, 'I', 9, '수정 동굴', 'Crystal Caverns', {}, [c('income', 1, 'own', { types: ['R'] })]), 1),
  five(t('ezburger', 'A', 1, 'C', 7, 'EZ 버거', 'EZ Burger', { income: 1 }, [], 'restaurant'), 1),
  five(t('failedsolar', 'A', 1, 'I', 12, '망한 태양광 회사', 'Failed Solar Co.', {}, [c('money', 2, 'all', { types: ['V'] })]), 2),
  five(t('fallingtower', 'A', 1, 'R', 10, '기울어진 탑', 'Falling Tower', { pop: 6 }, [c('rep', -2, 'adj', { types: ['R'] })]), 1),
  five(t('hydro', 'A', 1, 'I', 14, '수력 발전 댐', 'Hydroelectric Dam', { income: 1 }, [c('money', 5, 'adj', { types: ['I'] })]), 1),
  five(t('lactose', 'A', 1, 'C', 4, '락토스 프린세스', 'Lactose Princess', {}, [], 'restaurant'), 1),
  five(t('pieshack', 'A', 1, 'C', 8, '파이 가게', 'Pie Shack', { income: 1 }, [c('pop', 1, 'adj', { types: ['V'] })], 'restaurant'), 1),
  five(t('roadhouse', 'A', 1, 'R', 5, '로드하우스', 'Roadhouse', { pop: 2 }, [c('rep', -1, 'adj', { types: ['C'] })]), 1),
  five(t('sleepy', 'A', 1, 'R', 9, '슬리피 헤이븐', 'Sleepy Haven', { rep: 1 }, [c('pop', 1, 'adj', { types: ['R'] })]), 1),
  five(t('slice', 'A', 1, 'C', 10, '천국의 피자', 'Slice of Heaven', { income: 1 }, [c('pop', 1, 'adj', { types: ['C'] })], 'restaurant'), 1),
  five(t('starry', 'A', 1, 'V', 8, '별빛 산책로', 'Starry Sidewalk', {}, [c('money', 2, 'own', { star: true })]), 1),
  five(t('tinyhouse', 'A', 1, 'R', 4, '타이니 하우스 공원', 'Tiny House Park', { pop: 1 }), 1),
  five(t('tourismoffice', 'A', 1, 'C', 9, '관광 안내소', 'Tourism Office', {}, [c('pop', 1, 'own', { star: true })], 'office'), 1),
  five(t('countryclub', 'B', 1, 'R', 13, '컨트리 클럽', 'Country Club', { pop: 3 }, [c('rep', 1, 'adj', { types: ['R'] })]), 1),
  five(t('creekside', 'B', 1, 'V', 12, '크릭사이드 대학', 'Creekside College', {}, [c('rep', 1, 'all', { icon: 'school' })], 'school'), 1),
  five(t('crepe', 'B', 1, 'C', 12, '크레페 콘도', 'Crepe Condo', { income: 2 }, [], 'restaurant'), 1),
  five(t('dollararcade', 'B', 1, 'C', 10, '1달러 오락실', 'Dollar Arcade', {}, []), 1, { special: 'dollarPerPop' }),
  five(t('speedway', 'B', 1, 'I', 10, '그랜드 스피드웨이', 'Grand Speedway', { income: 3 }, [c('rep', -2, 'adj', { types: ['C', 'R'] })]), 1),
  five(t('asylum', 'B', 1, 'I', 18, '유령 정신병원', 'Haunted Asylum', { pop: 6 }, [c('rep', -3, 'adj', { types: ['V', 'R', 'C'] })]), 3),
  five(t('hedgren', 'B', 1, 'R', 15, '헤드그렌 주택지', 'Hedgren Subdivision', { pop: 6 }), 1),
  five(t('mayorted', 'B', 1, 'V', 16, '테드 시장 동상', 'Mayor Ted Statue', { rep: 1 }, [c('rep', 1, 'adj', { types: ['C'] })]), 2),
  five(t('mystery', 'B', 1, 'R', 10, '미스터리 맨션', 'Mystery Mansion', { income: 2 }, [c('pop', 1, 'adj', { types: ['R'] })]), 2),
  five(t('cathedral', 'B', 1, 'V', 10, '뾰족 대성당', 'Pointy Cathedral', { rep: 2 }, [c('pop', 1, 'adj', { types: ['R'] })]), 1),
  five(t('parkway', 'B', 1, 'I', 16, '경관 도로', 'Scenic Parkway', { rep: 1 }, [c('income', 2, 'adj', { types: ['C'] })]), 1),
  five(t('skilift', 'B', 1, 'I', 11, '스키 리프트', 'Ski Lift', {}, [c('income', 1, 'adj', { types: ['R', 'C'] })]), 2),
  five(t('smarty', 'B', 1, 'V', 10, '스마티팬츠 기술학교', 'Smarty Pants Technical School', {}, [c('income', 1, 'all', { icon: 'school' })], 'school'), 1),
  five(t('sprue', 'B', 1, 'I', 12, '스프루 공장', 'Sprue Factory', { income: 5 }, [c('rep', -2, 'adj', { types: ['V', 'C', 'R'] })]), 1),
  five(t('siltmore', 'B', 1, 'R', 14, '실트모어 저택', 'The Siltmore', { income: 2 }, [c('income', 1, 'adj', { types: ['R'] })]), 1),
  five(t('tourismcenter', 'B', 1, 'C', 15, '관광 센터', 'Tourism Center', {}, [c('star', 1, 'adj', { star: true })], 'office'), 1),
  five(t('wildflower', 'B', 1, 'R', 14, '야생화 정원', 'Wildflower Gardens', { income: 2 }, [c('rep', 1, 'adj', { types: ['V'] })]), 2),
  five(t('alien', 'C', 1, 'I', 20, '외계인 산', 'Alien Mountain', {}, [c('pop', -1, 'own', {}, { special: 'redline' })]), 4),
  five(t('artgallery', 'C', 1, 'C', 22, '미술관', 'Art Gallery', { rep: 2 }, [c('rep', 2, 'adj', { types: ['C'] })]), 2),
  five(t('arena', 'C', 1, 'V', 15, '베지어 게임즈 아레나', 'Bezier Games Arena', { rep: 2 }, [c('income', 2, 'adj', { types: ['R'] })]), 1),
  five(t('circle', 'C', 1, 'V', 20, '매립된 원', 'Embedded Circle', {}), 3),
  five(t('halloffame', 'C', 1, 'C', 10, '명예의 전당', 'Hall of Fame', { income: 2 }), 1),
  five(t('islandresort', 'C', 1, 'R', 22, '섬 리조트', 'Island Resort', { rep: 3 }, [c('pop', 5, 'adj', { types: ['R'] })]), 2, { req: 'adjLake' }),
  five(t('lookout', 'C', 1, 'I', 14, '전망 운하', 'Lookout Canal', { income: 1 }, [c('income', 1, 'adj', { lakes: true })]), 1, { req: 'adjLake' }),
  five(t('ludwig', 'C', 1, 'R', 26, '루트비히의 성', "Ludwig's Castle", { rep: 4 }), 3),
  five(t('volcano', 'C', 1, 'I', 8, '인공 화산', 'Manmade Volcano', { rep: 3 }, [c('pop', -2, 'adj', { types: ['I', 'V', 'R', 'C'] })]), 2),
  five(t('memorial', 'C', 1, 'V', 11, '기념관', 'Memorial Building', { rep: 1 }, [c('rep', 1, 'adj', { types: ['V'] })]), 1),
  five(t('opera', 'C', 1, 'C', 23, '오페라 하우스', 'Opera House', { rep: 1 }, [c('income', 1, 'adj', { types: ['V'] })]), 2),
  five(t('overpriced', 'C', 1, 'R', 25, '바가지 저택단지', 'Overpriced Estates', { rep: 1 }, [c('rep', 3, 'adj', { types: ['R'] })]), 1),
  five(t('pharaoh', 'C', 1, 'V', 21, '파라오의 은총', "Pharaoh's Favor", { rep: 1 }, [c('rep', 1, 'adj', { types: ['V'] })]), 3),
  five(t('bbq', 'C', 1, 'C', 16, '바비큐 교수', 'Professor BBQ', { income: 3 }, [c('rep', 2, 'adj', { star: true })], 'restaurant'), 1),
  five(t('snorkel', 'C', 1, 'R', 21, '스노클 섬', 'Snorkel Island', { pop: 5 }, [c('rep', 1, 'adj', { lakes: true })]), 2, { req: 'adjLake' }),
  five(t('supermall', 'C', 1, 'C', 20, '슈퍼몰', 'Super Mall', { income: 1 }, [c('rep', 1, 'all', { icon: 'restaurant' })]), 1),
  five(t('spa', 'C', 1, 'R', 15, '럭셔리 스파', 'Swanky Spa', { rep: 2 }, [c('income', 1, 'adj', { types: ['C'] })]), 1),

  // ── Nightlife ──
  night(t('backalley', 'A', 2, 'I', 0, '뒷골목', 'Back Alley', { income: 2 }, [c('money', -2, 'own', { night: true })])),
  night(t('citysquare', 'A', 2, 'V', 9, '시티 광장', 'City Square', { rep: 4 }, [c('pop', -1, 'all', { types: ['C'] })])),
  night(t('danceclub', 'A', 2, 'C', 4, '댄스 클럽', 'Dance Club', { income: 1 }, [c('money', 1, 'all', { types: ['C'] })])),
  night(t('hauntedhouse', 'A', 2, 'R', 2, '유령의 집', 'Haunted House', { pop: 13 }, [c('pop', -1, 'own', { night: true })])),
  night(t('helipad', 'A', 2, 'I', 9, '헬리패드', 'Helipad', { income: 1 }, [c('money', 5, 'all', { icon: 'airport' })], 'airport')),
  night(t('werewolf', 'A', 2, 'R', 0, '늑대인간 소굴', 'Werewolf Den', { income: 2 }, [c('pop', -1, 'own', { night: true })])),
  night(t('hospital', 'B', 2, 'I', 10, '병원', 'Hospital', {}, [c('pop', 1, 'all', { night: true })])),
  night(t('watch', 'B', 2, 'R', 7, '자율 방범대', 'Neighborhood Watch', { rep: 1 }, [c('money', 1, 'all', { types: ['R'] })])),
  night(t('police', 'B', 2, 'V', 11, '경찰서', 'Police Station', { rep: 2 }, []), { special: 'police' }),
  night(t('security', 'B', 2, 'C', 11, '경비 회사', 'Security Office', { income: 1 }, [c('money', 1, 'all', { night: true })], 'office')),
  night(t('tavern', 'B', 2, 'C', 8, '선술집', 'Tavern', { income: 2 }, [], 'restaurant')),
  night(t('gamenight', 'C', 2, 'R', 17, '게임의 밤 호스트', 'Game Night Host', { rep: 1 }, [c('pop', 5, 'all', { icon: 'restaurant' })])),
  night(t('library', 'C', 2, 'V', 15, '캠퍼스 도서관', 'Campus Library', { rep: 2 }, [c('money', 2, 'all', { icon: 'school' })])),
  night(t('pawn', 'C', 2, 'C', 10, '전당포', 'Pawn Shop', { income: 4 }, [c('money', -1, 'own', { types: ['C'] })])),
  night(t('nightcourt', 'C', 2, 'V', 16, '야간 법원', 'Night Court', { income: 1, rep: 2 }, []), { special: 'nightCourt' }),
  night(t('prison', 'C', 2, 'I', 19, '교도소', 'Prison', { rep: -1 }, [c('pop', 2, 'all', { types: ['V'] })])),

  // ── Promo: Cons (Star tiles) and Essen Spiel ──
  promo(t('dicetower', 'A', 1, 'C', 7, '다이스 타워 콘', 'Dice Tower Con', {}, [c('rep', 1, 'all', { con: true })]), { con: true, star: true, stars: 1 }),
  promo(t('kublacon', 'A', 1, 'I', 8, '쿠블라콘', 'Kublacon', {}, [c('rep', 1, 'all', { con: true })]), { con: true, star: true, stars: 1 }),
  promo(t('gencon', 'B', 1, 'C', 13, '젠콘', 'Gen Con', {}, [c('rep', 1, 'all', { con: true })]), { con: true, star: true, stars: 1 }),
  promo(t('bggcon', 'C', 1, 'C', 23, 'BGG 콘', 'BGG Con', {}, [c('rep', 1, 'all', { con: true })]), { con: true, star: true, stars: 2 }),
  promo(t('essencon', 'C', 1, 'I', 14, '에센 슈필', 'Essen Spiel', {}, [c('rep', 1, 'all', { con: true })]), { con: true, star: true, stars: 2 }),
  promo(t('grugapark', 'A', 2, 'V', 6, '그루가 공원', 'Grugapark', { rep: 2 }, [c('rep', 2, 'adj', { essen: true })]), { essen: true, req: 'essenUnique' }),
  promo(t('ubahn', 'B', 2, 'I', 11, 'U-반', 'U-Bahn', { income: 2 }, [c('income', 2, 'adj', { essen: true })]), { essen: true, req: 'essenUnique' }),
  promo(t('messe', 'C', 2, 'C', 20, '메세 에센', 'Messe Essen', { rep: 1, income: 1 }, [c('rep', 1, 'adj', { essen: true }), c('income', 1, 'adj', { essen: true })]), { essen: true, req: 'essenUnique' }),
];

function inc(tile, extra = {}) { return { ...tile, exp: 'inc', ...extra }; }
function five(tile, stars, extra = {}) { return { ...tile, exp: 'five', star: true, stars, ...extra }; }
function night(tile, extra = {}) { return { ...tile, exp: 'night', night: true, ...extra }; }
function promo(tile, extra = {}) { return { ...tile, exp: 'promo', ...extra }; }

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
  // 5★ star borders (used when both Inc. and 5★ are on)
  sb('boardwalk', 12, '보드워크', 'Boardwalk', { income: 1 }, [bc('rep', 1, ['C'])], 1),
  sb('zoo', 22, '시립 동물원', 'City Zoo', { rep: 3 }, [bc('income', 1, ['I', 'R', 'C'])], 1),
  sb('fort', 19, '안토니아 요새', 'Fort Antonia', { rep: 2 }, [bc('rep', 1, ['V'])], 2),
  sb('golf', 17, '골프장', 'Golf Course', { income: 1 }, [bc('income', 2, ['R'])], 1),
  sb('olympic', 25, '올림픽 공원', 'Olympic Park', { rep: 2 }, [{ res: 'star', amt: 1, scope: 'badj', types: [], star: true }], 1),
  sb('wildlife', 24, '야생동물 보호구역', 'Wildlife Sanctuary', { rep: 7 }, [bc('rep', -1, ALL4)], 1),
];
function sb(id, cost, ko, en, imm, cond, stars) { return { ...b(id, cost, ko, en, imm, cond), exp: 'five', star: true, stars }; }
export const BORDER_BY_ID = Object.fromEntries(BORDERS.map((x) => [x.id, x]));

// ── Suburbia Inc. Bonus (Income, when A runs out) / Challenge (Reputation, when B runs out) ──
const bonusMetricKo = { borders: '보더', V: '공공 타일', C: '상업 타일', income: '수입', I: '산업 타일', lakes: '호수', money: '자금', pop: '인구', rep: '평판', R: '주거 타일', incTiles: 'Inc. 타일', starTiles: '★ 타일', nightTiles: '나이트라이프 타일' };
const BONUS_EXP = { starTiles: 'five', nightTiles: 'night' };
export const BONUSES = [
  ['borders', 1, 3, 2, 4], ['V', 3, 3, 5, 3], ['C', 3, 2, 5, 3], ['income', 5, 2, 10, 3], ['I', 3, 2, 5, 3],
  ['lakes', 2, 3, 4, 3], ['money', 25, 2, 45, 3], ['pop', 13, 3, 40, 2], ['rep', 5, 3, 10, 2], ['R', 3, 4, 5, 3], ['incTiles', 3, 2, 5, 3],
  ['starTiles', 3, 3, 5, 3], ['nightTiles', 3, 3, 5, 3],
].map(([metric, bNeed, bGain, cNeed, cGain]) => ({ id: metric, metric, ko: bonusMetricKo[metric], exp: BONUS_EXP[metric], bonus: { need: bNeed, income: bGain }, challenge: { need: cNeed, rep: cGain } }));
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
  // 5★
  { id: 'foodie', ko: '미식가', en: 'Foodie', bonus: 15, metric: 'restaurants', dir: 'max', exp: 'five' },
  { id: 'hermit', ko: '은둔자', en: 'Hermit', bonus: 20, metric: 'starTiles', dir: 'min', exp: 'five' },
  { id: 'tourist', ko: '관광객', en: 'Tourist', bonus: 15, metric: 'starTiles', dir: 'max', exp: 'five' },
  // Nightlife
  { id: 'insomniac', ko: '불면증 환자', en: 'Insomniac', bonus: 15, metric: 'nightTiles', dir: 'max', exp: 'night' },
  { id: 'nyctophobian', ko: '어둠 공포증', en: 'Nyctophobian', bonus: 10, metric: 'nightTiles', dir: 'min', exp: 'night' },
];
export const GOAL_BY_ID = Object.fromEntries(GOALS.map((g) => [g.id, g]));

export const METRIC_KO = {
  airports: '공항 수', lakes: '호수 수', money: '보유 자금', R: '주거 타일 수', V: '공공 타일 수',
  C: '상업 타일 수', I: '산업 타일 수', civicCluster: '연결된 공공 타일', lakeCluster: '연결된 호수',
  investments: '투자 마커 사용 수', income: '수입', rep: '평판',
  borders: '보더 수', offices: '사무실(💼) 타일 수', buildings: '건물 타일 수', incTiles: 'Inc. 타일 수',
  restaurants: '식당(🍴) 타일 수', starTiles: '★ 타일 수', nightTiles: '나이트라이프 타일 수',
};
export const EXPANSIONS = [
  { id: 'inc', ko: 'Suburbia Inc.', desc: '보더·보너스/챌린지·새 건물 26장·목표 7종' },
  { id: 'five', ko: 'Suburbia 5★', desc: '★ 타일 49종·스타 트랙(턴 순서)·5인 플레이·목표 3종' },
  { id: 'night', ko: 'Nightlife', desc: '나이트라이프 타일 32장·목표 2종' },
  { id: 'promo', ko: '프로모 (Cons·Essen)', desc: '컨벤션 타일 5종·에센 타일 3종' },
];
// Star Track: spaces 0..STAR_MAX; the rightmost spaces hold limited tokens.
export const STAR_MAX = 12;
export const STAR_CAP = { 12: 1, 11: 2, 10: 3, 9: 4 };
export const STAR_INCOME_AT = 4; // moving past space 3
export const STAR_REP_AT = 8; // moving past space 7

// Red lines: crossing from N-1 to N triggers (read from the 1st-edition population board).
export const RED_LINES = [
  15, 22, 29, 35, 41, 47, 53, 59, 64, 69, 74, 78, 82, 86, 89, 92, 95, 98, 101,
  103, 105, 107, 109, 111, 113, 115, 117, 119, 121, 123, 125, 127, 129, 131, 133,
  135, 137, 139, 141, 143, 145, 147, 149,
];
for (let n = 152; n <= 600; n += 2) RED_LINES.push(n);

export const MARKET_COSTS = [10, 8, 6, 4, 2, 0, 0];

// Human-readable Korean description of a tile's effects.
const RES_KO = { income: '수입', rep: '평판', pop: '인구', money: '$', star: '★' };
function amtStr(res, amt) {
  if (res === 'money') return amt < 0 ? `-$${-amt}` : `$${amt}`;
  if (res === 'star') return `★ ${amt > 0 ? '+' : ''}${amt}`;
  return `${RES_KO[res]} ${amt > 0 ? '+' : ''}${amt}`;
}
function matchStr(cn) {
  if (cn.border) return '보더';
  if (cn.star) return '★ 타일';
  if (cn.lakes) return '호수';
  if (cn.night) return '나이트라이프 타일';
  if (cn.con) return '컨벤션 타일';
  if (cn.essen) return '에센 타일';
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
  dollarPerPop: '즉시: 내 인구 1당 $1',
  police: '이후 내게 오는 나이트라이프 부정 효과 무시',
  nightCourt: '지금까지 받은 나이트라이프 부정 효과를 되돌리고 이후 무시',
  lawOffice: '게임 종료 시 동점인 목표 1개를 단독 1위처럼 획득',
  planner: '이후 턴에 시장/기본 타일 하나로 무료 교체 (효과 없음)',
  redistrict: '다른 구역마다 인구 5를 빼앗음',
};
const REQ_KO = { pop2: '인구 2 이상일 때만 건설', adjBorder: '보더에 인접해야 건설', adjLake: '호수에 인접해야 건설', essenUnique: '구역당 1개만' };
export function describeTile(tile) {
  const cond = tile.cond.map(describeCond);
  if (tile.special && SPECIAL_KO[tile.special]) cond.push(SPECIAL_KO[tile.special]);
  if (tile.req) cond.push(`※ ${REQ_KO[tile.req]}`);
  let imm = describeImmediate(tile);
  if (tile.stars) imm = [`★${tile.stars}`, imm].filter(Boolean).join(', ');
  return { imm, cond };
}
