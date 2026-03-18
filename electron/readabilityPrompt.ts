/**
 * Few-Shot 프롬프트: 노트 내용을 가독성 좋게 변환
 * 예시를 한 번만 정의해 두고, 매 요청 시 동일한 패턴으로 변환 요청
 */

export const READABILITY_SYSTEM_PROMPT = `당신은 메모·노트를 정리하는 도우미입니다.
주어진 텍스트를 다음 규칙으로 가독성 좋게 변환해 주세요.
- 문장 단위로 줄바꿈, 불필요한 반복·줄임 제거
- 맞춤법·띄어쓰기 보정 (의미는 유지)
- 제목(# )은 유지하고, 본문만 정리
- 마크다운 형식(목록, 강조 등)이 있으면 유지
- 본문에 표·목록·단락 구분 등 서식이나 구조를 바꿔 달라는 요청(예: 표로 정리, 목록으로, 표 만들어줘)이 있으면, 정보를 빠짐없이 유지한 채 그 요청을 우선 반영해 주세요.
- 내용을 바꾸거나 요약하지 말고, 같은 내용을 읽기 좋게만 다듬어 주세요.`;

/** Few-shot 예시 1: 지저분한 메모 → 정리된 문장 */
export const FEW_SHOT_EXAMPLE_1 = {
  user: `회의메모
오늘 미팅에서 논의한거 - 예산은 다음달부터 반영 예정 김대리 말로는 2분기에는 무조건 되어있을거라고함
다음 액션: 영업팀에 공유(금요일까지)`,
  assistant: `# 회의 메모

오늘 미팅에서 논의한 내용:
- 예산은 다음 달부터 반영 예정
- 김 대리 말로는 2분기에는 무조건 반영되어 있을 것이라고 함

다음 액션: 영업팀에 공유 (금요일까지)`,
};

/** Few-shot 예시 2 (선택) */
export const FEW_SHOT_EXAMPLE_2 = {
  user: `장보기목록
우유 계란 빵 당근 양파 감자 고기
+ 세제랑 수건`,
  assistant: `# 장보기 목록

- 우유
- 계란
- 빵
- 당근, 양파, 감자
- 고기
- 세제, 수건`,
};

/** Gemini API용: systemInstruction + few-shot contents 구성 */
export function buildGeminiReadabilityRequest(userText: string): {
  systemInstruction: { parts: Array<{ text: string }> };
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
} {
  return {
    systemInstruction: { parts: [{ text: READABILITY_SYSTEM_PROMPT }] },
    contents: [
      { role: 'user', parts: [{ text: FEW_SHOT_EXAMPLE_1.user }] },
      { role: 'model', parts: [{ text: FEW_SHOT_EXAMPLE_1.assistant }] },
      { role: 'user', parts: [{ text: FEW_SHOT_EXAMPLE_2.user }] },
      { role: 'model', parts: [{ text: FEW_SHOT_EXAMPLE_2.assistant }] },
      { role: 'user', parts: [{ text: userText }] },
    ],
  };
}
