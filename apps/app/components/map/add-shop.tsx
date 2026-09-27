import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { ButtonOx, Label } from "../primitives";

// Pin mode for a café the map doesn't have yet: the map moves under a fixed
// pin, and the pin's spot is where the shop goes.
export function Crosshair() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
      {/* The pin's point sits on the exact centre. */}
      <View style={{ alignItems: "center", transform: [{ translateY: -17 }] }}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.oxblood, borderWidth: 3, borderColor: colors.card }} />
        <View style={{ width: 2, height: 12, backgroundColor: colors.oxblood }} />
      </View>
    </View>
  );
}

export function AddShopBar({ initialName, onCancel, onConfirm }: { initialName: string; onCancel: () => void; onConfirm: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  const ready = name.trim().length >= 2;
  return (
    <View style={{ backgroundColor: colors.paper, borderTopWidth: 2, borderTopColor: colors.ink, padding: 20, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Label style={{ color: colors.ink }}>Put the pin on the door</Label>
        <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel adding a shop" hitSlop={10}>
          <Label style={{ color: colors.ink3 }}>Cancel</Label>
        </Pressable>
      </View>
      <TextInput
        value={name}
        onChangeText={setName}
        maxLength={120}
        autoFocus={!initialName}
        placeholder="The name on the sign"
        placeholderTextColor={colors.ink3}
        accessibilityLabel="Shop name"
        returnKeyType="done"
        onSubmitEditing={() => ready && onConfirm(name.trim())}
        style={{
          height: 44,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: colors.rule,
          borderRadius: 2,
          backgroundColor: colors.card,
          fontFamily: "Area-Regular",
          fontSize: 14,
          color: colors.ink,
        }}
      />
      <ButtonOx
        title="Log it here"
        disabled={!ready}
        accessibilityRole="button"
        accessibilityState={{ disabled: !ready }}
        onPress={() => onConfirm(name.trim())}
        style={{ opacity: ready ? 1 : 0.4 }}
      />
      <Text style={{ fontFamily: "Area-Regular", fontSize: 11.5, color: colors.ink3 }}>
        {"Chains can't be added. Your first rating puts it on the map."}
      </Text>
    </View>
  );
}
