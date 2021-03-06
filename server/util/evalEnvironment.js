"use strict";

/*
** evalEnvironment.js
** Written by Michael Albinson 1/10/17
**
** The Environment object is used to provide a safe environment in which scripts can be run.
** Note that while the environment is "safe", the changes made to the database will be permanent.
** Thus, bad code can be injected while using this that can cause data loss if this is not used sparingly.
** Use of this object is not permitted while the system is in production, nor the evaluation of
** user-provided scripts.
*/

var withResolve = "(function a() {\n\
						return new Promise(function(resolve, reject) {\n\
							try { {0} \nresolve();}\n\
							catch(err) {\n\
								log('there was an error during execution');\n\
								reject(err.message);\n\
							}\n\
						})\n\
					})";

var withoutResolve = "(function a() {\n\
						return new Promise(function(resolve, reject) {\n\
							try { {0} }\n\
							catch(err) {\n\
								log('there was an error during execution');\n\
								reject(err.message);\n\
							}\n\
						})\n\
					})";


exports.Environment = function() {
	var DBRow = require('./DBRow').DBRow;
	var Janitor = require('./maint/janitor').Janitor;
	var util = require('./evalUtil');
	// require = function() {throw new Error("Requiring is not permitted in eval mode")};
	var logs = [];

	this.execute = function(script) {
		return new Promise(function (resolve, reject){
			var toRun;
			if (script.includes('resolve()'))
				toRun = withoutResolve.replace('{0}', script);
			else
				toRun = withResolve.replace('{0}', script);

			var fun = eval(toRun);

			fun().then(function() {
				resolve(logs);
			}, function(err) {
				log(err);
				reject(logs);
			}).catch(function(err) {
				log(err);
				reject(logs);
			})
		})
		
	};

	function log(str) {
		logs.push(str);
	}
};