#!/bin/bash
# BE 9주차 변이(일부러 깨뜨리기) 실험. 파일을 바꾸고 → 테스트 실행 → 반드시 원복한다.
# 사용: be_mutations.sh <이름> ...   (MA | MB | MC)
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/evidence/week09-tests"
mkdir -p "$OUT"
cd "$ROOT" || exit 1

FAV=src/service/favorite.service.ts
REC=src/service/movie-record.service.ts
FIL=src/filter/all-exceptions.filter.ts

backup() { for f in "$@"; do cp "$f" "$f.mutbak"; done; }
restore() { for f in "$@"; do [ -f "$f.mutbak" ] && mv "$f.mutbak" "$f"; done; }

mutate_precheck() {
  python3 - "$FAV" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
old = "    if (existing) {\n      throw favoriteDuplicated();\n    }\n"
new = "    // if (existing) {\n    //   throw favoriteDuplicated();\n    // }\n"
assert s.count(old) == 1, 'precheck block not found exactly once'
open(p, 'w', encoding='utf-8').write(s.replace(old, new))
PY
}
mutate_transaction() {
  python3 - "$REC" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
a = "return this.dataSource.transaction(async (manager) => {"
b = "      );\n    });\n  }\n}\n"
assert s.count(a) == 1 and s.rstrip().endswith("    });\n  }\n}"), 'transaction wrapper not found'
s = s.replace(a, "return (async (manager) => {")
idx = s.rstrip().rfind("    });\n  }\n}")
s = s[:idx] + "    })(this.dataSource.manager);\n  }\n}\n"
open(p, 'w', encoding='utf-8').write(s)
PY
}
mutate_filter() {
  python3 - "$FIL" <<'PY'
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
old = "  if (key.endsWith('uk_favorite_member_movie')) return favoriteDuplicated();\n"
assert s.count(old) == 1, 'filter line not found exactly once'
open(p, 'w', encoding='utf-8').write(s.replace(old, "  // (제거) uk_favorite_member_movie → FAVORITE409_1 변환\n"))
PY
}

run_unit() {  # $1 = 출력 파일 이름
  NO_COLOR=1 npx vitest run src/service/favorite.service.spec.ts src/service/movie-record.service.spec.ts > "$OUT/$1" 2>&1
  echo "  단위 종료코드 $?  → $1"
}
run_e2e() {
  NO_COLOR=1 npx vitest run --config ./vitest.config.e2e.ts test/favorites.e2e-spec.ts test/movie-records.e2e-spec.ts > "$OUT/$1" 2>&1
  echo "  e2e 종료코드 $?  → $1"
}

for name in "$@"; do
  echo "== $name"
  case "$name" in
    MA) backup "$FAV"; mutate_precheck;  run_unit mutA-precheck-removed-unit.txt;  run_e2e mutA-precheck-removed-e2e.txt;  restore "$FAV" ;;
    MB) backup "$REC"; mutate_transaction; run_unit mutB-transaction-removed-unit.txt; run_e2e mutB-transaction-removed-e2e.txt; restore "$REC" ;;
    MC) backup "$FAV" "$FIL"; mutate_precheck; mutate_filter; run_unit mutC-precheck-and-unique-conversion-removed-unit.txt; run_e2e mutC-precheck-and-unique-conversion-removed-e2e.txt; restore "$FAV" "$FIL" ;;
    *) echo "모르는 변이: $name" ;;
  esac
done
echo "== 원복 확인"
git status --short
git diff --stat | tail -1
