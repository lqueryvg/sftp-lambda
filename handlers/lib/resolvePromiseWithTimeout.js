module.exports.resolvePromiseWithTimeout = async (promise, seconds) => {
  // Note: pass a promise, not a function.
  // So if you have an async function, invoke it without "await"
  // to get a promise.
  // Example:
  //    const myFunction = async () => { blah... };
  //    resolvePromiseWithTimeout(myFunction(), 5)  // Note the parens after myFunction !!!

  let timerId;
  // Create a promise that rejects in <seconds> seconds
  const timeout = new Promise((resolve, reject) => {
    timerId = setTimeout(() => {
      clearTimeout(timerId);
      reject(new Error(`Timed out after ${seconds} seconds`));
    }, seconds * 1000);
  });

  // Returns a race between our timeout and the passed in promise
  let result;
  try {
    result = await Promise.race([promise, timeout]);
  } catch (error) {
    clearTimeout(timerId);
    throw error;
  }
  clearTimeout(timerId);
  return result;
};
