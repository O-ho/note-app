# Mac 코드 서명 & 낫터라이즈 (회사 Apple Developer)

DMG/ZIP를 다른 사람에게 넘길 때 **“손상되어 열 수 없습니다”**를 피하려면:

1. **Developer ID Application** 인증서로 서명  
2. Apple **낫터라이즈(Notarization)** 제출 후 통과  

둘 다 되어야 Gatekeeper가 통과하기 쉽습니다.

## 1. 인증서 (회사 계정)

- [Apple Developer](https://developer.apple.com) → **Certificates**  
- **Developer ID Application** 발급 (Team Agent / Admin 권한 필요할 수 있음)  
- `.cer` 받아서 더블클릭 → **키체인 접근**에 들어가는지 확인  
- 빌드하는 Mac에 그 인증서 + 해당 **개인키**가 있어야 함  

터미널에서 확인:

```bash
security find-identity -v -p codesigning
```

`Developer ID Application: … (XXXXXXXXXX)` 가 보이면 OK.

## 2. 앱 전용 비밀번호 (낫터라이즈용)

- [appleid.apple.com](https://appleid.apple.com) → 보안 → **앱 비밀번호** 생성  
- (회사 정책상 개인 Apple ID가 아니라 **배포용 계정**을 쓰는 경우가 많음)

## 3. Team ID

- Developer 사이트 우측 상단 **Membership** 또는 팀 이름 옆 **10자리** (예: `AB12CD34EF`)

## 4. 환경 변수

프로젝트 루트에 `.env.signing` 생성 (`.gitignore`에 있음):

```bash
cp .env.signing.example .env.signing
```

값 채운 뒤:

```bash
set -a && source .env.signing && set +a && npm run electron:build:mac
```

또는 한 줄씩 `export APPLE_ID=...` 후 `npm run electron:build:mac`.

## 5. package.json — 낫터라이즈 켜기

`package.json` → `build` → `mac` → **`"notarize": true`** 로 변경  
(기본은 `false` — Apple 계정 없이 빌드할 때 실패하지 않게.)

## 6. 빌드

```bash
set -a && source .env.signing && set +a && npm run electron:build:mac
```

- **서명**: 키체인의 **Developer ID Application** 자동 사용 (`notarize: false` 여도 서명됨)  
- **`notarize: true`** 이면 끝에 **notarize**가 돌아가며 몇 분 걸릴 수 있음  
- 성공하면 `release/` 의 DMG/ZIP 배포  

### 서명만 확인 (낫터라이즈 생략)

`notarize` 를 `false` 로 둔 채 빌드하면 **서명된 앱**은 나오지만, 인터넷으로 받은 사용자에게는 여전히 경고가 뜰 수 있음. **배포용은 `notarize: true` 권장.**

## API 키로 낫터라이즈 (선택)

앱 비밀번호 대신 App Store Connect API 키를 쓰는 경우, electron-builder / 환경 변수 방식은 [electron-builder Mac](https://www.electron.build/configuration/mac) 문서를 참고해 `APPLE_API_KEY` 등을 설정하면 됩니다.

## Revoked 인증서가 `security find-identity`에 같이 나올 때

키체인에 **취소(revoked)된 Developer ID**가 남아 있으면, electron-builder가 **자동으로 잘못된 쪽**을 고를 수 있습니다.

**방법 A — 쓸 인증서만 지정 (권장)**  
`security find-identity -v -p codesigning` 출력 중 **유효한** 줄 전체를 복사해 환경 변수로 고정합니다.

```bash
export CSC_NAME="Developer ID Application: 회사이름 (XXXXXXXXXX)"
npm run electron:build:mac
```

`.env.signing`에 `CSC_NAME=...` 한 줄 넣고 `source` 해도 됩니다. (따옴표 없이 `=` 뒤에 전체 이름)

**방법 B — 키체인 정리**  
**키체인 접근**에서 `Developer ID Application` 검색 → **취소됨** 표시된 인증서(및 묶인 개인 키)를 삭제.  
(만료·재발급으로 예전 게 revoked 된 경우 흔함.)

빌드 후 어떤 서명이 붙었는지 확인:

```bash
codesign -dv --verbose=4 release/mac/Note\ App.app
```

## 문제 시

- **서명 실패**: 키체인에 Developer ID Application + 비공개 키 있는지 확인  
- **revoked로 서명됨**: 위 `CSC_NAME` 또는 키체인에서 revoked 삭제  
- **notarize 실패**: `APPLE_TEAM_ID`, 앱 비밀번호, Apple ID 오타 확인  
- 회사 **2FA / SSO** 정책이면 배포 전용 Apple ID를 따로 두는 경우가 많음  
