#!/usr/bin/env bash

source .env
mkdir -p tmp/ftpshare
cd tmp
rm -f $KEYNAME $KEYNAME.pub
ssh-keygen -m PEM -t rsa -N "" -f $KEYNAME
cd ../
docker-compose up -d
# docker run \
#   -v $(pwd)/$keyname.pub:/home/demo/.ssh/keys/id_rsa.pub:ro \
#   -v $(pwd)/ftpshare:/home/demo/share \
#     -p 2222:22 -d atmoz/sftp \
#     demo::1001
ssh-keygen -R [localhost]:$LOCALHOST_PORT

# sftp -o StrictHostKeyChecking=no -i tmp/sftptest -P $LOCALHOST_PORT demo@localhost

cat <<EOF
Notes:

Connect manually like so:
  sftp -i tmp/sftptest -P $LOCALHOST_PORT demo@localhost

Stop the docker container:
  docker-compose down
EOF