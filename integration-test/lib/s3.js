const AWS = require("aws-sdk");

let s3 = null;

const connect = () => {
  if (!s3) {
    s3 = new AWS.S3({
      apiVersion: "2006-03-01",
      s3ForcePathStyle: true,
      accessKeyId: "S3RVER", // This specific key is required when working offline
      secretAccessKey: "S3RVER",
      endpoint: "http://localhost:8000"
    });
  }
};

const getObject = async params => {
  connect();
  const { Bucket, Key } = params;
  console.log(`s3.getObject(): bucket=${Bucket}, key=${Key}`);

  return s3.getObject(params).promise();
};

const putObject = async params => {
  connect();
  const { Bucket } = params;
  const { Key } = params;
  console.log(`s3.putObject(): bucket=${Bucket}, key=${Key}`);
  // eslint-disable-next-line no-param-reassign
  params.Key = Key;

  return s3.putObject(params).promise();
};
module.exports = { getObject, putObject };
