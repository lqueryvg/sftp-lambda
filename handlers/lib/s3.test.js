describe("serverless-s3-local tests", () => {
  it("uses local accessKeyId when STAGE is set to 'local'", async () => {
    let params;
    const recordParams = p => {
      params = p;
    };
    jest.doMock("aws-sdk", () => ({
      S3: jest.fn().mockImplementation(p => recordParams(p))
    }));

    process.env.STAGE = "local";
    // eslint-disable-next-line global-require
    require("./s3");
    expect(params.accessKeyId).toBe("S3RVER");
  });
});
