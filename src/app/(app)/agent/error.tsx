"use client";

import { ScreenError, type ErrorPageProps } from "@/components/screen-error";

export default function AgentError(props: ErrorPageProps) {
  return <ScreenError {...props} title="Der Job-Agent konnte nicht geladen werden" />;
}
