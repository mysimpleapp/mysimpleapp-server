# mysimpleapp-server
MySimpleApp (MSA) is a web application framework, running on NodeJS, simple to use and to develop with, based on "plug-and-play" components (the MSA components).

## How to install
* Install __nodejs__ ([Download link](https://nodejs.org/en/download/))
* Install __bower__ ([Official page](http://bower.io/)) :
```bash
# Example: install using npm

# Local install
npm install bower

# Or, global install (require root (unix), or administrator (windows) privileges)
npm install -g bower
```
* Download, or clone this __mysimpleapp-server__ repository into your working directory:
```bash
# Example: clone using git
git clone https://github.com/mysimpleapp/mysimpleapp-server.git <your_working_directory>
```
* Inside the repository, run the `installServer_linux.sh` or `installServer_windows.bat` script (by clicking on it for example).

## How to start
* Inside the repostory, run the `startServer_linux.sh` or `startServer_windows.bat` script (by clicking on it for example).
* When done, the server prompts you the URL of your running server (certainly: http://localhost:8080/ ).

## Architecture

MySimpleApp has a simple and non intrusive architecture, based on __MSA components__.

MSA components are components containing both server & client code, so that they are __"plug-and-play"__. That is to say that, once they have been imported in the application, the MSA components work directly without the need to write any additional code.

__Classical app architecture__:

In a classical web application, we can import some client side components (using bower, for example), and server side components (using npm, for example), but we also need to write code to connect all these components together and with the application.

![Classical app architecture](/doc/classical_architecture.png)

__MySimpleApp architecture__:

In a MySimpleApp application, the MSA components already holds the code to connect to their client & server side dependencies. This reduces considerably the amount of code needed to build a Web Application.

![MySimpleApp architecture](/doc/msa_architecture.png)

Futhermore, it is quite simple to create a MSA component. For more info, see the __Detailled architecture__ section on this page.

## Detailled architecture

MySimpleApp is based on some light and standard features:

The componentization (the capacity to separate the code into independant pieces: the components) is done using:
* On the client side: __WebComponents__ ([Tutorial](http://blog.soat.fr/2015/02/html-5-introduction-aux-web-components/))
* On the server side: __Node modules__ ([Tech doc](https://nodejs.org/api/modules.html))
  * And for the routing: __Express SubApps__ ([Tech doc](https://expressjs.com/en/api.html) - [Tutorial](https://derickbailey.com/2016/02/17/using-express-sub-apps-to-keep-your-code-clean/))

The package managers (tools that manage dependencies between components, and import them from the web) used are the following:
* On the client side: __Bower__ ([Link](https://bower.io/))
* On the server side: __NPM__ ([Link](https://www.npmjs.com/))

Here is the code structure of the MSA server:

![mysimpleapp-server architecture](/doc/msa-server_code_structure.png)

1. The core of the MSA server.
2. Script that start the server.
3. The legacy Bower components directory. It contains the MSA components and their client-side dependencies, as they are both imported by Bower.
4. An example of Bower component.
5. An example of MSA component.

Now let's see the code structure inside a MSA component.

![my-msa-component architecture](/doc/msa-component_code_structure.png)

6. An example of WebComponent (client-side code of MSA component).
7. Legacy bower configuration file, listing the MSA component client side dependencies, and also the dependencies on the other MSA components.
8. Directory containing server-side code of MSA component. This directory is not be visible by the user via static file request to the server.
9. Example of Node module (server-side code of MSA component).
10. Legacy NPM configuration file, listing the MSA component server side dependencies.
11. The legacy NPM components directory. It contains the MSA component server-side dependencies.

## How to create a MSA component

A MSA component is nothing more than a Bower component, following the code structure described in the previous section.

Here an example of what could be the content of the `my-msa-component.html` file:

```html
<!-- Import some MSA light utilities to simplify your work -->
<link rel="import" src="../mysimpleapp/mysimpleapp.html"></link>
<!-- You can create a HTML Custom Element -->
<template id="my-msa-component">
	<p>Hello world</p>
</template>
<!-- You can stylize your Custom Element -->
<style>
	my-msa-component p {
		color: red;
	}
</style>
<script>
	// Register your Custom Element (if you have created one)
	Msa.registerElement("my-msa-component", {
		template:"#my-msa-component"
	})

	// You can create some functions accessible via a global object
	MyMsaComponent = {}
	MyMsaComponent.sayHello = function() {
		console.log("hello")
	}
</script>
```

Here an example of what could be the content of the `index.js` file:

```javascript
// Create the module main object
var myMsaComponent = module.exports = {}

// You can create some functions accessible via the module object
myMsaComponent.sayHi = function() {
	console.log("Hi !")
}

// You can create a subApp, if you want to create some new routes
var subApp = myMsaComponent.subApp = Msa.subApp("/myMsa")

// You can create a new route via the subApp
// In this example, the route created is "GET /myMsa/ola"
subApp.get("/ola", function(req, res, next){
	res.json("Ola " + req.query.name + " !")
})
```

## How to import another MSA component

Let's assume that we create another MSA component `other-msa-component` that imports the MSA component `my-msa-component` defined in the previous section.

First, you need to add __my-msa-component__ in the `bower.json` file of your new component.

```json
{
	"name": "other-msa-component",
	"version": "1.2.3",
	...
	"dependencies": {
		"mysimpleapp": "4.5.6",
		"my-msa-component": "7.8.9"
	}
}
```

Here an example of what could be the content of the `other-msa-component.html` file:

```html
<link rel="import" src="../mysimpleapp/mysimpleapp.html"></link>
<!-- You need to import my-msa-component WebComponent -->
<link rel="import" src="../my-msa-component/my-msa-component.html"></link>
<template id="other-msa-component">
	<!-- You can use my-msa-component HTML Custom Element -->
	<my-msa-component></my-msa-component>
</template>
<script>
	Msa.registerElement("other-msa-component", {
		template:"#other-msa-component"
	})

	// You can call my-msa-component functions
	MyMsaComponent.sayHello()

	// You can target my-msa-component routes
	Msa.get("/myMsa/ola", { name:"Nico" }, function(res){
		console.log(res) // -> "Ola Nico !"
	})
</script>
```

Here an example of what could be the content of the `index.js` file:

```javascript
var otherMsaComponent = module.exports = {}

// You need to import (require) my-msa-component node module
var myMsaComponent = require("../../my-msa-component/msa-server/index.js")

// You can call my-msa-component functions
myMsaComponent.sayHi()
```

## SERVER API

List of server side functionalities available to other components.

### Function: Msa.subApp

Create subApp allowing to create some routing.

```javascript
// Example
var myMsaComponent = module.exports = {}
var subApp = myMsaComponent.subApp = Msa.subApp("/myMsa")

// You can create a new route via the subApp
// In this example, the route created is "GET /myMsa/ola"
subApp.get("/ola", function(req, res, next){
	res.json("Ola " + req.query.name + " !")
})
```

* __Msa.subApp__: `Function(route) -> subApp`
  * __route__: `String`, 
  * __subApp__: `Express SubApp`, resulting subApp.

### Function: Msa.require

Helper to require MSA components faster.

```javascript
// Example

var foo = Msa.require("foo")
// is equivalent to
var foo = require(Msa.dirname+"/bower_components/foo/msa-server/index.js")

var foo = Msa.require("foo","bar.js")
// is equivalent to
var foo = require(Msa.dirname+"/bower_components/foo/msa-server/bar.js")
```

* __Msa.require__: `Function(component[, script]) -> module`
  * __*component__: `String`, name of component to require.
  * __script__: `String`, script to require in component (default: "index.js").
  * __module__: required module.

### Function: Msa.toUrl

Convert a path to url.

```javascript
// Example
var url = Msa.toUrl(__dirname+"/file/path")
```

* __Msa.toUrl__: `Function(path) -> url`
  * __*path__: `String`, path to file or directory.
  * __url__: `String`, url to file or directory.
