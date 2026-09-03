import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { WheelPicker } from '@/components/onboarding/wheel-picker';
import { useHoverFade, useLiquidPress } from '@/lib/button-interactions';
import { CONDITIONS, CONDITION_LABELS, type Condition } from '@/lib/conditions';
import {
  addConditionLogEntry,
  deleteConditionLogEntry,
  getConditionLog,
  type ConditionLogEntry,
} from '@/lib/condition-log';
import { hapticError, hapticImpactLight, hapticSelect } from '@/lib/haptics';
import { localDateStr } from '@/lib/local-date';
import { useAppColors } from '@/lib/theme-context';
import { getProfile } from '@/lib/user-profile';
import { HealthConsentGate } from '@/components/settings/health-consent-gate';

// 0 = today, since a flare-up (unlike a training session) can honestly be
// logged the same day it's happening — unlike log-past-session-sheet.tsx's
// wheel, which starts at 1 specifically to leave today to the live check-in.
const DAY_OFFSETS = Array.from({ length: 31 }, (_, i) => i);

function dayLabel(offsetDays: number, date: Date): string {
  if (offsetDays === 0) return 'Today';
  if (offsetDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatEntryDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Reached from Settings' DATA section. Gated on healthConsent, same as the
 * onboarding fields this data extends — see HealthConsentGate's own comment.
 */
export default function ConditionLogScreen() {
  const insets = useSafeAreaInsets();
  const colors = useAppColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const backHover = useHoverFade();
  const addHover = useHoverFade();
  const savePress = useLiquidPress();

  const [entries, setEntries] = useState<ConditionLogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dayIndex, setDayIndex] = useState(0);
  const [selectedCondition, setSelectedCondition] = useState<Condition | null>(null);
  const [note, setNote] = useState('');

  const reload = useCallback(() => {
    (async () => {
      const [log, profile] = await Promise.all([getConditionLog(), getProfile()]);
      setEntries(log);
      setHasConsent(profile?.healthConsent === 'true');
      setLoaded(true);
    })();
  }, []);
  useFocusEffect(reload);

  const wheelItems = useMemo(
    () =>
      DAY_OFFSETS.map((offset) => {
        const d = new Date();
        d.setDate(d.getDate() - offset);
        return dayLabel(offset, d);
      }),
    []
  );
  const selectedDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - DAY_OFFSETS[dayIndex]);
    return localDateStr(d);
  }, [dayIndex]);

  const handleToggleAdd = () => {
    hapticSelect();
    setAdding((a) => !a);
  };

  const handleSave = async () => {
    if (!selectedCondition) return;
    hapticImpactLight();
    await addConditionLogEntry(Crypto.randomUUID(), selectedDateStr, selectedCondition, note);
    reload();
    setDayIndex(0);
    setSelectedCondition(null);
    setNote('');
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    hapticImpactLight();
    const previous = entries;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await deleteConditionLogEntry(id);
    } catch {
      hapticError();
      setEntries(previous);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          onHoverIn={backHover.onHoverIn}
          onHoverOut={backHover.onHoverOut}
          hitSlop={10}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <SymbolView name="chevron.left" size={16} tintColor={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} maxFontSizeMultiplier={1.3}>Condition Log</Text>
        <View style={styles.backButton} />
      </View>

      {!loaded ? null : !hasConsent ? (
        <HealthConsentGate />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Pressable
              style={styles.addRow}
              onPress={handleToggleAdd}
              onHoverIn={addHover.onHoverIn}
              onHoverOut={addHover.onHoverOut}
              accessibilityRole="button"
              accessibilityLabel={adding ? 'Cancel logging a flare-up' : 'Log a flare-up'}
            >
              <SymbolView name={adding ? 'xmark' : 'plus'} size={13} tintColor="#5FBE84" />
              <Text style={styles.addRowText} maxFontSizeMultiplier={1.2}>
                {adding ? 'Cancel' : 'Log a flare-up'}
              </Text>
            </Pressable>

            {adding ? (
              <View style={styles.addCard}>
                <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>When</Text>
                <View style={styles.wheelCard}>
                  <WheelPicker items={wheelItems} selectedIndex={dayIndex} onChange={setDayIndex} width={200} />
                </View>

                <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Which condition</Text>
                <View style={styles.pillGrid}>
                  {CONDITIONS.map((condition) => {
                    const isSelected = selectedCondition === condition;
                    return (
                      <Pressable
                        key={condition}
                        style={styles.gridPillHit}
                        onPress={() => {
                          hapticSelect();
                          setSelectedCondition((prev) => (prev === condition ? null : condition));
                        }}
                      >
                        <View style={[styles.gridPillVisual, isSelected && styles.gridPillVisualSelected]}>
                          <Text
                            style={[styles.gridPillText, isSelected && styles.gridPillTextSelected]}
                            numberOfLines={1}
                            maxFontSizeMultiplier={1.1}
                          >
                            {CONDITION_LABELS[condition]}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel} maxFontSizeMultiplier={1.3}>Note (optional)</Text>
                <TextInput
                  style={styles.noteInput}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Anything worth remembering?"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  maxFontSizeMultiplier={1.3}
                />

                <Pressable
                  onPress={handleSave}
                  onPressIn={savePress.onPressIn}
                  onPressOut={savePress.onPressOut}
                  disabled={!selectedCondition}
                  style={styles.saveButtonHit}
                >
                  <View style={[styles.saveButton, !selectedCondition && styles.saveButtonDisabled]}>
                    <Text style={styles.saveButtonText} maxFontSizeMultiplier={1.15}>Log It</Text>
                  </View>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionKicker} maxFontSizeMultiplier={1.3}>HISTORY</Text>
            {entries.length === 0 ? (
              <View style={styles.emptyCard}>
                <SymbolView name="heart.text.square" size={26} tintColor={colors.iconFaint} style={styles.emptyIcon} />
                <Text style={styles.emptyText} maxFontSizeMultiplier={1.3}>
                  Nothing logged yet.
                </Text>
              </View>
            ) : (
              <View style={styles.card}>
                {entries.map((entry, index) => (
                  <Swipeable
                    key={entry.id}
                    renderRightActions={() => (
                      <Pressable
                        style={styles.deleteAction}
                        onPress={() => handleDelete(entry.id)}
                        accessibilityRole="button"
                        accessibilityLabel="Delete entry"
                      >
                        <SymbolView name="trash.fill" size={15} tintColor="#ffffff" />
                      </Pressable>
                    )}
                    overshootRight={false}
                  >
                    <View
                      style={[
                        styles.entryRow,
                        index < entries.length - 1 && styles.entryRowDivider,
                        { backgroundColor: colors.surface },
                      ]}
                    >
                      <View style={styles.entryText}>
                        <Text style={styles.entryCondition} maxFontSizeMultiplier={1.2}>
                          {CONDITION_LABELS[entry.condition]}
                        </Text>
                        {entry.note ? (
                          <Text style={styles.entryNote} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                            {entry.note}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.entryDate} maxFontSizeMultiplier={1.2}>{formatEntryDate(entry.date)}</Text>
                    </View>
                  </Swipeable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useAppColors>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      color: colors.text,
      fontSize: 16,
      fontFamily: 'Geist-SemiBold',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
      gap: 28,
    },
    section: {
      gap: 12,
    },
    sectionKicker: {
      color: colors.textTertiary,
      fontSize: 11,
      letterSpacing: 1,
      fontFamily: 'Geist-SemiBold',
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
    },
    addRowText: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    addCard: {
      marginTop: 10,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 16,
      gap: 12,
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    wheelCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      paddingVertical: 8,
      alignItems: 'center',
    },
    pillGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    gridPillHit: {
      width: '47%',
      height: 40,
    },
    gridPillVisual: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.pillBorder,
      backgroundColor: colors.pillBg,
      paddingHorizontal: 6,
    },
    gridPillVisualSelected: {
      borderColor: '#438C63',
      backgroundColor: 'rgba(67,140,99,0.18)',
    },
    gridPillText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-SemiBold',
    },
    gridPillTextSelected: {
      color: '#5FBE84',
    },
    noteInput: {
      minHeight: 70,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.background,
      padding: 12,
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-Regular',
      textAlignVertical: 'top',
    },
    saveButtonHit: {
      width: '100%',
    },
    saveButton: {
      paddingVertical: 14,
      borderRadius: 14,
      backgroundColor: '#438C63',
      alignItems: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.4,
    },
    saveButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontFamily: 'Geist-SemiBold',
    },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    emptyCard: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.surfaceBorder,
      backgroundColor: colors.surface,
      padding: 20,
      alignItems: 'center',
    },
    emptyIcon: {
      marginBottom: 10,
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: 12.5,
      fontFamily: 'Geist-Medium',
      lineHeight: 18,
      textAlign: 'center',
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 13,
      gap: 10,
    },
    entryRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.surfaceDivider,
    },
    entryText: {
      flex: 1,
      gap: 2,
    },
    entryCondition: {
      color: colors.text,
      fontSize: 13,
      fontFamily: 'Geist-SemiBold',
    },
    entryNote: {
      color: colors.textTertiary,
      fontSize: 11.5,
      fontFamily: 'Geist-Regular',
    },
    entryDate: {
      color: colors.textSecondary,
      fontSize: 12,
      fontFamily: 'Geist-Medium',
    },
    deleteAction: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#E5484D',
    },
  });
}
