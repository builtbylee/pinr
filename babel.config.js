module.exports = function (api) {
    api.cache(true);

    const plugins = ['react-native-reanimated/plugin'];

    // Strip console.* calls in production builds for security
    if (process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production') {
        plugins.unshift('transform-remove-console');
    }

    return {
        presets: ['babel-preset-expo'],
        plugins,
    };
};
