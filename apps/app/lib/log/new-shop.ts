// A shop someone adds by hand is logged as "user/<uuid>"; the monthly build
// links it to the coffee index once a source has it (Curation Phase 6).
export function newShopId(): string {
  const uuid =
    globalThis.crypto?.randomUUID?.() ??
    // ponytail: Math.random fallback where randomUUID is missing; collisions
    // are the same odds as any v4 uuid in practice.
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 3) | 8).toString(16);
    });
  return `user/${uuid}`;
}
