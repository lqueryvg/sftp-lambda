jest.useFakeTimers();
const { resolvePromiseWithTimeout } = require("./resolvePromiseWithTimeout");

describe("resolvePromiseWithTimeout", () => {
  it("times out", async () => {
    const myFunction = jest.fn();
    myFunction.mockResolvedValue(42);

    const returnValue = resolvePromiseWithTimeout(myFunction(), 1);
    jest.runAllTimers();
    expect.assertions(1);
    try {
      await returnValue;
    } catch (error) {
      expect(error.message).toBe("Timed out after 1 seconds");
    }
  });
});
