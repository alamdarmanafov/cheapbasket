/**
 * Expo config plugin that patches the generated Podfile so iOS Google Maps
 * works with react-native-maps v1.x. Expo's built-in Maps.js still uses the
 * old `react-native-google-maps` podspec name which no longer exists; the new
 * package ships a single `react-native-maps.podspec` with a `Google` subspec.
 */
const { withPodfile } = require('@expo/config-plugins');

const withFixedMapsPlugin = (config) => {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    // Replace the old pod name Expo injects with the correct new one
    config.modResults.contents = contents.replace(
      /pod 'react-native-google-maps',\s*(path:[^\n]+)/g,
      "pod 'react-native-maps', $1, :subspecs => ['Google']"
    );
    return config;
  });
};

module.exports = withFixedMapsPlugin;
