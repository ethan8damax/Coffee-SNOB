import Link from "next/link";
import { photoUrl, type ModerationPhoto, type PhotoReportReason, type ShopPhoto } from "@coffeesnob/supabase";
import { decidePhotoAction, pinPhotoAction } from "./actions";
import { Flash } from "./added-tab";

// Photos (photos Phase 3): reported and hidden photos in the Inbox, and each
// shop's photos in its editor, where a pin picks the header.

const PHOTOS_URL = process.env.NEXT_PUBLIC_PHOTOS_URL ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.coffeesnobproject.com";
const REASON_LABEL: Record<PhotoReportReason, string> = {
  wrong_shop: "Wrong shop",
  inappropriate: "Not okay",
  not_theirs: "Not theirs",
  other: "Other",
};
const thumb = { width: 88, height: 88, objectFit: "cover", borderRadius: 2, background: "var(--paper-2)", display: "block" } as const;

function Decide({ id, outcome, label, back, primary }: { id: string; outcome: "kept" | "removed"; label: string; back: string; primary?: boolean }) {
  return (
    <form action={decidePhotoAction}>
      <input type="hidden" name="photoId" value={id} />
      <input type="hidden" name="outcome" value={outcome} />
      <input type="hidden" name="back" value={back} />
      <button type="submit" className={`btn btn-sm ${primary ? "btn-ox" : "btn-line"}`}>{label}</button>
    </form>
  );
}

export function PhotosTab({ photos, flash }: { photos: ModerationPhoto[]; flash: { done?: string; error?: string } }) {
  const back = "/admin/shops?tab=inbox&box=photos";
  return (
    <section className="adm-section" aria-labelledby="photos-h">
      <h2 id="photos-h" className="d3">Photos</h2>
      <p className="body">
        Reported photos, and any that are hidden. Two reports hide a photo until you decide. Everyone who reported it hears what you did.
      </p>
      <Flash {...flash} />
      {photos.length === 0 ? (
        <div className="adm-empty">
          <p className="body">No reported photos. They show up here when someone taps &ldquo;Report photo&rdquo;.</p>
        </div>
      ) : (
        <table className="adm-table">
          <thead>
            <tr>
              <th scope="col">Photo</th>
              <th scope="col">Shop</th>
              <th scope="col">Reported</th>
              <th scope="col"><span className="visually-hidden">Decision</span></th>
            </tr>
          </thead>
          <tbody>
            {photos.map((p) => (
              <tr key={p.id}>
                <td>
                  <a href={photoUrl(PHOTOS_URL, p.thumbPath.replace(/_t\.(webp|jpg)$/, ".$1"))} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl(PHOTOS_URL, p.thumbPath)} alt={`Photo of ${p.shopName}`} style={thumb} />
                  </a>
                </td>
                <td>
                  <div className="adm-name"><a href={`${APP_URL}/shop/${p.shopId}`} target="_blank" rel="noopener">{p.shopName}</a></div>
                  <div className="adm-meta">{p.username ? `by @${p.username}` : "by a deleted account"}</div>
                </td>
                <td>
                  <span className={`chip ${p.status === "hidden" ? "ox" : ""}`} style={{ marginRight: 6, marginBottom: 4 }}>{p.status === "hidden" ? "Hidden" : "Live"}</span>
                  {(Object.keys(REASON_LABEL) as PhotoReportReason[])
                    .filter((r) => p.reasons[r])
                    .map((r) => (
                      <span key={r} className="chip" style={{ marginRight: 6, marginBottom: 4 }}>{REASON_LABEL[r]} {p.reasons[r]}</span>
                    ))}
                </td>
                <td>
                  <div className="adm-actions" style={{ flexWrap: "wrap" }}>
                    <Decide id={p.id} outcome="removed" label="Remove" back={back} primary />
                    <Decide id={p.id} outcome="kept" label={p.status === "hidden" ? "Restore" : "Keep"} back={back} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// In the shop editor. Pinning makes a photo the header; otherwise headers rotate daily.
export function ShopPhotosPanel({ shopId, pinnedId, photos }: { shopId: string; pinnedId: string | null; photos: ShopPhoto[] }) {
  const back = `/admin/shops?tab=shops&edit=${shopId}`;
  return (
    <section aria-labelledby="shop-photos-h" style={{ marginTop: 28 }}>
      <h3 id="shop-photos-h" className="d4">Photos</h3>
      <p className="body-sm" style={{ color: "var(--ink-2)", marginTop: 6 }}>
        {photos.length === 0
          ? "No photos yet. Log a visit with a photo in the app, then pin it here."
          : pinnedId
            ? "The pinned photo is the header. Unpin it to go back to a daily rotation."
            : "The header rotates daily. Pin one to keep it."}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {photos.map((p) => {
          const pinned = p.id === pinnedId;
          return (
            <li key={p.id} style={{ display: "grid", gap: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl(PHOTOS_URL, p.thumbPath)} alt={p.username ? `Photo by @${p.username}` : "Photo"} style={{ ...thumb, width: "100%", height: 120, outline: pinned ? "3px solid var(--burnt)" : undefined }} />
              <span className="adm-meta">{pinned ? "Pinned · " : ""}{p.username ? `@${p.username}` : ""}</span>
              <div className="adm-actions" style={{ flexWrap: "wrap" }}>
                <form action={pinPhotoAction}>
                  <input type="hidden" name="shopId" value={shopId} />
                  <input type="hidden" name="photoId" value={pinned ? "" : p.id} />
                  <button type="submit" className={`btn btn-sm ${pinned ? "btn-line" : "btn-ox"}`}>{pinned ? "Unpin" : "Pin"}</button>
                </form>
                <Decide id={p.id} outcome="removed" label="Remove" back={back} />
              </div>
            </li>
          );
        })}
      </ul>
      {photos.length > 0 ? null : <Link href="/admin/shops?tab=inbox&box=photos" className="label" style={{ display: "inline-block", marginTop: 10 }}>Reported photos</Link>}
    </section>
  );
}
