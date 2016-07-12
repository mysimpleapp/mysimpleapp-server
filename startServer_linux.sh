#!/bin/sh
HERE=$(cd $(dirname $0); pwd)

node $HERE/server/server.js
[ "$?" -ne 0 ] && read -p "Press any key to continue..."