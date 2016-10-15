// require
var path = require('path')
var express = require('express')
var fs = require('fs')
var sh = require('shelljs')
var glob = require('glob')
var callsite = require('callsite')

var main = function() {
	// check input arguments
	var actions = process.argv.slice(2)
	// "start" is the default argument
	if(actions.length===0) actions.push("start")
	// execute actions given in args
	executeActions(actions, 0, actions.length)
}
var executeActions = function(actions, i, len, next) {
	if(i>=len) return next && next()
	var executeNextAction = function() { executeActions(actions, i+1, len, next) }
	var action = actions[i]
	if(action==="help") help(executeNextAction)
	else if(action==="start") start(executeNextAction)
	else if(action==="install") install(executeNextAction)
	else executeNextAction()
}

var help = function(next) {
	console.log("node server.js [help] [install] [start (default)]")
	console.log("  help: display this help.")
	console.log("  install: install first msa components.")
	console.log("  start: start server.")
	next()
}

var start = function(next) {
	
	createApp()
	
	applyConfigs(startServer)
}

var applyConfigs = function(next) {
	
	// find all msa-config.json files
	glob(App.dirname+"/bower_components/*/msa-server/msa-config.json", null, function(err, msaConfigFiles) {
		for(var f=0, lenF=msaConfigFiles.length; f<lenF; ++f) {
			var file = msaConfigFiles[f], dir = path.dirname(file)
			// parse file
			var config = JSON.parse(fs.readFileSync(file))
			// loop on config elems
			var configElems = (config.length===undefined) ? [config] : config
			for(var e=0, lenE=configElems.length; e<lenE; ++e) {
				var configElem = configElems[e]
				// subApp
				var subApp = null
				if(configElem.subApp) subApp = require(path.normalize(dir+'/'+configElem.subApp))
				else {
					// subApp from html expr
					var html = solveHtmlExpr(configElem, dir)
					if(html) {
						var subApp = createSubApp()
						subApp.get('/', function(req, res, next) {
							res.partial = html
							next()
						})
					}

				}
				// route
				if(subApp && configElem.route) {
					App.registerRoute(configElem.route, subApp)
				}
			}
		}
		
		// use main App
		var mainApp = require(App.dirname+'/bower_components/'+App.config.mainApp)
		App.use(mainApp)
		
		next && next()
	});
}

/*var resetMountedApp = function() {
	if(!App._router || !App._router.stack) return
	var stack = App._router.stack
	for(var r=0; r<stack.length; ++r)
		if(stack[r].name=='mounted_app')
			stack.splice(r--,1)
}*/

var startServer = function(next) {
	App.listen(App.config.port, App.config.url)
	console.log("Server ready: http://localhost:"+App.config.port+"/")
	next && next()
}
/*var getSubAppFromRouteName = function(routeName) {
	var route = App.routes[routeName]
	var subApp = route.subApp
	if(subApp==undefined) {
		subApp = null
		var subAppFile = route.file
		var ext = path.extname(subAppFile)
		if(ext==".js") subApp = require(subAppFile)
		else if(ext==".html") {
			subApp = App.subApp(subAppFile)
			subApp.getAsPartial('/', path.basename(subAppFile))
		} else {
			console.log("ERROR: Bad extension for routing file (only allowed .js and .html).")
		}
		route.subApp = subApp;
	}
	return subApp;
}*/

// partials
/*var buildPartial = function(file, args) {
	var fileurl = normalizeToUrl(this.dirurl+'/'+file)
	var webcomponent = path.basename(file, '.html')
	var head = '<link rel="import" href="'+fileurl+'"></link>'
	var body = '<'+webcomponent
	if(args) {
		for(var a in args) {
			if(a==="content") continue
			var val = args[a]
			if(val===null) continue
			body += " "+a+"='"+val+"'"
		}
	}
	body += '>'
	if(args && args.content) {
		body += args.content
	}
	body += '</'+webcomponent+'>'
	return { head: head, body: body }
}*/
var getAsPartial = function(route, htmlExpr, basePath) {
	var partial = App.solveHtmlExpr(htmlExpr, basePath)
	return this.get(route, function(req, res, next) {
		res.partial = partial
		next()
	})
}

