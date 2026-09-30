import { handleSign } from "@/lib/photos/handlers";
import { photoRoute } from "@/lib/photos/server";

// Two presigned R2 upload URLs for a log's photo (photos Phase 1 spec, section 2).
export const { POST, OPTIONS } = photoRoute(handleSign);
