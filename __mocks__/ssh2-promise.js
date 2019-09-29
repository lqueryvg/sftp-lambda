const mockStats = {
  isDirectory: jest.fn(),
  isFile: jest.fn()
  // isDirectory: jest.fn().mockResolvedValue(true),
  // isFile: jest.fn().mockResolvedValue(true)
};

const NO_SUCH_FILE = 2; // in-line with SFTPStream.STATUS_CODE, see https://github.com/mscdex/ssh2-streams/blob/master/SFTPStream.md#sftpstream-static-constants

const createNoSuchFileError = () => {
  const err = new Error("couldn't find the file");
  err.code = NO_SUCH_FILE;
  return err;
};

const mockSftp = {
  mkdir: jest.fn(),
  readFile: jest.fn(),
  readdir: jest.fn(),
  rename: jest.fn(),
  stat: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  mockStats,
  createNoSuchFileError
};

const close = jest.fn();
// const sftp = jest.fn();

const initMocks = () => {
  close.mockReset();
  mockSftp.mkdir.mockReset();
  mockSftp.readFile.mockReset();
  mockSftp.readFile.mockResolvedValue("some data");
  mockSftp.readdir.mockReset();
  mockSftp.readdir.mockReset();
  mockSftp.rename.mockReset();
  mockSftp.stat.mockReset();
  mockSftp.stat.mockResolvedValue(mockStats);
  mockSftp.writeFile.mockReset();
  mockSftp.unlink.mockReset();
  mockStats.isDirectory.mockReset();
  mockStats.isDirectory.mockResolvedValue(true);
  mockStats.isFile.mockReset();
  mockStats.isFile.mockResolvedValue(true);
};

const mockSsh = {
  sftp: () => mockSftp,
  close,
  initMocks
};
initMocks();
module.exports = jest.fn().mockImplementation(() => mockSsh);
