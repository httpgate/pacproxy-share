const Transform = require('stream').Transform;
/**
 *
 * @param {string} searchStr
 * @param {string} replaceWith
 */

const replace = (searchStr, replaceWith) => {

	// Type checking
	if (typeof searchStr !== 'string') {
		throw new TypeError('searchStr must be a string.')
	}
	if (typeof replaceWith !== 'string') {
		throw new TypeError('replaceWith must be a string.')
	}

	const searchBuffer = Buffer.from(searchStr);
	const replaceBuffer = Buffer.from(replaceWith);

	// The string data that we aren't yet sure it's part of the search string or not
	// We have to hold on to this until we are sure.
	let unsureBuffer = ''

	var ts = new Transform();

	ts._transform = (chunk, encoding, callback) => {
		let current = 0;
		let next = 0;

		if(unsureBuffer.length){
			chunk = Buffer.concat([unsureBuffer,chunk]);
			unsureBuffer ='';
		}

		if(chunk.length < searchBuffer.length){
			unsureBuffer = chunk;
			return callback();
		}
		
		while(next = chunk.indexOf(searchBuffer,current)){

			if(next>0 && next + searchBuffer.length > chunk.length){
				unsureBuffer = chunk.slice(next);
				ts.push(chunk.slice(current, next));
				ts.push(replaceBuffer);
				break;
			}
			else if(next===-1){
				next = Math.max(current, chunk.length - searchBuffer.length + 1);
				unsureBuffer = chunk.slice(next);
				ts.push(chunk.slice(current,next));
				break;
			}
			else {
				ts.push(chunk.slice(current,next));
				ts.push(replaceBuffer);
				current = next + searchBuffer.length;
			}
		}
		callback();
	}

	ts._flush = (callback) => {
		ts.push(unsureBuffer);
		callback()
	}

	return ts;
}

module.exports = replace;