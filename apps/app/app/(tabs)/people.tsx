import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import { getFollowList, searchProfiles, type PersonRow } from "@coffeesnob/supabase";
import { Avatar, Body, ButtonLine, IconBack, Label } from "@/components/primitives";
import { displayNameFor } from "@/lib/profile/profile-helpers";
import { parsePeopleTab, type PeopleTab } from "@/lib/people";

const TABS: { key: PeopleTab; label: string }[] = [
  { key: "followers", label: "Followers" },
  { key: "following", label: "Following" },
  { key: "find", label: "Find" },
];

// ponytail: one screen for followers / following / username search; fetch-on-change glue, not unit tested.
function useRows(tab: PeopleTab, id: string | undefined, query: string) {
  const [rows, setRows] = useState<PersonRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [key, setKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    if (tab === "find" ? query.trim().length < 2 : !id) {
      setRows([]);
      return;
    }
    setRows(null);
    // Debounce the search; the follow lists load straight away.
    const t = setTimeout(
      () => {
        const { supabase } = require("@/lib/supabase");
        (tab === "find" ? searchProfiles(supabase, query) : getFollowList(supabase, id!, tab)).then(
          (r) => !cancelled && setRows(r),
          () => !cancelled && setFailed(true)
        );
      },
      tab === "find" ? 300 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [tab, id, query, key]);
  return { rows, failed, retry: () => setKey((k) => k + 1) };
}

export default function PeopleScreen() {
  const params = useLocalSearchParams<{ id?: string; u?: string; tab?: string }>();
  const [tab, setTab] = useState<PeopleTab>(parsePeopleTab(params.tab));
  const [query, setQuery] = useState("");
  const { rows, failed, retry } = useRows(tab, params.id, query);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/profile"));
  const empty = tab === "find" ? (query.trim().length < 2 ? "Type at least two letters of a username." : "No one by that name.") : tab === "followers" ? "No followers yet." : "Not following anyone yet.";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ alignItems: "center", paddingBottom: 40 }}>
      <View style={{ width: "100%", maxWidth: 640 }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, marginLeft: -12, alignItems: "center", justifyContent: "center" }}>
            <IconBack />
          </Pressable>
          <Label accessibilityRole="header" style={{ color: colors.ink2 }}>
            {params.u ? `@${params.u}` : "People"}
          </Label>
        </View>

        <View accessibilityRole="tablist" style={{ marginTop: 14, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.rule }}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === t.key }}
              style={{ paddingHorizontal: 16, paddingVertical: 12, minHeight: 44, borderBottomWidth: 2, borderBottomColor: tab === t.key ? colors.ink : "transparent", marginBottom: -1 }}
            >
              <Label style={{ color: tab === t.key ? colors.ink : colors.ink3 }}>{t.label}</Label>
            </Pressable>
          ))}
        </View>

        {tab === "find" && (
          <View style={{ padding: 16 }}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Search by username"
              placeholderTextColor={colors.ink3}
              accessibilityLabel="Search by username"
              style={{ borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.card, borderRadius: 2, paddingHorizontal: 12, minHeight: 44, fontFamily: "Area-Regular", fontSize: 14, color: colors.ink }}
            />
          </View>
        )}

        {failed ? (
          <View style={{ alignItems: "center", padding: 32, gap: 16 }}>
            <Body style={{ color: colors.ink3 }}>Couldn't load that.</Body>
            <ButtonLine title="Try again" onPress={retry} accessibilityRole="button" accessibilityLabel="Try again" />
          </View>
        ) : rows === null ? (
          <ActivityIndicator color={colors.oxblood} style={{ padding: 32 }} />
        ) : rows.length === 0 ? (
          <Body style={{ color: colors.ink3, textAlign: "center", padding: 32 }}>{empty}</Body>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>
            {rows.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/u/${p.username}`)}
                accessibilityRole="link"
                accessibilityLabel={`${displayNameFor(p)}, @${p.username}`}
                style={{ minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}
              >
                <Avatar name={displayNameFor(p)} size={36} />
                <View style={{ flexShrink: 1 }}>
                  <Body numberOfLines={1} style={{ fontFamily: "Area-Bold", color: colors.ink }}>{displayNameFor(p)}</Body>
                  <Label numberOfLines={1}>@{p.username}</Label>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
