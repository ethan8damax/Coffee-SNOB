import Svg, { Circle, Path } from "react-native-svg";

// Glyphs copied from the design's Icon set (screens/_primitives.jsx).
type IconProps = { size?: number; color: string };

function base(size: number, color: string, strokeWidth: number) {
  return { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth, strokeLinecap: "square" as const };
}

export function PinIcon({ size = 15, color }: IconProps) {
  return (
    <Svg {...base(size, color, 1.7)}>
      <Path d="M12 21s6.5-7 6.5-12A6.5 6.5 0 0 0 5.5 9c0 5 6.5 12 6.5 12z" />
      <Circle cx={12} cy={9} r={2.2} />
    </Svg>
  );
}

export function ArrowIcon({ size = 15, color }: IconProps) {
  return (
    <Svg {...base(size, color, 2)}>
      <Path d="M5 19 19 5M9 5h10v10" />
    </Svg>
  );
}

export function PlusIcon({ size = 15, color }: IconProps) {
  return (
    <Svg {...base(size, color, 2.1)}>
      <Path d="M12 4.5v15M4.5 12h15" />
    </Svg>
  );
}

export function MinusIcon({ size = 15, color }: IconProps) {
  return (
    <Svg {...base(size, color, 2.1)}>
      <Path d="M4.5 12h15" />
    </Svg>
  );
}

export function CloseIcon({ size = 14, color }: IconProps) {
  return (
    <Svg {...base(size, color, 2.2)}>
      <Path d="M5 5l14 14M19 5 5 19" />
    </Svg>
  );
}

export function RefreshIcon({ size = 15, color }: IconProps) {
  return (
    <Svg {...base(size, color, 1.9)}>
      <Path d="M19 5v5h-5M5 19v-5h5" />
      <Path d="M6.35 8.35A7 7 0 0 1 19 10M17.65 15.65A7 7 0 0 1 5 14" />
    </Svg>
  );
}

export function ChevronIcon({ size = 12, color, direction = "left" }: IconProps & { direction?: "left" | "right" }) {
  const d = direction === "left" ? "M15 5 9 12l6 7" : "M9 5l6 7-6 7";
  return (
    <Svg {...base(size, color, 2.1)}>
      <Path d={d} />
    </Svg>
  );
}
