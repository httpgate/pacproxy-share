#!/usr/bin/env node
'use strict'
const startShare = require('./share.js');
const ipv4Regex = /^(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

if(!process.argv[2]) return startShare();  
const options = {'domain':  process.argv[2]};

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