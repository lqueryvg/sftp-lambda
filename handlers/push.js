const { pushFile } = require("./lib/pushFile");
// const { assertAllVarsSet } = require("../lib/helpers");

// put single file to sftp server
// - triggered by S3 putObject event
module.exports.push = async event => {
  console.log(`push() invoked`);

  // assertAllVarsSet("push");

  const { s3 } = event.Records[0];
  const Bucket = s3.bucket.name;
  const Key = s3.object.key;
  console.log(`Bucket=${Bucket}, Key=${Key}`);

  await pushFile({ Bucket, Key });
};
