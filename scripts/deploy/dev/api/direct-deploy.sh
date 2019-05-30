#!/bin/bash +x
PROJECT="/home/ubuntu/vikings/api"
PROJECT_TMP="/home/ubuntu/tmp/api"
TAR_TMP="/home/ubuntu/tmp"

##killall node
#cd $PROJECT && npm stop
cd $PROJECT_TMP && tar -xvf $TAR_TMP/api-vikings-prod-source.tar.gz

pm2 stop 0
sleep 5

#rm -rf $PROJECT
#mkdir $PROJECT

shopt -s extglob
cd $PROJECT && rm -rf ./!(node_modules|public|plugins)

#mkdir -p $PROJECT

#mv $PROJECT_TMP/* $PROJECT/
/usr/bin/rsync -a $PROJECT_TMP/ $PROJECT/

sleep 3

rm -rf $PROJECT_TMP/*

rm $PROJECT/package-lock.json

cd $PROJECT && npm install

cd $PROJECT && pm2 start server.js

exit 0
