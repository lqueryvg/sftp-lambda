# sftp-lambda

![Build Status](https://github.com/lqueryvg/sftp-lambda/workflows/Test/badge.svg)

Serverless lambda functions to sync files between AWS S3 and an SFTP server.

- [sftp-lambda](#sftp-lambda)
  - [Characteristics](#characteristics)
  - [Description](#description)
  - [How it works](#how-it-works)
    - [Activity Diagram](#activity-diagram)
    - [Sequence Diagram](#sequence-diagram)
  - [Configuration](#configuration)
    - [Environment Variables](#environment-variables)
    - [Custom VPC](#custom-vpc)
  - [Design Details](#design-details)
    - [pull (S3 <- SFTP)](#pull-s3---sftp)
    - [push (S3 -> SFTP)](#push-s3---sftp)
    - [pushRetry (S3 -> SFTP)](#pushretry-s3---sftp)

## Characteristics

- a 3rd party provides an SFTP server where you need to push / pull files
- **_YOU_** always initiate the connection (push or pull), not the 3rd party
- the data that you pull is not needed urgently, i.e. you are happy to pull
  files less frequently than every minute or every second
- you don't run your own SFTP server
- you don't pay for an SFTP service
- **_CHEAP_**
  - cheaper than _AWS Transfer for SFTP_
  - **_MUCH_** cheaper if you don't need a static IP address for whitelisting on the FTP server
    - it's just the cost of the Lambdas executions
    - but this is not recommended
      - best practice is to use a static IP and get it whitelisted
  - at least **_FIVE TIMES_** cheaper even if you **_DO_** need a fixed IP
    - the main cost of the fixed IP is the price of a NAT gateway + elastic IP
    - these are still very cheap compared to _AWS Transfer for SFTP_

## Description

- All connections are initiated from **your** AWS account
  - you therefore have full control and visibilty of transfers
- 3 lambda functions:
  - one for pulling batches of files from SFTP (`pull`)
  - two for pushing individual files to SFTP (`push` & `pushRetry`)
- Shared-nothing architecture
  - deploy multiple instances
    of the same lambdas to achieve multiple connection "flows",
    eg. different cron schedules for different FTP servers, directories or buckets

## How it works

- S3 to SFTP (`push` & `pushRetry`)

  - triggered whenever a file is uploaded to an S3 bucket
  - the file is immediately transfered to the configured FTP server
  - every S3 object will be transferred in its own lambda & SFTP connection
    - lots of files means lots of separate connections
      - if you are not happy about this,
        then maybe this is not the best tool for your use case
  - S3 metadata on each object is updated to indicate that the object has been
    successfully transferred
  - failures are sent to an SQS queue for later pushRetry

- S3 from SFTP (`pull`)
  - pulls multiple files in one connection
  - pulls tree structures recursively
  - recreates the same directory structure in the target bucket
  - successfully transferred files are moved to a `.done` directory on the SFTP server
    - this prevents files being copied multiple times
    - the SFTP server owner can therefore see which files have been transferred
    - if a file needs to be re-transferred for any reason,
      the SFTP server owner can move it from the `.done` directory back up to its parent directory
  - an optional retention period can be configured to purge files from
    the `.done` directory after a configurable number of days

The diagrams in the following sections should help.

### Activity Diagram

![Activity Diagram](diagrams/activity.png)

### Sequence Diagram

![Sequence Diagram](diagrams/sequence.png)

## Configuration

- Deployment of the Lambdas and the related resources (e.g. SQS queues) is up to you.
- Sample configurations are provided (TODO).
  - Serverless is recommended.
- Configuration of SFTP details & file / bucket paths is via Lambda environment variables
- Implement multiple "flows" (e.g. different target directories, buckets, or FTP servers with their
  own connection information) by deploying multiple instances of the lambdas with relevant variables.
- Each push "flow" will need it's own SQS queue.

### Environment Variables

Not all variables are required by all lambdas, as described below:

| variable                        | applies to function | notes                                                                                                                                                            |
| ------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SFTP_HOST, SFTP_PORT, SFTP_USER | all                 | SSH (SFTP) connection information                                                                                                                                |
| SFTP_PRIVATE_KEY                | all                 | SSH private key (the key multiline contents, not the filename)                                                                                                   |
| SFTP_RETRY_QUEUE_NAME           | push, pushRetry     | SQS pushRetry queue name                                                                                                                                         |
| SFTP_TARGET_S3_BUCKET           | pull                | target S3 bucket                                                                                                                                                 |
| SFTP_TARGET_S3_PREFIX           | pull                | target S3 object key prefix                                                                                                                                      |
| SFTP_SOURCE_DIR                 | pull                | source directory to pull from                                                                                                                                    |
| SFTP_FILE_RETENTION_DAYS        | pull                | how many days after file transfer to keep a file on the source SFTP server (in the `.done` directory) before deleting. Set this to zero to disable this feature. |

### Custom VPC

Setup a custom VPC if you want a fixed IP address.

The approach here is to run the Lambdas in a private subnet and route via a NAT
in a public subnet which has an EIP (fixed IP address). Note that since the
Lambda is running in a private subnet, the private subnet needs to be given
access to an S3 service endpoint so that the Lambda can access the S3 bucket.

![Custom VPC](diagrams/vpc.png)

## Design Details

### pull (S3 <- SFTP)

- scheduled via CloudWatch cron
- connects to the SFTP server & recursively copies the source directory to the S3 bucket
- the directory structure in the target bucket will match the directory
  structure on the SFTP server, with an optional prefix path added to each object key
  in the S3 bucket (effectively, a target S3 directory).
- successfully transferred files are moved to a `.done` directory on the source SFTP server
  - a `.done` directory is created within each directory of the tree structure being copied
- on error, this lambda will fail

### push (S3 -> SFTP)

- called when a single object is uploaded to an S3 bucket, or an object has been over-written
- pushes the single file to SFTP server
  - if successful, mark the meta data on the object as synced
- on error:
  - push the failed event to a pushRetry SQS queue, then **_SUCCEED_**
    - Note that if the lambda were to fail, the AWS Lambda service will retry
      the same object, and we'd end up with multiple events for the same object
      on the pushRetry queue.

### pushRetry (S3 -> SFTP)

- scheduled via CloudWatch cron
- for each failed event message on the pushRetry queue
  - first, check if object already synced
    - this could happen if the S3 object has been over-written with a newer version
      and successfully transferred via the `push` lambda
      - note that overwriting an S3 object causes the meta-data to be deleted
  - write the file to the SFTP server
  - if successful, delete message from the pushRetry queue
- on error, this lambda should fail
