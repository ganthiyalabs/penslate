import { createAuth } from "@penslate/backend/convex/auth";
import { setupFetchClient } from "@convex-dev/better-auth/react-start";
import { getCookie } from "@tanstack/react-start/server";

export const fetchClient = await setupFetchClient(createAuth, getCookie);