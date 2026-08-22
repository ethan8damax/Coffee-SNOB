import { Text, View, Pressable, StyleSheet, type TextProps, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@coffeesnob/design-tokens";

const SCRIPT_PATHS = [
  "M225.65,137.69c-18.03,0-37.26,23.32-43.75,49.06-.1.4-.32.75-.63,1.01-.45.39-.92,1.02-1.52,1.97-11.81,23.28-17.79,29.76-21.78,29.59-3.66-.16-3.33-4.49-.33-11.97,10.31-25.11,21.28-47.22,21.28-59.19,0-6.32-3.33-10.31-9.64-10.31-8.98,0-19.62,8.81-35.08,35.75-1,1.83-2.16,2.33-2.83,2.33s-1.33-.66-.33-3.16l5.32-13.63c2.33-5.99,3.99-9.81,3.99-13.3.17-4.16-1.16-7.65-7.65-7.81-9.41-.31-20.39,17.69-29.23,35.7-.74,1.51-2.92,1.52-3.65,0-3.6-7.54-9.25-14.32-15.03-19.9-8.81-8.81-17.79-19.95-17.79-31.09s10.97-27.93,27.1-27.93c21.11,0,24.44,7.65,18.95,38.74-.17,1.5.17,2.33,1,2.33s1.5-1,2-2.49c1.66-6.32,4.16-24.44,8.65-38.9.33-1.33,0-2-.83-2-1.5,0-4.49.83-7.81.83-5.82,0-9.81-1.5-19.62-1.5-21.61,0-38.41,18.12-38.41,36.41,0,12.64,9.14,24.94,18.62,34.08,9.14,8.81,17.79,20.95,17.79,32.92,0,15.63-12.14,31.92-30.76,31.92s-23.77-8.15-23.77-27.27c0-4.49.33-9.64.66-15.63.17-1-.5-1.33-1.16-1.33s-1.33.5-1.66,1.33c-2,7.65-2.16,30.09-6.15,43.23-.67,1.5-.17,2,.66,2,1.66,0,4.66-.83,8.81-.83,4.82,0,11.97,1.5,18.45,1.5,25.77,0,44.22-17.46,44.22-40.4,0-2.77-.38-5.48-1.04-8.13-.17-.68.05-1.37.52-1.89.38-.42.76-1.05,1.22-1.95,11.3-23.44,18.45-30.09,22.45-29.93,3.66,0,3.49,4.49.66,11.97l-19.29,55.03c-3.82,11.31-1.66,14.8,3.16,14.8,3.99,0,7.48-2,8.48-5.32,1-3.49-1.16-9.48,2.99-22.28,11.97-34.75,32.75-56.53,41.73-56.53,2.66,0,3.99,2,3.99,6.15,0,8.65-11.31,32.42-20.62,55.86-2.16,5.98-3.33,10.14-3.49,13.47-.16,4.16.83,7.81,7.48,8.15,7.74.38,16.05-11.62,23.77-25.75,1.02-1.87,3.85-1.15,3.85.97h0c0,15.46,6.98,25.27,19.29,25.27,22.28,0,46.39-34.58,46.39-66.01,0-15.46-7.32-25.94-19.62-25.94ZM201.87,225.15c-8.81,0-11.97-8.65-11.97-20.12,0-27.93,17.62-62.85,32.75-62.85,8.81,0,12.14,9.14,12.14,20.62,0,28.1-17.79,62.35-32.92,62.35Z",
  "M292.99,137.86c-10.31,0-22.11,16.79-31.92,34.75-1.16,2-1.83,2.33-2.66,2.33s-1.16-1-.5-2.83l12.64-32.75c4.49-11.8,11.14-31.42,17.29-47.05.83-2.16.83-2.83-.83-2.83-1.83,0-3.82,1.33-6.32,2.49-4.99,2.83-17.12,3.49-21.28,3.49-1.83,0-2.83.33-2.83,1.5,0,1,.83,1.16,2.16,1.16,2.33,0,4.32-.17,7.98-.17,7.32,0,6.48,4.32,4.16,11.31l-31.59,94.6c-3.82,11.14-7.81,16.96-7.81,19.12,0,2.83,15.63,6.65,25.44,6.65,28.43,0,48.05-42.9,48.05-71.82,0-11.64-3.33-19.95-11.97-19.95ZM257.91,226.14c-7.15,0-14.3-5.32-12.3-10.97l7.32-20.78c6.65-19.62,24.61-47.72,35.75-47.72,4.82,0,6.32,4.82,6.32,13.3,0,25.77-15.3,66.17-37.08,66.17Z",
];

export function ScriptLogo({ height = 26, color = colors.teal }: { height?: number; color?: string }) {
  const width = height * (288 / 178);
  return (
    <Svg height={height} width={width} viewBox="22 82 288 178" fill={color}>
      {SCRIPT_PATHS.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}

export function IconBack({ size = 21, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="square">
      <Path d="M14.5 4.5 7 12l7.5 7.5" />
    </Svg>
  );
}

export function IconCheck({ size = 17, color = colors.ink }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="square">
      <Path d="M4.5 12.5 9.5 17.5 19.5 7" />
    </Svg>
  );
}

export function Avatar({
  name = "AB",
  size = 28,
  bg = colors.sageDk,
  fg = colors.paper,
}: {
  name?: string;
  size?: number;
  bg?: string;
  fg?: string;
}) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={{ color: fg, fontFamily: "AreaExtended-Black", fontSize: size * 0.34 }}>{initials}</Text>
    </View>
  );
}

