const helpers = require("./helpers");

describe("helpers tests", () => {
  beforeEach(() => {
    process.env.SFTP_HOST = "not-localhost";
    process.env.SFTP_USER = "demo";
    process.env.SFTP_PORT = 2222;
    process.env.SFTP_PRIVATE_KEY = "some-key";
  });

  it("sets readyTimeout when not localhost", async () => {
    const config = helpers.getSSHConfig();
    expect(config.readyTimeout).toBeDefined();
  });
});
