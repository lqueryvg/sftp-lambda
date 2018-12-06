const SSH2Promise = require("ssh2-promise");
const path = require("path");

const helpers = require("./helpers");
const sqs = require("./sqs");
const s3 = require("./s3");

const sendFile = async ({ filename, data }) => {
  const sshconfig = helpers.getSSHConfig();
  const ssh = await new SSH2Promise(sshconfig);

  try {
    const sftp = await ssh.sftp();
    await sftp.writeFile(filename, data);
  } catch (error) {
    // try to close the connection, but still log and throw the original error
    console.log(error);
    await ssh.close();
    throw error;
  }

  await ssh.close();
};

module.exports.pushFile = async ({ Bucket, Key, isRetry = false }) => {
  const s3Obj = await s3.getObject({ Bucket, Key });

  if (s3Obj.Metadata && s3Obj.Metadata.synched === true) {
    console.log(`object already synced: Bucket=${Bucket}, Key=${Key}`);
    return;
  }

  try {
    await sendFile({ filename: path.basename(Key), data: s3Obj.body });
  } catch (error) {
    console.log(error);
    if (isRetry) {
      throw error;
    } else {
      console.log("queuing event for later pushRetry...");
      if (error.message.match(/Environment variable.*not set/)) {
        console.error(
          "but this looks like a configuration problem so the pushRetry will never succeed until the configuration is fixed."
        );
      }

      const q = await sqs.getQueue();
      await sqs.addMessage(q, { Bucket, Key });
    }
  }
};
