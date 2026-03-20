/**
 * UI에 보여줄 예시(전/후). electron/docPolishPrompt.ts 의 few-shot 예시 1과 동일하게 유지하세요.
 */
export const DOC_POLISH_PREVIEW_BEFORE = `## 결제 웹훅 (임시정리)

이거 POST로 오는데 url은 /api/v1/webhooks/pay 이거임. 바디는 json인데 event_type 이랑 payload 있음 payload 안에 order_id, amount, status 이런거 들어있음

성공하면 그냥 200 주면되고 실패하면 재시도 한다고 하는데 몇번까지인지는 문서에 안나와있음 아마 3번? 그리고 idempotency-key 헤더 넣어주면 중복처리 안된다고 함 안넣으면 같은 이벤트 두번올수도?

로컬에서 테스트할때는 ngrok 써서 외부에서 접근가능하게 해야함 그리고 .env에 WEBHOOK_SECRET 넣어야 서명검증함 시크릿 틀리면 401뜸

알려진 이슈: 가끔 status가 pending인데 이미 완료된것처럼 보이는 경우 있음 (프론트 캐시문제일수도) 새로고침해보셈

문의는 슬랙 #payments-dev`;

export const DOC_POLISH_PREVIEW_AFTER = `## 결제 웹훅

요청은 \`POST /api/v1/webhooks/pay\` 엔드포인트로 수신됩니다. 본문은 JSON이며 \`event_type\`과 \`payload\` 필드를 포함합니다. \`payload\`에는 \`order_id\`, \`amount\`, \`status\` 등이 포함됩니다.

### 응답 및 재시도

- 정상 처리 시 HTTP \`200\`을 반환하면 됩니다.
- 처리 실패 시 재시도가 이루어진다고 하나, **최대 재시도 횟수는 공식 문서에 기재되어 있지 않습니다.** (작성 시점 기준으로는 약 3회로 추정)
- \`Idempotency-Key\` 헤더를 내면 동일 이벤트의 중복 처리를 줄일 수 있습니다. 헤더가 없으면 동일 이벤트가 중복 수신될 수 있습니다.

### 로컬 테스트

- 외부에서 접근 가능한 URL이 필요하므로 \`ngrok\` 등으로 터널링합니다.
- \`.env\`에 \`WEBHOOK_SECRET\`을 설정해야 서명 검증이 동작합니다. 시크릿이 맞지 않으면 HTTP \`401\`이 반환됩니다.

### 알려진 이슈

- \`status\`가 \`pending\`인데 화면에서는 이미 완료된 것처럼 보이는 경우가 있습니다. (프론트엔드 캐시 영향 가능) 새로고침 후 다시 확인해 보세요.

문의: Slack \`#payments-dev\``;
