import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from './AppText';
import { Button } from './Button';
import { Field } from './Field';
import { Chevron, Icon } from './Icon';
import { Sheet } from './Sheet';
import { currentLang } from '../auth';
import { t } from '../i18n';
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
        <Text variant="caption" weight="bold" style={{ color: colors.muted }} numberOfLines={1}>{label}:</Text>
        <Text variant="caption" weight="bold" style={[styles.pillValue, { color: value !== options[0]?.value ? colors.primaryInk : colors.text }]} numberOfLines={1}>
          {selected?.label ?? '—'}
        </Text>
        <Chevron color={colors.muted} rtl={false} expanded />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
            {searchable && options.length > 5 ? (
              <Field
                label={searchPlaceholder ?? t(lang, 'fpSearchName')}
                value={query}
                onChangeText={setQuery}
                autoFocus={false}
              />
            ) : null}
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={[styles.empty, { color: colors.muted }]}>{t(lang, 'fpNoMatch')}</Text>
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
                      <Text variant="bodySm" weight="bold" style={{ color: active ? colors.primaryInk : colors.text }}>{opt.label}</Text>
                      {opt.hint ? <Text variant="caption" style={{ color: colors.muted }}>{opt.hint}</Text> : null}
                    </View>
                    {active ? <Icon name="check" size={16} color={colors.primaryInk} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
      </Sheet>
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
  const [open, setOpen] = useState(false);
  const [fromDraft, setFromDraft] = useState(value.from ?? '');
  const [toDraft, setToDraft] = useState(value.to ?? '');
  const [err, setErr] = useState<string | null>(null);

  const labelFor = (p: PeriodChoice) => {
    if (p.days === 'custom' && p.from && p.to) return `${p.from} → ${p.to}`;
    if (p.days === '1') return t(lang, 'pdToday');
    if (p.days === '7') return t(lang, 'pd7');
    if (p.days === '30') return t(lang, 'pd30');
    if (p.days === '90') return t(lang, 'pd90');
    if (p.days === '365') return t(lang, 'pd365');
    return t(lang, 'pdCustom');
  };

  const applyCustom = () => {
    const f = fromDraft.trim();
    const end = toDraft.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || f > end) {
      setErr(t(lang, 'pdBadRange'));
      return;
    }
    setErr(null);
    onChange({ days: 'custom', from: f, to: end });
    setOpen(false);
  };

  return (
    <>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${t(lang, 'pdPeriod')}: ${labelFor(value)}`}
        onPress={() => { setErr(null); setOpen(true); }}
        style={({ pressed }) => [
          styles.pill,
          elev('sm'),
          { backgroundColor: colors.card, borderColor: colors.primaryLine, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Icon name="calendar" size={14} color={colors.primaryInk} />
        <Text variant="caption" weight="bold" style={[styles.pillValue, { color: colors.primaryInk }]} numberOfLines={1}>{labelFor(value)}</Text>
        <Chevron color={colors.muted} rtl={false} expanded />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={t(lang, 'pdSelect')}>
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
                    style={[styles.option, { borderColor: colors.border }, active ? { backgroundColor: colors.primarySoft } : null]}
                  >
                    <Text variant="bodySm" weight="bold" style={{ color: active ? colors.primaryInk : colors.text }}>{label}</Text>
                    {active ? <Icon name="check" size={16} color={colors.primaryInk} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={[styles.customBox, { borderTopColor: colors.border }]}>
              <Text variant="caption" weight="bold" style={{ color: colors.muted }}>{t(lang, 'pdOrCustom')}</Text>
              <View style={styles.dateRow}>
                <View style={styles.dateCol}>
                  <Field label={t(lang, 'pdFrom')} placeholder="2026-11-01" value={fromDraft} onChangeText={setFromDraft} />
                </View>
                <View style={styles.dateCol}>
                  <Field label={t(lang, 'pdTo')} placeholder="2026-11-26" value={toDraft} onChangeText={setToDraft} />
                </View>
              </View>
              {err ? <Text variant="caption" style={{ color: colors.danger }}>{err}</Text> : null}
              <Button label={t(lang, 'pdApply')} onPress={applyCustom} />
            </View>
      </Sheet>
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
  pillValue: { flexShrink: 1 },
  empty: { paddingVertical: spacing.md },
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
  customBox: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: spacing.sm },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateCol: { flex: 1 },
});
