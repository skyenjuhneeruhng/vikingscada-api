'use strict';

var mongoose = require('mongoose');
var util = require('util');
var CastError = mongoose.SchemaType.CastError;

function FloatType(digits) {
	function Float(path, options) {
		this.path = path;
		mongoose.SchemaTypes.Number.call(this, path, options);
	}

	util.inherits(Float, mongoose.SchemaTypes.Number);

	Float.prototype.cast = function(value) {
		if (typeof value !== 'number') return new CastError('Number', value, this.path);

		return Number(value.toFixed(digits || 2));
	};

	return Float;
}

module.exports.loadType = function(mongoose, digits) {
	var floatType = new FloatType(digits);

	mongoose.Schema.Types.Float = mongoose.SchemaTypes.Float = mongoose.Types.Float = floatType;

	return floatType;
};
