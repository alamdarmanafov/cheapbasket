/**
 * What every push the admin side sends has in common.
 *
 * The sound is the app's own bell, bundled into the binary by the
 * expo-notifications config plugin (`sounds` in app.json) under this file
 * name; iOS plays it by name, Android plays whatever the channel was created
 * with. The channel id must match the one the app registers — a channel's
 * sound cannot be changed once it exists, which is why the id carries a
 * version.
 */
export const PUSH_SOUND = 'appsound.wav';
export const PUSH_CHANNEL = 'alerts-v2';
export const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
