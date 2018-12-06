// both export promises as separate variables so they can be mocked & asserted on
const mockS3 = require("./mock-helpers/s3");
const mockSQS = require("./mock-helpers/sqs");

module.exports = {
  S3: jest.fn().mockImplementation(() => mockS3),
  SQS: jest.fn().mockImplementation(() => mockSQS)
};
