const mockConsole = require("jest-mock-console").default;

jest.mock("ssh2-promise");
const ssh = require("ssh2-promise");

const mockSsh = ssh();
mockSsh.initMocks();
const mockSftp = mockSsh.sftp();

jest.mock("aws-sdk");
const AWS = require("aws-sdk");

const s3 = new AWS.S3();

const { pull } = require("./pull.js");

describe("pull", () => {
  beforeEach(() => {
    mockConsole();
    process.env.SFTP_HOST = "localhost";
    process.env.SFTP_USER = "demo";
    process.env.SFTP_PORT = 2222;
    process.env.SFTP_PRIVATE_KEY = "blah";
    process.env.SFTP_FILE_RETENTION_DAYS = 1;
    process.env.SFTP_SOURCE_DIR = "share/outbound";
    process.env.SFTP_TARGET_S3_BUCKET = "my-bucket";
    process.env.SFTP_TARGET_S3_PREFIX = "/";
    process.env.SFTP_SSH_READY_TIMEOUT_SECONDS = 5;
    mockSsh.initMocks();
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

  it("throws error when neither password nor SSH private key is set", async () => {
    delete process.env.SFTP_PASSWORD;
    delete process.env.SFTP_PRIVATE_KEY;
    try {
      await pull();
    } catch (err) {
      expect(err.message).toMatch(
        /Environment variables .* not set, need at least one/
      );
    }
  });

  it("closes ssh connection on error", async () => {
    mockSftp.readdir = jest.fn().mockImplementation(() => {
      const error = new Error();
      error.code = "some error code";
      throw error;
    });

    await pull();
    expect(mockSsh.close).toHaveBeenCalledTimes(1);
  });

  it("does NOT try to close ssh connection on ECONNREFUSED", async () => {
    mockSftp.readdir = jest.fn().mockImplementation(() => {
      const error = new Error();
      error.code = "ECONNREFUSED";
      throw error;
    });

    await pull();
    expect(mockSsh.close).toHaveBeenCalledTimes(0);
  });

  it("lists an empty source directory, and calls callback with success", async () => {
    // share/outbound/
    //  └── (empty)
    const testFTPServerTree = {
      "share/outbound": []
    };
    mockSftp.readdir = jest
      .fn()
      .mockImplementation(dirpath => testFTPServerTree[dirpath]);

    const callback = jest.fn();

    await pull(undefined, undefined, callback);

    expect(mockSftp.readdir).toBeCalledTimes(1);
    expect(mockSftp.readdir).toHaveBeenNthCalledWith(1, "share/outbound");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenNthCalledWith(1, null, "Success");
  });

  it("list an empty subdirectory", async () => {
    // share/outbound/
    //  └── d1/
    //      └── (empty)
    const testFTPServerTree = {
      "share/outbound": [{ filename: "d1", longname: "d" }],
      "share/outbound/d1": []
    };
    mockSftp.readdir = jest
      .fn()
      .mockImplementation(dirpath => testFTPServerTree[dirpath]);

    await pull();
    expect(mockSftp.readdir).toBeCalledTimes(2);
    expect(mockSftp.unlink).toBeCalledTimes(0);
    expect(mockSftp.readdir).toHaveBeenNthCalledWith(1, "share/outbound");
    expect(mockSftp.readdir).toHaveBeenNthCalledWith(2, "share/outbound/d1");
  });

  it("purges an old file", async () => {
    // share/outbound/
    //  └── d1/
    //      └── .done/
    //          └── f1    (mtime = 0 === very old)
    const testFTPServerTree = {
      "share/outbound": [{ filename: "d1", longname: "d" }],
      "share/outbound/d1": [{ filename: ".done", longname: "d" }],
      "share/outbound/d1/.done": [
        { filename: "f1", longname: "-", attrs: { mtime: 0 } }
      ]
    };

    mockSftp.readdir = jest
      .fn()
      .mockImplementation(dirpath => testFTPServerTree[dirpath]);

    await pull();
    expect(mockSftp.unlink).toBeCalledTimes(1);
    expect(mockSftp.unlink).toHaveBeenNthCalledWith(
      1,
      "share/outbound/d1/.done/f1"
    );
  });

  it("doesn't purge when retention disabled", async () => {
    // share/outbound/
    //  └── d1/
    //      └── .done/
    //          └── f1    (mtime = 0 === very old)
    const testFTPServerTree = {
      "share/outbound": [{ filename: "d1", longname: "d" }],
      "share/outbound/d1": [{ filename: ".done", longname: "d" }],
      "share/outbound/d1/.done": [
        { filename: "f1", longname: "-", attrs: { mtime: 0 } }
      ]
    };
    process.env.SFTP_FILE_RETENTION_DAYS = 0;

    mockSftp.readdir = jest
      .fn()
      .mockImplementation(dirpath => testFTPServerTree[dirpath]);

    await pull();
    expect(mockSftp.readdir).toBeCalledTimes(2);
    expect(mockSftp.readdir).toHaveBeenNthCalledWith(1, "share/outbound");
    expect(mockSftp.readdir).toHaveBeenNthCalledWith(2, "share/outbound/d1");
  });

  it("purges the right file", async () => {
    // share/outbound/
    //  └── d1/
    //      └── .done/
    //          ├── f1    (mtime = 0 === very old)
    //          └── f2    (mtime = 0 === very old)
    process.env.SFTP_FILE_RETENTION_DAYS = 2;

    const currentDate = new Date();
    const secondsInOneHour = 60 * 60;
    const retentionPIT =
      currentDate -
      new Date(
        process.env.SFTP_FILE_RETENTION_DAYS * 24 * secondsInOneHour * 1000
      );

    const testFTPServerTree = {
      "share/outbound": [{ filename: "d1", longname: "d" }],
      "share/outbound/d1": [{ filename: ".done", longname: "d" }],
      "share/outbound/d1/.done": [
        {
          filename: "f1",
          longname: "-",
          attrs: { mtime: (retentionPIT + secondsInOneHour) / 1000 }
        },
        {
          filename: "f2",
          longname: "-",
          attrs: { mtime: (retentionPIT - secondsInOneHour) / 1000 }
        }
      ]
    };

    mockSftp.readdir = jest
      .fn()
      .mockImplementation(dirpath => testFTPServerTree[dirpath]);

    await pull();
    expect(mockSftp.unlink).toBeCalledTimes(1);
    expect(mockSftp.unlink).toHaveBeenNthCalledWith(
      1,
      "share/outbound/d1/.done/f2"
    );
    expect(mockSftp.readdir).toBeCalledTimes(3);
    expect(mockSftp.readdir).toHaveBeenNthCalledWith(1, "share/outbound");
    expect(mockSftp.readdir).toHaveBeenNthCalledWith(2, "share/outbound/d1");
    expect(mockSftp.readdir).toHaveBeenNthCalledWith(
      3,
      "share/outbound/d1/.done"
    );
  });

  it("creates .done directories, moves a file and puts in bucket", async () => {
    // share/outbound/
    //  └── d1/
    //      └── f1
    const testFTPServerTree = {
      "share/outbound": [{ filename: "d1", longname: "d" }],
      "share/outbound/d1": [{ filename: "f1", longname: "-" }]
    };

    mockSftp.readdir = jest
      .fn()
      .mockImplementation(dirpath => testFTPServerTree[dirpath]);

    mockSftp.stat = jest.fn().mockImplementation(() => {
      throw mockSftp.createNoSuchFileError();
    });

    await pull();
    expect(mockSftp.mkdir).toBeCalledTimes(2);
    expect(mockSftp.mkdir).toHaveBeenNthCalledWith(1, "share/outbound/.done/");
    expect(mockSftp.mkdir).toHaveBeenNthCalledWith(
      2,
      "share/outbound/d1/.done/"
    );

    expect(mockSftp.unlink).toBeCalledTimes(0);
    expect(mockSftp.rename).toBeCalledTimes(1);
    expect(mockSftp.rename).toHaveBeenNthCalledWith(
      1,
      "share/outbound/d1/f1",
      "share/outbound/d1/.done/f1"
    );

    expect(s3.putObject).toBeCalledTimes(1);
    expect(s3.putObject).toHaveBeenNthCalledWith(1, {
      Body: "some data",
      Bucket: "my-bucket",
      Key: "d1/f1"
    });
  });

  it("overwrites a file in the .done directory", async () => {
    // share/outbound/
    //  └── d1/
    //      ├── f1
    //      └── .done/
    //          └── f1
    const testFTPServerTree = {
      "share/outbound": [
        { filename: "d1", longname: "d" },
        { filename: ".done", longname: "d" }
      ],
      "share/outbound/d1": [
        { filename: "f1", longname: "-" },
        { filename: ".done", longname: "d" }
      ],
      "share/outbound/d1/.done": [{ filename: "f1", longname: "-" }]
    };

    mockSftp.readdir = jest
      .fn()
      .mockImplementation(dirpath => testFTPServerTree[dirpath]);
    await pull();
    expect(mockSftp.mkdir).toBeCalledTimes(0);
    expect(mockSftp.unlink).toBeCalledTimes(1);
    expect(mockSftp.unlink).toHaveBeenNthCalledWith(
      1,
      "share/outbound/d1/.done/f1"
    );
    expect(mockSftp.rename).toBeCalledTimes(1);
    expect(mockSftp.rename).toHaveBeenNthCalledWith(
      1,
      "share/outbound/d1/f1",
      "share/outbound/d1/.done/f1"
    );
  });

  it("throws error if filename exists in .done dir and is not a file", async () => {
    // share/outbound/
    //  └── d1/
    //      ├── f1
    //      └── .done/
    //          └── f1/    (a directory !!!)
    const testFTPServerTree = {
      "share/outbound": [
        { filename: "d1", longname: "d" },
        { filename: ".done", longname: "d" }
      ],
      "share/outbound/d1": [
        { filename: "f1", longname: "-" },
        { filename: ".done", longname: "d" }
      ],
      "share/outbound/d1/.done": [{ filename: "f1", longname: "d" }] // a directory !!!
    };

    mockSftp.readdir = jest
      .fn()
      .mockImplementation(dirpath => testFTPServerTree[dirpath]);

    const mockStats = {
      isDirectory: jest.fn().mockResolvedValue(true),
      isFile: () => false
    };

    mockSftp.stat.mockResolvedValue(mockStats);

    await pull();
    expect(console.error.mock.calls[0][0]).toMatch(
      /ERROR: target already exists/
    );
    expect(mockSftp.unlink).toBeCalledTimes(0);
    expect(mockSftp.stat).toHaveBeenNthCalledWith(
      1,
      "share/outbound/d1/.done/f1"
    );

    expect(mockSftp.stat).toBeCalledTimes(1);
  });

  it("error is output if stat throws an unexpected error", async () => {
    // share/outbound/
    //  ├── f1
    //  └── .done/
    //      └── f1
    const testFTPServerTree = {
      "share/outbound": [
        { filename: ".done", longname: "d" },
        { filename: "f1", longname: "-" }
      ],
      "share/outbound/.done": [
        { filename: "f1", longname: "-", attrs: { mtime: 0 } }
      ]
    };

    mockSftp.readdir = jest
      .fn()
      .mockImplementation(dirpath => testFTPServerTree[dirpath]);

    mockSftp.stat.mockImplementation(() => {
      throw new Error("unexpected error from stat");
    });

    await pull();
    expect(console.error.mock.calls[0][0]).toMatch(
      /ERROR: unexpected error from stat/
    );
  });
});
