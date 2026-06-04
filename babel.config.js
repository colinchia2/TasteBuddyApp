module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin powers Reanimated 4 (used by
    // react-native-draggable-flatlist). MUST be the last plugin.
    plugins: ['react-native-worklets/plugin'],
  };
};
