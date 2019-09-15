const getEnv = varName => {
  const ret = process.env[varName];
  if (!ret) throw new Error(`Environment variable ${varName} not set`);
  return ret;
};

const pushVars = [
  "SFTP_RETRY_QUEUE_NAME",
  "SFTP_TARGET_DIR",
  "SFTP_PUSH_TIMEOUT_SECONDS"
];
const mandatoryVars = {
  ftp: [
    "SFTP_HOST",
    "SFTP_PORT",
    "SFTP_USER",
    "SFTP_PRIVATE_KEY",
    "SFTP_SSH_READY_TIMEOUT_SECONDS"
  ],
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

const getSSHConfig = () => {
  const options = {
    // debug: console.log,
    host: getEnv("SFTP_HOST"),
    port: getEnv("SFTP_PORT"),
    username: getEnv("SFTP_USER"),
    privateKey: getEnv("SFTP_PRIVATE_KEY"),
    reconnect: false, // setting this to true only confuses the overall timeout requirements
    readyTimeout: getEnv("SFTP_SSH_READY_TIMEOUT_SECONDS") * 1000 // milliseconds, the timeout for initial ssh connection
    // reconnectTries: 3,
    // reconnectDelay: 2000
  };
  // if (options.host !== "localhost") {
  //   // otherwise, this option breaks local docker testing
  //   options.readyTimeout = 5000; // milliseconds
  // }
  console.log(
    `getSSHConfig(): host=${options.host}, port=${options.port}, username=${
      options.username
    }`
  );
  return options;
};

module.exports = {
  getSSHConfig,
  getEnv,
  assertAllVarsSet
};
