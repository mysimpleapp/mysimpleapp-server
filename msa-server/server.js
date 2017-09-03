// require
var path = require('path'),
	join = path.join
var express = require('express')
var fs = require('fs')
var sh = require('shelljs')
var glob = require('glob')

// global Msa object
global.Msa = global.MySimpleApp = {}
Msa.dirname = path.normalize(join(__dirname,".."))
Msa.compsDir = Msa.dirname+'/bower_components'
Msa.compsUrl = "/bower_components"
Msa.express = express

require('./htmlExpr')

// MAIN /////////////////////////////////////////////////////

var main = function() {
	// check input arguments
	var actions = process.argv.slice(2)
	// "start" is the default argument
	if(actions.length===0) actions.push("start")
	// execute actions given in args
	executeActions(actions, 0, actions.length, exit)
}
var executeActions = function(actions, i, len, next) {
	if(i>=len) return next && next()
	var executeNextAction = function(err) {
		if(err) return next && next(err)
		executeActions(actions, i+1, len, next)
	}
	var action = actions[i]
	if(action==="help") help(executeNextAction)
	else if(action==="start") start(executeNextAction)
	else if(action==="install") install(executeNextAction)
	else executeNextAction()
}
var exit = function(err) {
	if(err) {
		console.log(err)
		process.exit(1)
	}
	process.exit(0)
}


// HELP //////////////////////////////////////////

var help = function(next) {
	console.log("node server.js [help] [install] [start (default)]")
	console.log("  help: display this help.")
	console.log("  install: install first msa components.")
	console.log("  start: start server.")
	next()
}


// INSTALL ///////////////////////////////////////////////////////////////

var install = function(next) {

	createApp()

	Msa.installComponent(null, next)
}

// installComponent
var installComponent = Msa.installComponent = function(component, next) {
	if (!sh.which('npm')) return next("ERROR: npm is not installed.")
	if (!sh.which('bower')) return next("ERROR: bower is not installed.")
	var pwd = sh.pwd(), dir = Msa.dirname;
	sh.cd(dir);
	var cmd = 'bower install '+(component ? component : "");
	sh.exec(cmd, function(code){
		if(code!==0) return console.log("ERROR: '"+cmd+"' failed (dir: "+dir+").")
		sh.cd(pwd);
		var path = join(Msa.dirname, 'bower_components', (component ? component : '*'), 'msa-server/package.json')
		glob(path, null, function(err, packageFiles) {
			if(err) return console.log("ERROR: ", err)
			installSubApp(packageFiles, 0, packageFiles.length, next)
		})
	})
}
var installSubApp = function(packageFiles, i, len, next) {
	if(i>=len) return next();
	var file = packageFiles[i], dir = path.dirname(file);
	// npm install the subApp module dependencies
	var pwd = sh.pwd();
	sh.cd(dir);
	var cmd = "npm install"
	sh.exec(cmd, function(code){
		if(code!==0) return console.log("ERROR: '"+cmd+"' failed (dir: "+dir+").")
		sh.cd(pwd)
		installSubApp(packageFiles, i+1, len, next)
	})
}


// START //////////////////////////////////////////

var start = function(next) {
	
	createApp()
	
	requireMsaComponentIndexScripts(function() {
		startServer(next)
	})
}

var createApp = function() {
	if(Msa.app) return

	// create App
	Msa.app = express()
	Msa.subAppsRouter = express.Router()

	// load sever params
	Msa.params = JSON.parse(fs.readFileSync(join(__dirname,'params.json'), 'utf8'))
}


var requireMsaComponentIndexScripts = function(next) {

	// require msa components index scripts
	glob(join(Msa.dirname, "bower_components/*/msa-server/index.js"), null, function(err, indexScripts) {
		for(var i=0, len=indexScripts.length; i<len; ++i)
			require(indexScripts[i])
	})

	// use main App
	var mainApp = require(join(Msa.dirname, 'bower_components', Msa.params.main_app)).subApp
	Msa.app.use(mainApp)

	next && next()
}

var startServer = function(next) {
	var httpsParams = Msa.params.https, isHttps = httpsParams.activated
	// create server
	if(isHttps) {
		var https = require('https')
		var cred = {
			key: fs.readFileSync(httpsParams.key),
			cert: fs.readFileSync(httpsParams.cert)
		}
		var server = https.createServer(cred, Msa.app)
	} else {
		var http = require('http')
		var server = http.createServer(Msa.app)
	}
	// determine port
	var port = Msa.params.port
	if(port=="dev") port = isHttps ? 8443 : 8080
	if(port=="prd") port = isHttps ? 81 : 80
	// start server
	server.listen(port)
	// log
	var prot = isHttps ? "https" : "http"
	console.log("Server ready: "+prot+"://localhost:"+port+"/")
}


// HELPERS //////////////////////////////////////////

// create express subApp (used to create server-side msa-components)
var createSubApp = Msa.subApp = function(route) {
	var subApp = express()
	subApp.getAsPartial = getAsPartial
	if(route) Msa.registerRoute(route, subApp)
	return subApp
}

// register new route (used by msa-components)
var registerRoute = Msa.registerRoute = function(route, subApp) {
	this.subAppsRouter.use(route, subApp)
}

// shortcut function to server HTML content as partial
var getAsPartial = function(route, htmlExpr) {
	var partial = Msa.formatHtml(htmlExpr)
	return this.get(route, function(req, res, next) {
		res.partial = partial
		next()
	})
}

Msa.require = function(comp, file) {
	var path = Msa.compsDir+'/'+comp+'/msa-server'
	if(file) path += '/'+file
	return require(path)
}

var toUrl = Msa.toUrl = function(filepath) {
	var rpath = path.relative(Msa.dirname, filepath)
	var url = path.normalize(rpath).replace(/\\/g, '/')
	if(url[0]!='/') url = '/'+url
	return url
}

// execute main function
main()
