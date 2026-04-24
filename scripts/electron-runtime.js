const CONTAINER_FLAGS = ['--no-sandbox', '--disable-setuid-sandbox'];

function shouldUseContainerFlags(
  env = process.env,
  platform = process.platform
) {
  return platform === 'linux' && env.CODESPACES === 'true';
}

function buildElectronArgs(
  appArgs,
  env = process.env,
  platform = process.platform
) {
  return shouldUseContainerFlags(env, platform)
    ? [...CONTAINER_FLAGS, ...appArgs]
    : appArgs;
}

function buildElectronEnvironment(env = process.env, extra = {}) {
  const next = {
    ...env,
    ...extra
  };

  delete next.ELECTRON_RUN_AS_NODE;
  return next;
}

module.exports = {
  CONTAINER_FLAGS,
  buildElectronArgs,
  buildElectronEnvironment,
  shouldUseContainerFlags
};
