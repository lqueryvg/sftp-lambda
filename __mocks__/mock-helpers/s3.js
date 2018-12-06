const getObjectPromise = jest.fn();
const putObjectPromise = jest.fn();
putObjectPromise.mockResolvedValue(42);

const mockS3 = {
  getObject: jest.fn(),
  putObject: jest.fn(),
  getObjectPromise,
  putObjectPromise
};
mockS3.getObject.mockImplementation(() => ({
  promise: getObjectPromise
}));
mockS3.putObject.mockImplementation(() => ({
  promise: putObjectPromise
}));

module.exports = mockS3;
