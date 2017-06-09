#!/bin/bash
cd "$(dirname $0)/msa-server"

main() {
	checkDep "node"
	checkDep "npm"
	checkDep "bower"
	installServer
	exitOK
}

checkDep() {
	[ -z "$(which $1)" ] && exitKO "$1 is not installed."
}

installServer() {
	echo "Installing MySimpleApp server..."
	ERR_MSG="Installation of MySimpleApp server failed."
	npm install || exitKO "$ERR_MSG"
	node server.js install || exitKO "$ERR_MSG"
}

exitOK() {
	touch installed
	echo "Server successfully installed."
	echo "Press any key to continue..."
	read _
	exit 1
}

exitKO() {
	(>&2 echo "ERROR: $1")
	echo "Press any key to continue..."
	read _
	exit 1
}

main