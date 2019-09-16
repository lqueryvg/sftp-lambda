const SSH2Promise = require("ssh2-promise");
const path = require("path");

const { getEnv } = require("./config");
const { getSSHConfig } = require("./sshConfig");
const { initEnvVars } = require("./config");

const sqs = require("./sqs");
const s3 = require("./s3");
const { resolvePromiseWithTimeout } = require("./resolvePromiseWithTimeout");

const makeTree = async (sftp, topDir, pathToCreate) => {
  console.log(
    `makeTree(): invoked, topDir=${topDir}, pathToCreate=${pathToCreate}`
  );
  if (pathToCreate === ".") return;

  await pathToCreate
    .split(path.sep)
    .reduce(async (prevPathPromise, currentDir) => {
      const prevPath = await prevPathPromise;
      // console.log(`makeTree(): prevPath=${prevPath}, currentDir=${currentDir}`);
      const currentPath = path.join(prevPath, currentDir, path.sep);
      // console.log(`makeTree(): currentPath=${currentPath}`);
      const fullPath = path.join(topDir, currentPath, path.sep);

      // console.log(`makeTree(): stat ${fullPath}`);
      try {
        await sftp.stat(fullPath);
      } catch (error) {
        if (error.message === "No such file") {
          // console.log(`makeTree(): mkdir ${fullPath}`);
          await sftp.mkdir(fullPath);
          // console.log("makeTree(): mkdir complete");
        } else {
          throw error;
        }
      }

      return currentPath;
    }, Promise.resolve(""));
};

const sendFile = async ({ filename, data }) => {
  const targetDir = getEnv("SFTP_TARGET_DIR");
  const sshconfig = getSSHConfig();
  console.log(
    `sendFile(): filename=${filename}, targetDir=${targetDir}, connecting...`
  );
  // console.log(sshconfig);
  const ssh = await new SSH2Promise(sshconfig);

  try {
    const sftp = await ssh.sftp();
    let stats;
    try {
      stats = await sftp.stat(targetDir);
    } catch (error) {
      console.log(`sendFile(): caught error '${error.message}'`);
      if (error.message === "No such file") {
        throw new Error(`ERROR: SFTP_TARGET_DIR ${targetDir} does not exist`);
      }
      console.log(`sendFile(): throwing error`);
      throw error;
    }
    if (!stats.isDirectory()) {
      throw new Error(`ERROR: SFTP_TARGET_DIR ${targetDir} is not a directory`);
    }

    await makeTree(sftp, targetDir, path.dirname(filename));
    console.log("sendFile(): makeTree() returned");
    const targetFilename = path.join(targetDir, filename);
    console.log(`sendFile(): writing file to target ${targetFilename}...`);
    await sftp.writeFile(targetFilename, data);
  } catch (error) {
    // try to close the connection, but still log and throw the original error
    console.log(error);
    await ssh.close();
    throw error;
  }

  await ssh.close();
};

const pushFileInternal = async ({ Bucket, Key }) => {
  // if isRetry and the s3 object definitely does not exist, we need
  // to return silently, so that the SQS error event will be deleted
  // so that no further retry takes place
  const response = await s3.getObject({ Bucket, Key });
  // console.log(
  //   `pushFile(): response.Body=${response.Body.toString().replace(/\n$/, "")}`
  // );

  // await sleep(10000);
  // Note that if this was not a retry, the S3 object has
  // either been pushed or over-written. In either case the metadata will
  // have been cleared, therefore "synced" will not be "true".
  if (response.Metadata && response.Metadata.synched === "true") {
    console.log(
      `pushFileInternal(): object already synched: Bucket=${Bucket}, Key=${Key}`
    );
    return;
  }

  console.log(`pushFileInternal(): object NOT already synched`);

  let targetPath = Key;
  const regexpString = process.env.SFTP_SOURCE_S3_REGEXP_STRIP;
  if (regexpString) {
    const regexp = new RegExp(regexpString);
    targetPath = Key.replace(regexp, "");
    console.log(
      `pushFileInternal(): strip ${regexpString} from key ${Key} = ${targetPath}`
    );
  }

  await sendFile({ filename: targetPath, data: response.Body });
  await s3.setObjectSynched({ Bucket, Key });
};

module.exports.pushFile = async ({ Bucket, Key, isRetry = false }) => {
  try {
    initEnvVars("push");

    await resolvePromiseWithTimeout(
      pushFileInternal({ Bucket, Key }),
      getEnv("SFTP_PUSH_TIMEOUT_SECONDS")
    );
  } catch (error) {
    console.log(`pushFile(): caught error "${error}"`);
    if (isRetry) {
      throw error;
    } else {
      console.log(
        `ERROR: pushFile() got the following error:\n${error.message}`
      );
      if (error.message.match(/must be set for \w+ operation/)) {
        console.error(
          "but this looks like a configuration problem; the retry will never succeed until the configuration is fixed"
        );
      }

      console.log("pushFile(): queuing event for later retry...");
      const q = await sqs.getQueue();
      console.log(`pushFile(): q = ${JSON.stringify(q)}`);

      await sqs.addMessage(q, { Bucket, Key });
      // console.log("calling exit");
      // callback();
      // process.exit(0);
    }
  }
};
