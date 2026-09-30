import { useState } from "react";
import { Image, Modal, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { colors } from "@coffeesnob/design-tokens";
import { photoUrl, reportPhoto, type PhotoReportReason, type ShopPhoto } from "@coffeesnob/supabase";
import { Tap } from "@/components/tap";
import { useAuth } from "@/context/auth";
import { Label } from "../primitives";
import { CreditTag } from "./tag";

const PHOTOS_URL = process.env.EXPO_PUBLIC_PHOTOS_URL ?? "";

const REASONS: { id: PhotoReportReason; label: string }[] = [
  { id: "wrong_shop", label: "Wrong shop" },
  { id: "inappropriate", label: "Not okay" },
  { id: "not_theirs", label: "Not their photo" },
  { id: "other", label: "Something else" },
];

type ReportState = "idle" | "choosing" | "sending" | "sent" | "already" | "failed";

// The shop's photos as a strip; tap one for the full size, its credit, and a
// way to report it (photos Phase 3).
export function Gallery({ photos }: { photos: ShopPhoto[] }) {
  const [open, setOpen] = useState<ShopPhoto | null>(null);
  const { width, height } = useWindowDimensions();
  if (photos.length === 0) return null;
  return (
    <View style={{ gap: 10 }}>
      <Label>Photos</Label>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {photos.map((p) => (
          <Tap key={p.id} onPress={() => setOpen(p)} accessibilityRole="button" accessibilityLabel={p.username ? `Photo by ${p.username}` : "Photo"}>
            <Image source={{ uri: photoUrl(PHOTOS_URL, p.thumbPath) }} style={{ width: 96, height: 96, borderRadius: 2, backgroundColor: colors.paper2 }} resizeMode="cover" />
          </Tap>
        ))}
      </ScrollView>
      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16 }}>
          {/* The backdrop closes; the photo and its controls sit above it. */}
          <Tap onPress={() => setOpen(null)} accessibilityRole="button" accessibilityLabel="Close photo" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(22,19,16,0.94)" }]} />
          {open ? (
            <View style={{ gap: 12 }}>
              <View>
                <Image
                  source={{ uri: photoUrl(PHOTOS_URL, open.path) }}
                  style={{ width: Math.min(width - 32, (height - 180) * (open.width / open.height)), aspectRatio: open.width / open.height, backgroundColor: colors.ink }}
                  resizeMode="contain"
                />
                <CreditTag username={open.username} style={{ position: "absolute", top: 10, right: 10 }} />
              </View>
              <ReportPhoto key={open.id} photoId={open.id} />
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function ReportPhoto({ photoId }: { photoId: string }) {
  const { session } = useAuth();
  const [state, setState] = useState<ReportState>("idle");
  if (!session) return null;

  async function send(reason: PhotoReportReason) {
    setState("sending");
    try {
      const { supabase } = require("../../lib/supabase");
      setState(await reportPhoto(supabase, photoId, reason));
    } catch {
      setState("failed");
    }
  }

  const quiet = { color: colors.sageLt };
  if (state === "sent") return <Label style={quiet}>Reported. We'll take a look.</Label>;
  if (state === "already") return <Label style={quiet}>You already reported this one.</Label>;
  if (state === "choosing" || state === "sending" || state === "failed") {
    return (
      <View style={{ gap: 8 }}>
        <Label style={quiet}>{state === "failed" ? "That didn't send. Try again." : "What's wrong with it?"}</Label>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {REASONS.map((r) => (
            <Tap
              key={r.id}
              onPress={() => send(r.id)}
              disabled={state === "sending"}
              accessibilityRole="button"
              accessibilityLabel={`Report: ${r.label}`}
              style={{ minHeight: 36, paddingHorizontal: 11, justifyContent: "center", borderWidth: 1, borderColor: colors.cream, borderRadius: 2 }}
            >
              <Label style={{ color: colors.cream }}>{r.label}</Label>
            </Tap>
          ))}
        </View>
      </View>
    );
  }
  return (
    <Tap onPress={() => setState("choosing")} accessibilityRole="button" accessibilityLabel="Report photo" hitSlop={8} style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}>
      <Label style={{ ...quiet, textDecorationLine: "underline" }}>Report photo</Label>
    </Tap>
  );
}
