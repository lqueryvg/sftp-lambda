const mockConsole = require("jest-mock-console").default;

jest.mock("ssh2-promise");
const ssh = require("ssh2-promise");

const mockSsh = ssh();
mockSsh.initMocks();
const mockSftp = mockSsh.sftp();

jest.mock("aws-sdk");
const AWS = require("aws-sdk");

const s3 = new AWS.S3();
const sqs = new AWS.SQS();

const { pushRetry } = require("./pushRetry");

s3.getObjectPromise.mockReturnValue({
  Metadata: { synched: false },
  Body: "some data"
});

describe("pushRetry handler", () => {
  beforeEach(() => {
    process.env.SFTP_HOST = "localhost";
    process.env.SFTP_USER = "demo";
    process.env.SFTP_PORT = 2222;
    process.env.SFTP_PRIVATE_KEY = "some-key";
    process.env.SFTP_RETRY_QUEUE_NAME = "my-pushRetry-queue";
    process.env.SFTP_TARGET_DIR = "/test-target";
    process.env.SFTP_PUSH_TIMEOUT_SECONDS = 20;
    process.env.SFTP_SSH_READY_TIMEOUT_SECONDS = 10;
    mockSsh.initMocks();
    mockConsole();
  });

  afterEach(() => {
    sqs.deleteMessage.mockReset();
  });

  it("throws an error with bad config", async () => {
    delete process.env.SFTP_RETRY_QUEUE_NAME;
    expect.assertions(1);

    try {
      await pushRetry();
    } catch (err) {
      expect(err.message).toMatch(
        /SFTP_RETRY_QUEUE_NAME must be set for retry operation/
      );
    }
  });

  it("bad message should not throw error and not be deleted from queue", async () => {
    sqs.receiveMessagePromise.mockReturnValue({ Messages: ["{}"] });
    expect.assertions(1);

    try {
      await pushRetry();
    } catch (err) {
      expect(err).not.toBeDefined();
    }
    expect(sqs.deleteMessage).not.toBeCalled();
  });

  it("good message should be deleted from queue", async () => {
    process.env.SFTP_RETRY_QUEUE_NAME = "my-pushRetry-queue";
    sqs.receiveMessagePromise.mockReturnValue({
      Messages: [{ Body: JSON.stringify({ Bucket: "bucket", Key: "key" }) }]
    });
    expect.assertions(1);

    try {
      await pushRetry();
    } catch (err) {
      expect(err).not.toBeDefined();
    }
    expect(sqs.deleteMessage).toBeCalled();
  });

  it("error when writing file, message should NOT be deleted from queue", async () => {
    process.env.SFTP_RETRY_QUEUE_NAME = "my-pushRetry-queue";
    sqs.receiveMessagePromise.mockReturnValue({
      Messages: [{ Body: JSON.stringify({ Bucket: "bucket", Key: "key" }) }]
    });
    mockSftp.writeFile.mockImplementation(() => {
      throw new Error();
    });
    expect.assertions(1);

    try {
      await pushRetry();
    } catch (err) {
      expect(err).not.toBeDefined();
    }
    expect(sqs.deleteMessage).not.toBeCalled();
  });
  it("does nothing when queue empty", async () => {
    sqs.receiveMessagePromise.mockReturnValue({});
    mockSftp.writeFile.mockImplementation(() => {
      throw new Error();
    });

    await pushRetry();
    expect(sqs.deleteMessage).not.toBeCalled();

    expect(
      // The last call to the mock function was called with the specified args
      console.log.mock.calls[console.log.mock.calls.length - 1][0]
    ).toMatch(/No messages to process/);
  });
});
