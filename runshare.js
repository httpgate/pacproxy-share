#!/usr/bin/env node

const http = require('http');
const startShare = require('./share.js');

//TODO handle arguments
const options = {"server" : http.createServer(), "https": false}
startShare(options);
