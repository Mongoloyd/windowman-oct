import { handleMetaIntakeReplayRequest } from "./handler.ts";

Deno.serve((req) => handleMetaIntakeReplayRequest(req));
