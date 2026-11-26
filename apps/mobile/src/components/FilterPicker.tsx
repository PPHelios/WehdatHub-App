import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Field } from './Field';
import { Icon } from './Icon';
import { currentLang } from '../auth';
import { radius, spacing, useTheme } from '../theme';

export interface PickerOption<T extends string = string> {
  value: T;
  label: string;
  hint?: string;
}

/**
 * A compact, elevated filter pill that opens a searchable modal list — keeps filter bars to one line
 * even for large agencies with dozens of brokers.
 */
export function FilterPicker<T extends string>({
  label,
  options,
  value,
  onChange,
  searchable = true,
  searchPlaceholder,
  testID,
}: {
  label: string;
  options: PickerOption<T>[];
  value: T;
  onChange: (value: T) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  testID?: string;
}) {
  const { colors, elev } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value) ?? options[0];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.hint?.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? ''}`}
        onPress={() => { setQuery(''); setOpen(true); }}
        style={({ pressed }) => [
          styles.pill,
          elev('sm'),
          {
            backgroundColor: colors.card,
            borderColor: value !== options[0]?.value ? colors.primaryLine : colors.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={[styles.pillLabel, { color: colors.muted }]} numberOfLines={1}>{label}:</Text>
        <Text style={[styles.pillValue, { color: value !== options[0]?.value ? colors.primaryInk : colors.text }]} numberOfLines={1}>
          {selected?.label ?? '—'}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => undefined}
            style={[styles.sheet, elev('lg'), { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.sheetHead}>
              <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.text }]}>{label}</Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setOpen(false)}>
                <Icon name="cross" size={18} color={colors.muted} />
              </Pressable>
            </View>
            {searchable && options.length > 5 ? (
              <Field
                label={searchPlaceholder ?? (ar ? 'ابحث بالاسم' : 'Search by name')}
                value={query}
                onChangeText={setQuery}
                autoFocus={false}
              />
            ) : null}
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={{ color: colors.muted, paddingVertical: spacing.md }}>
                  {ar ? 'مفيش نتايج مطابقة.' : 'No matching options.'}
                </Text>
              ) : filtered.map((opt) => {
                const active = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    testID={testID ? `${testID}-opt-${opt.value}` : undefined}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => { onChange(opt.value); setOpen(false); }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        borderColor: colors.border,
                        backgroundColor: active ? colors.primarySoft : pressed ? colors.cardSubtle : 'transparent',
                      },
                    ]}
                  >
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionLabel, { color: active ? colors.primaryInk : colors.text }]}>{opt.label}</Text>
                      {opt.hint ? <Text style={[styles.optionHint, { color: colors.muted }]}>{opt.hint}</Text> : null}
                    </View>
                    {active ? <Icon name="check" size={16} color={colors.primaryInk} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export type PeriodChoice = {
  days: '1' | '7' | '30' | '90' | '365' | 'custom';
  from?: string;
  to?: string;
};

const PRESET_DAYS = ['1', '7', '30', '90', '365'] as const;

/**
 * Period filter pill supporting Today, 7/30/90/365 days, and a Custom YYYY-MM-DD date range.
 */
export function PeriodPicker({
  value,
  onChange,
  testID,
}: {
  value: PeriodChoice;
  onChange: (next: PeriodChoice) => void;
  testID?: string;
}) {
  const { colors, elev } = useTheme();
  const lang = currentLang();
  const ar = lang === 'ar';
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [fromDraft, setFromDraft] = useState(value.from ?? '');
  const [toDraft, setToDraft] = useState(value.to ?? '');
  const [err, setErr] = useState<string | null>(null);

  const labelFor = (p: PeriodChoice) => {
    if (p.days === 'custom' && p.from && p.to) return `${p.from} → ${p.to}`;
    if (p.days === '1') return ar ? 'النهارده' : 'Today';
    if (p.days === '7') return ar ? 'آخر ٧ أيام' : '7 days';
    if (p.days === '30') return ar ? '٣٠ يوم' : '30 days';
    if (p.days === '90') return ar ? '٩٠ يوم' : '90 days';
    if (p.days === '365') return ar ? '٣٦٥ يوم' : '365 days';
    return ar ? 'فترة مخصصة' : 'Custom';
  };

  const applyCustom = () => {
    const f = fromDraft.trim();
    const t = toDraft.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(t) || f > t) {
      setErr(ar ? 'اكتب التاريخ بصيغة YYYY-MM-DD (من قبل إلى).' : 'Use YYYY-MM-DD with start on or before end.');
      return;
    }
    setErr(null);
    onChange({ days: 'custom', from: f, to: t });
    setOpen(false);
  };

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${ar ? 'الفترة' : 'Period'}: ${labelFor(value)}`}
        onPress={() => { setErr(null); setOpen(true); }}
        style={({ pressed }) => [
          styles.pill,
          elev('sm'),
          { backgroundColor: colors.card, borderColor: colors.primaryLine, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Icon name="calendar" size={14} color={colors.primaryInk} />
        <Text style={[styles.pillValue, { color: colors.primaryInk }]} numberOfLines={1}>{labelFor(value)}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={() => undefined}
            style={[styles.sheet, elev('lg'), { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={styles.sheetHead}>
              <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.text }]}>
                {ar ? 'اختر الفترة' : 'Select period'}
              </Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setOpen(false)}>
                <Icon name="cross" size={18} color={colors.muted} />
              </Pressable>
            </View>
            <View style={styles.presets}>
              {PRESET_DAYS.map((d) => {
                const active = value.days === d;
                const label = labelFor({ days: d });
                return (
                  <Pressable
                    key={d}
                    testID={testID ? `${testID}-${d}` : undefined}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => { onChange({ days: d }); setOpen(false); }}
                    style={[
                      styles.option,
                      {
                        borderColor: colors.border,
                        backgroundColor: active ? colors.primarySoft : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[styles.optionLabel, { color: active ? colors.primaryInk : colors.text }]}>{label}</Text>
                    {active ? <Icon name="check" size={16} color={colors.primaryInk} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.customBox, { borderTopColor: colors.border }]}>
              <Text style={[styles.customTitle, { color: colors.muted }]}>
                {ar ? 'أو فترة مخصصة' : 'Or custom date range'}
              </Text>
              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <Field label={ar ? 'من' : 'From'} placeholder="2026-11-01" value={fromDraft} onChangeText={setFromDraft} />
                </View>
                <View style={styles.dateCol}>
                  <Field label={ar ? 'إلى' : 'To'} placeholder="2026-11-26" value={toDraft} onChangeText={setToDraft} />
                </View>
              </View>
              {err ? <Text style={{ color: colors.danger, fontSize: 12 }}>{err}</Text> : null}
              <Button label={ar ? 'تطبيق الفترة' : 'Apply range'} onPress={applyCustom} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  pillLabel: { fontSize: 12, fontWeight: '600' },
  pillValue: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    maxHeight: '80%',
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  list: { maxHeight: 340 },
  presets: { gap: spacing.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
    minHeight: 44,
  },
  optionCopy: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  optionHint: { fontSize: 12 },
  customBox: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: spacing.sm },
  customTitle: { fontSize: 13, fontWeight: '700' },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateCol: { flex: 1 },
});
