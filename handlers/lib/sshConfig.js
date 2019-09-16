const { getEnv } = require("./config");

module.exports.getSSHConfig = () => {
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
