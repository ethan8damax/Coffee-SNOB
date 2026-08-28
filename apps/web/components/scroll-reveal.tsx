"use client";

import { useEffect } from "react";

const SELECTOR = "[data-reveal], [data-reveal-hair], .band-fade, .scale-chevrons";

export function ScrollReveal() {
  useEffect(() => {
    const targets = document.querySelectorAll(SELECTOR);
    if (targets.length === 0) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.35 }
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return null;
}
