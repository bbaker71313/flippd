module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE !== 'production') {
    return config;
  }

  return {
    ...config,
    autolinking: {
      ...(config.autolinking ?? {}),
      exclude: [
        ...((config.autolinking?.exclude) ?? []),
        'expo-dev-client',
      ],
    },
  };
};
