// app.json stays the readable source of truth; this layer adds what depends
// on the environment. The Sentry config plugin uploads source maps and dSYMs
// at build time so crash traces are readable; it only joins the plugin list
// when the organisation and project are set (EAS env: SENTRY_ORG,
// SENTRY_PROJECT, plus SENTRY_AUTH_TOKEN as a secret), so a build without
// them is exactly the build app.json describes.
module.exports = ({ config }) => {
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const plugins = [...(config.plugins ?? [])];
  if (org && project) plugins.push(['@sentry/react-native/expo', { organization: org, project, url: process.env.SENTRY_URL || 'https://sentry.io/' }]);
  return { ...config, plugins };
};
