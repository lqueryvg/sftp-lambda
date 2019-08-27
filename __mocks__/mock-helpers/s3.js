const getObjectPromise = jest.fn();
const putObjectPromise = jest.fn();
const copyObjectPromise = jest.fn();

putObjectPromise.mockResolvedValue(42);

const mockS3 = {
  getObject: jest.fn(),
  putObject: jest.fn(),
  copyObject: jest.fn(),
  getObjectPromise,
  putObjectPromise,
  copyObjectPromise
};
mockS3.getObject.mockImplementation(() => ({
  promise: getObjectPromise
}));
mockS3.putObject.mockImplementation(() => ({
  promise: putObjectPromise
}));
mockS3.copyObject.mockImplementation(() => ({
  promise: copyObjectPromise
}));

module.exports = mockS3;
