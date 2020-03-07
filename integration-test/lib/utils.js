/* eslint-disable import/no-extraneous-dependencies */
const chalk = require("chalk");
const readlineSync = require("readline-sync");

const interactive = false;

const sleep = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const waitFor = async ({
  funcToBeTrue,
  initialRetries,
  intervalMilliseconds
}) => {
  let retriesRemaining = initialRetries;
  while (retriesRemaining > 0) {
    console.info(
      chalk.yellow(
        `Attempt ${initialRetries - retriesRemaining + 1} of ${initialRetries}`
      )
    );
    if (await funcToBeTrue()) {
      console.info(
        chalk.yellow(
          `-> Attempt ${initialRetries - retriesRemaining + 1} succeeded :-)`
        )
      );
      return;
    }
    retriesRemaining -= 1;
    await sleep(intervalMilliseconds);
  }
  console.error(chalk.red("wait timeout, exiting..."));
  process.exit(1);
};

const header = string => {
  console.log(chalk.magenta(string));
  if (interactive && !readlineSync.keyInYN("continue?")) {
    // Key that is not `Y` was pressed.
    console.log(chalk.red("user requested exit..."));
    process.exit();
  }
};

const run = async (func, params, additionalMessage) => {
  let startingMessage = `${func.name}()`;
  if (additionalMessage)
    startingMessage = `${startingMessage} - ${additionalMessage}`;
  header(startingMessage);
  const returnValue = await func(params);
  console.log(`${func.name}() end`);
  return returnValue;
};

// const assert = (message, condition) => {
//   if (!condition) {
//     console.log(chalk.red(`assertion failed: "${message}", exiting...`));
//     process.exit(1);
//   } else console.log(chalk.green(`assertion succeeded: ${message}`));
// };

module.exports = { waitFor, run };
