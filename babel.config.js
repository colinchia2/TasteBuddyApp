module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 54+) automatically adds react-native-worklets/plugin
    // (which powers Reanimated 4, used by react-native-draggable-flatlist) when the
    // package is installed — so it must NOT be listed manually, or it applies twice.
    presets: ['babel-preset-expo'],
  };
};
