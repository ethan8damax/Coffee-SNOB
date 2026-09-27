import { useState } from "react";
import { Pressable, ScrollView, Switch, TextInput, View } from "react-native";
import { router } from "expo-router";
import { colors } from "@coffeesnob/design-tokens";
import {
  deleteCollection,
  removeFromCollection,
  setCollectionNote,
  updateCollection,
  type Collection,
  type CollectionItem,
} from "@coffeesnob/supabase";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { useCollectionSaved } from "@/lib/collections/use-collections";
import { Body, BodySm, ButtonLine, ButtonOx, D2, IconBack, Label } from "../primitives";

const input = {
  minHeight: 44,
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderWidth: 1,
  borderColor: colors.rule,
  borderRadius: 2,
  backgroundColor: colors.card,
  fontFamily: "Area-Regular",
  fontSize: 14,
  color: colors.ink,
} as const;

const area = (i: CollectionItem) => [i.neighborhood, i.locality].filter(Boolean).join(", ");

// Rated shops have a page; a café nobody has logged opens on the map instead.
function openItem(i: CollectionItem) {
  if (i.rated) router.push(`/shop/${i.shopId}`);
  else if (i.lat !== null && i.lng !== null) router.push({ pathname: "/map", params: { lat: String(i.lat), lng: String(i.lng) } });
}

