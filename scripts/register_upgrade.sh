#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: scripts/register_upgrade.sh \"upgrade title\""
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TITLE="$*"
DATE_STR="$(date +%Y-%m-%d)"
TIME_STR="$(date +%H%M%S)"
SLUG="$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
FILE_NAME="${DATE_STR}-${TIME_STR}-${SLUG}.md"
UPGRADE_DIR="$ROOT_DIR/docs/upgrades"
TARGET_FILE="$UPGRADE_DIR/$FILE_NAME"
INDEX_FILE="$UPGRADE_DIR/INDEX.md"

mkdir -p "$UPGRADE_DIR"

cat > "$TARGET_FILE" <<EOF
# Upgrade: $TITLE

- Date: $DATE_STR
- Owner: TBD
- Status: proposed

## Background

## Scope

## Affected Areas
- Frontend:
- Backend:
- Database:
- Telegram bot:
- AI flow:

## Implementation Plan
1.
2.
3.

## Verification
- Local checks:
- Production checks:

## Rollback Plan

## PLAN.md Updates
- Sections changed:
EOF

if [[ -f "$INDEX_FILE" ]]; then
  awk -v entry="- $DATE_STR | proposed | [$TITLE](./$FILE_NAME)" '
    BEGIN { inserted=0 }
    {
      print $0
      if (!inserted && $0 ~ /^## Entries$/) {
        print entry
        inserted=1
      }
    }
    END {
      if (!inserted) {
        print "## Entries"
        print entry
      }
    }
  ' "$INDEX_FILE" > "$INDEX_FILE.tmp"
  mv "$INDEX_FILE.tmp" "$INDEX_FILE"
else
  cat > "$INDEX_FILE" <<EOF
# Upgrade Index

## Entries
- $DATE_STR | proposed | [$TITLE](./$FILE_NAME)
EOF
fi

echo "Created: $TARGET_FILE"
echo "Updated: $INDEX_FILE"
echo "Next: update PLAN.md if scope/concept changes."
