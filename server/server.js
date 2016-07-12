var express, fs, sh, glob, callsite
var path = require('path')

var createServer = function() {
	// create express App
	try {
		express = require('express')
	} catch(err) {
		return globalNpm(__dirname, createServer)
	}
	global.App = express()
	App.express = express
	App.dirname = path.normalize(__dirname+"/..")
	App.installComponent = installComponent
	App.subApp = createSubApp
	App.getSubAppFromRouteName = getSubAppFromRouteName
	App.components = {}
	App.routes = {}
	App.init = init
	App.setRoutes = setRoutes
	App.solveHtmlExpr = solveHtmlExpr
	//App.normalizeToUrl = normalizeToUrl
	
	// require
	fs = require('fs')
	sh = require('shelljs')
	glob = require('glob')
	callsite = require('callsite')
	
	// load sever config
	App.config = JSON.parse(fs.readFileSync(__dirname+'/config.json', 'utf8'))
	
	App.init()
}

var init = function(next) {
	if(!this.config.installed) installServer();
	else {
		if(!this.config.configured) setRoutesForConfiguration(startServer)
		else setRoutes(startServer)
	}
}

var setRoutes = function(next) {
	resetMountedApp()
	
	// parse subApp msa-routes.json files
	glob(App.dirname+"/bower_components/**/msa-config.json", null, function(err, msaConfigFiles) {
		for(var f=0, len=msaConfigFiles.length; f<len; ++f) {
			var msaConfigFile = msaConfigFiles[f]
			var config = JSON.parse(fs.readFileSync(msaConfigFile))
			var routes = config.routes
			if(!routes) continue
			var dirname = path.dirname(msaConfigFile)
			// fill App.routes
			for(var routeName in routes) {
				if(App.routes[routeName]!==undefined) { console.log('WARNING: route name "'+routeName+'" is already used.');  continue; }
				var route = { name:routeName, file:dirname+'/'+routes[routeName], subApp:null }
				App.routes[routeName] = route
			}
		}
		
		// build router
		App.subAppsRouter = express.Router()
		for(var routeName in App.routes) {
			var subApp = App.getSubAppFromRouteName(routeName)
			if(subApp) App.subAppsRouter.use("/"+routeName, subApp)
		}
		
		// use main App
		var mainApp = require(App.dirname+'/bower_components/'+App.config.mainApp)
		App.use(mainApp)
		
		next && next()
	});
}

var resetMountedApp = function() {
	if(!App._router || !App._router.stack) return
	var stack = App._router.stack
	for(var r=0; r<stack.length; ++r)
		if(stack[r].name=='mounted_app')
			stack.splice(r--,1)
}

var startServer = function(next) {
	App.listen(App.config.port, App.config.url)
	console.log("Server ready: http://localhost:"+App.config.port+"/")
	next && next()
};
var getSubAppFromRouteName = function(routeName) {
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
};

// App.require
var createSubApp = function(callerDepth) {
	if(!callerDepth) callerDepth = 0
	var callerFileName = getCallerFileName(callerDepth+1)
	callerFileName = path.normalize(callerFileName)
	var subApp = express()
	subApp.dirname = path.dirname(callerFileName)
	subApp.dirurl = normalizeToUrl(path.relative(App.dirname, subApp.dirname))
	subApp.buildPartial = buildPartial
	subApp.getAsPartial = getAsPartial
	return subApp
}

// partials
var buildPartial = function(file, args) {
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
}
var getAsPartial = function(route, file, args) {
	var partial = this.buildPartial(file, args)
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
var getCallerFileName = function(callerDepth) {
	if(callerDepth===undefined) callerDepth = 0
	return callsite()[callerDepth+1].getFileName()
}
var solveHtmlExpr = function(htmlExpr) {
	var type = typeof htmlExpr
	// case string
	if(type==="string") return { body:htmlExpr }
	if(type==="object") {
		// case webcomponent
		var webcomponent = htmlExpr.webcomponent
		if(webcomponent!==undefined) {
			var tagname = path.basename(webcomponent, '.html')
			var webcomponentUrl = normalizeToUrl(path.relative(App.dirname, webcomponent))
			return { head:'<link rel="import" href="'+webcomponentUrl+'"></link>', body:"<"+tagname+"></"+tagname+">"}
		}
		// other cases
		return htmlExpr
	}
}

// installation ///////////////////////////////////////////////////////////////

var globalNpmPossiblePaths = [
	path.resolve(path.dirname(process.execPath),'node_modules','npm'),
	path.resolve(path.dirname(process.execPath),'..','lib','node_modules','npm')
]
var globalNpm = function(dir, next) {
	// try to require npm global module
	var npm = null;
	for(var i=0, len=globalNpmPossiblePaths.length; i<len && !npm; ++i) {
		try {
			npm = require(globalNpmPossiblePaths[i])
		} catch(err) {}
	}
	// if not found, raise an error
	if(!npm) return console.log('ERROR: Could not find npm.\nPlease, manually run this command "npm install", in this directory "'+dir+'"')
	// if found, npm install the server
	process.chdir(dir);
	npm.load(function (err) {
		if (err) return console.log(err);
		npm.commands.install(function (err, data) {
			if (err) return console.log(err);
			next && next();
		});
	});
};

var installServer = function() {
	App.installComponent({component:null}, null, function(){
		App.config.installed = true;
		fs.writeFile('config.json', JSON.stringify(App.config, null, "\t"), function (err) {
			if(err) return console.log(err);
			App.init();
		});
	});
};

// installComponent
var installComponent = function(req, res, next) {
	if (!sh.which('git')) return next("ERROR: git is not installed.");
	if (!sh.which('npm')) return next("ERROR: npm is not installed.");
	if (!sh.which('bower')) return next("ERROR: bower is not installed.");
	var component = req.component;
	var pwd = sh.pwd(), dir = App.dirname;
	sh.cd(dir);
	var cmd = 'bower install '+(component ? component : "");
	sh.exec(cmd, function(code){
		if(code!==0) return console.log("ERROR: '"+cmd+"' failed (dir: "+dir+").")
		sh.cd(pwd);
		var path = App.dirname+'/bower_components/' + (component ? component : '*') + '/**/msa-config.json';
		glob(path, null, function(err, msaConfigFiles) {
			if(err) return console.log("ERROR: "+err);
			installSubApp(msaConfigFiles, 0, next);
		});
	})
};
var installSubApp = function(msaConfigFiles, index, next) {
	if(index>=msaConfigFiles.length) return next();
	var file = msaConfigFiles[index], dir = path.dirname(file);
	// check if package.json exists
	filExists(dir+'/package.json', function(exists) {
		// if not exists: pass
		if(!exists) return installSubApp(msaConfigFiles, index+1, next)
		// if exists: npm install the subApp module dependencies
		var pwd = sh.pwd();
		sh.cd(dir);
		var cmd = "npm install"
		sh.exec(cmd, function(code){
			if(code!==0) return console.log("ERROR: '"+cmd+"' failed (dir: "+dir+").")
			sh.cd(pwd)
			installSubApp(msaConfigFiles, index+1, next)
		})
	})
};

setRoutesForConfiguration = function(next) {
	resetMountedApp()
	
	// use main App
	var configureApp = require("./configure.js");
	App.use(configureApp)
	
	next && next();
}

filExists = function(file, next) {
	if(fs.access) fs.access(file, fs.F_OK, function(err) { next(!err) })
	else fs.exists(file, next) // to be compatible with old versions of nodejs
}

createServer();
