const { pushFile } = require("./lib/pushFile");
const sqs = require("./lib/sqs");
const { assertAllVarsSet } = require("./lib/helpers");

module.exports.pushRetry = async () => {
  console.log(`pushRetry() invoked`);

  assertAllVarsSet("pushRetry");

  const q = await sqs.getQueue();
  const data = await sqs.getMessages(q);

  const numMessages = data.Messages.length;
  console.log(`found ${numMessages} messages`);
  for (let i = 0; i < numMessages; i += 1) {
    const message = data.Messages[i];
    console.log(`processing message ${i + 1}...`);

    try {
      await pushFile({ ...JSON.parse(message.Body), isRetry: true });
      await sqs.deleteMessage(q, message.ReceiptHandle);
    } catch (error) {
      console.error(error);
    }
  }
};
