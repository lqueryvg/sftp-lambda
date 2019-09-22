#!/usr/bin/env bash

set -e   # fail on any error

top=$(git rev-parse --show-toplevel)   # let's be safe before we start removing things
testDir=$top/integration-test

rm -rf $testDir/tmp/ftp-share/
rm -rf $testDir/tmp/s3-local/

mkdir -p $testDir/tmp/s3-local/local-ftp-bucket/
mkdir -p $testDir/tmp/ftp-share/outbound/files/
mkdir -p $testDir/tmp/ftp-share/inbound/files/

cd $testDir/tmp/ftp-share/outbound/files/
echo "data1" > file1.csv
echo "data2" > file2.csv