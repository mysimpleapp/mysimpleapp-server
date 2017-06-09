#!/bin/bash
cd "$(dirname $0)/msa-server"

main() {
	checkInstalled
	startServer
}

checkInstalled() {
	[ ! -f "installed" ] && exitKO "Server is not installed. Please, use installServer_linux script first."
}

startServer() {
	echo "Starting MySimpleApp server..."
	node server.js start || exitKO "MySimpleApp server failed."
}

exitKO() {
	(>&2 echo "ERROR: $1")
	echo "Press any key to continue..."
	read _
	exit 1
}

main