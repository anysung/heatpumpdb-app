# HeatPump DB — 브랜드 에셋

채택안: 3a (레드 상단 · DB 레드) / 3b (블루 상단 · DB 블루) / 4a (동적 로고)

## svg/ — 웹사이트·프레젠테이션용 벡터 (권장)
- heatpumpdb-3a-lockup-light/dark.svg — 심볼+워드마크 락업 (light = 밝은 배경용, dark = 어두운 배경용)
- heatpumpdb-3b-lockup-light/dark.svg
- heatpumpdb-symbol-3a/3b-light/dark.svg — 심볼 단독 (파비콘·아이콘)
- heatpumpdb-4a-animated-light/dark.svg — 동적 로고. <img src> 또는 인라인 SVG로 넣으면 자동 재생 (반 바퀴 회전 → DB 컬러 교차)
- heatpumpdb-4a-symbol-animated-*.svg — 심볼만 도는 버전 (로더/스플래시용)

## png/ — PPT·문서용 래스터
- 락업 @4x (투명 배경 / dark는 #1d1d1f 배경 포함)
- 심볼 512px, 앱 아이콘 1024px

## 웹 적용 예
```html
<img src="heatpumpdb-4a-animated-light.svg" alt="HeatPump DB" height="40">
```

주의: SVG 워드마크는 Inter/시스템 폰트로 렌더링됩니다. 웹사이트에 Inter를 로드하면 시안과 동일하게 표시됩니다.
컬러: 레드 #e0452c(다크 #ff6b52) · 블루 #0066cc(다크 #2997ff) · 잉크 #1d1d1f
