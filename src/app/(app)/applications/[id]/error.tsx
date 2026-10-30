"use client";

import { ScreenError, type ErrorPageProps } from "@/components/screen-error";

export default function ApplicationError(props: ErrorPageProps) {
  return <ScreenError {...props} title="Diese Bewerbung konnte nicht geladen werden" elsewhere={{ href: "/applications", label: "Zurück zu den Bewerbungen" }} />;
}
