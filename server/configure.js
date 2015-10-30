// app ////////////////////////////////////////////////////////////////
var configureApp = module.exports = App.express();
var userApp = require('../bower_components/msa-user/server/index.js');
var fs = require('fs');

// input json parsing
configureApp.use(require("body-parser").json());

// configuration
var checkAppNotConfigured = function(req, res, next) {
	next((App.config.configured) ? 'Not permitted.' : undefined);
};
var addAdminGroup = function(req, res, next) {
	req.body.group = 'admin';
	userApp.addGroup(req, res, next);
};
var updateConfig = function(req, res, next) {
	App.config.configured = true;
	fs.writeFile('config.json', JSON.stringify(App.config, null, "\t"), function (err) {
		next(err);
	});
};
var resetRoutes = function(req, res, next) {
	App.setRoutes(next);
};
configureApp.post("/configure",
	checkAppNotConfigured,
	userApp.register,
	addAdminGroup,
	userApp.login,
	updateConfig,
	resetRoutes,
	userApp.replyUser);

// main HTML
configureApp.get('/', function(req, res, next){
	res.sendFile(__dirname+'/views/configure.html');
})

// static routing
configureApp.use(App.express.static(App.dirname));