function Item({ item, editing, listId, onRemoved }: { item: CollectionItem; editing: boolean; listId: string; onRemoved: () => void }) {
  const [note, setNote] = useState(item.note ?? "");
  const [savedNote, setSavedNote] = useState(item.note ?? "");
  const [failed, setFailed] = useState(false);
  const saveNote = async () => {
    if (savedNote === note.trim()) return;
    try {
      await setCollectionNote(supabase, listId, item.shopId, note);
      setSavedNote(note.trim());
    } catch {
      setFailed(true);
    }
  };
  return (
    <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.rule2, gap: 6 }}>
      <Pressable onPress={() => openItem(item)} accessibilityRole="link" accessibilityLabel={item.name} style={{ gap: 3 }}>
        <Body style={{ fontFamily: "Area-Bold", color: colors.ink }}>{item.name}</Body>
        <Label>{area(item) || (item.rated ? "Rated" : "Not yet rated")}</Label>
      </Pressable>
      {editing ? (
        <View style={{ gap: 8 }}>
          <TextInput
            value={note}
            onChangeText={setNote}
            onBlur={saveNote}
            maxLength={300}
            multiline
            placeholder="Why it's here. What to order."
            placeholderTextColor={colors.ink3}
            accessibilityLabel={`Note for ${item.name}`}
            style={input}
          />
          <Pressable
            onPress={async () => {
              try {
                await removeFromCollection(supabase, listId, item.shopId);
                onRemoved();
              } catch {
                setFailed(true);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.name}`}
            hitSlop={8}
            style={{ alignSelf: "flex-start", minHeight: 32, justifyContent: "center" }}
          >
            <Label style={{ color: colors.oxblood }}>Remove</Label>
          </Pressable>
          {failed ? <BodySm style={{ color: colors.oxblood }}>{"Couldn't save that. Try again."}</BodySm> : null}
        </View>
      ) : savedNote ? (
        <BodySm style={{ color: colors.ink2 }}>{savedNote}</BodySm>
      ) : null}
    </View>
  );
}

export function CollectionView({ collection, onChanged }: { collection: Collection; onChanged: () => void }) {
  const { session } = useAuth();
  const me = session?.user.id ?? null;
  const isOwn = me !== null && me === collection.ownerId;
  const { saved, failed: saveFailed, toggle } = useCollectionSaved(isOwn ? null : me, collection.id);
  const [items, setItems] = useState(collection.items);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(collection.title);
  const [description, setDescription] = useState(collection.description ?? "");
  const [isPublic, setIsPublic] = useState(collection.isPublic);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [failed, setFailed] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/profile"));

  const save = async () => {
    setFailed(false);
    try {
      await updateCollection(supabase, collection.id, { title: title.trim() || collection.title, description, isPublic });
      setEditing(false);
      onChanged();
    } catch {
      setFailed(true);
    }
  };

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteCollection(supabase, collection.id);
      router.replace("/profile");
    } catch {
      setFailed(true);
    }
  };

  const count = `${items.length} ${items.length === 1 ? "café" : "cafés"}`;
  const saves = collection.saveCount ? ` · saved by ${collection.saveCount}` : "";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.paper }} contentContainerStyle={{ alignItems: "center", paddingBottom: 60 }}>
      <View style={{ width: "100%", maxWidth: 640, paddingHorizontal: 16, paddingTop: 12 }}>
        <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, marginLeft: -12, alignItems: "center", justifyContent: "center" }}>
          <IconBack />
        </Pressable>

        {editing ? (
          <View style={{ gap: 10, marginTop: 8 }}>
            <TextInput value={title} onChangeText={setTitle} maxLength={120} accessibilityLabel="Collection name" style={[input, { fontFamily: "Area-Bold", fontSize: 18 }]} />
            <TextInput
              value={description}
              onChangeText={setDescription}
              maxLength={500}
              multiline
              placeholder="What ties these together?"
              placeholderTextColor={colors.ink3}
              accessibilityLabel="Description"
              style={[input, { minHeight: 80 }]}
            />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Label style={{ color: colors.ink }}>Public</Label>
                <BodySm style={{ color: colors.ink3 }}>{isPublic ? "On your profile. Anyone can save it." : "Only you can see it."}</BodySm>
              </View>
              <Switch value={isPublic} onValueChange={setIsPublic} accessibilityLabel="Public collection" trackColor={{ true: colors.oxblood, false: colors.rule }} thumbColor={colors.card} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <ButtonOx title="Save" onPress={save} accessibilityRole="button" accessibilityLabel="Save changes" style={{ flex: 1 }} />
              <ButtonLine title="Cancel" onPress={() => setEditing(false)} accessibilityRole="button" accessibilityLabel="Cancel editing" />
            </View>
          </View>
        ) : (
          <View style={{ gap: 8, marginTop: 8 }}>
            <D2 accessibilityRole="header">{collection.title}</D2>
            {collection.ownerUsername ? (
              <Pressable onPress={() => router.push(`/u/${collection.ownerUsername}`)} accessibilityRole="link" hitSlop={6} style={{ alignSelf: "flex-start" }}>
                <Label style={{ color: colors.ink2 }}>{`by @${collection.ownerUsername}`}</Label>
              </Pressable>
            ) : null}
            {collection.description ? <Body style={{ color: colors.ink2 }}>{collection.description}</Body> : null}
            <Label>{isOwn ? `${collection.isPublic ? "Public" : "Private"} · ${count}${saves}` : `${count}${saves}`}</Label>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              {isOwn ? (
                <ButtonLine title="Edit" onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Edit this collection" />
              ) : (
                <ButtonLine
                  title={saved ? "Saved" : saveFailed ? "Retry save" : "Save"}
                  onPress={me ? toggle : () => router.push("/sign-in")}
                  accessibilityRole="button"
                  accessibilityLabel={saved ? "Saved, tap to remove from your Faves" : "Save this collection"}
                />
              )}
            </View>
          </View>
        )}

        <View style={{ marginTop: 20, borderTopWidth: 1, borderTopColor: colors.ink }}>
          {items.length === 0 ? (
            <Body style={{ color: colors.ink3, paddingVertical: 24 }}>
              {isOwn ? "Nothing in here yet. Tap Collect on any café, on the map or its page." : "Nothing in here yet."}
            </Body>
          ) : (
            items.map((i) => (
              <Item key={i.shopId} item={i} editing={editing} listId={collection.id} onRemoved={() => setItems((all) => all.filter((x) => x.shopId !== i.shopId))} />
            ))
          )}
        </View>

        {editing ? (
          <Pressable onPress={remove} accessibilityRole="button" accessibilityLabel="Delete this collection" style={{ marginTop: 24, minHeight: 44, justifyContent: "center" }}>
            <Label style={{ color: colors.oxblood }}>{confirmDelete ? "Tap again to delete" : "Delete collection"}</Label>
          </Pressable>
        ) : null}
        {failed ? <BodySm style={{ color: colors.oxblood, marginTop: 8 }}>{"Couldn't save that. Try again."}</BodySm> : null}
      </View>
    </ScrollView>
  );
}
