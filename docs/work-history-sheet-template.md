# Work History Sheet Template

`/work-history` 페이지는 Google Sheets의 한 시트를 읽어서 업무 기록으로 변환합니다.

## Environment

`.env.local`에 아래 값을 넣으면 됩니다.

```env
GOOGLE_SHEETS_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_WORK_HISTORY_SHEET_NAME=WorkHistory
GOOGLE_WORK_HISTORY_RANGE=WorkHistory!A1:Z1000
```

## Expected columns

헤더는 첫 번째 행에 있어야 합니다.

| column | required | example |
| --- | --- | --- |
| `id` | optional | `wrk-1001` |
| `date` or `날짜` | recommended | `2026-03-18` |
| `title` or `업무명` | required | `주간 리포트 개편` |
| `summary` or `요약` | optional | `리포트 구조를 액션 중심으로 재정리` |
| `category` or `카테고리` | optional | `planning`, `meeting`, `analysis`, `delivery`, `automation`, `improvement` |
| `status` or `상태` | optional | `done`, `in-progress`, `blocked` |
| `owner` or `작성자` | optional | `나` |
| `tags` or `태그` | optional | `리포트, 주간업무, 템플릿` |
| `project` or `프로젝트` | optional | `운영 리포팅` |
| `outcome` or `결과` | optional | `공유 시간이 줄어듦` |
| `source` or `출처` | optional | `Notion / Weekly Report` |
| `pinned` or `고정` | optional | `TRUE` |

## Notes

- `title`이 비어 있는 행은 무시됩니다.
- `tags`는 `,`, `#`, `|`, `;`, 줄바꿈 기준으로 분리됩니다.
- `category`, `status`는 한글 또는 영문 값 모두 허용됩니다.
- `pinned`는 `true`, `1`, `yes`, `고정`, `중요` 값이면 고정 항목으로 처리됩니다.
- 연결 정보가 없거나 시트 파싱에 실패하면 앱은 샘플 데이터를 보여줍니다.
