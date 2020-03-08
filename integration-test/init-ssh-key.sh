#!/usr/bin/env bash

set -e   # fail on any error
top=$(git rev-parse --show-toplevel)   # let's be safe before we start removing things

testDir=$top/integration-test
cd $testDir
source .env

keyDir=$testDir/tmp/ssh-key/
rm -rf $keyDir; mkdir -p $keyDir; cd $keyDir

rm -f $FTP_SSH_KEYNAME $FTP_SSH_KEYNAME.pub
ssh-keygen -m PEM -t rsa -N "" -f $FTP_SSH_KEYNAME

echo "Deleting any pre-existing host key from known hosts file..."

set +e
ssh-keygen -R [localhost]:$FTP_LOCALHOST_PORT 2>/dev/null

echo "ssh initialised"