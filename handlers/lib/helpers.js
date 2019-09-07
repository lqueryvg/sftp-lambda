const getEnv = varName => {
  const ret = process.env[varName];
  if (!ret) throw new Error(`Environment variable ${varName} not set`);
  return ret;
};

const pushVars = [
  "SFTP_RETRY_QUEUE_NAME",
  // "SFTP_S3_SOURCE_STRIP_PREFIX", // TODO
  "SFTP_TARGET_DIR"
];
const mandatoryVars = {
  ftp: ["SFTP_HOST", "SFTP_PORT", "SFTP_USER", "SFTP_PRIVATE_KEY"],
  push: pushVars,
  pull: [
    "SFTP_TARGET_S3_BUCKET",
    "SFTP_TARGET_S3_PREFIX",
    "SFTP_SOURCE_DIR",
    "SFTP_FILE_RETENTION_DAYS"
  ],
  pushRetry: pushVars
};

const variableIsSet = varName => varName in process.env;

const assertAllVarsSet = operationType => {
  const requiredVars = [...mandatoryVars.ftp, ...mandatoryVars[operationType]];
  if (!requiredVars.every(variableIsSet)) {
    throw new Error(
      `ERROR: not all required variables are set for '${operationType}' operation. Required vars are:\n  ${requiredVars.join(
        "\n  "
      )}`
    );
  }
};

const getSSHConfig = () => ({
  host: getEnv("SFTP_HOST"),
  port: getEnv("SFTP_PORT"),
  username: getEnv("SFTP_USER"),
  privateKey: getEnv("SFTP_PRIVATE_KEY"),
  reconnect: true,
  reconnectTries: 3,
  reconnectDelay: 2000,
  readyTimeout: 20
});

module.exports = {
  getSSHConfig,
  getEnv,
  assertAllVarsSet
};
