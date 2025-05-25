const http = require('http');
const https = require('https');
const zlib = require('zlib');
const replace = require('./replace.js');
const webAgent = new https.Agent({
	keepAlive: true,
	maxCachedSessions : 1000
});

const shareModule = {
	"domain" : 'localhost',
	"port" : 8080,
	"root" : '/sharepath/',
	"https" : true,
	"server" : false,
	"logging" : true,
}

function startShare(options){
	if("domain" in options) shareModule.domain=options.domain;
	if("port" in options) shareModule.port=options.port;
	if("root" in options) shareModule.root=options.root;
	if("https" in options) shareModule.https=options.https;
	if("logging" in options) shareModule.logging=options.logging;

	if(!shareModule.root.startsWith('/')) shareModule.root='/'+shareModule.root;
	if(!shareModule.root.endsWith('/')) shareModule.root=shareModule.root + '/';	

	if("server" in options) shareModule.server=options.server;
	else {
		shareModule.server = http.createServer();
		shareModule.server.listen(shareModule.port, '0.0.0.0',() => {
           console.info("\r\n Http Sharing Server Listening on ", shareModule.server.address());
        });
		shareModule.server.on('error', gErrorHandler);
	}
	shareModule.server.on('request', handleRequest);
}


/**
 * handle website requests
 */
function handleRequest(req, res) {
	const visitorIP = req.socket.remoteAddress;
	log('%s %s %s ', visitorIP, req.headers.host, req.url);


	if(!req.url.startsWith(shareModule.root)){
		if(req.headers.referer && req.headers.referer.includes(shareModule.root)) {
			const domainIndex = req.headers.referer.indexOf(shareModule.root) + shareModule.root.length;
			const domainRefer = req.headers.referer.slice(domainIndex, req.headers.referer.indexOf('/', domainIndex));
			if(checkDomain(domainRefer))  return response(res, 301, {'location': shareModule.root + domainRefer + req.url});
			else response(res,404);
		}
		else	return response(res,404);
	}
	
	const url = req.url.slice(shareModule.root.length);

	try{
		var parsed = new URL('https://' + url);
	} catch (e) {
		return  response(res, 403);
	}

	if(!checkDomain(parsed.host))	return  response(res, 403);

	const headers = {...req.headers};
	const filterHeaders = {'User-Agent': headers['user-agent'], 'Accept-Encoding': headers['accept-encoding'], 'Accept-Language': headers['accept-language'],'Host': parsed.host, 'Accept': headers['accept']};
	headers.host = parsed.host;
	if(url.includes('cloudokyo') || url.endsWith('.mp3') || url.endsWith('.mp4') || url.endsWith('.m4a') ) parsed.headers= headers;
	else if(req.method=='POST') parsed.headers= headers;
	else parsed.headers = filterHeaders

	parsed.agent = webAgent;
	try {
		requestRemote(parsed, req, res);
	} catch (e) {
		log('%s Error %s ', visitorIP, e.message);
	}
}


