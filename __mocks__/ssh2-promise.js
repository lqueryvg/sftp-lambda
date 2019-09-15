const mockStats = {
  isDirectory: jest.fn(),
  isFile: jest.fn()
  // isDirectory: jest.fn().mockResolvedValue(true),
  // isFile: jest.fn().mockResolvedValue(true)
};

const mockSftp = {
  mkdir: jest.fn(),
  readFile: jest.fn(),
  readdir: jest.fn(),
  rename: jest.fn(),
  stat: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
  mockStats
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
