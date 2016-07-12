#!/bin/sh
cd "$(dirname $0)/server"

startServer() {
	echo "Start MySimpleApp server..."
	node server.js start
}

installServer() {
	echo "Install MySimpleApp server..."
	npm install
	node server.js install
}

exitInError() {
	echo "Press any key to continue..."
	read _
	exit 1
}

# Start server
startServer
if [ "$?" -ne 0 ]; then
	# If server failed to start, try an installation
	echo "MySimpleApp failed ! Perhaps it is not installed."
	installServer
	[ "$?" -ne 0 ] && echo "Installation of MySimpleApp server failed !" && exitInError
	# Then restart server
	startServer
	[ "$?" -ne 0 ] && echo "MySimpleApp server failed to start !" && exitInError
fi