const mockConsole = require("jest-mock-console").default;

jest.mock("ssh2-promise");
const ssh = require("ssh2-promise");

const mockSsh = ssh();
const mockSftp = mockSsh.sftp();

jest.mock("aws-sdk");
const AWS = require("aws-sdk");

const s3 = new AWS.S3();

const { pull } = require("./pull.js");

describe("pull", () => {
  beforeAll(() => {
    mockConsole();
  });

  beforeEach(() => {
    process.env.SFTP_HOST = "localhost";
    process.env.SFTP_USER = "demo";
    process.env.SFTP_PORT = 2222;
    process.env.SFTP_PRIVATE_KEY = "blah";
    process.env.SFTP_FILE_RETENTION_DAYS = 1;
    process.env.SFTP_SOURCE_DIR = "share/outbound";
    process.env.SFTP_TARGET_S3_BUCKET = "my-bucket";
    process.env.SFTP_TARGET_S3_PREFIX = "/";
  });

  it("throws error when a required variable is not set", async () => {
    delete process.env.SFTP_TARGET_S3_BUCKET;
    expect.assertions(1);
    try {
      await pull();
    } catch (err) {
      expect(err).toBeDefined();
    }
  });

  it("throws error when a required var is not set", async () => {
    delete process.env.SFTP_HOST;
    try {
      await pull();
    } catch (err) {
      expect(err.message).toMatch(/Environment variable .* not set/);
    }
  });

  // share/outbound
  //  ├── d1
  //  │   └── f2
  //  ├── d2
  //  │   └── .done
  //  │       ├── f3
  //  │       └── f4
  //  └── f1

  const testFTPServerTree = {
    "share/outbound": [
      { filename: "f1", longname: "-" },
      { filename: "d1", longname: "d" },
      { filename: "d2", longname: "d" }
    ],
    "share/outbound/d1": [{ filename: "f2", longname: "-" }],
    "share/outbound/d2": [{ filename: ".done", longname: "d" }],
    "share/outbound/d2/.done": [
      { filename: "f3", longname: "-", attrs: { mtime: 0 } },
      {
        filename: "f4",
        longname: "-",
        attrs: { mtime: Math.round(new Date().getTime() / 1000) }
      }
    ]
  };

  it("recursively gets files and moves files into .done", async () => {
    mockSftp.readdir = jest
      .fn()
      .mockImplementation(dirpath => testFTPServerTree[dirpath]);

    await pull();
    expect(mockSftp.rename).toBeCalledTimes(2);
    expect(mockSftp.rename).toHaveBeenNthCalledWith(
      1,
      "share/outbound/f1",
      "share/outbound/.done/f1"
    );
    expect(mockSftp.readFile).toBeCalledTimes(2);
    expect(mockSftp.readFile).toHaveBeenNthCalledWith(1, "share/outbound/f1");
    expect(mockSftp.readFile).toHaveBeenNthCalledWith(
      2,
      "share/outbound/d1/f2"
    );
    expect(mockSftp.mkdir).toBeCalledTimes(2);
    expect(mockSftp.mkdir).toHaveBeenNthCalledWith(1, "share/outbound/.done/");
    expect(mockSftp.mkdir).toHaveBeenNthCalledWith(
      2,
      "share/outbound/d1/.done/"
    );
    expect(mockSftp.unlink).toBeCalledTimes(1);
    expect(mockSftp.unlink).toBeCalledWith("share/outbound/d2/.done/f3");
    expect(mockSftp.readdir).toBeCalledTimes(4);

    expect(s3.putObject).toBeCalledTimes(2);
    expect(s3.putObject).toHaveBeenNthCalledWith(1, {
      Bucket: "my-bucket",
      Key: "share/outbound/f1"
    });
    expect(s3.putObject).toHaveBeenNthCalledWith(2, {
      Bucket: "my-bucket",
      Key: "share/outbound/d1/f2"
    });
  });

  it("doesn't purge when disabled", async () => {
    mockSftp.readdir = jest
      .fn()
      .mockImplementation(dirpath => testFTPServerTree[dirpath]);
    process.env.SFTP_FILE_RETENTION_DAYS = 0;

    mockSftp.unlink.mockReset();
    await pull();
    expect(mockSftp.unlink).toBeCalledTimes(0);
  });

  it("closes ssh connection on error", async () => {
    mockSftp.readdir = jest.fn().mockImplementation(() => {
      const error = new Error();
      error.code = "some error code";
      throw error;
    });

    mockSsh.close.mockReset();
    await pull();
    expect(mockSsh.close).toHaveBeenCalledTimes(1);
  });

  it("does NOT try to close ssh connection on ECONNREFUSED", async () => {
    mockSftp.readdir = jest.fn().mockImplementation(() => {
      const error = new Error();
      error.code = "ECONNREFUSED";
      throw error;
    });

    mockSsh.close.mockReset();
    await pull();
    expect(mockSsh.close).toHaveBeenCalledTimes(0);
  });
});
