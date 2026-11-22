# 서버비아 (Suburbia) — 온라인 보드게임

친구들과 온라인으로, 또는 봇(쉬움·보통·어려움·매우 어려움)과 함께 하는 서버비아 팬 구현입니다.

- **웹에서 바로 플레이:** https://saint-name.github.io/Suburbia/ (PC·모바일 브라우저)
- **이전 버전 플레이:** https://saint-name.github.io/Suburbia/versions/
- **변경 기록:** [CHANGELOG.md](CHANGELOG.md)
- **Windows:** `Suburbia-x.y.z-portable.exe` (설치 없이 실행)

## 하는 법
1. 이름을 입력하고 **온라인 방 만들기**를 누르면 5자리 방 코드가 나옵니다.
2. 친구는 같은 주소(또는 exe)에서 방 코드를 입력하고 **참가하기**를 누릅니다.
3. 방장은 빈자리에 봇을 추가하고, 확장(Suburbia Inc., 5★, Nightlife, 프로모)을 골라 시작합니다.

웹 버전과 exe 버전은 서로 같은 방에서 함께 플레이할 수 있습니다.

## 버전
| 버전 | 내용 |
|---|---|
| 1.0.1 | 인구 보드 표시 |
| 1.0.2 | 원본 배치를 따른 타일 그림 |
| 1.0.3 | 봇이 숨겨진 정보를 보지 않도록 수정 |
| 1.0.4 | Suburbia Inc. 확장 |
| 1.0.5 | 모든 확장(5★·Nightlife·Cons·Essen), 선택 테두리 자홍색 |
| 1.0.6 | 5★를 끈 게임에서 별 표시에 "5★ 없이는 효과 없음" 안내 |
| 1.0.7 | 봇 난이도 "매우 어려움" 추가 (몬테카를로 시뮬레이션) |

## 개발
- `src/engine` 규칙 엔진·봇, `src/ui` 화면, `src/net` 온라인(PeerJS/WebRTC)
- `npm install && node build.mjs` → `dist/index.html` (웹 사이트는 `docs/index.html`, 버전별 사본은 `docs/versions/<버전>/`)
- 테스트: `node test/rules.mjs`, `node test/inc.mjs`, `node test/exp.mjs`

Suburbia는 Bézier Games의 보드게임입니다. 이 저장소는 개인적으로 즐기기 위한 비공식 팬 구현입니다.