function requestRemote(parsed, req, res) {
	const visitorIP = req.socket.remoteAddress;
	log('%s Fetch %s ', visitorIP, parsed.toString());
	const host = req.headers.host;
	const rhost = parsed.host;

	let agent = http;
	if(parsed.protocol == 'https:') agent = https;

	var gotResponse = false;

	const onResponse = (proxyRes) => {
		if(isLocalIP(proxyRes.socket.remoteAddress)) return response(res,403);
		let statusCode = proxyRes.statusCode ? proxyRes.statusCode : 200;
		const headers = {...proxyRes.headers};
		gotResponse = true;

		if ([301, 302, 307].includes(statusCode) && proxyRes.headers['location']) {
			let location = proxyRes.headers['location'].trim();

			if(shareModule.https)	location = location.replace('https://', 'https://"' + host + shareModule.root).replace('http://', 'https://"' + host + shareModule.root)
			location = location.replace('http://', 'http://' + host + shareModule.root).replace('https://', 'http://' + host + shareModule.root)

			headers['location'] = location;
			res.writeHead(statusCode, headers);
			return proxyRes.pipe(res);

		}

		const resHtml = headers['content-type'] && ( headers['content-type'].includes('text/html') ||  headers['content-type'].includes('text/css'));
		const encoding = (headers['content-encoding'] || '').toLowerCase() ;
		delete headers['content-length'];
		res.writeHead(statusCode, headers);
		let pipend = proxyRes;
		if (resHtml) {
			if(encoding.includes('gzip'))	pipend = pipend.pipe( zlib.createUnzip());
			else if(encoding.includes('br')) pipend = pipend.pipe(zlib.createBrotliDecompress())
			else if(encoding.includes('deflate')) pipend = pipend.pipe(zlib.createInflateRaw())

			if(shareModule.https){
				pipend = pipend.pipe(replace('src="//', 'src="https://')).pipe(replace("src='//", "src='https://"));
				pipend = pipend.pipe(replace('href="//', 'href="https://')).pipe(replace("href='//", "href='https://"));
			}
			else{
				pipend = pipend.pipe(replace('src="//', 'src="http://')).pipe(replace("src='//", "src='http://"));
				pipend = pipend.pipe(replace('href="//', 'href="http://')).pipe(replace("href='//", "href='http://"));
			}

			pipend = pipend.pipe(replace('src="/', 'src="' + shareModule.root + rhost + '/')).pipe(replace("src='/", "src='"+shareModule.root + rhost + '/'));
			pipend = pipend.pipe(replace('href="/', 'href="' + shareModule.root + rhost + '/')).pipe(replace("href='/", "href='" + shareModule.root + rhost + '/'));
			pipend = pipend.pipe(replace('url="/', 'url="' + shareModule.root + rhost + '/')).pipe(replace("url='/", "url='"+shareModule.root + rhost + '/'));
			pipend = pipend.pipe(replace('url("/', 'url("' + shareModule.root + rhost + '/')).pipe(replace("url('/", "url('"+shareModule.root + rhost + '/'));
			pipend = pipend.pipe(replace('url: "/', 'url: "' + shareModule.root + rhost + '/')).pipe(replace("url: '/", "url: '"+shareModule.root + rhost + '/'));
			pipend = pipend.pipe(replace('href=/', 'href=' + shareModule.root + rhost + '/')).pipe(replace('src=/', 'src=' + shareModule.root + rhost + '/')).pipe(replace('url(/', 'url(' + shareModule.root + rhost + '/'))

			if(shareModule.https)	pipend = pipend.pipe(replace('https://', 'https://"' + host + shareModule.root));
			else	pipend = pipend.pipe(replace('http://', 'http://' + host + shareModule.root)).pipe(replace('https://', 'http://' + host + shareModule.root));

			if(encoding.includes('gzip'))	pipend = pipend.pipe(zlib.createGzip());
			else if(encoding.includes('br')) pipend = pipend.pipe(zlib.createBrotliCompress())
			else if(encoding.includes('deflate')) pipend = pipend.pipe(zlib.createDeflateRaw())

			pipend.pipe(res);

		} else {
			proxyRes.pipe(res);
		}
	}	

	var proxyReq = agent.request(parsed, onResponse);
	
	proxyReq.on('error',  (err) => {
		log('%s REQUEST %s ', visitorIP, err);
		if (gotResponse) {}
		else if ('ENOTFOUND' == err.code) response(res,400);
		else response(res,500);
		gotResponse = true;
		req.socket.end();
	});

	const endRequest = ()=>{
		proxyReq.end();
		res.removeListener('finish', endRequest);
		req.removeListener('end', endRequest);		
	}
	res.on('finish', ()=>endRequest());
	req.on('end', ()=>endRequest());
	
	if(!req.writableEnded) req.pipe(proxyReq);
	else endRequest();	
}


function gErrorHandler(e) {
	log('General Error %s ',  e.message);
}

function checkDomain(address) {
    if (!address) return false;
    else if(address.length > 255) return false
  
    var domainParts = address.split('.');
    if(domainParts.length<2) return false;
    if (domainParts.some(function (part) {
      return part.length > 63;
    })) return false;

    return true;
}


function response(res, httpCode, headers, content) {
	res.on('error', gErrorHandler);

	if(headers) res.writeHead(httpCode, headers);
	else res.writeHead(httpCode);

	if(content) res.write(content);
	res.end();
}


function log(...args) {
	if (shareModule.logging) console.log(...args);
}

function isLocalIP(address) {
	if(!address) return true;
	address = address.toLowerCase();
	if(address.startsWith('::ffff:')) address = address.slice(7);
	if(address.startsWith('::') || address.startsWith('0')) return true;
	if(address.startsWith('fc') || address.startsWith('fd') || address.startsWith('fe')) return true;
	if(address.startsWith('192.168.') || address.startsWith('10.') || address.startsWith('127.') || address.startsWith('169.254.') || address.startsWith('172.16')) return true;
	return false;
}

module.exports = startShare;