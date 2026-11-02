#!/usr/bin/env bash
# sanitize-timezones.sh
# OPSEC: fail (or rewrite) committed timezone tokens in public docs.
#
# Usage:
#   bash scripts/sanitize-timezones.sh              # check-only (CI default)
#   bash scripts/sanitize-timezones.sh --fix       # rewrite then re-check
#   bash scripts/sanitize-timezones.sh --list-excludes
#
# Improvements:
#   - False-positive handling (ISO 8601 left alone, pure UTC ok, camelCase ids skipped)
#   - Prefer ISO 8601 (YYYY-MM-DD / ...Z) on rewrite
#   - Exclusion patterns via .timezone-sanitize-ignore + built-in path skips

set -euo pipefail

FIX=0
LIST_EXCLUDES=0
for arg in "$@"; do
  case "$arg" in
    --fix) FIX=1 ;;
    --list-excludes) LIST_EXCLUDES=1 ;;
  esac
done

# Named US zones + offsets. Pure UTC/GMT without offset is allowed.
TZ_BAD='\b(CST|CDT|EST|EDT|MST|MDT|PST|PDT)\b|\bUTC[+-][0-9]{1,2}\b|\bGMT[+-][0-9]{1,2}\b|\bCentral (Standard|Daylight) Time\b|\bEastern (Standard|Daylight) Time\b|\bMountain (Standard|Daylight) Time\b|\bPacific (Standard|Daylight) Time\b'

ISO_RE='[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}(:[0-9]{2})?(Z|[+-][0-9]{2}:?[0-9]{2})?)?'

BUILTIN_PRUNE=(
  './.git'
  './node_modules'
  './target'
  './dist'
  './build'
  './vendor'
  './.next'
  './coverage'
)

SKIP_BASENAMES="sanitize-timezones.sh timezone-sanitize.yml"
IGNORE_FILE=".timezone-sanitize-ignore"

is_excluded_path() {
  local path="$1"
  if [ -f "$IGNORE_FILE" ]; then
    while IFS= read -r pat || [ -n "$pat" ]; do
      case "$pat" in
        ''|\#*) continue ;;
      esac
      if echo "$path" | grep -Eq -- "$pat"; then
        return 0
      fi
    done < "$IGNORE_FILE"
  fi
  return 1
}

is_false_positive_line() {
  local line="$1"
  if echo "$line" | grep -Eqi -- "$ISO_RE"; then
    if ! echo "$line" | grep -Eqi -- '\b(CST|CDT|EST|EDT|MST|MDT|PST|PDT)\b|Central (Standard|Daylight) Time|Eastern (Standard|Daylight) Time|Mountain (Standard|Daylight) Time|Pacific (Standard|Daylight) Time'; then
      return 0
    fi
  fi
  if echo "$line" | grep -Eqi -- '[A-Za-z_](CST|CDT|EST|EDT|MST|MDT|PST|PDT)[A-Za-z0-9_]|[A-Za-z0-9_](CST|CDT|EST|EDT|MST|MDT|PST|PDT)[A-Za-z_]'; then
    return 0
  fi
  return 1
}

if [ "$LIST_EXCLUDES" -eq 1 ]; then
  echo "Built-in path prunes:"
  printf '  %s\n' "${BUILTIN_PRUNE[@]}"
  echo
  echo "Always-skipped basenames:"
  for b in $SKIP_BASENAMES; do echo "  $b"; done
  if [ -f "$IGNORE_FILE" ]; then
    echo
    echo "From $IGNORE_FILE:"
    grep -vE '^\s*(#|$)' "$IGNORE_FILE" | sed 's/^/  /' || true
  else
    echo
    echo "No $IGNORE_FILE present."
  fi
  exit 0
fi

PRUNE_ARGS=()
for p in "${BUILTIN_PRUNE[@]}"; do
  PRUNE_ARGS+=(-path "$p" -o)
done
unset 'PRUNE_ARGS[${#PRUNE_ARGS[@]}-1]'

FILES=$(find . \
  \( "${PRUNE_ARGS[@]}" \) -prune -o \
  -type f \( \
    -name '*.md' -o -name '*.txt' -o -name '*.html' -o -name '*.js' -o -name '*.ts' \
    -o -name '*.json' -o -name '*.yml' -o -name '*.yaml' -o -name '*.toml' \
    -o -name '*.rs' -o -name '*.ps1' -o -name '*.sh' \
    -o -name 'NOTES*' -o -name 'CHANGELOG*' -o -name 'HISTORY*' \
  \) -print 2>/dev/null || true)

FILTERED=""
for f in $FILES; do
  base=$(basename "$f")
  case " $SKIP_BASENAMES " in
    *" $base "*) continue ;;
  esac
  if is_excluded_path "$f"; then
    continue
  fi
  FILTERED="${FILTERED}${f}\n"
done
FILES="$FILTERED"

if [ -z "$(echo "$FILES" | tr -d '[:space:]')" ]; then
  echo "No candidate files found."
  exit 0
fi

FOUND=0
HITS=""

while IFS= read -r f; do
  [ -z "$f" ] && continue
  matches=$(grep -nEi -- "$TZ_BAD" "$f" 2>/dev/null || true)
  [ -z "$matches" ] && continue
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    content="${line#*:}"
    if is_false_positive_line "$content"; then
      continue
    fi
    FOUND=1
    HITS="${HITS}${f}:${line}\n"
  done <<EOF
$matches
EOF
done <<EOF
$FILES
EOF

if [ "$FOUND" -eq 0 ]; then
  echo "OK — no timezone tokens found in tracked public files."
  exit 0
fi

echo "Timezone tokens detected (OPSEC):"
printf '%s' "$HITS"
echo

if [ "$FIX" -eq 1 ]; then
  echo "Applying neutral / ISO-leaning rewrites..."
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    sed -i -E \
      -e 's/([[:space:]]*[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?[[:space:]]*([AaPp][Mm])?)[[:space:]]*(CST|CDT|EST|EDT|MST|MDT|PST|PDT)\b/\1/g' \
      -e 's/[[:space:]]*\b(CST|CDT|EST|EDT|MST|MDT|PST|PDT)\b//g' \
      -e 's/\bCentral (Standard|Daylight) Time\b//g' \
      -e 's/\bEastern (Standard|Daylight) Time\b//g' \
      -e 's/\bMountain (Standard|Daylight) Time\b//g' \
      -e 's/\bPacific (Standard|Daylight) Time\b//g' \
      -e 's/\bUTC[+-][0-9]{1,2}\b/Z/g' \
      -e 's/\bGMT[+-][0-9]{1,2}\b/Z/g' \
      -e 's/  +/ /g' \
      -e 's/ +\././g' \
      "$f" 2>/dev/null || true
  done <<EOF
$FILES
EOF
  echo "Re-checking after fix..."
  exec bash "$0"
fi

echo "CI failure: remove or neutralize the tokens above."
echo "Preferred form: ISO 8601 date (YYYY-MM-DD) or full UTC (...Z)."
echo "Local fix:  bash scripts/sanitize-timezones.sh --fix"
echo "Exclusions: add path regexes to .timezone-sanitize-ignore  (see --list-excludes)"
exit 1
