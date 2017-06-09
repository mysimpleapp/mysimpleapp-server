// TODO: migrate to independant Node Module
// require
var path = require('path'),
	join = path.join,
	resolve = path.resolve
var htmlparser2 = require("htmlparser2")

// convert HTML expression to HTML object
Msa.formatHtml = function(htmlExpr) {
	// fill head & body objects
	var head = new Set(), body = []
	_formatHtml_core(htmlExpr, head, body, false)
	// format head & body to sring
	var bodyStr = body.join('')
	var headStr = ""
	for(var h of head)
		headStr += h
	// return HTML string
	return { head:headStr, body:bodyStr }
}
var _formatHtml_core = function(htmlExpr, head, body, isHead) {
	var type = typeof htmlExpr
	// case string
	if(type==="string") {
		_formatHtml_push(htmlExpr, head, body, isHead)
	} else if(type==="object") {
		// case array
		var len = htmlExpr.length
		if(len!==undefined) {
			for(var i=0; i<len; ++i)
				_formatHtml_core(htmlExpr[i], head, body, isHead)
		// case object
		} else {
			var tag = htmlExpr.tag
			var cnt = htmlExpr.content || htmlExpr.cnt
			var attrs = htmlExpr.attributes || htmlExpr.attrs
			var style = htmlExpr.style
			var imp = htmlExpr.import
			var js = htmlExpr.script || htmlExpr.js
			var css = htmlExpr.stylesheet || htmlExpr.css
			var wel = htmlExpr.webelement || htmlExpr.wel
			// web element
			if(wel) {
				_formatHtml_core({import:wel}, head, body, isHead)
				tag = tag || _formatHtml_getWelTag(wel)
				isHead = false
			}
			// html import
			if(imp && !tag) {
				tag = 'link'
				attrs = attrs || {}
				attrs.rel = 'import'
				attrs.href = imp
				isHead = true
			}
			// script
			if(js && !tag) {
				tag = 'script'
				attrs = attrs || {}
				attrs.src = js
				isHead = true
			}
			// stylesheet
			if(css && !tag) {
				tag = 'link'
				attrs = attrs || {}
				attrs.rel = 'stylesheet'
				attrs.type = 'text/css'
				attrs.href = css
				isHead = true
			}
			// tag (with attrs, style & content)
			tag = htmlExpr.tag || tag
			if(tag) {
				var str = '<'+tag
				// attrs
				if(style) {
					if(!attrs) attrs={}
					attrs.style = style
				}
				if(attrs)
					for(var a in attrs) {
						var val = attrs[a]
						if(style) { a='style'; val=style }
						if(a=='style') val = _formatHtml_style(val)
						str += ' '+ a +'="'+ val +'"'
					}
				str += '>'
				_formatHtml_push(str, head, body, isHead)
				// content
				if(cnt) _formatHtml_core(cnt, head, body, isHead)
				_formatHtml_push('</'+tag+'>', head, body, isHead)
			}
			// body
			_formatHtml_core(htmlExpr.body, head, body, false)
			// head
			_formatHtml_core(htmlExpr.head, head, body, true)
		}
	}
}
var _formatHtml_style = function(style) {
	var type = typeof style
	if(type==="string") return style
	else if(type==="object") {
		var str = ""
		for(var a in style) str += a+':'+style[a]+'; '
		return str
	}
}
var _formatHtml_push = function(html, head, body, isHead) {
	if(isHead) head.add(html)
	else body.push(html)
}
var _formatHtml_getWelTag = function(wel) {		
	return path.basename(wel, '.html')
}

// Check that an object match an user expr
var checkHtmlExpr = Msa.checkHtmlExpr = function(match, htmlExpr) {
	var tag = match.tag
	if(tag && tag!==htmlExpr.tag) return false
	var attrs = match.attrs
	if(attrs) {
		var htmlAttrs = htmlExpr.attrs
		if(!htmlAttrs) return false
		for(var p in attrs) {
			if(attrs[p]!==htmlAttrs[p]) return false
		}
	}
	return true
}

// html parser ///////////////////////////////////////////////////////////////////

Msa.parseHtml = function(html) {
	var domStack = [{tag:"root", content:[]}]
	var parser = new htmlparser2.Parser({
		onopentag: function(tag, attrs){
			var newDom = {
				tag: tag,
				attrs: attrs,
				content: []
			}
			domStack[domStack.length-1].content.push(newDom)
			domStack.push(newDom)
		},
		ontext: function(text){
		    domStack[domStack.length-1].content.push(text)
		},
		onclosetag: function(tag){
			domStack.pop()
	    }
	}, {decodeEntities: true})
	parser.write(html)
	parser.end()
	return { body: domStack[0].content }
}
