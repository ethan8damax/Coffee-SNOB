import { describe, it, expect } from "vitest";
import { colors } from "@coffeesnob/design-tokens";
import { escapeHtml, ratedPinHtml, nearbyDotHtml, userDotHtml } from "./pin-markup";

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("escapeHtml", () => {
  it("escapes the characters that could break out of markup", () => {
    expect(escapeHtml(`<img src=x onerror="a()"> & 'b'`)).toBe("&lt;img src=x onerror=&quot;a()&quot;&gt; &amp; &#39;b&#39;");
  });
});

describe("ratedPinHtml", () => {
  it("names a 5 and fills it oxblood with five solid chevrons", () => {
    const html = ratedPinHtml({ name: "Sey Coffee", rating: 5, selected: false, dimmed: false });
    expect(html).toContain("Sey Coffee");
    expect(html).toContain(colors.oxblood);
    expect(count(html, "<svg")).toBe(5);
    expect(count(html, 'stroke-opacity="1"')).toBe(5);
  });

  it("names a 4 and fills it burnt", () => {
    const html = ratedPinHtml({ name: "Abraço", rating: 4, selected: false, dimmed: false });
    expect(html).toContain("Abraço");
    expect(html).toContain(colors.burnt);
    expect(count(html, 'stroke-opacity="1"')).toBe(4);
  });

  it("keeps 1-3 quiet: chevrons only, no shop name", () => {
    const html = ratedPinHtml({ name: "Variety", rating: 3, selected: false, dimmed: false });
    expect(html).not.toContain("Variety");
    expect(count(html, "<svg")).toBe(5);
    expect(count(html, 'stroke-opacity="1"')).toBe(3);
    expect(count(html, 'stroke-opacity=".3"')).toBe(2);
  });

  it("escapes shop names", () => {
    const html = ratedPinHtml({ name: "<script>x</script>", rating: 5, selected: false, dimmed: false });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("draws a 2px ink border when selected", () => {
    expect(ratedPinHtml({ name: "A", rating: 4, selected: true, dimmed: false })).toContain(`2px solid ${colors.ink}`);
    expect(ratedPinHtml({ name: "A", rating: 4, selected: false, dimmed: false })).not.toContain(`2px solid ${colors.ink}`);
  });

  it("drops to 72% opacity when another pin is selected", () => {
    expect(ratedPinHtml({ name: "A", rating: 4, selected: false, dimmed: true })).toContain("opacity:.72");
    expect(ratedPinHtml({ name: "A", rating: 4, selected: false, dimmed: false })).toContain("opacity:1");
  });
});

describe("nearbyDotHtml", () => {
  it("is a small muted dot, and grows and darkens when selected", () => {
    const idle = nearbyDotHtml({ selected: false });
    expect(idle).toContain("width:7px");
    expect(idle).toContain(colors.card);
    const dim = nearbyDotHtml({ selected: false, dim: true });
    expect(dim).toContain("width:5px");
    expect(dim).toContain("opacity:.45");
    const on = nearbyDotHtml({ selected: true });
    expect(on).toContain("width:11px");
    expect(on).toContain(colors.ink);
  });
});

describe("userDotHtml", () => {
  it("is an oxblood dot with a paper ring", () => {
    const html = userDotHtml();
    expect(html).toContain(colors.oxblood);
    expect(html).toContain(colors.paper);
  });
});
