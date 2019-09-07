const SSH2Promise = require("ssh2-promise");
const path = require("path");

const helpers = require("./helpers");
const sqs = require("./sqs");
const s3 = require("./s3");
const { assertAllVarsSet } = require("./helpers");

const sendFile = async ({ filename, data }) => {
  console.log(`sendFile(filename=${filename}), connecting...`);
  const sshconfig = helpers.getSSHConfig();
  const ssh = await new SSH2Promise(sshconfig);

  try {
    const sftp = await ssh.sftp();
    const targetFilename = `${helpers.getEnv("SFTP_TARGET_DIR")}/${filename}`;
    console.log(`writing file to target ${targetFilename}...`);

    await sftp.writeFile(targetFilename, data);
  } catch (error) {
    // try to close the connection, but still log and throw the original error
    console.log(error);
    await ssh.close();
    throw error;
  }

  await ssh.close();
};

module.exports.pushFile = async ({ Bucket, Key, isRetry = false }) => {
  // TODO - wrap this in a try catch
  // if isRetry and the s3 object definitely does not exist, we need
  // to return silently, so that the SQS error event will be deleted
  // so that no further retry takes place
  const response = await s3.getObject({ Bucket, Key });
  console.log(`response=${response}`);
  console.log(`response.Body=${response.Body}`);

  // Note that if this was not a retry, the S3 object has
  // either been pushed or over-written. In either case the metadata will
  // have been cleared, therefore "synced" will not be "true".
  console.log(`response.Metadata.synched=${response.Metadata.synched}`);
  if (response.Metadata && response.Metadata.synched === "true") {
    console.log(`object already synced: Bucket=${Bucket}, Key=${Key}`);
    return;
  }

  try {
    assertAllVarsSet("push");
    await sendFile({ filename: path.basename(Key), data: response.Body });
    await s3.setObjectSynched({ Bucket, Key });
  } catch (error) {
    console.log(error);
    if (isRetry) {
      throw error;
    } else {
      console.log("queuing event for later pushRetry...");
      if (error.message.match(/ERROR: not all required variables are set/)) {
        console.error(
          "but this looks like a configuration problem so the pushRetry will never succeed until the configuration is fixed."
        );
      }

      const q = await sqs.getQueue();
      await sqs.addMessage(q, { Bucket, Key });
    }
  }
};
