import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiClientError } from '@wehdathub/shared';
import type { Lang, ProjectImage, ProjectImageRole, UploadFile } from '@wehdathub/shared';
import { api } from '../api';
import { compressPhotos } from '../compress';
import { errorText } from '../errors';
import { MAX_PROJECT_PHOTOS } from '../projectRules';
import { fill, pt } from '../projectText';
import { pickPhotos } from '../photos';
import { radius, spacing, useTheme } from '../theme';
import { Button } from './Button';
import { SmartImage } from './SmartImage';
import { toastError } from './Toast';

const ROLES: ProjectImageRole[] = ['shared', 'layout', 'hidden'];

/** What the server's gallery answers mean, in the broker's words. OFF, SORT_PDF and ALLOWANCE (pages left and needed) come back as errors. */
export function galleryError(e: unknown, lang: Lang): string {
  const T = pt(lang);
  if (e instanceof ApiClientError) {
    if (e.code === 'OFF') return T.galleryOff;
    if (e.code === 'SORT_PDF') return T.gallerySortPdf;
    if (e.code === 'ALLOWANCE') return fill(T.galleryAllowance, { left: String(e.extra.left ?? 0), needed: String(e.extra.needed ?? 0) });
  }
  return errorText(e, lang);
}

/** A project's photos for managers: add photos (all shared, no AI), the explicit "Sort with AI" (its cost shown first), a role per photo, delete. */
export function ProjectGallery({ projectId, images, lang, onChanged }: { projectId: string; images: ProjectImage[]; lang: Lang; onChanged: () => void }) {
  const { colors } = useTheme();
  const T = pt(lang);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try { await fn(); setMsg(T.galleryDone); onChanged(); } catch (e) { setMsg(toastError(galleryError(e, lang))); } finally { setBusy(false); }
  };
  const pick = async (): Promise<UploadFile[]> => compressPhotos(await pickPhotos(MAX_PROJECT_PHOTOS));
  const add = () => run(async () => { const f = await pick(); if (f.length) await api.projectPhotos(projectId, f); });
  // Spends pages of the month's allowance: ask first, with the cost.
  const sort = () => Alert.alert(T.galleryConfirm, T.gallerySortCost, [
    { text: T.cancel, style: 'cancel' },
    { text: T.gallerySort, onPress: () => { void run(async () => { const f = await pick(); if (f.length) await api.projectGallery(projectId, f, { sort: true }); }); } },
  ]);
  const roleText = (r: ProjectImageRole) => (r === 'shared' ? T.roleShared : r === 'layout' ? T.roleLayout : T.roleHidden);
  return (
    <View testID="project-gallery" style={[styles.box, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.h, { color: colors.text }]}>{T.gallery}</Text>
      {images.map((i) => (
        <View key={i.id} style={styles.row}>
          <SmartImage uri={i.url} style={styles.thumb} />
          <View style={styles.flex}>
            <View style={styles.roles}>
              {ROLES.map((r) => (
                <Pressable key={r} testID={`role-${i.id}-${r}`} accessibilityRole="button" accessibilityState={{ selected: i.role === r }} disabled={busy || i.role === r} onPress={() => run(() => api.projectImageRole(projectId, i.id, r))} style={[styles.role, { borderColor: i.role === r ? colors.primary : colors.border }, i.role === r && { backgroundColor: colors.primary }]}>
                  <Text style={{ color: i.role === r ? colors.onPrimary : colors.text, fontSize: 13 }}>{roleText(r)}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable testID={`delete-${i.id}`} accessibilityRole="button" disabled={busy} onPress={() => run(() => api.deleteProjectImage(projectId, i.id))} style={styles.del}>
              <Text style={{ color: colors.danger }}>{T.galleryDelete}</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <View style={styles.row}>
        <View style={styles.flex}><Button testID="gallery-add" label={T.galleryAdd} variant="secondary" disabled={busy} onPress={add} /></View>
        <View style={styles.flex}><Button testID="gallery-sort" label={T.gallerySort} variant="secondary" disabled={busy} onPress={sort} /></View>
      </View>
      <Text style={{ color: colors.muted, fontSize: 13 }}>{T.gallerySortCost}</Text>
      {msg ? <Text testID="gallery-msg" style={{ color: colors.accent }}>{msg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  h: { fontSize: 17, fontWeight: '800' },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  flex: { flex: 1 },
  thumb: { width: 64, height: 64, borderRadius: radius.sm, overflow: 'hidden' },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  role: { minHeight: 36, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, justifyContent: 'center' },
  del: { minHeight: 44, justifyContent: 'center' },
});
