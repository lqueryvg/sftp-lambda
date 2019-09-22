const AWS = require("aws-sdk");

let s3LocalParams = {};

if (process.env.STAGE && process.env.STAGE === "local") {
  s3LocalParams = {
    s3ForcePathStyle: true,
    accessKeyId: "S3RVER", // for serverless-s3-local
    secretAccessKey: "S3RVER",
    endpoint: "http://localhost:8000"
  };
}

const s3 = new AWS.S3({
  apiVersion: "2006-03-01",
  ...s3LocalParams
});

const getObject = async params => {
  const { Bucket, Key } = params;
  console.log(`s3.getObject(): bucket=${Bucket}, key=${Key}`);

  const response = await s3.getObject(params).promise();
  return response;
};

const putObject = async params => {
  const { Bucket } = params;
  let { Key } = params;
  Key = Key.replace(/^\/*/, ""); // delete initial slashes
  Key = Key.replace(/\/\/+/, "/"); // change double slashes to single slash
  Key = Key.replace(/\/*/, ""); // change trailing slash
  console.log(`s3.putObject(): bucket=${Bucket}, key=${Key}`);
  // eslint-disable-next-line no-param-reassign
  params.Key = Key;

  return s3.putObject(params).promise();
};

const setObjectSynched = async params => {
  const { Bucket, Key } = params;

  const response = await s3
    .copyObject({
      ...params,
      CopySource: `${Bucket}/${Key}`,
      Metadata: { Synched: "true" },
      MetadataDirective: "REPLACE"
    })
    .promise();
  console.log(JSON.stringify(response));
  return response;
};

module.exports = { getObject, putObject, setObjectSynched };
