@echo off

:: Start server
call :startServer
if ERRORLEVEL 1 (
	:: If server failed to start, try an installation
	echo MySimpleApp failed ! Perhaps it is not installed.
	call :installServer
	if ERRORLEVEL 1 (
		echo Installation of MySimpleApp server failed !
		pause & exit /b 1
	)
	:: Then restart server
	call :startServer
	if ERRORLEVEL 1 (
		echo MySimpleApp server failed to start !
		pause & exit /b 1
	)
)

:startServer
	echo Start MySimpleApp server...
	node %~dp0\server\server.js start
	goto:eof

:installServer
	echo Install MySimpleApp server...
	pushd %~dp0\server & call npm install & popd
	node %~dp0\server\server.js install
	goto:eof