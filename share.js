const http = require('http');
const https = require('https');
const zlib = require('zlib');
const replace = require('./replace.js');
const { on } = require('events');
const rejectAccess = (req, res) => response(res,403);
const webAgent = new https.Agent({
	keepAlive: true,
	maxCachedSessions : 1000
});

const shareModule = {
	"domain" : 'localhost',
	"root" : '/sharepath/',
	"port" : 8080,
	"ip" : '0.0.0.0',
	"logging" : false,
	"https" : true,
	"server" : false,
	"onNotFound" : rejectAccess
}

function startShare(options){
	if(!options) return startShare({'https': false});

	if("domain" in options) {
		shareModule.domain=options.domain;
		if(!checkDomain(shareModule.domain))	return console.error('Invalid domain name: %s', shareModule.domain);
	}
	if("root" in options) shareModule.root=options.root;
	if(!shareModule.root.startsWith('/')) shareModule.root='/'+shareModule.root;
	if(!shareModule.root.endsWith('/')) shareModule.root=shareModule.root + '/';	

	if("port" in options) shareModule.port=options.port;
	if("ip" in options) shareModule.ip=options.ip;
	if("logging" in options) shareModule.logging=options.logging;
	if("https" in options) shareModule.https=options.https;

	if("server" in options) shareModule.server=options.server;
	else {
		shareModule.server = http.createServer();
		shareModule.server.listen(shareModule.port, shareModule.ip, () => {
           console.info("\r\n Http Sharing Server Listening on ", shareModule.server.address());
        });
		shareModule.server.on('error', gErrorHandler);
	}

	if("onNotFound" in options) shareModule.onNotFound=options.onNotFound;

	shareModule.server.on('request', handleRequest);
	console.info('Share Internet with prefix:	%s://%s%s%s', shareModule.https ? 'https' : 'http', shareModule.domain, (shareModule.https ? '' : ':'+ shareModule.port), shareModule.root);
}


/**
 * handle website requests
 */
function handleRequest(req, res) {
	const visitorIP = req.socket.remoteAddress;
	log('%s %s %s ', visitorIP, req.headers.host, req.url);

	if(req.headers.host && req.headers.host.split(':')[0].toLowerCase() != shareModule.domain) return onNotFound(req, res);

	if(!req.url.startsWith(shareModule.root)){
		if(req.headers.referer && req.headers.referer.includes(shareModule.root)) {
			const domainIndex = req.headers.referer.indexOf(shareModule.root) + shareModule.root.length;
			const domainRefer = req.headers.referer.slice(domainIndex, req.headers.referer.indexOf('/', domainIndex));
			if(checkDomain(domainRefer))  return response(res, 301, {'location': shareModule.root + domainRefer + req.url});
			else return onNotFound(req, res);
		}
		else	return onNotFound(req, res);
	}
	
	const url = req.url.slice(shareModule.root.length);

	try{
		var parsed = new URL('https://' + url);
	} catch (e) {
		return  response(res, 403);
	}

	if(!checkDomain(parsed.host))	return  response(res, 403);

	const headers = {...req.headers};
	const filterHeaders = {'User-Agent': headers['user-agent'], 'Accept-Encoding': headers['accept-encoding'], 'Host': parsed.host};
	if(headers['accept-language']) filterHeaders['Accept-Language'] = headers['accept-language'];
	if(headers['cache-control']) filterHeaders['Cache-Control'] = headers['cache-control'];

	headers.host = parsed.host;

	parsed.headers = filterHeaders
	parsed.method = req.method;
	if(req.method=='POST') parsed.headers= headers;
	else if(url.endsWith('.mp3') || url.endsWith('.mp4') || url.endsWith('.m4a'))	 parsed.headers= headers;
	else if(url.endsWith('/') || url.endsWith('.html') || url.endsWith('.htm') || url.endsWith('.php') || url.endsWith('.css') )  delete parsed.headers['accept-encoding'];
	else if(url.includes('.php?') || url.includes('.css?') || url.includes('.html?') || url.includes('.htm#') ) delete parsed.headers['accept-encoding'];
	else if(url.includes('.cloudokyo.cloud')) parsed.headers= headers;

	if(shareModule.ip !== '0.0.0.0'){
		parsed.localAddress = shareModule.ip;
	}

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

			if(location.includes(host + shareModule.root)) {
				if(shareModule.https) location = location.replace('http', 'https');
				else location = location.replace('https', 'http');
			}
			else if(shareModule.https)	location = location.replace('https://', 'https://' + host + shareModule.root).replace('http://', 'https://' + host + shareModule.root)
			else location = location.replace('http://', 'http://' + host + shareModule.root).replace('https://', 'http://' + host + shareModule.root)

			headers['location'] = location;
			res.writeHead(statusCode, headers);
			return proxyRes.pipe(res);
		}

		const resHtml = headers['content-type'] && ( headers['content-type'].includes('text/html') ||  headers['content-type'].includes('text/css'));
		let resJs = rhost.endsWith('ganjingworld.com') && parsed.pathname.endsWith('.js') && parsed.pathname.includes('/pages/_app-');
		if(!resJs)  resJs = rhost.endsWith('falundafa.org')  && parsed.pathname.includes('functions.js');

		if(resJs|| resHtml)	delete headers['content-length'];

		const decoding = (headers['content-encoding'] || '').toLowerCase() ;
		let encoding = decoding;
		if(!decoding && resHtml && req.headers['accept-encoding'] && req.headers['accept-encoding'].toLowerCase().includes('gzip')) {
			encoding = 'gzip';
			headers['content-encoding'] = 'gzip';
		}

		res.writeHead(statusCode, headers);
		let pipend = proxyRes;
		if (resHtml || resJs) {
			if(!decoding)	pipend = proxyRes;
			else if(decoding.includes('gzip'))	pipend = pipend.pipe( zlib.createGunzip());
			else if(decoding.includes('zstd')) pipend = pipend.pipe(zlib.createZstdDecompress())
			else if(decoding.includes('br')) pipend = pipend.pipe(zlib.createBrotliDecompress())
			else if(decoding.includes('deflate')) pipend = pipend.pipe(zlib.createInflateRaw())
		}

		if (resHtml) {
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
		}

		if (resHtml || resJs) {
			if(rhost.endsWith('.ganjingworld.com') && (parsed.pathname.startsWith('/embed/') || parsed.pathname.includes('/live/')))
				pipend = pipend.pipe(replace('https://www.ganjingworld.', (shareModule.https? 'https://' : 'http://') + host + shareModule.root + "www.ganjingworld."));

			else if(shareModule.https)	pipend = pipend.pipe(replace('https://', 'https://' + host + shareModule.root)).pipe(replace('http://', 'https://' + host + shareModule.root));
			else	pipend = pipend.pipe(replace('http://', 'http://' + host + shareModule.root)).pipe(replace('https://', 'http://' + host + shareModule.root));

			if(rhost.endsWith('.soundofhope.org') && parsed.pathname.startsWith('/post/'))	pipend = pipend.pipe(replace('//media.soundofhope.org',  '//' + host + shareModule.root + "media.soundofhope.org"));

			if(encoding.includes('gzip'))	pipend = pipend.pipe(zlib.createGzip());
			else if(encoding.includes('zstd')) pipend = pipend.pipe(zlib.createZstdCompress())
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

process.on('uncaughtException', gErrorHandler);

module.exports = startShare;