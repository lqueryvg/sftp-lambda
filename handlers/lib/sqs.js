const AWS = require("aws-sdk");

const sqs = new AWS.SQS();
const { getEnv } = require("./config");

const getQueue = async () =>
  sqs
    .getQueueUrl({
      QueueName: getEnv("SFTP_RETRY_QUEUE_NAME")
    })
    .promise();

const addMessage = async (q, message) =>
  sqs
    .sendMessage({
      MessageBody: JSON.stringify(message),
      QueueUrl: q.QueueUrl
    })
    .promise();

const getMessages = async q =>
  sqs
    .receiveMessage({
      QueueUrl: q.QueueUrl,
      MaxNumberOfMessages: 10
    })
    .promise();

const deleteMessage = async (q, receiptHandle) =>
  sqs
    .deleteMessage({
      QueueUrl: q.QueueUrl,
      ReceiptHandle: receiptHandle
    })
    .promise();

module.exports = {
  getMessages,
  addMessage,
  getQueue,
  deleteMessage
};
