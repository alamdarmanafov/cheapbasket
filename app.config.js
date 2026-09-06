const fs = require('fs');
const base = require('./app.json');

module.exports = ({ config }) => {
  const expo = { ...base.expo, ...config };
  if (fs.existsSync('./google-services.json')) {
    expo.android = { ...expo.android, googleServicesFile: './google-services.json' };
  }
  return expo;
};
