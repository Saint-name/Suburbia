# 새 대화에서 할 일 (Claude에게)

이 압축 파일은 서버비아 1.0.5 프로젝트 전체입니다. `.git` 폴더에 1.0.1~1.0.5 커밋과 태그(`v1.0.1`~`v1.0.5`)가 들어 있습니다.

1. 첨부된 `suburbia-1.0.5-source.zip`의 압축을 풉니다. 안에 `suburbia/` 폴더가 있고, 그 안에 `.git`이 있습니다.
2. GitHub 저장소 `Saint-name/Suburbia`를 업로드(push) 권한으로 세션에 연결합니다. 이 저장소는 비어 있습니다.
3. 풀어 둔 폴더에서 `main` 브랜치와 모든 태그를 이 저장소에 push합니다:
   `git remote add origin https://github.com/Saint-name/Suburbia && git push -u origin main --tags`
4. GitHub Pages를 켭니다: Source = Deploy from a branch, Branch = `main`, 폴더 = `/docs`.
   API 권한이 없으면 사용자에게 저장소 Settings → Pages에서 위 값으로 직접 설정해 달라고 안내합니다.
5. 사이트 주소(`https://saint-name.github.io/Suburbia/`)가 열리는지 확인하고 사용자에게 알려 줍니다.

## 참고
- 웹 사이트 파일은 `docs/index.html` 하나입니다(`dist/index.html`과 같은 파일). `docs/.nojekyll`도 포함되어 있습니다.
- 빌드: `npm install && node build.mjs` → `dist/index.html`. 사이트에 반영하려면 `docs/index.html`로 복사합니다.
- 테스트: `node test/rules.mjs`, `node test/inc.mjs`, `node test/exp.mjs`
- Windows exe: `desktop/`에서 `npx electron-builder --win portable --x64`
- 버전 규칙: 수정할 때마다 1.0.x를 하나씩 올리고, `package.json`·`desktop/package.json`의 version을 바꾼 뒤 `v1.0.x` 태그를 붙입니다.
