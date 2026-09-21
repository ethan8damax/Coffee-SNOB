import Svg, { Circle, Path } from "react-native-svg";

// The design's locate-me glyph (screens/map.jsx `LocateIcon`).
export function LocateIcon({ size = 15, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="square">
      <Circle cx={12} cy={12} r={3.2} />
      <Path d="M12 2.5v3.4M12 18.1v3.4M21.5 12h-3.4M5.9 12H2.5" />
    </Svg>
  );
}
