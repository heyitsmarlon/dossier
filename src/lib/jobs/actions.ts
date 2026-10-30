"use server";

import { z } from "zod";

import { action, ActionError } from "@/lib/action";

import { cancelJob, retryJob } from "./runner";

/** Runs a failed job again (E6-7): same job, same input, so nothing is duplicated. */
export const retry = action(z.object({ id: z.string().min(1) }), async ({ id }) => {
  if (!(await retryJob(id))) throw new ActionError("Das lässt sich nicht wiederholen: Es läuft noch oder ist schon fertig.");
  return null;
});

/** Stops a queued or running job. */
export const cancel = action(z.object({ id: z.string().min(1) }), async ({ id }) => {
  await cancelJob(id);
  return null;
});