export function Eyebrow({ children, color = colors.ink3 }: { children: string; color?: string }) {
  return (
    <View style={styles.eyebrowRow}>
      <Text style={[styles.label, { color }]}>{children}</Text>
      <View style={styles.eyebrowRule} />
    </View>
  );
}

export function D1(props: TextProps) {
  return <Text {...props} style={[styles.d1, props.style]} />;
}
export function D2(props: TextProps) {
  return <Text {...props} style={[styles.d2, props.style]} />;
}
export function D4(props: TextProps) {
  return <Text {...props} style={[styles.d4, props.style]} />;
}
export function Body(props: TextProps) {
  return <Text {...props} style={[styles.body, props.style]} />;
}
export function BodySm(props: TextProps) {
  return <Text {...props} style={[styles.bodySm, props.style]} />;
}
export function Label(props: TextProps) {
  return <Text {...props} style={[styles.label, props.style]} />;
}

export function ButtonOx({
  title,
  style,
  ...rest
}: { title: string; style?: StyleProp<ViewStyle> } & Omit<PressableProps, "style">) {
  return (
    <Pressable {...rest} style={[styles.btn, styles.btnOx, style]}>
      <Text style={styles.btnOxText}>{title}</Text>
    </Pressable>
  );
}

export function ButtonLine({
  title,
  style,
  ...rest
}: { title: string; style?: StyleProp<ViewStyle> } & Omit<PressableProps, "style">) {
  return (
    <Pressable {...rest} style={[styles.btn, styles.btnLine, style]}>
      <Text style={styles.btnLineText}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  eyebrowRule: { flex: 1, height: 1, backgroundColor: colors.rule },
  d1: { fontFamily: "Area-Bold", fontSize: 40, lineHeight: 37, letterSpacing: -1.4, color: colors.ink },
  d2: { fontFamily: "Area-Bold", fontSize: 30, lineHeight: 28, letterSpacing: -0.96, color: colors.ink },
  d4: { fontFamily: "Area-Bold", fontSize: 17, lineHeight: 18, letterSpacing: -0.4, color: colors.ink },
  body: { fontFamily: "Area-Regular", fontSize: 13.5, lineHeight: 19.6, color: colors.ink },
  bodySm: { fontFamily: "Area-Regular", fontSize: 12, lineHeight: 16.8, color: colors.ink3 },
  label: {
    fontFamily: "AreaExtended-Bold",
    fontSize: 8.5,
    letterSpacing: 1.19,
    textTransform: "uppercase",
    color: colors.ink3,
  },
  btn: { height: 46, borderRadius: 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  btnOx: { backgroundColor: colors.oxblood },
  btnOxText: {
    fontFamily: "AreaExtended-Black",
    fontSize: 10.5,
    letterSpacing: 1.05,
    textTransform: "uppercase",
    color: colors.cream,
  },
  btnLine: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.ink },
  btnLineText: {
    fontFamily: "AreaExtended-Black",
    fontSize: 10.5,
    letterSpacing: 1.05,
    textTransform: "uppercase",
    color: colors.ink,
  },
});
