const { pushFile } = require("./lib/pushFile");

// put single file to sftp server
// - triggered by S3 putObject event
module.exports.push = async (event, context, callback) => {
  console.log(`push() invoked`);

  // Note: DO NOT assert that the config is correct at this point
  // Reason: if the config (specified by environment variables)
  // is wrong we want to put this object on the retry queue so it
  // can be retried once the config is fixed.

  const { s3 } = event.Records[0];
  const Bucket = s3.bucket.name;
  const Key = s3.object.key;
  console.log(`push(): Bucket=${Bucket}, Key=${Key}`);

  await pushFile({ Bucket, Key, callback });
};
