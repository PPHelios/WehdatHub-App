import React, { useEffect, useState } from 'react';
import { BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, StretchInY, FadeOut, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useAuth } from '../auth';
import { Button } from './Button';
import { AppText as Text } from './AppText';
import { VoiceBar } from './VoiceBar';
import { radius, spacing, useTheme } from '../theme';

const appear = FadeInDown.duration(220).reduceMotion(ReduceMotion.System);
const reveal = StretchInY.duration(260).reduceMotion(ReduceMotion.System);
const disappear = FadeOut.duration(120).reduceMotion(ReduceMotion.System);
const reorder = LinearTransition.duration(240).reduceMotion(ReduceMotion.System);
const units = ['DEMO-03', 'DEMO-01', 'DEMO-02', 'DEMO-04'];

export function SearchPractice({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const broker = useAuth((s) => s.broker);
  const ar = broker?.lang !== 'en';
  const copy = (en: string, arabic: string) => ar ? arabic : en;
  const number = (value: number) => value.toLocaleString(ar ? 'ar-EG' : 'en-GB');
  const entry = broker?.role === 'data_entry';
  const team = broker?.role === 'team_lead';
  const owner = broker?.role === 'owner';
  const manager = ['manager', 'admin'].includes(broker?.role ?? '');
  const question = entry ? copy('Which units need confirmation?', 'الوحدات اللي محتاجة مراجعة')
    : team ? copy('Show overdue follow-ups', 'متابعات متأخرة')
      : owner ? copy('How many deals did we close?', 'كام صفقة قفلنا؟')
        : manager ? copy('Show unassigned leads', 'عملاء من غير بروكر')
        : copy('Find options for Sara Hassan', 'هات وحدات مناسبة لسارة حسن');
  const [step, setStep] = useState(0);
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string>();
  const [hint, setHint] = useState(false);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  const submit = () => {
    if (step !== 0) return;
    if (text.trim().toLocaleLowerCase() !== question.toLocaleLowerCase()) {
      setHint(true);
      return;
    }
    Keyboard.dismiss();
    setStep(1);
  };
  const instruction = step === 0
    ? copy('Tap the example to fill the search bar, then send it.', 'اضغط على المثال عشان تكتبه في البحث، وبعدها اضغط إرسال.')
    : step === 2 ? copy('Practice complete', 'خلصت التجربة')
      : entry ? copy('Confirm the oldest unit and watch the queue update.', 'أكّد أقدم وحدة وشوف القائمة وهي بتتحدّث.')
        : team ? copy('Tap a broker to see their overdue leads.', 'اختار وسيط عشان تشوف عملاءه اللي متابعتهم اتأخرت.')
          : owner ? copy('Tap a bar to see the deals behind it.', 'اضغط على عمود عشان تشوف الصفقات اللي اتحسبت فيه.')
            : manager ? copy('Assign the demo lead to Sara and watch the queue update.', 'اسند العميل التجريبي لسارة وشوف القائمة وهي بتتحدّث.')
            : copy('Two leads share this name. Select the lead whose phone ends in 4321.', 'فيه عميلين بنفس الاسم. اختار اللي رقمه آخره ٤٣٢١.');
  const row = (key: string, title: string, onPress?: () => void) => (
    <Animated.View key={key} layout={reorder} entering={appear} exiting={disappear} style={[styles.row, { borderColor: colors.border }]}>
      {onPress ? <Pressable testID={key} accessibilityRole="button" onPress={onPress} style={styles.tap}><Text style={{ color: colors.primaryInk }}>{title}</Text></Pressable>
        : <Text testID={key} style={{ color: colors.text }}>{title}</Text>}
    </Animated.View>
  );
  const done = (record?: string) => { setPicked(record); setStep(2); };
  return (
    <View testID="search-practice" style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={{ color: colors.muted }}>{copy('Practice with demo data', 'تجربة ببيانات تجريبية')}</Text>
          <Button label={copy('Exit', 'خروج')} onPress={onClose} variant="quiet" size="sm" testID="practice-exit" />
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{copy('Try Search', 'جرّب البحث')}</Text>
        <Text accessibilityLiveRegion="polite" style={{ color: colors.text }}>{instruction}</Text>
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {step === 0 ? <>
            {row('practice-example', question, () => { setHint(false); setText(question); })}
            {hint ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>{copy('Use the example above for this practice.', 'استخدم المثال اللي فوق في التجربة دي.')}</Text> : null}
          </> : entry ? <>
            <Text accessibilityLiveRegion="polite" testID="practice-unit-count" style={{ color: colors.text }}>{copy('Units overdue', 'وحدات محتاجة تحديث')} · {number(step === 1 ? 4 : 3)}</Text>
            {(step === 1 ? units.slice(0, 3) : units.slice(1)).map((unit) => row(unit, unit))}
            {step === 1 ? <Button testID="practice-confirm" label={copy('Confirm DEMO-03', 'أكّد DEMO-03')} onPress={() => done()} /> : null}
          </> : team ? (step === 1 ? <>
            {row('practice-broker-sara', copy('Sara Hassan · 2 overdue', 'سارة حسن · ٢ متأخرين'), () => done('Sara'))}
            {row('practice-broker-omar', copy('Omar Ali · 1 overdue', 'عمر علي · ١ متأخر'), () => done('Omar'))}
          </> : <>
            {row('practice-lead-1', picked === 'Sara' ? 'L-0101' : 'L-0103')}
            {picked === 'Sara' ? row('practice-lead-2', 'L-0102') : null}
          </>) : manager ? <>
            <Text accessibilityLiveRegion="polite" testID="practice-unassigned-count" style={{ color: colors.text }}>{copy('Unassigned leads', 'عملاء من غير وسيط')} · {number(step === 1 ? 1 : 0)}</Text>
            {step === 1 ? row('practice-unassigned-lead', 'L-0104') : null}
            {step === 1 ? <Button testID="practice-assign" label={copy('Assign to Sara', 'اسند لسارة')} onPress={() => done()} /> : null}
          </> : owner ? <>
            <View style={styles.chart}>
              {[3, 2, 4].map((count, i) => (
                <Pressable key={i} testID={`practice-bar-${i}`} accessibilityRole="button" accessibilityState={{ selected: picked === String(i) }}
                  accessibilityLabel={copy(`Week ${i + 1}, ${count} deals`, `الأسبوع ${number(i + 1)}، ${number(count)} صفقات`)}
                  onPress={() => done(String(i))} style={styles.column}>
                  <Text style={{ color: colors.text }}>{number(count)}</Text>
                  <Animated.View entering={reveal} style={[styles.bar, { height: count * 20, backgroundColor: picked === String(i) ? colors.primaryInk : colors.primary }]} />
                </Pressable>
              ))}
            </View>
            {picked !== undefined ? Array.from({ length: [3, 2, 4][Number(picked)] }, (_, i) => row(`practice-deal-${i}`, `D-0${Number(picked) + 1}0${i + 1}`)) : null}
          </> : step === 1 ? <>
            {row('practice-sara-4321', copy('Sara Hassan · ends in 4321', 'سارة حسن · آخره ٤٣٢١'), () => done())}
            {row('practice-sara-8765', copy('Sara Hassan · ends in 8765', 'سارة حسن · آخره ٨٧٦٥'), () => setHint(true))}
            {hint ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>{copy('Look for the phone ending in 4321.', 'دور على الرقم اللي آخره ٤٣٢١.')}</Text> : null}
          </> : <>
            {row('practice-requirements', copy('Apartment · 2 bedrooms · up to EGP 8m', 'شقة · غرفتين · لحد ٨ مليون جنيه'))}
            {row('practice-match', 'DEMO-01')}
          </>}
          {step === 2 ? <Button label={copy('Back to Search', 'ارجع للبحث')} onPress={onClose} testID="practice-done" /> : null}
        </View>
      </ScrollView>
      <View style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.bg }]}>
        <VoiceBar id="practice" label={copy('Practice search', 'بحث تجريبي')} value={text}
          onChangeText={(value) => { setHint(false); setText(value); }} onSubmit={submit}
          placeholder={copy('Try the example', 'جرّب المثال')} onError={() => undefined} disabled={step !== 0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 27, fontWeight: '800' },
  panel: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, padding: spacing.lg, gap: spacing.sm },
  row: { minHeight: 44, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  tap: { minHeight: 44, justifyContent: 'center' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
  column: { width: 64, minHeight: 44, alignItems: 'center', gap: spacing.xs },
  bar: { width: 32, borderRadius: radius.sm },
});
