import { config } from "./config";
import type { MergedPlace } from "./place";

// How loudly an unrated place shows (parent spec 5.1). Never hides: hiding is
// for filters, overrides and flags. `why` stays empty for dim places:
// nothing worth explaining.
// roaster: "serves X" / "X's own café" lines from matchRoasters, worth the
// roaster points once however many roasters vouch.
export function scorePlace(p: MergedPlace, notSpecialty = 0, roaster: string[] = []): { visibility: "show" | "dim"; why: string[] } {
  const v = config.visibility;
  const why: string[] = [...roaster];
  // Each person who reported it "not specialty" costs a point, up to the cap.
  let points = (roaster.length ? v.roaster : 0) - Math.min(notSpecialty, v.notSpecialtyCap);
  if (p.datasets.length >= v.multiSourceMin) {
    points += v.multiSource;
    why.push(`in ${p.datasets.length} sources`);
  }
  if (p.category && config.coffeeShopCategories.includes(p.category)) {
    points += v.coffeeShopCategory;
    why.push("listed as a coffee shop");
  }
  if (p.hours || p.website) {
    points += v.hoursOrWebsite;
    why.push("has hours or a website");
  }
  return points >= v.showAt ? { visibility: "show", why } : { visibility: "dim", why: [] };
}
