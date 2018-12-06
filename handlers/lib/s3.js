const AWS = require("aws-sdk");

const s3 = new AWS.S3({ apiVersion: "2006-03-01" });

const getObject = async params => {
  const { Bucket, Key } = params;
  console.log(`putS3Object: bucket=${Bucket}, key=${Key}`);

  return s3.getObject(params).promise();
};

const putObject = async params => {
  const { Bucket, Key } = params;
  console.log(`putS3Object: bucket=${Bucket}, key=${Key}`);

  return s3.putObject(params).promise();
};

module.exports = { getObject, putObject };
