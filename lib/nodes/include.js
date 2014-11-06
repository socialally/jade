'use strict';

var Node = require('./node');

/**
 * Initialize a `Filter` node with the given
 * filter `name` and `block`.
 *
 * @param {String} name
 * @param {Block|Node} block
 * @api public
 */

var Include = module.exports = function Include(path, filter, attrs, block) {
  this.path = path;
  this.filter = filter;
  this.attrs = attrs;
  this.block = block;
};

// Inherit from `Node`.
Include.prototype = Object.create(Node.prototype);
Include.prototype.constructor = Include;

Include.prototype.type = 'Include';
