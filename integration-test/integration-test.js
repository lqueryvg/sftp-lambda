/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */
const shell = require("shelljs");
// shell.config.verbose = true;
const chalk = require("chalk");
const fs = require("fs");

require("dotenv").config({ path: "../.env.local" });

const { spawn } = require("child_process");
const waitPort = require("wait-port");
const s3 = require("./lib/s3");
const sqs = require("./lib/sqs");
const { waitFor, run } = require("./lib/utils");

const dockerDown = () => {
  shell.exec("docker-compose down");
};

const initTestData = () => {
  shell.exec("./init-test-data.sh");
};

const setAWSEnv = () => {
  process.env.AWS_ACCESS_KEY_ID = "S3RVER";
  process.env.AWS_SECRET_ACCESS_KEY = "S3RVER";
};

const countSQSMessages = async () => {
  const messages = await sqs.getMessages({
    QueueUrl: `http://localhost:9324/queue/${process.env.LOCAL_RETRY_QUEUE}`
  });
  console.log(`messages = ${JSON.stringify(messages)}`);
  if (!messages.Messages) return 0;
  return messages.Messages.length;
};

const waitForSQSMessages = async ({ expectedNumber }) => {
  await waitFor({
    funcToBeTrue: async () => {
      console.log(`hoping for ${expectedNumber} SQS messages...`);
      return (await countSQSMessages()) === expectedNumber;
    },
    initialRetries: 5,
    intervalMilliseconds: 1000
  });
};

const startSQS = async () => {
  shell.exec("docker-compose up -d sqs");
  await waitPort({ port: 9324, interval: 500 }, 2000);
};

const initSSHKey = () => {
  shell.exec("./init-ssh-key.sh");
};

const startServerless = async () => {
  const serverlessProcess = await spawn(
    "yarn exec -- sls offline start --env local --stage local",
    [],
    {
      cwd: "..",
      shell: true,
      stdio: "inherit"
    }
  );

  const portsAreUp =
    (await waitPort({ port: 3000, interval: 500, timeout: 8000 })) && // serverless lambda port
    (await waitPort({ port: 8000, interval: 500, timeout: 8000 })); // s3 local port

  if (!portsAreUp) {
    console.error("timed out waiting for ports, exiting...");
    process.exit(1);
  }
  console.log("ports are open, continuing...");

  return serverlessProcess;
};

const createSQSQueue = async () => {
  // shell.exec(
  //   "aws sqs --endpoint-url http://localhost:9324 create-queue --queue-name $LOCAL_RETRY_QUEUE"
  // );

  await waitFor({
    funcToBeTrue: async () => {
      console.log("try to create queue...");
      try {
        await sqs.createQueue({
          QueueName: `${process.env.LOCAL_RETRY_QUEUE}`
        });
      } catch (e) {
        console.error(e);
        return false;
      }
      return true;
    },
    initialRetries: 5,
    intervalMilliseconds: 1000
  });
};

const testPush = async () => {
  await s3.putObject({
    Bucket: `${process.env.LOCAL_S3_BUCKET}`,
    Key: "outbound/files/file1.csv",
    Body: "file1 data"
  });
  // shell.exec(
  //   "aws s3 --endpoint http://localhost:8000 ls $LOCAL_S3_BUCKET/ --recursive"
  // );

  // shell.exec(
  //   `aws sqs --endpoint-url http://localhost:9324 receive-message \
  //     --queue-url http://localhost:9324/queue/$LOCAL_RETRY_QUEUE`
  // );
};

const startFTPServer = () => {
  shell.exec("docker-compose up -d ftp");
};

const waitForSFTPAvailable = async () => {
  let code;

  await waitFor({
    funcToBeTrue: async () => {
      console.log("checking ssh connection...");
      shell.set("+e");
      ({ code } = shell
        .ShellString("ls -l")
        .exec(
          "sftp -o StrictHostKeyChecking=no -i tmp/ssh-key/sftptest -P 2222 demo@localhost"
        ));
      shell.set("-e");
      return code === 0;
    },
    initialRetries: 5,
    intervalMilliseconds: 1000
  });
};

const testPushRetry = async () => {
  // shell.exec(
  //   `aws sqs --endpoint-url http://localhost:9324 receive-message \
  //     --queue-url http://localhost:9324/queue/$LOCAL_RETRY_QUEUE`
  // );

  // retry until file arrives
  await waitFor({
    funcToBeTrue: async () => {
      console.log("checking ssh connection...");
      shell.exec(
        "yarn exec -- sls invoke local -f pushFilesRetry --env local --stage local -d '{}'",
        {
          cwd: ".."
        }
      );
      const stats = fs.statSync("tmp/ftp-share/inbound/files/file1.csv");

      return stats.isFile();
    },
    initialRetries: 5,
    intervalMilliseconds: 1000
  });
};

const invokePull = async () => {
  shell.exec(
    "yarn exec -- sls invoke local -f pullFiles --env local --stage local -d '{}'",
    {
      cwd: ".."
    }
  );
};

const checkPullWorked = async () => {
  // check that the 2 files arrived in S3
  for (let i = 1; i <= 2; i += 1) {
    const filename = `inbound/files/file${i}.csv`;
    const bucket = "local-ftp-bucket";
    const data = await s3.getObject({
      Bucket: bucket,
      Key: filename
    });
    console.log(JSON.stringify(data));
    const receivedText = data.Body.toString();
    const expectedText = `data${i}\n`;
    if (receivedText !== expectedText) {
      throw new Error(
        `expected local s3://${bucket}/${filename} to contain data "${expectedText}" but received "${receivedText}" instead`
      );
    }
  }
};

const stopServerless = serverlessProcess => {
  console.log("killing the serverless offline process...");
  serverlessProcess.kill("SIGTERM");
};

const main = async () => {
  // console.log("main()");
  shell.set("-e");

  await run(dockerDown);
  await run(initTestData);
  await run(setAWSEnv);
  await run(startSQS);
  await run(initSSHKey);
  const serverlessProcess = await run(startServerless);

  await run(createSQSQueue);

  await run(testPush, {}, "should fail because FTP server is down");
  await run(waitForSQSMessages, { expectedNumber: 1 });
  await run(startFTPServer);
  await run(waitForSFTPAvailable);
  await run(testPushRetry, {}, "should work now that FTP is up");
  await run(waitForSQSMessages, { expectedNumber: 0 });

  await run(invokePull);
  await run(checkPullWorked);

  await run(stopServerless, serverlessProcess);
  await run(dockerDown);
};

(async () => {
  try {
    await main();
  } catch (e) {
    console.error(chalk.red(e));
    process.exit(1);
  }
})();
