import Link from "next/link";

import { ScreenMessage } from "@/components/screen-message";
import { buttonClassName } from "@/components/ui/button";

/** An application id that doesn't exist, e.g. one that was deleted (E11-4). */
export default function ApplicationNotFound() {
  return (
    <ScreenMessage
      title="Diese Bewerbung wurde nicht gefunden"
      actions={
        <Link href="/applications" className={buttonClassName("primary", "md", "hover:text-on-primary")}>
          Zurück zu den Bewerbungen
        </Link>
      }
    >
      <p>Sie wurde vielleicht gelöscht, oder der Link ist unvollständig. Deine anderen Bewerbungen sind alle noch da.</p>
    </ScreenMessage>
  );
}
