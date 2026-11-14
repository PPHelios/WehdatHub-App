import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Lang, UnitFields } from '@wehdathub/shared';
import { featureGroups } from '../featureLabels';
import { spacing, useTheme } from '../theme';
import { ux } from '../unitExtraText';
import { Chips } from './Chips';

type FieldFn = (k: string, label: string, extra?: object) => React.ReactElement;

/** The add-unit fields the website form has beyond the basics: areas, payment, project, owner link, commission, and the features picker. */
export function UnitExtraFields({ fields, set, field, lang, rent, ready, editing }: {
  fields: UnitFields; set: (k: string, v: string | string[]) => void; field: FieldFn; lang: Lang; rent: boolean; ready: boolean; editing: boolean;
}) {
  const { colors } = useTheme();
  const x = ux(lang);
  const [more, setMore] = useState(false);
  const chosen = Array.isArray(fields.feature) ? fields.feature : [];
  const toggle = (k: string) => set('feature', chosen.includes(k) ? chosen.filter((c) => c !== k) : [...chosen, k]);
  const s = (k: string) => (typeof fields[k] === 'string' ? (fields[k] as string) : '');
  const h = [styles.h, { color: colors.text }];
  return (
    <View style={styles.wrap}>
      {editing ? null : field('code', x.code, { autoCapitalize: 'characters', autoCorrect: false })}
      <Text style={h}>{x.currency}</Text>
      <Chips options={[{ value: 'EGP', label: 'EGP' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }]} value={s('currency') || 'EGP'} onChange={(v) => set('currency', v === 'EGP' ? '' : v)} />
      {rent ? (
        <>
          <Text style={h}>{x.rentPeriod}</Text>
          <Chips options={[{ value: 'monthly', label: x.monthly }, { value: 'yearly', label: x.yearly }]} value={s('rent_period') as 'monthly' | 'yearly' | ''} onChange={(v) => set('rent_period', v)} />
        </>
      ) : null}
      <View style={styles.row}><View style={styles.flex}>{field('land_area', x.land, { keyboardType: 'decimal-pad' })}</View><View style={styles.flex}>{field('garden_area', x.garden, { keyboardType: 'decimal-pad' })}</View></View>
      {field('roof_area', x.roof, { keyboardType: 'decimal-pad' })}
      {ready ? null : (
        <>
          <Text style={h}>{x.quarter}</Text>
          <Chips options={['1', '2', '3', '4'].map((q) => ({ value: q, label: `Q${q}` }))} value={s('delivery_quarter')} onChange={(v) => set('delivery_quarter', v)} />
        </>
      )}
      {rent ? null : (
        <>
          <Text style={h}>{x.payment}</Text>
          {field('installment_value', x.installment, { keyboardType: 'decimal-pad' })}
          <Chips options={[{ value: 'monthly', label: x.m }, { value: 'quarterly', label: x.q }, { value: 'semi_annual', label: x.s }, { value: 'annual', label: x.a }]} value={s('payment_frequency') as 'monthly' | ''} onChange={(v) => set('payment_frequency', v)} />
          {field('installments_end', x.last, { keyboardType: 'numbers-and-punctuation' })}
          {field('cash_price', x.cash, { keyboardType: 'decimal-pad' })}
          <View style={styles.row}><View style={styles.flex}>{field('maintenance_pct', x.maintPct, { keyboardType: 'decimal-pad' })}</View><View style={styles.flex}>{field('maintenance_terms', x.maintTerms)}</View></View>
        </>
      )}
      {field('project', x.project)}
      {field('developer', x.developer)}
      {field('owner_lead', x.ownerLead, { autoCapitalize: 'characters', autoCorrect: false })}
      <Pressable accessibilityRole="button" testID="more-details" onPress={() => setMore((m) => !m)}><Text style={[styles.h, { color: colors.primary }]}>{more ? '▾' : '▸'} {x.more}</Text></Pressable>
      {more ? <>{field('commission', x.commission)}{field('co_broker', x.coBroker)}</> : null}
      <Text style={h}>{x.features}</Text>
      {featureGroups(lang).map((g) => (
        <View key={g.group} style={styles.group} testID={`features-${g.group}`}>
          <Text style={{ color: colors.muted, fontWeight: '600' }}>{x.g[g.group as keyof typeof x.g] ?? g.group}</Text>
          <View style={styles.chips}>
            {g.items.map((it) => {
              const on = chosen.includes(it.key);
              return (
                <Pressable key={it.key} testID={`feature-${it.key}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => toggle(it.key)}
                  style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }]}>
                  <Text style={{ color: on ? colors.onPrimary : colors.text, fontWeight: '600' }}>{it.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {field('features_other', x.featuresOther)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  h: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  group: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
