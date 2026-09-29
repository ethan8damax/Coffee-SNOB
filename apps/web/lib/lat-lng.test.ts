import { describe, expect, it } from "vitest";
import { metersBetween, parseLatLng } from "./lat-lng";

describe("parseLatLng", () => {
  it.each([
    ["27.96, -82.46", { lat: 27.96, lng: -82.46 }],
    ["27.96 -82.46", { lat: 27.96, lng: -82.46 }],
    ["https://www.google.com/maps/place/Lunar/@28.0482,-82.3929,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d28.04828!4d-82.39292", { lat: 28.04828, lng: -82.39292 }],
    ["https://www.google.com/maps/@27.9506,-82.4572,15z", { lat: 27.9506, lng: -82.4572 }],
    ["https://maps.apple.com/?ll=27.95,-82.45&q=Coffee", { lat: 27.95, lng: -82.45 }],
    ["https://www.openstreetmap.org/?mlat=27.95&mlon=-82.45#map=17/27.95/-82.45", { lat: 27.95, lng: -82.45 }],
    ["https://www.openstreetmap.org/#map=17/27.95/-82.45", { lat: 27.95, lng: -82.45 }],
  ])("%s", (input, out) => expect(parseLatLng(input)).toEqual(out));
  it.each(["", "Tampa", "95, 10", "27.96"])("%s → null", (input) => expect(parseLatLng(input)).toBeNull());
});

describe("metersBetween", () => {
  it("about 111 m per 0.001° of latitude", () => expect(Math.round(metersBetween({ lat: 28, lng: -82 }, { lat: 28.001, lng: -82 }))).toBe(111));
});
