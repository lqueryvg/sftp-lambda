const SSH2Promise = require("ssh2-promise");

const { pullTree } = require("./lib/pullTree");
const { getSSHConfig } = require("./lib/sshConfig");
const { getEnv, initEnvVars } = require("./lib/config");

// get files from sftp server
// - called by schedule
module.exports.pull = async (_event, context, callback) => {
  console.log(`pull() invoked`);

  const sshconfig = getSSHConfig();

  initEnvVars("pull");
  const ssh = await new SSH2Promise(sshconfig);
  const sftp = ssh.sftp();
  try {
    console.log(`source FTP directory is ${getEnv("SFTP_SOURCE_DIR")}`);
    await pullTree({
      sftp,
      dirpath: getEnv("SFTP_SOURCE_DIR"),
      fileRetentionMilliseconds:
        getEnv("SFTP_FILE_RETENTION_DAYS") * (24 * 60 * 60 * 1000)
    });
    console.log("pullTree() returned");
  } catch (e) {
    // TODO: add metric for errors
    console.error(`ERROR: ${e.message}`);
    if (e.code !== "ECONNREFUSED") {
      await ssh.close();
    }
    return;
  }

  console.log("closing ssh connection");
  await ssh.close();

  if (callback) callback(null, "Success");
};
