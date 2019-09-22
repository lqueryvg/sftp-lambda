const fs = require("fs");

module.exports.sshPrivateKey = serverless => {
  // serverless.cli.consoleLog(serverless);
  // serverless.cli.consoleLog(serverless.variable.options.stage);
  if (
    !serverless.variables.options.stage ||
    serverless.variables.options.stage !== "local"
  )
    return "not-set";

  const keyFile = "integration-test/tmp/ssh-key/sftptest";
  serverless.cli.consoleLog(`Serverless: reading key from file ${keyFile}...`);
  const privateKeyString = fs.readFileSync(keyFile);
  // serverless.cli.consoleLog(`key = ${privateKeyString}`);
  return privateKeyString;
};
