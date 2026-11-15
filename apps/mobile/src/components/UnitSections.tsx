import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { Lang, UnitFields } from '@wehdathub/shared';
import { ux } from '../unitExtraText';
import { uf } from '../unitFormText';
import { readPhone, readPrice, plain, withCommas } from '../readback';
import { FINISHING, FURNISHING, PROPERTY_TYPES, options } from '../unitOptions';
import { sizeShows } from '../unitRules';
import { spacing, useTheme } from '../theme';
import { Chips } from './Chips';

// The four sections of the add/edit unit form (docs/plans/unified-unit-box.md, section 5). The place box is in the first one.

type FieldFn = (k: string, label: string, extra?: object) => React.ReactElement;
export interface SectionProps {
  fields: UnitFields;
  set: (k: string, v: string | string[] | boolean | undefined) => void;
  field: FieldFn;
  lang: Lang;
}

const str = (v: UnitFields[string]): string => (typeof v === 'string' ? v : '');
const PLAN_ROWS = [1, 2, 3];
const FREQUENCIES = [
  { value: 'monthly', ar: 'شهري', en: 'Monthly' }, { value: 'quarterly', ar: 'ربع سنوي', en: 'Quarterly' },
  { value: 'semi_annual', ar: 'نصف سنوي', en: 'Semi-annual' }, { value: 'annual', ar: 'سنوي', en: 'Annual' },
];

/** A section's number, title and one-line hint. */
export function SectionHead({ n, title, hint }: { n: number; title: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.head}>
      <View style={styles.headRow}>
        <View style={[styles.num, { backgroundColor: colors.primary }]}><Text style={{ color: colors.onPrimary, fontWeight: '800' }}>{n}</Text></View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>
      {hint ? <Text style={{ color: colors.muted }}>{hint}</Text> : null}
    </View>
  );
}

/** A labelled switch row. */
export function SwitchRow({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.flex, { color: colors.text }]}>{label}</Text>
      <Switch testID={testID} value={value} onValueChange={onChange} />
    </View>
  );
}

const Label = ({ children }: { children: string }) => {
  const { colors } = useTheme();
  return <Text style={[styles.label, { color: colors.text }]}>{children}</Text>;
};

/** Section 2: price and size. Land, garden and roof show by unit type; a field that has a value always shows. */
export function SizeSection({ fields, set, field, lang }: SectionProps) {
  const L = uf(lang);
  const x = ux(lang);
  const rent = fields.listing_type === 'rent';
  const type = str(fields.property_type);
  return (
    <View style={styles.stack}>
      {field('price_value', rent ? L.rentLabel : L.priceLabel, { keyboardType: 'numbers-and-punctuation', hint: readPrice(str(fields.price_value), lang), value: withCommas(str(fields.price_value)), onChangeText: (v: string) => set('price_value', plain(v)) })}
      <Label>{x.currency}</Label>
      <Chips options={[{ value: 'EGP', label: 'EGP' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }]} value={str(fields.currency) || 'EGP'} onChange={(v) => set('currency', v === 'EGP' ? '' : v)} />
      {rent ? (
        <>
          <Label>{x.rentPeriod}</Label>
          <Chips options={[{ value: 'monthly', label: x.monthly }, { value: 'yearly', label: x.yearly }]} value={str(fields.rent_period) as 'monthly' | 'yearly' | ''} onChange={(v) => set('rent_period', v)} />
        </>
      ) : null}
      <View style={styles.row}>
        <View style={styles.flex}>{field('area_value', lang === 'en' ? 'Area m²' : 'المساحة م²', { keyboardType: 'decimal-pad' })}</View>
        <View style={styles.flex}>{field('bedrooms', lang === 'en' ? 'Bedrooms' : 'الغرف', { keyboardType: 'number-pad' })}</View>
      </View>
      <View style={styles.row}>
        <View style={styles.flex}>{field('bathrooms', lang === 'en' ? 'Bathrooms' : 'الحمامات', { keyboardType: 'number-pad' })}</View>
        {sizeShows('floor_level', type, fields) ? <View style={styles.flex}>{field('floor_level', lang === 'en' ? 'Floor (0 = ground)' : 'الدور (0 = أرضي)', { keyboardType: 'number-pad' })}</View> : null}
      </View>
      {sizeShows('land_area', type, fields) ? field('land_area', L.landLabel, { keyboardType: 'decimal-pad' }) : null}
      <View style={styles.row}>
        {sizeShows('garden_area', type, fields) ? <View style={styles.flex}>{field('garden_area', L.gardenLabel, { keyboardType: 'decimal-pad' })}</View> : null}
        {sizeShows('roof_area', type, fields) ? <View style={styles.flex}>{field('roof_area', L.roofLabel, { keyboardType: 'decimal-pad' })}</View> : null}
      </View>
      <Label>{lang === 'en' ? 'Finishing' : 'التشطيب'}</Label>
      <Chips options={options(FINISHING, lang)} value={str(fields.finishing)} onChange={(v) => set('finishing', v)} />
      <Label>{lang === 'en' ? 'Furnishing' : 'الفرش'}</Label>
      <Chips options={options(FURNISHING, lang)} value={str(fields.furnishing)} onChange={(v) => set('furnishing', v)} />
    </View>
  );
}

