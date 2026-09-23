import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

/**
 * SF Symbol -> Android Material Symbol name, for every icon this app
 * actually uses. expo-symbols renders real Material Symbols on Android (see
 * AGENTS.md's own "Expo HAS CHANGED" note — this wasn't true in older SDKs),
 * but only when `name` is passed as `{ ios, android }`; a bare SF Symbol
 * string (this app's icon usage until now, iOS-only) resolves to nothing on
 * Android and the icon silently renders blank. `AppSymbol` (./app-symbol.tsx)
 * is the one place this table gets consulted — nothing else should import
 * it directly.
 *
 * Values are real Google Material Symbols ligature names, each checked
 * against expo-symbols' own bundled symbols.json before being added here —
 * not guessed. Where a `.fill` SF Symbol variant has no distinct Material
 * ligature, it deliberately maps to the same value as its non-fill
 * counterpart (Material Symbols draws fill from a font axis this library
 * doesn't expose per-icon, not a separate icon name) — the fill/outline
 * nuance is lost on Android, but the icon itself still renders.
 */
export const ANDROID_ICON_MAP: Partial<Record<SFSymbol, AndroidSymbol>> = {
  archivebox: 'archive',
  'archivebox.fill': 'archive',
  'arrow.clockwise': 'refresh',
  'arrow.triangle.2.circlepath': 'sync',
  'arrow.up.right': 'north_east',
  'arrow.down.right': 'trending_down',
  'arrow.right': 'trending_flat',
  'arrow.uturn.left': 'undo',
  'bed.double': 'bedtime',
  'bed.double.fill': 'bedtime',
  'bell.fill': 'notifications',
  calendar: 'calendar_month',
  'calendar.badge.plus': 'calendar_add_on',
  camera: 'photo_camera',
  'creditcard.fill': 'credit_card',
  'chart.bar.fill': 'bar_chart',
  'chart.bar.xaxis': 'bar_chart',
  'chart.line.uptrend.xyaxis': 'trending_up',
  checkmark: 'check',
  'checkmark.circle.fill': 'check_circle',
  'chevron.left': 'chevron_left',
  'chevron.right': 'chevron_right',
  'wifi.slash': 'wifi_off',
  'chevron.up': 'expand_less',
  'chevron.down': 'expand_more',
  'circle.dashed': 'radio_button_unchecked',
  'clock.arrow.circlepath': 'history',
  'clock.fill': 'schedule',
  'dumbbell.fill': 'fitness_center',
  faceid: 'fingerprint',
  'figure.arms.open': 'self_improvement',
  'figure.strengthtraining.traditional': 'fitness_center',
  'figure.walk': 'directions_walk',
  'flame.fill': 'local_fire_department',
  folder: 'folder',
  'folder.fill': 'folder_open',
  'fork.knife': 'restaurant',
  'gearshape.fill': 'settings',
  'hand.raised': 'front_hand',
  'heart.fill': 'favorite',
  'heart.text.square': 'health_and_safety',
  'info.circle': 'info',
  'iphone.radiowaves.left.and.right': 'phonelink_ring',
  link: 'link',
  'list.bullet.clipboard': 'assignment',
  'lock.fill': 'lock',
  'mappin.and.ellipse': 'location_on',
  'moon.zzz.fill': 'bedtime',
  'note.text': 'notes',
  'pause.fill': 'pause',
  pencil: 'edit',
  'person.2.fill': 'group',
  'person.crop.circle.badge.xmark': 'no_accounts',
  'person.crop.circle.fill': 'account_circle',
  'person.text.rectangle.fill': 'badge',
  'photo.on.rectangle': 'photo_library',
  'photo.stack': 'collections',
  'play.fill': 'play_arrow',
  'play.rectangle': 'smart_display',
  plus: 'add',
  'questionmark.circle': 'help',
  'rectangle.split.2x1': 'splitscreen',
  ruler: 'straighten',
  scalemass: 'monitor_weight',
  'slider.horizontal.3': 'tune',
  sparkles: 'auto_awesome',
  'square.and.arrow.up': 'share',
  'square.and.pencil': 'edit_square',
  target: 'track_changes',
  touchid: 'fingerprint',
  trash: 'delete_outline',
  'trash.fill': 'delete',
  xmark: 'close',
};
