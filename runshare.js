#!/usr/bin/env node

'use strict'
const shareModule = require('./share.js');
const ipv4Regex = /^(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const options = { 'ip': '0.0.0.0', 'port': 8080 };

if(!process.argv[2]) return startShare();  
if(process.argv[2]=='-h' || process.argv[2]=='--help') {
    console.log('Usage: pacproxy-share <domain> [<root>] [<port>] [<ip>] [-v] [-http]');
    console.log('  <domain>  : Domain name to use for the share');
    console.log('  <root>    : Root path of share URL (default: /sharepath )');
    console.log('  <port>    : Port number to listen on (default: 8080)');
    console.log('  <ip>      : IP address to bind to (default: all interfaces)');
    console.log('  -v        : Enable verbose logging');
    console.log('  -http     : Use HTTP instead of HTTPS');
    return;
}

options.domain=process.argv[2];

if(!process.argv[3]) return startShare(options);
options.root = process.argv[3];

if(!process.argv[4]) return startShare(options);
if(isNaN(process.argv[4])) return console.error('Invalid port number:', process.argv[4]);
options.port = parseInt(process.argv[4]);

let i = 5;
if(!process.argv[i]) return startShare(options);
if(ipv4Regex.test(process.argv[i])){
    options.ip = process.argv[i];
    i++;
}

if(!process.argv[i]) return startShare(options);
if(process.argv[i]=='-v') {
    options.logging = true;
    i++;
}

if(!process.argv[i]) return startShare(options);
if(process.argv[i]=='-http') options.https = false;
else    return console.error('Invalid argument:', process.argv[i]);

return startShare(options);

function startShare(options) {
    const http = require('http');
    const shareHandler = shareModule(options);
    const server = http.createServer();
    server.on('error', (err) => console.error('Server error:', err));
    server.on('request', shareHandler);
    
    server.listen(options.port, options.ip, () => {
        console.info("\r\n Http Sharing Server Listening on ", server.address());
    });
}