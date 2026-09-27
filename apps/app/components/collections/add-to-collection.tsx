import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, TextInput, View, useWindowDimensions } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import {
  addToCollection,
  createCollection,
  ensureShop,
  findShopId,
  getCollectionsWithShop,
  getUserCollections,
  removeFromCollection,
  type CollectionSummary,
  type PlaceRef,
} from "@coffeesnob/supabase";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { isDesktopWidth } from "@/lib/nav";
import { Body, BodySm, ButtonLine, ButtonOx, D4, IconCheck, Label } from "../primitives";

// What's being collected: a shop with a record, or a map café that may not
// have one yet (created, unrated, the first time it's added).
export type CollectTarget = { shopId: string; name: string } | { place: PlaceRef; name: string };

const input = {
  height: 44,
  paddingHorizontal: 12,
  borderWidth: 1,
  borderColor: colors.rule,
  borderRadius: 2,
  backgroundColor: colors.card,
  fontFamily: "Area-Regular",
  fontSize: 14,
  color: colors.ink,
} as const;

// Google-Maps-style "save to list" sheet. With no target it's just the
// New collection form (the profile's button), and reports the new id.
export function AddToCollection({ target, onClose, onCreated }: { target?: CollectTarget; onClose: () => void; onCreated?: (id: string) => void }) {
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const { width } = useWindowDimensions();
  const desktop = isDesktopWidth(width);
  const [lists, setLists] = useState<CollectionSummary[] | null>(null);
  const [holding, setHolding] = useState<Set<string>>(new Set());
  const [shopId, setShopId] = useState<string | null>(target && "shopId" in target ? target.shopId : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(!target);
  const [title, setTitle] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (!me || !target) return;
    let cancelled = false;
    (async () => {
      const known = "shopId" in target ? target.shopId : await findShopId(supabase, target.place);
      const [mine, inThem] = await Promise.all([getUserCollections(supabase, me), known ? getCollectionsWithShop(supabase, me, known) : Promise.resolve([])]);
      if (cancelled) return;
      setShopId(known);
      setLists(mine);
      setHolding(new Set(inThem));
      if (!mine.length) setCreating(true);
    })().catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
    // The target is fixed for the sheet's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // The shop row, made on first use for a café nobody has logged.
  const resolveShop = async () => {
    if (shopId) return shopId;
    if (!target || "shopId" in target) throw new Error("no shop");
    const id = await ensureShop(supabase, target.place);
    setShopId(id);
    return id;
  };

  const toggle = async (listId: string) => {
    setBusy(listId);
    setFailed(false);
    const had = holding.has(listId);
    try {
      const id = await resolveShop();
      if (had) await removeFromCollection(supabase, listId, id);
      else await addToCollection(supabase, listId, id);
      setHolding((h) => {
        const next = new Set(h);
        if (had) next.delete(listId);
        else next.add(listId);
        return next;
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!me || !title.trim()) return;
    setBusy("new");
    setFailed(false);
    try {
      const id = await createCollection(supabase, me, { title, isPublic });
      if (target) {
        await addToCollection(supabase, id, await resolveShop());
        setLists((l) => [{ id, title: title.trim(), description: null, isPublic, saveCount: 0, ownerId: me, shopCount: 1, createdAt: new Date().toISOString() }, ...(l ?? [])]);
        setHolding((h) => new Set(h).add(id));
        setCreating(false);
        setTitle("");
      } else {
        onCreated?.(id);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Close"
        style={{ flex: 1, backgroundColor: "rgba(26,20,16,0.45)", justifyContent: desktop ? "center" : "flex-end", alignItems: "center" }}
      >
        <Pressable
          onPress={() => {}}
          accessible={false}
          style={{
            width: desktop ? 420 : "100%",
            maxHeight: "80%",
            backgroundColor: colors.paper,
            borderTopWidth: 2,
            borderTopColor: colors.ink,
            borderWidth: desktop ? 2 : 0,
            borderColor: colors.ink,
            borderRadius: 2,
            padding: 20,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <D4 accessibilityRole="header">{target ? "Add to a collection" : "New collection"}</D4>
              {target ? <Label numberOfLines={1} style={{ marginTop: 4 }}>{target.name}</Label> : null}
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Done" hitSlop={10}>
              <Label style={{ color: colors.ink }}>Done</Label>
            </Pressable>
          </View>

          {target && !lists && !failed ? <ActivityIndicator color={colors.oxblood} style={{ padding: 16 }} /> : null}

          {target && lists?.length ? (
            <ScrollView style={{ maxHeight: 300, borderTopWidth: 1, borderTopColor: colors.rule }}>
              {lists.map((l) => {
                const on = holding.has(l.id);
                return (
                  <Pressable
                    key={l.id}
                    onPress={() => toggle(l.id)}
                    disabled={busy !== null}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, busy: busy === l.id }}
                    accessibilityLabel={`${l.title}, ${l.isPublic ? "public" : "private"}`}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.rule2 }}
                  >
                    <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                      <Body numberOfLines={1} style={{ fontFamily: "Area-Bold", color: colors.ink }}>{l.title}</Body>
                      <Label>{l.isPublic ? "Public" : "Private"}</Label>
                    </View>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 2,
                        borderWidth: 1.5,
                        borderColor: colors.ink,
                        backgroundColor: on ? colors.ink : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: busy === l.id ? 0.4 : 1,
                      }}
                    >
                      {on ? <IconCheck size={14} color={colors.paper} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {creating ? (
            <View style={{ gap: 10 }}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                maxLength={120}
                autoFocus
                placeholder="Boston wishlist, Sunday regulars…"
                placeholderTextColor={colors.ink3}
                accessibilityLabel="Collection name"
                returnKeyType="done"
                onSubmitEditing={create}
                style={input}
              />
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Label style={{ color: colors.ink }}>Public</Label>
                  <BodySm style={{ color: colors.ink3 }}>{isPublic ? "On your profile. Anyone can save it." : "Only you can see it."}</BodySm>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  accessibilityLabel="Public collection"
                  trackColor={{ true: colors.oxblood, false: colors.rule }}
                  thumbColor={colors.card}
                />
              </View>
              <ButtonOx
                title={target ? "Create and add" : "Create"}
                onPress={create}
                disabled={!title.trim() || busy !== null}
                accessibilityRole="button"
                accessibilityState={{ disabled: !title.trim() || busy !== null }}
                style={{ opacity: title.trim() && busy === null ? 1 : 0.4 }}
              />
            </View>
          ) : (
            <ButtonLine title="New collection" onPress={() => setCreating(true)} accessibilityRole="button" accessibilityLabel="New collection" />
          )}

          {failed ? <BodySm style={{ color: colors.oxblood }}>{"Couldn't save that. Try again."}</BodySm> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
