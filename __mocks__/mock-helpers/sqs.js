const receiveMessagePromise = jest.fn();
const getQueueUrlPromise = jest.fn();
getQueueUrlPromise.mockResolvedValue({ QueueUrl: "dummy-q-url" });
const sendMessagePromise = jest.fn();
const deleteMessagePromise = jest.fn();

const mockSQS = {
  receiveMessage: jest.fn(),
  sendMessage: jest.fn(),
  deleteMessage: jest.fn(),
  getQueueUrl: jest.fn(),
  receiveMessagePromise,
  getQueueUrlPromise,
  sendMessagePromise,
  deleteMessagePromise
};
mockSQS.receiveMessage.mockImplementation(() => ({
  promise: receiveMessagePromise
}));
mockSQS.getQueueUrl.mockImplementation(() => ({
  promise: getQueueUrlPromise
}));
mockSQS.sendMessage.mockImplementation(() => ({
  promise: sendMessagePromise
}));
mockSQS.deleteMessage.mockImplementation(() => ({
  promise: deleteMessagePromise
}));

module.exports = mockSQS;