/*var getUrl = function(file, callerFileName) {
	if(!callerFileName) callerFileName = getCallerFileName();
	return '/'+path.normalize(path.relative(App.dirname, path.dirname(callerFileName)+'/'+file));
};*/
var normalizeToUrl = function(file) {
	var url = path.normalize(file).replace(/\\/g, '/')
	if(url[0]!='/') url = '/'+url
	return url
}
/*var getCallerFileName = function(callerDepth) {
	if(callerDepth===undefined) callerDepth = 0
	return callsite()[callerDepth+1].getFileName()
}*/
var solveHtmlExpr = function(htmlExpr, basePath) {
	var type = typeof htmlExpr
	// case string
	if(type==="string") return { body:htmlExpr }
	if(type==="object") {
		// case webcomponent
		var webcomponent = htmlExpr.webcomponent
		if(webcomponent!==undefined) {
			var tagname = path.basename(webcomponent, '.html')
			if(basePath) webcomponent = basePath+"/"+webcomponent
			var webcomponentUrl = normalizeToUrl(path.relative(App.dirname, webcomponent))
			return { head:'<link rel="import" href="'+webcomponentUrl+'"></link>', body:"<"+tagname+"></"+tagname+">"}
		}
		// basic
		if(htmlExpr.head!==undefined || htmlExpr.body!==undefined) {
			return htmlExpr
		}
	}
	return null
}

// installation ///////////////////////////////////////////////////////////////

var install = function(next) {

	createApp()

	App.installComponent(null, next)
}

// installComponent
var installComponent = function(component, next) {
	if (!sh.which('git')) return next("ERROR: git is not installed.");
	if (!sh.which('npm')) return next("ERROR: npm is not installed.");
	if (!sh.which('bower')) return next("ERROR: bower is not installed.");
	var pwd = sh.pwd(), dir = App.dirname;
	sh.cd(dir);
	var cmd = 'bower install '+(component ? component : "");
	sh.exec(cmd, function(code){
		if(code!==0) return console.log("ERROR: '"+cmd+"' failed (dir: "+dir+").")
		sh.cd(pwd);
		var path = App.dirname+'/bower_components/' + (component ? component : '*') + '/msa-server/package.json';
		glob(path, null, function(err, packageFiles) {
			if(err) return console.log("ERROR: "+err);
			installSubApp(packageFiles, 0, packageFiles.length, next);
		});
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

var registerRoute = function(route, subApp) {
	this.subAppsRouter.use(route, subApp)
}

// COMMON ////////////////////////////////////////

var createApp = function() {
	if(global.App) return

	// create App
	global.App = express()

	// Add App attributes & methods
	App.express = express
	App.dirname = path.normalize(__dirname+"/..")
	App.installComponent = installComponent
	App.subApp = createSubApp
	//App.getSubAppFromRouteName = getSubAppFromRouteName
	//App.components = {}
	//App.routes = {}
	//App.setRoutes = setRoutes
	App.solveHtmlExpr = solveHtmlExpr

	App.subAppsRouter = express.Router()
	App.registerRoute = registerRoute

	// load sever config
	App.config = JSON.parse(fs.readFileSync(__dirname+'/config.json', 'utf8'))
}

var createSubApp = function(callerDepth) {
	/*if(!callerDepth) callerDepth = 0
	var callerFileName = getCallerFileName(callerDepth+1)
	callerFileName = path.normalize(callerFileName)*/
	var subApp = express()
	/*subApp.dirname = path.dirname(callerFileName)
	subApp.dirurl = normalizeToUrl(path.relative(App.dirname, subApp.dirname))
	subApp.buildPartial = buildPartial*/
	subApp.getAsPartial = getAsPartial
	return subApp
}

// execute main function
main()
