"use client";

import { ScreenError, type ErrorPageProps } from "@/components/screen-error";

/** When a screen in the app fails to load (E11-4); the sidebar stays. */
export default function AppError(props: ErrorPageProps) {
  return <ScreenError {...props} title="Diese Seite konnte nicht geladen werden" elsewhere={{ href: "/applications", label: "Zu deinen Bewerbungen" }} />;
}
