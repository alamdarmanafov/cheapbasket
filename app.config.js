const fs = require('fs');
const base = require('./app.json');

module.exports = ({ config }) => {
  const expo = { ...base.expo, ...config };
  // Android push (FCM): local file in the repo root, or the file secret uploaded with
  // `eas env:create --name GOOGLE_SERVICES_JSON --type file` for EAS builds.
  const googleServices = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync('./google-services.json') ? './google-services.json' : null);
  if (googleServices) expo.android = { ...expo.android, googleServicesFile: googleServices };
  // Android map tiles (react-native-maps) need a Google Maps SDK key; iOS uses Apple Maps without a key.
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_KEY;
  if (mapsKey) expo.android = { ...expo.android, config: { ...(expo.android?.config ?? {}), googleMaps: { apiKey: mapsKey } } };
  return expo;
};
