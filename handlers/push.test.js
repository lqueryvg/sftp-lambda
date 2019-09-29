const mockConsole = require("jest-mock-console").default;

jest.mock("ssh2-promise");
const ssh = require("ssh2-promise");

const mockSsh = ssh();
const mockSftp = mockSsh.sftp();

jest.mock("aws-sdk");

const AWS = require("aws-sdk");

const s3 = new AWS.S3();
const sqs = new AWS.SQS();

const { push } = require("./push");

describe("push handler", () => {
  const s3SamplePutEvent = {
    Records: [
      {
        s3: {
          bucket: {
            name: "my-bucket"
          },
          object: {
            key: "my-path/my-file"
          }
        }
      }
    ]
  };

  const mockS3GetObjectResponse = {
    Metadata: { synched: false },
    Body: "test data"
  };

  beforeAll(() => {
    mockConsole();
  });

  beforeEach(() => {
    process.env.SFTP_HOST = "localhost";
    process.env.SFTP_USER = "demo";
    process.env.SFTP_PORT = 2222;
    process.env.SFTP_PRIVATE_KEY = "some-key";
    process.env.SFTP_RETRY_QUEUE_NAME = "test-pushRetry-queue";
    process.env.SFTP_TARGET_DIR = "/test-target";
    process.env.SFTP_SOURCE_S3_REGEXP_STRIP = "my-path";
    process.env.SFTP_SSH_READY_TIMEOUT_SECONDS = 10;
    process.env.SFTP_PUSH_TIMEOUT_SECONDS = 20;
    // mockSftp.mockStats.isDirectory.mockReturnValue(true);
    // mockSftp.stat.mockResolvedValue(mockSftp.mockStats);
    s3.getObjectPromise.mockReturnValue(mockS3GetObjectResponse);
    // mockSftp.writeFile.mockReset();
    mockSsh.initMocks();
  });
  afterEach(() => {
    sqs.getQueueUrl.mockClear();
    sqs.sendMessage.mockClear();
  });

  it("returns without error and does not try to send if file already synched", async () => {
    const sampleResponse = {
      ...mockS3GetObjectResponse,
      Metadata: { synched: "true" }
    };
    s3.getObjectPromise.mockReturnValue(sampleResponse);

    expect.assertions(1);
    try {
      await push(s3SamplePutEvent);
    } catch (err) {
      expect(err).not.toBeDefined();
    }
    expect(mockSftp.writeFile).not.toBeCalled();
  });

  it("send file with bad config will queue event for pushRetry", async () => {
    delete process.env.SFTP_HOST; // this is the bad config !
    expect.assertions(3);
    try {
      await push(s3SamplePutEvent);
    } catch (err) {
      expect(err).not.toBeDefined();
    }
    expect(mockSftp.writeFile).not.toBeCalled();
    expect(sqs.getQueueUrlPromise).toBeCalled();
    expect(sqs.sendMessagePromise).toBeCalled();
  });

  it("send file write fails, does not throw but tries to close ssh connection and queues event", async () => {
    expect.assertions(4);
    mockSftp.writeFile.mockImplementation(() => {
      throw new Error();
    });
    try {
      await push(s3SamplePutEvent);
    } catch (err) {
      expect(err).not.toBeDefined();
    }
    expect(mockSftp.stat).toBeCalled();
    expect(mockSsh.close).toBeCalled();
    expect(sqs.getQueueUrl).toBeCalled();
    const expectedMessage = {
      MessageBody: JSON.stringify({
        Bucket: "my-bucket",
        Key: "my-path/my-file"
      }),
      QueueUrl: "dummy-q-url"
    };
    expect(sqs.sendMessage).toBeCalledWith(expectedMessage);
  });

  it("queues event if stat on target dir throws No such file error", async () => {
    mockSftp.stat.mockImplementation(() => {
      throw mockSftp.createNoSuchFileError();
    });
    await push(s3SamplePutEvent);
    expect(sqs.getQueueUrl).toBeCalled();
  });

  it("queues event if stat on target dir throws unknown error", async () => {
    mockSftp.stat.mockImplementation(() => {
      throw new Error("unknown error");
    });
    await push(s3SamplePutEvent);
    expect(sqs.getQueueUrl).toBeCalled();
  });

  it("queues event if target dir is not a directory", async () => {
    mockSftp.mockStats.isDirectory.mockReturnValue(false);
    await push(s3SamplePutEvent);
    expect(sqs.getQueueUrl).toBeCalled();
  });

  it("queues event if env var not set", async () => {
    delete process.env.SFTP_HOST;

    mockSftp.mockStats.isDirectory.mockReturnValue(false);
    await push(s3SamplePutEvent);
    expect(sqs.getQueueUrl).toBeCalled();
  });

  it("send file succeeds, closes ssh connection and does not queue event", async () => {
    await push(s3SamplePutEvent);
    expect(mockSftp.writeFile).toBeCalledWith(
      `${process.env.SFTP_TARGET_DIR}/my-file`,
      mockS3GetObjectResponse.Body
    );
    expect(mockSsh.close).toBeCalled();
    expect(sqs.getQueueUrl).not.toBeCalled();
    expect(sqs.sendMessage).not.toBeCalled();
  });

  it("calls mkdir to make trees", async () => {
    const s3SamplePutEventModified = { ...s3SamplePutEvent };
    s3SamplePutEventModified.Records[0].s3.object.key = "my-path/dir1/my-file";
    mockSftp.stat.mockImplementation(async path => {
      if (path === "/test-target/dir1/") {
        throw mockSftp.createNoSuchFileError();
      } else {
        return mockSftp.mockStats;
      }
    });
    await push(s3SamplePutEventModified);
    expect(mockSftp.mkdir).toBeCalledWith("/test-target/dir1/");
  });

  it("queues event if fails to make tree", async () => {
    const s3SamplePutEventModified = { ...s3SamplePutEvent };
    s3SamplePutEventModified.Records[0].s3.object.key = "my-path/dir1/my-file";
    mockSftp.stat.mockImplementation(async path => {
      if (path === "/test-target/dir1/") {
        throw mockSftp.createNoSuchFileError();
      } else {
        return mockSftp.mockStats;
      }
    });
    mockSftp.mkdir.mockImplementation(async () => {
      throw new Error("mkdir failed");
    });

    await push(s3SamplePutEventModified);
    expect(sqs.sendMessage).toBeCalled();
  });

  it("queues event if stat gives unknown error while making tree", async () => {
    const s3SamplePutEventModified = { ...s3SamplePutEvent };
    s3SamplePutEventModified.Records[0].s3.object.key = "my-path/dir1/my-file";
    mockSftp.stat.mockImplementation(async path => {
      if (path === "/test-target/dir1/") {
        throw new Error("bizarre error");
      } else {
        return mockSftp.mockStats;
      }
    });
    mockSftp.mkdir.mockImplementation(async () => {
      throw new Error("mkdir failed");
    });

    await push(s3SamplePutEventModified);
    expect(sqs.sendMessage).toBeCalled();
  });
});
