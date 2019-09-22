const AWS = require("aws-sdk");

let sqs = null;

const connect = () => {
  if (!sqs) {
    sqs = new AWS.SQS({
      region: "eu-west-1",
      accessKeyId: "local",
      secretAccessKey: "local",
      endpoint: "http://localhost:9324"
    });
  }
};

const getMessages = async q => {
  connect();
  return sqs
    .receiveMessage({
      QueueUrl: q.QueueUrl,
      MaxNumberOfMessages: 10,
      VisibilityTimeout: 1
    })
    .promise();
};

const createQueue = async q => {
  connect();
  return sqs
    .createQueue({
      QueueName: q.QueueName
    })
    .promise();
};

module.exports = {
  getMessages,
  createQueue
};
