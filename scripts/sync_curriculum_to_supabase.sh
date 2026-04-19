#!/usr/bin/env bash
# Apply curriculum DDL + seed catalog into Supabase (requires DB password once).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/backend/.env" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT/backend/.env"
  set +a
fi

REF="$(python3 -c "import os; from urllib.parse import urlparse; u=os.environ.get('SUPABASE_URL',''); h=urlparse(u).hostname or ''; print(h.replace('.supabase.co',''))")"
SQL_FILE="$ROOT/sql/migrations/20260416_curriculum_catalog.sql"
CATALOG="$ROOT/data/curriculum/catalog_from_pdfs.json"

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "Add to backend/.env:"
  echo "  SUPABASE_DB_PASSWORD=<from Supabase Dashboard → Settings → Database → Database password>"
  echo "Then run: $0"
  exit 1
fi

if [[ -z "$REF" ]]; then
  echo "Could not parse project ref from SUPABASE_URL"
  exit 1
fi

echo "Linking project $REF …"
supabase link --project-ref "$REF" -p "$SUPABASE_DB_PASSWORD" --yes

echo "Applying curriculum SQL …"
supabase db query -f "$SQL_FILE" --linked --yes

echo "Seeding catalog JSON …"
python3 "$ROOT/scripts/seed_curriculum_catalog.py" --file "$CATALOG"

echo "Done."
