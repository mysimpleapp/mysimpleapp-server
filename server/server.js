// require
var path = require('path')
var express = require('express')
var fs = require('fs')
var sh = require('shelljs')
var glob = require('glob')

global.Msa = global.MySimpleApp = {}
Msa.dirname = path.normalize(__dirname+"/..")
Msa.express = express

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
	
	requireMsaComponentIndexScripts(startServer)
}

var requireMsaComponentIndexScripts = function(next) {

	// require msa components index scripts
	glob(Msa.dirname+"/bower_components/*/msa-server/index.js", null, function(err, indexScripts) {
		for(var i=0, len=indexScripts.length; i<len; ++i)
			require(indexScripts[i])
	})

	// use main App
	var mainApp = require(Msa.dirname+'/bower_components/'+Msa.config.mainApp)
	Msa.app.use(mainApp)

	next && next()
}

var startServer = function(next) {
	Msa.app.listen(Msa.config.port, Msa.config.url)
	console.log("Server ready: http://localhost:"+Msa.config.port+"/")
	next && next()
}

var getAsPartial = function(route, htmlExpr, basePath) {
	var partial = Msa.solveHtmlExpr(htmlExpr, basePath)
	return this.get(route, function(req, res, next) {
		res.partial = partial
		next()
	})
}

var normalizeToUrl = function(file) {
	var url = path.normalize(file).replace(/\\/g, '/')
	if(url[0]!='/') url = '/'+url
	return url
}

var solveHtmlExpr = Msa.solveHtmlExpr = function(htmlExpr) { //, basePath) {
	var head = [], body = []
	solveHtmlExprCore(htmlExpr, head, body)
	var bodyStr = "", headStr = ""
	for(var i=0, len=body.length; i<len; ++i)
		bodyStr += body[i]
	for(var i=0, len=head.length; i<len; ++i) {
		var found = false
		for(var j=i-1; !found && j>=0; --j)
			found = (head[i]===head[j])
		if(!found) headStr += head[i]
	}
	return { head:headStr, body:bodyStr }
}
var solveHtmlExprCore = function(htmlExpr, head, body) {
	var type = typeof htmlExpr
	// case string
	if(type==="string") body.push(htmlExpr)
	else if(type==="object") {
		// case array
		var len = htmlExpr.length
		if(len!==undefined) {
			for(var i=0; i<len; ++i)
				solveHtmlExprCore(htmlExpr[i], head, body)
		// case object
		} else {
			// webcomponent
			var tag
			var webcomponent = htmlExpr.webcomponent
			if(webcomponent!==undefined) {
				var tagname = path.basename(webcomponent, '.html')
				var webcomponentUrl = normalizeToUrl(path.relative(Msa.dirname, webcomponent))
				head.push('<link rel="import" href="'+webcomponentUrl+'"></link>')
				tag = tagname
			}
			// tag (with props & content)
			tag = htmlExpr.tag || tag
			if(tag) {
				var content = htmlExpr.content, props = htmlExpr.props
				var str = '<'+tag
				// props
				if(props)
					for(var p in props)
						str += ' '+ p +'="'+ props[p] +'"'
				str += '>'
				body.push(str)
				// content
				if(content) solveHtmlExprCore(content, head, body)
				body.push('</'+tag+'>')
			}
			// body
			solveHtmlExprCore(htmlExpr.body, head, body)
			// head
			solveHeadExpr(htmlExpr.head, head)
		}
	}
}
var solveHeadExpr = function(headExpr, head) {
	var type = typeof headExpr
	// case string
	if(type==="string") head.push(headExpr)
	else if(type==="object") {
		// case array
		var len = headExpr.length
		if(len!==undefined) {
			for(var i=0; i<len; ++i)
				solveHeadExpr(headExpr[i], head)
			return
		}
	}
}

var checkHtmlExpr = Msa.checkHtmlExpr = function(match, htmlExpr) {
	var tag = match.tag
	if(tag && tag!==htmlExpr.tag) return false
	var props = match.props
	if(props) {
		var htmlProps = htmlExpr.props
		if(!htmlProps) return false
		for(var p in props) {
			if(props[p]!==htmlProps[p]) return false
		}
	}
	return true
}

// installation ///////////////////////////////////////////////////////////////

var install = function(next) {

	createApp()

	Msa.installComponent(null, next)
}

// installComponent
var installComponent = Msa.installComponent = function(component, next) {
	if (!sh.which('git')) return next("ERROR: git is not installed.");
	if (!sh.which('npm')) return next("ERROR: npm is not installed.");
	if (!sh.which('bower')) return next("ERROR: bower is not installed.");
	var pwd = sh.pwd(), dir = Msa.dirname;
	sh.cd(dir);
	var cmd = 'bower install '+(component ? component : "");
	sh.exec(cmd, function(code){
		if(code!==0) return console.log("ERROR: '"+cmd+"' failed (dir: "+dir+").")
		sh.cd(pwd);
		var path = Msa.dirname+'/bower_components/' + (component ? component : '*') + '/msa-server/package.json';
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

var registerRoute = Msa.registerRoute = function(route, subApp) {
	this.subAppsRouter.use(route, subApp)
}

// COMMON ////////////////////////////////////////

var createApp = function() {
	if(Msa.app) return

	// create App
	Msa.app = express()
	Msa.subAppsRouter = express.Router()

	// load sever config
	Msa.config = JSON.parse(fs.readFileSync(__dirname+'/config.json', 'utf8'))
}

var createSubApp = Msa.subApp = function(route) {
	var subApp = express()
	subApp.getAsPartial = getAsPartial
	if(route) Msa.registerRoute(route, subApp)
	return subApp
}

// execute main function
main()
