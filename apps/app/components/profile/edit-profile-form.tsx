import { useState } from "react";
import { View, TextInput } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { updateProfile, type PublicProfile } from "@coffeesnob/supabase";
import { Body, ButtonLine, ButtonOx, Label } from "@/components/primitives";
import { useAuth } from "@/context/auth";
import { BIO_MAX, NAME_MAX, normalizeEdit, remaining } from "@/lib/profile/profile-helpers";

const input = {
  borderWidth: 1,
  borderColor: colors.rule,
  backgroundColor: colors.card,
  borderRadius: 2,
  paddingHorizontal: 12,
  paddingVertical: 10,
  minHeight: 44,
  fontFamily: "Area-Regular",
  fontSize: 14,
  color: colors.ink,
} as const;

// Lives on the Settings screen (was inline on the profile header) — saving
// updates the shared auth profile via refreshProfile, which is what the
// header (name/avatar) reads from; the profile screen's own copy catches up
// on next focus (see useProfile's `refresh`).
export function EditProfileForm({ profile, onDone }: { profile: PublicProfile; onDone: () => void }) {
  const { refreshProfile } = useAuth();
  const [name, setName] = useState(profile.displayName ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const parsed = normalizeEdit({ displayName: name, bio });

  async function save() {
    if (!parsed.ok || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      const { supabase } = require("@/lib/supabase");
      await updateProfile(supabase, profile.id, parsed.fields);
      await refreshProfile();
      onDone();
    } catch {
      setFailed(true);
      setSaving(false);
    }
  }

  const bioLeft = remaining(bio, BIO_MAX);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 6 }}>
        <Label>Display name</Label>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX}
          placeholder={profile.username}
          placeholderTextColor={colors.ink3}
          accessibilityLabel="Display name"
          style={input}
        />
      </View>
      <View style={{ gap: 6 }}>
        <Label>Bio</Label>
        <TextInput
          value={bio}
          onChangeText={setBio}
          multiline
          placeholder="What you drink, where you stand."
          placeholderTextColor={colors.ink3}
          accessibilityLabel="Bio"
          style={[input, { minHeight: 96, textAlignVertical: "top" }]}
        />
        <Label style={{ color: bioLeft < 0 ? colors.burnt : colors.ink3 }}>{bioLeft} characters left</Label>
      </View>
      {failed && <Body style={{ color: colors.burnt }}>Couldn't save that. Try again.</Body>}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <ButtonOx
          title={saving ? "Saving" : "Save"}
          onPress={save}
          disabled={!parsed.ok || saving}
          accessibilityRole="button"
          accessibilityLabel="Save profile"
          style={{ flex: 1, opacity: !parsed.ok || saving ? 0.5 : 1 }}
        />
        <ButtonLine title="Cancel" onPress={onDone} disabled={saving} accessibilityRole="button" accessibilityLabel="Cancel editing" style={{ flex: 1 }} />
      </View>
    </View>
  );
}
