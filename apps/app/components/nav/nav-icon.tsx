import Svg, { Circle, Path } from "react-native-svg";
import type { NavItem } from "@/lib/nav";

export function NavIcon({ name, size = 20, color }: { name: NavItem["icon"]; size?: number; color: string }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeLinecap: "square" as const };
  switch (name) {
    case "home":
      return (
        <Svg {...common} strokeWidth={1.8}>
          <Path d="M3.5 10.5 12 3.5l8.5 7" />
          <Path d="M5.5 10v10h13V10" />
        </Svg>
      );
    case "map":
      return (
        <Svg {...common} strokeWidth={1.8}>
          <Path d="M9 3.5 3.5 5.5v15L9 18.5l6 2 5.5-2v-15l-5.5 2-6-2z" />
          <Path d="M9 3.5v15M15 5.5v15" />
        </Svg>
      );
    case "plus":
      return (
        <Svg {...common} strokeWidth={2.1}>
          <Path d="M12 4.5v15M4.5 12h15" />
        </Svg>
      );
    case "user":
      return (
        <Svg {...common} strokeWidth={1.8}>
          <Circle cx={12} cy={8} r={4} />
          <Path d="M4.5 20.5c1.5-3.6 4.2-5.5 7.5-5.5s6 1.9 7.5 5.5" />
        </Svg>
      );
  }
}
