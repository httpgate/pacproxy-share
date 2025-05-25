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
            current = unsureBuffer.length;
            unsureBuffer ='';
        }

        next = chunk.indexOf(searchBuffer);
        while(current < chunk.length){
            if(next===-1){
                ts.push(chunk.slice(current,chunk.length));
                if((chunk.length-current) < searchBuffer.length)    next = current;
                else next = chunk.length - searchBuffer.length + 1;
                unsureBuffer = chunk.slice(next);
                break;
            } else {
                ts.push(chunk.slice(current,next));
                ts.push(replaceBuffer);
                current = next + searchBuffer.length;
                next = chunk.indexOf(searchBuffer,current);
                continue;
            }
        }
        // This is needed
        callback()
	}

	ts._flush = (callback) => {
        callback()
	}

	return ts;
}
module.exports = replace;