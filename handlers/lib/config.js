// if the 3rd field is blank, the variable must be set
const configString = `
  SFTP_RETRY_QUEUE_NAME            push,retry
  SFTP_TARGET_DIR                  push,retry
  SFTP_PUSH_TIMEOUT_SECONDS        push,retry      20
  SFTP_SOURCE_S3_REGEXP_STRIP      push,retry      optional
  SFTP_HOST                        all
  SFTP_PORT                        all
  SFTP_USER                        all
  SFTP_PASSWORD                    all             optional
  SFTP_PRIVATE_KEY                 all             optional
  SFTP_SSH_READY_TIMEOUT_SECONDS   all             5
  SFTP_TARGET_S3_BUCKET            pull
  SFTP_TARGET_S3_PREFIX            pull
  SFTP_SOURCE_DIR                  pull
  SFTP_FILE_RETENTION_DAYS         pull            0
  `;

const validActionType = {
  push: true,
  pull: true,
  retry: true
};

const initEnvVars = ftpActionType => {
  if (!ftpActionType) throw new Error("ERROR: ftpActionType not supplied");
  if (!validActionType[ftpActionType])
    throw new Error(`ERROR: invalid ftpActionType "${ftpActionType}" supplied`);

  // const config = {};
  const errors = [];
  /* eslint-disable no-restricted-syntax */
  /* eslint-disable no-continue */
  for (let line of configString.split("\n")) {
    // skip empty lines
    if (!line) continue;
    line = line.trim();
    if (line === "") continue;

    const [varName, appliesToString, defaultValue] = line.split(/ +/);

    const appliesTo = {};
    for (const word of appliesToString.split(",")) {
      appliesTo[word] = true;
    }

    if (appliesToString === "all" || appliesTo[ftpActionType]) {
      if (process.env[varName]) continue;
      if (defaultValue === "optional") {
        // the calling code is responsible for checking this
        continue;
      }
      if (defaultValue && defaultValue !== "optional") {
        process.env[varName] = defaultValue;
        continue;
      }
      errors.push(`${varName} must be set for ${ftpActionType} operation`);
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
};

const getEnv = (varName, altVars = []) => {
  // any unset environment variables should have been caught by now,
  // but using this function at least creates a usable error message
  const ret = process.env[varName];
  if (ret || (!ret && altVars.some(altVar => !!process.env[altVar]))) {
    return ret;
  }
  if (altVars.length === 0) {
    throw new Error(`Environment variable ${varName} not set`);
  } else {
    throw new Error(
      `Environment variables ${[varName, ...altVars].join(
        ", "
      )} not set, need at least one`
    );
  }
};

module.exports = {
  initEnvVars,
  getEnv
  // assertAllVarsSet
};
