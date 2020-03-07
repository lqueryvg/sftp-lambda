const fs = require("fs");
const { pull } = require("../handlers/pull");

process.env.SFTP_HOST = "localhost";
process.env.SFTP_USER = "demo";
process.env.SFTP_PORT = 2222;
console.log(process.cwd());
process.env.SFTP_PRIVATE_KEY = fs.readFileSync("./tmp/sftptest");
process.env.SFTP_FILE_RETENTION_DAYS = 1;
process.env.SFTP_SOURCE_DIR = "share/outbound";
process.env.SFTP_TARGET_S3_BUCKET = "dummy_bucket";

const main = async () => {
  pull();
};

main();
