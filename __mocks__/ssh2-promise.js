const mockStats = {
  isDirectory: jest.fn().mockResolvedValue(true)
};

const mockSftp = {
  rename: jest.fn(),
  mkdir: jest.fn(),
  readFile: jest.fn().mockResolvedValue("some data"),
  unlink: jest.fn(),
  writeFile: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn().mockResolvedValue(mockStats),
  mockStats
};

const mockSsh = {
  sftp: () => mockSftp,
  close: jest.fn()
};

module.exports = jest.fn().mockImplementation(() => mockSsh);
