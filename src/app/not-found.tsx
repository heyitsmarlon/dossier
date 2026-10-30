import Link from "next/link";

import { ScreenMessage } from "@/components/screen-message";
import { buttonClassName } from "@/components/ui/button";

/** Addresses that don't match any page (E11-4). */
export default function NotFound() {
  return (
    <main className="flex min-h-screen justify-center">
      <ScreenMessage
        standalone
        title="Diese Seite gibt es nicht"
        actions={
          <Link href="/" className={buttonClassName("primary", "md", "hover:text-on-primary")}>
            Zur Übersicht
          </Link>
        }
      >
        <p>Der Link ist vielleicht veraltet oder vertippt. Alles Gespeicherte ist, wo du es gelassen hast.</p>
      </ScreenMessage>
    </main>
  );
}
