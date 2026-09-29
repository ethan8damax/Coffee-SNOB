import { Text, TextInput, View } from "react-native";
import { Tap } from "@/components/tap";
import { colors } from "@coffeesnob/design-tokens";
import { Label } from "../primitives";
import { DAY_NAMES, closeTime, parseTime, type DayHours } from "../../lib/add-shop/form";

// A week of opening hours, one row a day: tap the day to open it, type
// times however you like ("7", "7:30am", "3pm"). The first open day can be
// copied to the rest.
export function HoursEditor({ value, onChange }: { value: DayHours[]; onChange: (week: DayHours[]) => void }) {
  const set = (i: number, patch: Partial<DayHours>) => onChange(value.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const first = value.findIndex((d) => d.open && d.from && d.to);
  const copyable = first >= 0 && value.some((d, j) => j !== first && (d.from !== value[first].from || d.to !== value[first].to || !d.open));

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.rule }}>
      {value.map((d, i) => {
        const from = parseTime(d.from);
        const bad = d.open && ((d.from !== "" && !from) || (d.to !== "" && !(from ? closeTime(from, d.to) : parseTime(d.to))));
        return (
          <View key={DAY_NAMES[i]} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}>
            <Tap
              onPress={() => set(i, { open: !d.open })}
              accessibilityRole="switch"
              accessibilityLabel={`${DAY_NAMES[i]}: ${d.open ? "open" : "closed"}`}
              accessibilityState={{ checked: d.open }}
              style={{ width: 92, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 2,
                  borderWidth: 1,
                  borderColor: d.open ? colors.ink : colors.rule,
                  backgroundColor: d.open ? colors.ink : "transparent",
                }}
              />
              <Label style={{ color: d.open ? colors.ink : colors.ink3 }}>{DAY_NAMES[i]}</Label>
            </Tap>
            {d.open ? (
              <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TimeInput value={d.from} onChange={(from) => set(i, { from })} label={`${DAY_NAMES[i]} opens`} placeholder="7am" bad={bad} />
                <Text style={{ fontFamily: "Area-Regular", fontSize: 14, color: colors.ink3 }}>to</Text>
                <TimeInput value={d.to} onChange={(to) => set(i, { to })} label={`${DAY_NAMES[i]} closes`} placeholder="3pm" bad={bad} />
              </View>
            ) : (
              <Text style={{ flex: 1, fontFamily: "Area-Regular", fontSize: 13.5, color: colors.ink3 }}>Closed</Text>
            )}
          </View>
        );
      })}
      {copyable ? (
        <Tap
          onPress={() => onChange(value.map(() => ({ ...value[first] })))}
          accessibilityRole="button"
          accessibilityLabel={`Use ${DAY_NAMES[first]}'s hours every day`}
          style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
        >
          <Label style={{ color: colors.oxblood }}>{`Same as ${DAY_NAMES[first]} every day`}</Label>
        </Tap>
      ) : null}
    </View>
  );
}

function TimeInput({ value, onChange, label, placeholder, bad }: { value: string; onChange: (v: string) => void; label: string; placeholder: string; bad: boolean }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      maxLength={8}
      placeholder={placeholder}
      placeholderTextColor={colors.ink3}
      accessibilityLabel={label}
      autoCapitalize="none"
      autoCorrect={false}
      style={{
        flex: 1,
        flexBasis: 0,
        minWidth: 0, // web inputs have an intrinsic width; let them shrink to the row
        height: 40,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: bad ? colors.oxblood : colors.rule,
        borderRadius: 2,
        backgroundColor: colors.card,
        fontFamily: "Area-Regular",
        fontSize: 16, // 16+ stops iOS zooming on focus
        color: colors.ink,
      }}
    />
  );
}
