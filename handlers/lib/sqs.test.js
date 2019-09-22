describe("serverless-offline-sqs tests", () => {
  it("uses local accessKeyId when STAGE is set to 'local'", async () => {
    let params;
    const recordParams = p => {
      params = p;
    };
    jest.doMock("aws-sdk", () => ({
      SQS: jest.fn().mockImplementation(p => recordParams(p))
    }));

    process.env.STAGE = "local";
    // eslint-disable-next-line global-require
    require("./sqs");
    expect(params.accessKeyId).toBe("local");
  });
});
