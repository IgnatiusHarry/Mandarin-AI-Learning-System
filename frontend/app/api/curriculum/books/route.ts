import { NextResponse } from "next/server";
import {
  booksFromCatalogJson,
  curriculumSupabase,
  listBooksDb,
  readBundledCatalog,
} from "@/lib/curriculum/load";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = curriculumSupabase();
  if (sb) {
    const r = await listBooksDb(sb);
    if (r.ok && r.rows.length > 0) {
      return NextResponse.json(r.rows);
    }
    /* missing tables or empty DB → try bundled JSON */
  }

  const file = await readBundledCatalog();
  if (file?.books?.length) {
    return NextResponse.json(booksFromCatalogJson(file));
  }

  return NextResponse.json([]);
}
