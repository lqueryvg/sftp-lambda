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

describe("push handler", () => {
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
    s3.getObjectPromise.mockReturnValue(mockS3GetObjectResponse);

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
    s3.getObjectPromise.mockReturnValue(mockS3GetObjectResponse);

    expect.assertions(4);
    mockSftp.writeFile.mockImplementation(() => {
      throw new Error();
    });
    try {
      await push(s3SamplePutEvent);
    } catch (err) {
      expect(err).not.toBeDefined();
    }
    expect(mockSftp.writeFile).toBeCalled();
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

  it("send file succeeds, closes ssh connection and does not queue event", async () => {
    s3.getObjectPromise.mockReturnValue(mockS3GetObjectResponse);

    mockSftp.writeFile.mockReset();
    expect.assertions(4);
    try {
      await push(s3SamplePutEvent);
    } catch (err) {
      expect(err).not.toBeDefined();
    }
    expect(mockSftp.writeFile).toBeCalledWith(
      `${process.env.SFTP_TARGET_DIR}/my-file`,
      mockS3GetObjectResponse.Body
    );
    expect(mockSsh.close).toBeCalled();
    expect(sqs.getQueueUrl).not.toBeCalled();
    expect(sqs.sendMessage).not.toBeCalled();
  });
});
