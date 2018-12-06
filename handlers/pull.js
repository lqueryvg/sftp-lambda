const SSH2Promise = require("ssh2-promise");

const { pullTreeRecursive } = require("./lib/pullTree");
const { getEnv, getSSHConfig, assertAllVarsSet } = require("./lib/helpers");

// function sleep(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms));
// }

// get files from sftp server
// - called by schedule
module.exports.pull = async () => {
  console.log(`pull() invoked`);

  const sshconfig = getSSHConfig();

  assertAllVarsSet("pull");
  const ssh = await new SSH2Promise(sshconfig);
  const sftp = ssh.sftp();
  try {
    await pullTreeRecursive({
      sftp,
      dirpath: getEnv("SFTP_SOURCE_DIR"),
      fileRetentionMilliseconds:
        getEnv("SFTP_FILE_RETENTION_DAYS") * (24 * 60 * 60 * 1000)
    });
    console.log("done");
  } catch (e) {
    // TODO: add metric for errors
    console.log(e);
    if (e.code !== "ECONNREFUSED") {
      await ssh.close();
    }
    return;
  }

  console.log("closing ssh connection");
  await ssh.close();
};
