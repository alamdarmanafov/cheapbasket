import { tr } from './i18n';
import { Alert, Platform } from 'react-native';

/**
 * Confirm dialog that works on native (Alert) and web (window.confirm). Resolves true when confirmed.
 * `cancelLabel` is worth setting when the dialog reports something that already
 * happened — tr('common.cancel') then reads as if it would undo it.
 */
export function confirmAsync(title: string, message: string, okLabel = tr('common.yes'), destructive = false, cancelLabel = tr('common.cancel')): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: okLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

export function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
