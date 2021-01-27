/* eslint-disable no-restricted-syntax */
const { initEnvVars } = require("./config");

describe("config tests", () => {
  const validPushVars = [
    "SFTP_HOST",
    "SFTP_PORT",
    "SFTP_USER",
    "SFTP_PASSWORD",
    "SFTP_PRIVATE_KEY",
    "SFTP_SSH_READY_TIMEOUT_SECONDS",
    "SFTP_RETRY_QUEUE_NAME",
    "SFTP_TARGET_DIR"
  ];

  it("throws error if ftp action type not supplied", async () => {
    expect(() => {
      initEnvVars();
    }).toThrowError("ERROR: ftpActionType not supplied");
  });

  it("throws error when invalid action type supplied", async () => {
    expect(() => {
      initEnvVars("get");
    }).toThrowError(/ERROR: invalid ftpActionType.*/);
  });

  it("throws error when required variables not set", async () => {
    expect(() => {
      initEnvVars("pull");
    }).toThrowError(/must be set for pull/);
  });

  it("returns correct config for push", async () => {
    for (const varName of validPushVars) {
      process.env[varName] = "some-test-value";
    }
    initEnvVars("push");
    expect(process.env.SFTP_SOURCE_S3_REGEXP_STRIP).toBeUndefined(); // optional
    expect(process.env.SFTP_PUSH_TIMEOUT_SECONDS).toBe("20"); // has a default
  });
});
