'use strict';

var fs = require('fs');
var path = require('path');
var constantinople = require('constantinople');
var runtime = require('./runtime.js');
var filters = require('./filters');
var nodes = require('./nodes');
var utils = require('./utils');
var Parser = require('./parser.js');

module.exports = Linker;
function Linker(options) {
  this.options = options || {};
}
Linker.prototype.resolvePath = function (to, filename) {
  var dirname = path.dirname;
  var basename = path.basename;
  var join = path.join;

  if (to[0] !== '/' && !filename)
    throw new Error('the "filename" option is required to use include/extends with "relative" paths');

  if (to[0] === '/' && !this.options.basedir)
    throw new Error('the "basedir" option is required to use include/extends with "absolute" paths');

  to = join(to[0] === '/' ? this.options.basedir : dirname(filename), to);

  if (basename(to).indexOf('.') === -1) to += '.jade';

  return to;
};
Linker.prototype.readFile = function (filename) {
  return fs.readFileSync(filename, 'utf8').replace(/\r/g, '');
};
Linker.prototype.link = function (str, filename, child) {
  // Parse
  var parser = new (this.options.parser || Parser)(str, filename, this.options);
  if (child) {
    Object.keys(child).forEach(function (key) {
      parser[key] = child[key];
    });
  }
  var ast;
  try {
    ast = parser.parse();
  } catch (err) {
    parser = parser.context();
    runtime.rethrow(err, parser.filename, parser.lexer.lineno, parser.input);
  }

  // handle includes
  utils.walkAST(ast, null, function after(node, replace) {
    if (node.type === 'Include') {
      replace(this.getIncluded(node, filename, {
        blocks: utils.merge({}, parser.blocks),
        mixins: parser.mixins
      }));
    }
  }.bind(this));

  if (parser.extending) {
    ast.extending = parser.extending;
    ast.blocks = parser.blocks;
    ast.included = parser.included;
    ast.contexts = parser.contexts;
    ast.mixins = parser.mixins;
    return this.getExtending(ast, filename);
  }

  // TODO: include checks that blocks match up
  /*
  if (!this.extending && !this.included && Object.keys(this.blocks).length){
    var blocks = [];
    utils.walkAST(block, function (node) {
      if (node.type === 'Block' && node.name) {
        blocks.push(node.name);
      }
    });
    Object.keys(this.blocks).forEach(function (name) {
      if (blocks.indexOf(name) === -1 && !this.blocks[name].isSubBlock) {
        console.warn('Warning: Unexpected block "'
                     + name
                     + '" '
                     + ' on line '
                     + this.blocks[name].line
                     + ' of '
                     + (this.blocks[name].filename)
                     + '. This block is never used. This warning will be an error in v2.0.0');
      }
    }.bind(this));
  }
  */

  return ast;
};
Linker.prototype.getIncluded = function (node, filename, parent) {
  var path = this.resolvePath(node.path, filename);
  var str = this.readFile(path);

  // has-filter
  if (node.filter) {
    var options = {filename: path};
    if (node.attrs) {
      node.attrs.forEach(function (attribute) {
        options[attribute.name] = constantinople.toConstant(attribute.val);
      });
    }
    str = filters(node.filter, str, options);
    return new nodes.Literal(str);
  }

  // non-jade
  if ('.jade' != path.substr(-5)) {
    return new nodes.Literal(str);
  }

  var ast = this.link(str, path, parent);

  ast.filename = path;
  if (node.block) {
    // TODO: handle errors thrown here and produce better messages
    ast.includeBlock().push(node.block);
  }
  return ast;
}
Linker.prototype.getExtending = function (node, filename) {
  var path = this.resolvePath(node.extending.path, filename);
  var str = this.readFile(path);

  var ast = this.link(str, path, {
    blocks: node.blocks,
    included: node.included,
    contexts: node.contexts
  });

  // hoist mixins
  for (var name in node.mixins)
    ast.unshift(node.mixins[name]);

  return ast;
};
