const http = require('http');
const https = require('https');
const zlib = require('zlib');
const replace = require('./replace.js');
const rejectAccess = (req, res) => response(res,403);
const webAgent = new https.Agent({
	keepAlive: true,
	maxCachedSessions : 1000
});

const shareModule = {
	"domain" : 'localhost',
	"root" : '/sharepath/',
	"ip" : '0.0.0.0',
	"logging" : false,
	"https" : true,
	"onNotFound" : rejectAccess
}

function share(options){
	if(!options || typeof options != 'object') return share({'https': false});
		
	if("domain" in options) {
		shareModule.domain=options.domain.toLowerCase().trim();
		if(!checkDomain(shareModule.domain))	return console.error('Invalid domain name: %s', shareModule.domain);
	}
	if("root" in options) shareModule.root=options.root;
	if(!shareModule.root.startsWith('/')) shareModule.root='/'+shareModule.root;
	if(!shareModule.root.endsWith('/')) shareModule.root=shareModule.root + '/';	

	if("ip" in options) shareModule.ip=options.ip;
	if("port" in options) shareModule.port=options.port;

	if("logging" in options) shareModule.logging=options.logging;
	if("https" in options) shareModule.https=options.https;

	if("onNotFound" in options) shareModule.onNotFound=options.onNotFound;

	console.info('\nShare Internet with prefix:	%s://%s%s%s', shareModule.https ? 'https' : 'http', shareModule.domain, (shareModule.https ? '' : ':'+ shareModule.port), shareModule.root);

	return shareHandler;
}


/**
 * handle website requests
 */
function shareHandler(req, res) {
	const visitorIP = req.socket.remoteAddress;
	log('%s %s %s ', visitorIP, req.headers.host, req.url);

	if(req.headers.host && req.headers.host.split(':')[0].toLowerCase() != shareModule.domain) return shareModule.onNotFound(req, res);

	let url = req.url;

	if(url.includes(shareModule.domain + shareModule.root)) return response(res, 301, {'location':  url.split(shareModule.domain)[1]});

	if(!url.startsWith(shareModule.root)){
		if(req.headers.referer && req.headers.referer.includes(shareModule.root)) {
			const domainIndex = req.headers.referer.indexOf(shareModule.root) + shareModule.root.length;
			const domainRefer = req.headers.referer.slice(domainIndex).split('/')[0].toLowerCase();
			if(!checkDomain(domainRefer))	return shareModule.onNotFound(req, res);
			else if(req.method == 'GET')	return response(res, 301, {'location': shareModule.root + domainRefer + req.url});
			else url = shareModule.root + domainRefer + req.url
		}
		else	return shareModule.onNotFound(req, res);
	}
	
	url = url.slice(shareModule.root.length);

	try{
		var parsed = new URL('https://' + url);
	} catch (e) {
		return  response(res, 403);
	}

	if(!checkDomain(parsed.host))	return  response(res, 403);

	const headers = {...req.headers};
	const filterHeaders = {'User-Agent': headers['user-agent'], 'Host': parsed.host};
	if(headers['accept-encoding']) filterHeaders['Accept-Encoding'] = headers['accept-encoding'];
	if(headers['accept-language']) filterHeaders['Accept-Language'] = headers['accept-language'];
	if(headers['cache-control']) filterHeaders['Cache-Control'] = headers['cache-control'];

	headers.host = parsed.host;
	parsed.headers = filterHeaders
	parsed.method = req.method;
	if(req.method=='POST') parsed.headers= headers;
	else if(url.endsWith('/') || url.endsWith('.html') || url.endsWith('.htm') || url.endsWith('.php') || url.endsWith('.css') )  delete parsed.headers['accept-encoding'];
	else if(url.includes('.php?') || url.includes('.css?') || url.includes('.html?') || url.includes('.htm#') ) delete parsed.headers['accept-encoding'];

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
		delete headers['cookie'];
		delete headers['set-cookie'];	
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

		if(parsed.method != 'GET' ){
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
			if(rhost.endsWith('.ganjingworld.com') && (parsed.pathname.includes('/embed/') || parsed.pathname.includes('/live/'))  || parsed.pathname.includes('/video/') )
				pipend = pipend.pipe(replace('https://www.ganjingworld.', (shareModule.https? 'https://' : 'http://') + host + shareModule.root + "www.ganjingworld."));
			else if(shareModule.https)
				pipend = pipend.pipe(replace('https://', 'https://' + host + shareModule.root)).pipe(replace('http://', 'https://' + host + shareModule.root));
			else
				pipend = pipend.pipe(replace('http://', 'http://' + host + shareModule.root)).pipe(replace('https://', 'http://' + host + shareModule.root));

			if(rhost.endsWith('.soundofhope.org') && parsed.pathname.startsWith('/post/'))
				pipend = pipend.pipe(replace('//media.soundofhope.org',  '//' + host + shareModule.root + "media.soundofhope.org"));

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

module.exports = share;