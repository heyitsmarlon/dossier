import { NextResponse } from "next/server";

import { heldPdf, pdfDownload } from "@/lib/pdf/downloads";
import { route } from "@/lib/route";

const GONE = "Dieses PDF ist nicht mehr da. Lade es erneut herunter.";

/** Hands over a PDF that `POST /api/pdf` rendered and held for a few minutes. */
export const GET = route<RouteContext<"/api/pdf/[id]">>(async (_request, { params }) => {
  const held = heldPdf((await params).id);
  return held ? pdfDownload(held.pdf, held.fileName) : NextResponse.json({ error: GONE }, { status: 404 });
});
