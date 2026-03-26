/**
 * Few-shot: 개발 문서(README, API 설명, 기술 노트) 문장 다듬기
 * src/docPolishPreview.ts 예시 1과 동일한 본문을 유지할 것
 */

export const DOC_POLISH_SYSTEM_PROMPT = `당신은 소프트웨어 개발 문서(README, API 문서, 기술 노트, 이슈 설명 등)를 다듬는 편집자입니다.
주어진 텍스트를 다음 규칙으로 변환해 주세요.
- 문장을 명확·간결하게 정리하고, 불필요한 구어체·줄임말은 문서체로 바꿉니다.
- 절차·조건·오류는 읽기 쉬운 목록이나 단락으로 나눕니다.
- 마크다운 구조(제목 단계, 목록, 코드 블록, 표, 링크)는 유지합니다.
- 코드 블록(\`\`\` … \`\`\`) 안의 내용은 수정하지 마세요.
- 기술적 의미, 동작, 버전·엔드포인트 이름 등 사실은 바꾸지 말고, 추측으로 내용을 추가하지 마세요.
- 입력과 동일한 언어를 유지합니다(한국어 입력 → 한국어, 영어 입력 → 영어).
- 본문에 표·목록·단락 구분 등 서식 요청이 있으면 정보를 유지한 채 그 요청을 우선 반영합니다.`;

export type TransformOption = 'balanced' | 'strong' | 'concise';

function optionPrompt(option: TransformOption): string {
  if (option === 'strong') {
    return '추가 지침: 문서 품질 개선을 강하게 적용하세요. 섹션 구조화, 문장 재작성, 중복 제거를 적극 수행하되 기술 사실은 바꾸지 마세요.';
  }
  if (option === 'concise') {
    return '추가 지침: 같은 정보를 더 짧고 밀도 높게 전달하세요. 불필요한 완곡 표현을 줄이고 핵심을 빠르게 파악할 수 있게 작성하세요.';
  }
  return '추가 지침: 기본 균형 모드입니다. 문서체 품질과 원문 충실도를 균형 있게 유지하세요.';
}

const FEW_SHOT_1 = {
  user: `## 결제 웹훅 (임시정리)

이거 POST로 오는데 url은 /api/v1/webhooks/pay 이거임. 바디는 json인데 event_type 이랑 payload 있음 payload 안에 order_id, amount, status 이런거 들어있음

성공하면 그냥 200 주면되고 실패하면 재시도 한다고 하는데 몇번까지인지는 문서에 안나와있음 아마 3번? 그리고 idempotency-key 헤더 넣어주면 중복처리 안된다고 함 안넣으면 같은 이벤트 두번올수도?

로컬에서 테스트할때는 ngrok 써서 외부에서 접근가능하게 해야함 그리고 .env에 WEBHOOK_SECRET 넣어야 서명검증함 시크릿 틀리면 401뜸

알려진 이슈: 가끔 status가 pending인데 이미 완료된것처럼 보이는 경우 있음 (프론트 캐시문제일수도) 새로고침해보셈

문의는 슬랙 #payments-dev`,
  assistant: `## 결제 웹훅

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

문의: Slack \`#payments-dev\``,
};

const FEW_SHOT_2 = {
  user: `### GET /users/me
this endpoint basically used for fetching user stuff when u already logged in, might be slow if lot of data`,
  assistant: `### \`GET /users/me\`

Returns data for the authenticated user. The client must be logged in before calling this endpoint. Responses may be slower when the payload is large.`,
};

export function buildGeminiDocPolishRequest(
  userText: string,
  option: TransformOption = 'balanced'
): {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
} {
  const systemText = `${DOC_POLISH_SYSTEM_PROMPT}\n\n${optionPrompt(option)}`;
  return {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [
      { role: 'user', parts: [{ text: FEW_SHOT_1.user }] },
      { role: 'model', parts: [{ text: FEW_SHOT_1.assistant }] },
      { role: 'user', parts: [{ text: FEW_SHOT_2.user }] },
      { role: 'model', parts: [{ text: FEW_SHOT_2.assistant }] },
      { role: 'user', parts: [{ text: userText }] },
    ],
  };
}
