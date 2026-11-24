#!/bin/bash
# BE 9주차 평점 미션 테스트(단위 2 + 통합 2)를 일부러 깨뜨려 보는 실험. 파일을 바꾸고 → 테스트 → 반드시 원복.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/evidence/week09-tests"
mkdir -p "$OUT"
cd "$ROOT" || exit 1
SVC=src/service/rating.service.ts
CTL=src/controller/rating.controller.ts

run_unit() { NO_COLOR=1 npx vitest run src/service/rating.service.spec.ts > "$OUT/$1" 2>&1; echo "  단위 종료코드 $?  → $1  ($(grep -E 'Tests ' "$OUT/$1" | sed 's/^ *//'))"; }
run_unit_all() { NO_COLOR=1 npx vitest run > "$OUT/$1" 2>&1; echo "  단위(전체) 종료코드 $?  → $1  ($(grep -E 'Tests ' "$OUT/$1" | sed 's/^ *//'))"; }
run_e2e()  { NO_COLOR=1 npx vitest run --config ./vitest.config.e2e.ts test/ratings.e2e-spec.ts test/members-write.e2e-spec.ts > "$OUT/$1" 2>&1; echo "  e2e 종료코드 $?  → $1  ($(grep -E 'Tests ' "$OUT/$1" | sed 's/^ *//'))"; }

for name in "$@"; do
  echo "== $name"
  case "$name" in
    R1) # 평점 중복 사전 검사 제거
      cp "$SVC" "$SVC.mutbak"
      python3 - "$SVC" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
old="    if (existing) {\n      throw ratingDuplicated();\n    }\n"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"    // if (existing) {\n    //   throw ratingDuplicated();\n    // }\n"))
PY
      run_unit mutR1-rating-precheck-removed-unit.txt; run_e2e mutR1-rating-precheck-removed-e2e.txt; mv "$SVC.mutbak" "$SVC" ;;
    R2) # 소유권(403) 검사 제거
      cp "$SVC" "$SVC.mutbak"
      python3 - "$SVC" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
old="    if (rating.member.memberId !== memberId) {\n      throw ratingForbidden();\n    }\n"
assert s.count(old)==1
open(p,'w',encoding='utf-8').write(s.replace(old,"    // (제거) 소유권 확인\n"))
PY
      run_unit mutR2-owner-check-removed-unit.txt; run_e2e mutR2-owner-check-removed-e2e.txt; mv "$SVC.mutbak" "$SVC" ;;
    R3) # POST /ratings 의 AuthGuard 제거
      cp "$CTL" "$CTL.mutbak"
      python3 - "$CTL" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
i=s.index("@Post('ratings')"); j=s.index("@UseGuards(AuthGuard)",i)
open(p,'w',encoding='utf-8').write(s[:j]+s[j+len("@UseGuards(AuthGuard)"):])
PY
      run_unit_all mutR3-post-ratings-guard-removed-unit.txt; run_e2e mutR3-post-ratings-guard-removed-e2e.txt; mv "$CTL.mutbak" "$CTL" ;;
    R4) # POST /ratings 가 201 대신 200 을 돌려줌
      cp "$CTL" "$CTL.mutbak"
      python3 - "$CTL" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
i=s.index("@Post('ratings')"); j=s.index("@HttpCode(HttpStatus.CREATED)",i)
open(p,'w',encoding='utf-8').write(s[:j]+"@HttpCode(HttpStatus.OK)"+s[j+len("@HttpCode(HttpStatus.CREATED)"):])
PY
      run_e2e mutR4-post-ratings-status-200-e2e.txt; mv "$CTL.mutbak" "$CTL" ;;
    *) echo "모르는 변이: $name" ;;
  esac
done
echo "== 원복 확인(남은 .mutbak 없어야 함)"; ls src/service src/controller | grep mutbak; git diff --stat -- "$SVC" | tail -1; echo "(service 변경 없음이 정상)"
