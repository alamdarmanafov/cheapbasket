import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * How much of the screen the keyboard covers right now, for views that
 * `KeyboardAvoidingView` cannot help.
 *
 * A sheet pinned to the bottom with `position: absolute` ignores the padding
 * the avoiding view adds, so the keyboard slides up over it and the field the
 * person just tapped disappears. The sheet reads this and raises its own
 * `bottom` instead.
 *
 * iOS only: Android resizes the window itself (`softwareKeyboardLayoutMode`
 * defaults to "resize"), so a bottom-pinned view there already sits on the
 * keyboard, and adding the height again would lift it twice.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