/** Section 3: delivery and payment. Off for a rental. The payment tabs (resale or primary) set the market, as on the website. */
export function DeliverySection({ fields, set, field, lang }: SectionProps) {
  const x = ux(lang);
  const ready = fields.is_ready === '1';
  const primary = fields.market === 'primary';
  const { colors } = useTheme();
  return (
    <View style={styles.stack}>
      <SwitchRow label={lang === 'en' ? 'Ready to move' : 'استلام فوري'} value={ready} onChange={(v) => set('is_ready', v ? '1' : '')} testID="f-is_ready" />
      {ready ? null : (
        <View style={styles.row}>
          <View style={styles.flex}>{field('delivery_year', lang === 'en' ? 'Delivery year' : 'سنة التسليم', { keyboardType: 'number-pad' })}</View>
          <View style={styles.flex}>
            <Label>{x.quarter}</Label>
            <Chips options={['1', '2', '3', '4'].map((q) => ({ value: q, label: `Q${q}` }))} value={str(fields.delivery_quarter)} onChange={(v) => set('delivery_quarter', v)} />
          </View>
        </View>
      )}
      <Label>{x.payment}</Label>
      <Chips options={[{ value: 'resale', label: lang === 'en' ? 'Resale with installments' : 'ريسيل بالتقسيط' }, { value: 'primary', label: lang === 'en' ? 'Primary' : 'برايمري' }]} value={primary ? 'primary' : 'resale'} onChange={(v) => set('market', v)} testID="f-market" />
      {primary ? (
        <View style={styles.stack}>
          {field('cash_price', lang === 'en' ? 'Cash price' : 'سعر الكاش', { keyboardType: 'decimal-pad' })}
          <View style={styles.row}>
            <View style={styles.flex}>{field('maintenance_pct', x.maintPct, { keyboardType: 'decimal-pad' })}</View>
            <View style={styles.flex}>{field('maintenance_terms', x.maintTerms)}</View>
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>{field('project', x.project)}</View>
            <View style={styles.flex}>{field('developer', x.developer)}</View>
          </View>
          {PLAN_ROWS.map((i) => (
            <View key={i} style={styles.plan}>
              <Text style={{ color: colors.muted, fontWeight: '700' }}>{lang === 'en' ? `Plan ${i}` : `نظام ${i}`}</Text>
              <View style={styles.row}>
                <View style={styles.flex}>{field(`plan_down_${i}`, lang === 'en' ? 'Down %' : 'مقدم %', { keyboardType: 'decimal-pad' })}</View>
                <View style={styles.flex}>{field(`plan_years_${i}`, lang === 'en' ? 'Years' : 'سنين', { keyboardType: 'decimal-pad' })}</View>
              </View>
              <Chips options={FREQUENCIES.map((f) => ({ value: f.value, label: lang === 'en' ? f.en : f.ar }))} value={str(fields[`plan_freq_${i}`]) as never} onChange={(v) => set(`plan_freq_${i}`, v)} />
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.stack}>
          <View style={styles.row}>
            <View style={styles.flex}>{field('down_payment_value', lang === 'en' ? 'Paid (cash required)' : 'المدفوع (الكاش المطلوب)', { keyboardType: 'numbers-and-punctuation', value: withCommas(str(fields.down_payment_value)), onChangeText: (v: string) => set('down_payment_value', plain(v)) })}</View>
            <View style={styles.flex}>{field('remaining_amount', lang === 'en' ? 'Remaining installments' : 'المتبقي أقساط', { keyboardType: 'numbers-and-punctuation', value: withCommas(str(fields.remaining_amount)), onChangeText: (v: string) => set('remaining_amount', plain(v)) })}</View>
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>{field('installment_value', x.installment, { keyboardType: 'decimal-pad' })}</View>
            <View style={styles.flex}>{field('installments_end', x.last, { keyboardType: 'numbers-and-punctuation' })}</View>
          </View>
          <Label>{x.freq}</Label>
          <Chips options={FREQUENCIES.map((f) => ({ value: f.value, label: lang === 'en' ? f.en : f.ar }))} value={str(fields.payment_frequency) as never} onChange={(v) => set('payment_frequency', v)} />
        </View>
      )}
    </View>
  );
}

/** Section 4: the owner and the notes (never shown to clients), and the client description. */
export function OwnerSection({ fields, set, field, lang, expanded, onDescribeAgain }: SectionProps & { expanded: boolean; onDescribeAgain: () => void }) {
  const L = uf(lang);
  const x = ux(lang);
  const [more, setMore] = React.useState(expanded);
  const { colors } = useTheme();
  return (
    <View style={styles.stack}>
      <Text style={{ color: colors.muted }}>{L.ownerPrivate}</Text>
      {field('owner_name', lang === 'en' ? 'Owner' : 'المالك')}
      {field('owner_phone', lang === 'en' ? 'Owner phone' : 'تليفون المالك', { keyboardType: 'phone-pad', hint: readPhone(str(fields.owner_phone)) })}
      <SwitchRow label={lang === 'en' ? 'No name: use the phone as the name' : 'مفيش اسم: استخدم التليفون كاسم'} value={fields.owner_name_from_phone === '1'} onChange={(v) => set('owner_name_from_phone', v ? '1' : '')} testID="f-owner_name_from_phone" />
      {field('owner_lead', x.ownerLead, { autoCapitalize: 'characters', autoCorrect: false, placeholder: 'L-0042' })}
      <Pressable accessibilityRole="button" testID="more-details" onPress={() => setMore((m) => !m)} style={styles.more}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{more ? '▾' : '▸'} {L.moreDetails}</Text>
      </Pressable>
      {more ? (
        <View style={styles.stack}>
          {field('commission', x.commission)}
          {field('co_broker', x.coBroker)}
          {field('unit_no', lang === 'en' ? 'Unit no.' : 'رقم الوحدة', { autoCorrect: false })}
          {field('address', lang === 'en' ? 'Address (agency only)' : 'العنوان (للشركة بس)')}
          {field('pin', lang === 'en' ? 'Google Maps link or coordinates' : 'لينك جوجل ماب أو الإحداثيات', { autoCapitalize: 'none', autoCorrect: false })}
        </View>
      ) : null}
      {field('notes', lang === 'en' ? 'Notes' : 'ملاحظات', { multiline: true })}
      {/* Written from the unit's fields until the broker types in it; "write it again" takes the draft back. */}
      {field('clean_summary', L.description, { multiline: true, testID: 'clean-summary' })}
      <Pressable accessibilityRole="button" testID="describe-again" onPress={onDescribeAgain} style={styles.more}>
        <Text style={{ color: colors.primary, fontWeight: '700' }}>{L.describeAgain}</Text>
      </Pressable>
    </View>
  );
}

/** The property types the form offers (roof included), with their labels in the app language. */
export const typeOptions = (lang: Lang) => options(PROPERTY_TYPES, lang);

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  head: { gap: spacing.xs, marginTop: spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  plan: { gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  more: { minHeight: 44, justifyContent: 'center' },
});
