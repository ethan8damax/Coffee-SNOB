import { handleConfirm } from "@/lib/photos/handlers";
import { photoRoute } from "@/lib/photos/server";

// Checks the uploaded files and records the photo (photos Phase 1 spec, section 2).
export const { POST, OPTIONS } = photoRoute(handleConfirm);
