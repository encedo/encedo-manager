/*!
 * EncedoKey Application v0.67
 *
 * Encedo Limited Development Team
 * created by Krzysztof Rutecki 
 * refactored by Maciej Kupisiewicz 
 *
 * Released under the MIT license
 * Date: 2021-05-20T21:47Z
 */

class Encedo {
	
	/**
	 * Creates an Encedo Object and set starting values for variables
	 *
	 * @param {url} URL address that this instance is working on
	 * @return {} 
	*/

	constructor(url) {
		
		this.timenow = this.setTime();
		this.online = window.navigator.onLine;
		this.debug = false;
		this.gloader = '';
		
		this.encedo_authinit = false;
		this.encedo_url = url;
		this.encedo_version = false;
		this.encedo_status = false;
		this.encedo_health = false;
		this.encedo_config = false;
		
		this.encedo_type = 'ppa';
		this.encedo_keysearch = true;
		
		this.encedo_time = 0;
		this.encedo_time_offset = 0;
		
		this.encedo_version_hardware = false;
		this.encedo_version_firmware = false;
		this.encedo_version_bootloader = false;
		
		this.encedo_update_firmware = false;
		this.encedo_update_dashboard = false;
		this.encedo_update_bootloader = false;
		
		this.lastEventId = false;
		this.lastEventIdInfo = false;
		this.lastEventIdHandler = false;
		this.lastEventIdHandlerCleaned = false;
		
		/** Important JWT token */
		this.jwt_token = "";
		
		this.tokens = {};
		
		/** We would like to handle all the variables that comes with our starting address */
		this.hash = document.location.hash.substring(1);
		this.args = document.location.href.replace('#'+this.hash, '').split('?');
		this.last = document.location.href.replace(this.url, '').split('?')[0];
		
		/** Preparing url variables to further usage */
		
		if(this.args && this.args.length > 1) {
			var tmp = this.args[1].split(':')[0];
			this.args = {  };
			tmp = tmp.split('&');	
			for(var i = 0, j = tmp.length; i < j; i++) {
				var now = tmp[i].split('=');
				this.args[""+now[0]+""] = decodeURIComponent(now[1]);
			};
		};
		
		if(this.arg('debug')) {
			this.debug = true;
		};

	};

	/**
	 * Makes request to the Encedo USB Device
	 * This function is public and can be use to talk to Encedo
	 * 
	 * It could be done be Fetch API but it is safer do it in an old school way with XMLHttpRequest
	 *
	 * @param {url} Address to reach
	 * @param {func} Javascript function that executes when request is loaded
	 * @param {method} Simple GET or POST, default: GET
	 * @param {givenObj} Javascript object with data to send
	 * @param {timeout} Time to wait in miliseconds, default: 5000
	 * @return {Promise} Promise handler
	*/
	api = function(url, method = 'GET', givenObj, timeout = 8600) {
		
		var self = this;
		
		return new Promise((resolve, reject) => {
			
			var xhr = new XMLHttpRequest();	
			var internal = true;
			var download = false;
			var data = false;
			
			xhr.timeout = timeout;
			
			if(method == 'GET_FILE') {
				method = 'GET';
				download = true;
				xhr.responseType = 'text';
			};
			
			if(url.substring(0,4) == 'http') {
				internal = false;
				xhr.open(method, url);
			} else {
				xhr.open(method, self.encedo_url + '/' + url);
			};
			
			xhr.setRequestHeader("Cache-Control", "no-cache, no-store, must-revalidate");
			xhr.setRequestHeader("Pragma", "no-cache");
			xhr.setRequestHeader("Expires", "0");
			
			xhr.onload = function () {
				if (xhr.readyState === 4 && (xhr.status >= 200 && xhr.status < 300)) {
					
					if(xhr.responseText && !download) {
						data = xhr.responseText;
						try {
							data = JSON.parse(xhr.responseText);
						} catch(e) {
							
						};
					};
					
					if(download) {
						var blob = new Blob([xhr.response], {type: 'text'});
						let a = document.createElement("a");
						a.style = "display: none";
						document.body.appendChild(a);
						let url = window.URL.createObjectURL(blob);
						a.href = url;
						a.download = 'logger_file.txt';
						a.click();
						window.URL.revokeObjectURL(url);
					};

					self.log(url, data);
					resolve(data);
				} else if(xhr.status == 403 && internal) {
					self.check(function(){
						self.api(url, method, givenObj, timeout);
					}, function(){
						reject(xhr);
					});
				} else {
					reject(xhr);
				}
			};
			
			xhr.onerror  = function () {
				reject(xhr);
			};
			
			if(self.jwt_token && self.jwt_token.length > 2 && internal) {
				if( url != 'api/system/status' && 
					url != 'api/system/version' && 
					url != 'api/system/checkin' && 
					url != 'api/auth/ext/token' && 
					url != 'api/auth/ext/request' && 
					url != 'api/auth/token') {
					xhr.setRequestHeader('Authorization', 'Bearer ' + self.jwt_token);
				};
				//self.jwt_token = false;
			};
			
			if(method != 'GET' && givenObj) {
				xhr.setRequestHeader("Content-Type", "application/json");
			};
			xhr.send((givenObj ? JSON.stringify(givenObj) : ''));
			
			
		});
		
	};
	
	
	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	version() {
		var self = this;
		return this.api('api/system/version')
		.then(function(data){
			self.encedo_version = data;
			
			self.encedo_version_hardware = data.hwv;
			self.encedo_version_firmware = data.fwv;
			self.encedo_version_bootloader = data.blv;
			
			if(self.encedo_version_hardware.indexOf('EPA') > -1) {
				self.encedo_type = 'epa';
			};
		
			return data;
		}).catch(function(e) {
			self.error(e);
		});
	};
	
	
	/**
	 * Checking status of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB status
	*/
	status() {
		var self = this;
		return this.api('api/system/status')
		.then(function(data){
			self.encedo_status = data;			
			return data;
		}).catch(function(e) {
			self.error(e);
		});
	};
	
	/**
	 * Checking health of an Encedo USB Device 
	 *
	 * @param {success} Function that is executed when checking operation is going goooood.
	 * @param {fail} Function that handles the error while checking Encedo USB Device
	 * @return {Promise} Promise object
	*/
	checkAPI(success, fail) {
		
		var self = this;	
		
		return self.api('api/system/config').then(function(data){
			self.log(data);
			self.encedo_config = data;
			if(success) success(data);
		}).catch(function(e) {
			if(fail) fail(e);
			self.error(e);
		});
	};
	
	/**
	 * Checking health of an Encedo USB Device 
	 *
	 * @param {success} Function that is executed when checking operation is going goooood.
	 * @param {fail} Function that handles the error while checking Encedo USB Device
	 * @return {Promise} Promise object
	*/
	check(success, fail) {
		
		var self = this;	
		
		return self.api('api/system/checkin')
		.then(function(data) {
			return self.api('https://api.encedo.com/checkin', 'POST', data);
		}).then(function(data) {
			return self.api('api/system/checkin', 'POST', data);
		}).then(function(data) {
			
			self.encedo_health = data;
			
			if(data.newfws) {
				self.encedo_update_firmware = data.newfws;
			} else {
				self.encedo_update_firmware = false;
			}
			
			if(data.newuis) {
				self.encedo_update_dashboard = data.newuis;
			} else {
				self.encedo_update_dashboard = false;
			}
			
			self.info();
			
			if(success) success(data); 
		}).catch(function(e) {
			if(fail) fail(e);
			self.error(e);
		});
		
	};
	
	
	/**
	 * Checking health of an Encedo USB Device 
	 *
	 * @param {success} Function that is executed when checking operation is going goooood.
	 * @param {fail} Function that handles the error while checking Encedo USB Device
	 * @return {Promise} Promise object
	*/
	ping(success, fail) {
		var self = this;	
		return this.api('api/system/status')
		.then(function(data) {
			self.encedo_status = data;
			if(success) success(data);
		}).catch(function(e) {
			if(fail) fail(e);
			self.error(e);
		});
	};
	
	
	/**
	 * Checking health of an Encedo USB Device 
	 *
	 * @param {success} Function that is executed when checking operation is going goooood.
	 * @param {fail} Function that handles the error while checking Encedo USB Device
	 * @return {Promise} Promise object
	*/
	url(newUrl) {
		this.encedo_url	= newUrl;
	};
	
		
	/**
	 * Pairing method 
	 *
	 * @param {success} 
	 * @param {fail} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	pair(success, fail) {
		var self = this;
		var epk_temp = false;
		var cred_temp = false;
		var req_temp = false;
		return this.api('api/system/config')
		.then(function(data){
			self.log(data);
			cred_temp = data;
			return self.api('https://api.encedo.com/notify/session', 'POST', { eid: data.eid });
		}).then(function(data) {
			self.log(data);
			epk_temp = data.epk;
			return self.api('api/auth/ext/init', 'POST', { epk: data.epk });
		}).then(function(data) {
			self.log(data);
			data.epk = epk_temp;
			req_temp = data.request;
			return self.api('https://api.encedo.com/notify/register/init', 'POST', data);
		}).then(function(data) {
			self.log(data);
			if(success) success(data, cred_temp, req_temp);
		}).catch(function(e) {
			self.error(e);
			if(fail) fail(e);
		});
	};
	
	/**
	 * Pairing method 
	 *
	 * @param {success} 
	 * @param {fail} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	paired(success, fail) {
		var self = this;
		var epk_temp = false;
		var cred_temp = false;
		var req_temp = false;
		return this.api('api/system/config')
		.then(function(data){
			self.log(data);
			cred_temp = data;
			return self.api('https://api.encedo.com/notify/session', 'POST', { eid: data.eid });
		}).then(function(data) {
			self.log(data);
			epk_temp = data.epk;
			return self.api('api/auth/ext/mac', 'POST', { epk: data.epk });
		}).then(function(data) {
			self.log(data);
			data.epk = epk_temp;
			req_temp = data.request;
			return self.api('https://api.encedo.com/notify/subscribers/list', 'POST', data);
		}).then(function(data) {
			self.log(data);
			if(success) success(data);
		}).catch(function(e) {
			self.error(e);
			if(fail) fail(e);
		});
	};
	
	/**
	 * Unpairing method 
	 *
	 * @param {success} 
	 * @param {fail} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	unpair(pid, success, fail) {
		var self = this;
		var epk_temp = false;
		var cred_temp = false;
		var req_temp = false;
		return this.api('api/system/config')
		.then(function(data){
			self.log(data);
			cred_temp = data;
			return self.api('https://api.encedo.com/notify/session', 'POST', { eid: data.eid });
		}).then(function(data) {
			self.log(data);
			epk_temp = data.epk;
			return self.api('api/auth/ext/mac', 'POST', { epk: data.epk });
		}).then(function(data) {
			self.log(data);
			data.epk = epk_temp;
			data.pid = pid;
			req_temp = data.request;
			return self.api('https://api.encedo.com/notify/subscribers/delete', 'POST', data);
		}).then(function(data) {
			self.log(data);
			if(success) success(data);
		}).catch(function(e) {
			self.error(e);
			if(fail) fail(e);
		});
	};
	
	/**
	 * Makes request 
	 *
	 * @param {data} 
	 * @param {success} 
	 * @param {fail} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	init_old(data, success, fail) {
		var self = this;
		return this.api('api/auth/token')
		.then(function(encedo_authinit){
			self.encedo_authinit = encedo_authinit;
			self.log(encedo_authinit);
			self.initFinal(encedo_authinit, data, success, fail);
		}).catch(function(e) {
			self.error(e);
		});
	};
	
	/**
	 * Makes request 
	 *
	 * @param {data} 
	 * @param {success} 
	 * @param {fail} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	checkPairing(success, fail) {
		var self = this;
		return this.api('api/auth/token').then(function(encedo_authinit){
			return self.api('https://api.encedo.com/notify/session', 'POST', { eid: encedo_authinit.eid });
		}).then(function(data) {
			if(success) success(data);
		}).catch(function(e) {
			if(fail) fail(e);
			self.error(e);
		});
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {data} 
	 * @param {success} 
	 * @param {fail} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	init(data, statusDOM, success, fail) {
		var self = this;
		return this.api('api/auth/init').then(function(encedo_authinit){
			
			statusDOM.innerHTML = 'Preparing device to be initialised...';
			self.encedo_authinit = encedo_authinit;
			self.initFinal(encedo_authinit, data, statusDOM, success, fail);
			self.log(encedo_authinit);
			
		}).catch(function(e) {
			self.error(e);
		});
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	initFinal(init, data, statusDOM, success, fail) {
		
		var self = this;
		var seed = init.eid;
		var userid = data.userid;
		var useremail = data.useremail;
		var hostname = data.hostname;
		var ipaddr = data.ipaddr;

		var storage_mode = data.storage_mode;
		var storage_disk0size = data.storage_disk0size;
		
		var trusted_ts = data.trusted_ts;
		var trusted_backend = data.trusted_backend;
		var allow_keysearch = data.allow_keysearch;
		var iat = Math.floor((new Date()).getTime() / 1000);

		var passU = data.passU;
		
		argon2.hash({
			pass: passU,
			salt: self.FromBase64(seed),
			time: 10,
			mem: 8192,
			hashLen: 32,
		}).then(function(hash){

			self.log("USER Secret: " + hash.hashHex);    
			var keysU = nacl.box.keyPair.fromSecretKey( hash.hash );
			self.log("USER Prv: " + self.ToBase64(keysU.secretKey));
			self.log("USER Pub: " + self.ToBase64(keysU.publicKey));

			var m = new Mnemonic("english");
			
			// Generate new mnemonics
			var words = m.generate(256);
			
			statusDOM.innerHTML = 'Generating keys and backup tools ...';
			
			// Generate BIP32 seeds from mnemonics
			var seedM = m.toSeed(words);
			self.log("MASTER Secret: " +seedM);
			
			statusDOM.innerHTML = 'Master secret is ready.';

			var keysM = nacl.box.keyPair.fromSecretKey( self.fromHexString(seedM.substr(1, 64)) );
			self.log("MASTER Prv: " + self.ToBase64(keysM.secretKey));
			self.log("MASTER Pub: " + self.ToBase64(keysM.publicKey));

			var remote_pub = new Uint8Array( self.FromBase64(init.spk) );
			self.log("SHARED Pub: " + init.spk + " L: "+remote_pub.length);
			self.log("SHARED Prv: " + self.ToBase64(keysM.secretKey));
			
			statusDOM.innerHTML = 'Shared key is ready.';

			var jwt_secret_base64 = self.ToBase64( nacl.scalarMult(keysM.secretKey, remote_pub) );
			self.log("SHARED Sec: " + jwt_secret_base64);

			var cfg = {
				"masterkey": self.ToBase64(keysM.publicKey),
				"userkey": self.ToBase64(keysU.publicKey),
				"user": userid,
				"email": useremail,
				"hostname": hostname,
				"ip": ipaddr,
				"storage_mode": storage_mode,
				"storage_disk0size": storage_disk0size,
				"dnsd": true,
				"trusted_ts": trusted_ts,
				"trusted_backend": trusted_backend,
				"allow_keysearch": allow_keysearch,
				"origin": "*"      
			};
			
			if(data.gen_csr) {
				cfg.gen_csr = true;
			};
			
			statusDOM.innerHTML = 'Creating config data ...';

			var dataFinal = {
				"jti": init.jti,
				"aud": init.spk,
				"exp": init.exp,
				"iat": iat,
				"iss": self.ToBase64(keysM.publicKey),
				"cfg": cfg
			};
			
			statusDOM.innerHTML = 'Creating header ...';

			var header = { 
				"ecdh": "x25519"
			};

			var jwt = self.jwt_generate_hs256(header, dataFinal, CryptoJS.enc.Base64.parse(jwt_secret_base64));  
			self.log(jwt);   
			
			statusDOM.innerHTML = 'Preparing user data ...';

			var init_data = { 
				"init": jwt
			};  
			
			var xhr = new XMLHttpRequest();
			xhr.open('POST', self.encedo_url + '/api/auth/init');
			xhr.setRequestHeader("Content-Type", "application/json");
			xhr.onload = function(e) {
				if (this.status == 200) {
					
					statusDOM.innerHTML = 'Initialisation process in progress ...';
					
					let encedo_init_reply = JSON.parse(this.response);
					
					self.log(encedo_init_reply);
					
					if(success) success(encedo_init_reply, words, jwt);
					
					
				} else {
					if(fail) fail();
				};
			};
			xhr.send(JSON.stringify(init_data));   

			
		}).catch(function(hash){
			console.log('error');
		});

	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	provisioning() {
		
		var self = this;	
		var xhr = new XMLHttpRequest();
		xhr.open('GET', self.encedo_url + '/api/system/config/attestation');
		//xhr.setRequestHeader('Authorization', "Bearer "+self.jwt_token); 
		xhr.onload = function(e) {
			if (this.status == 200) {
				req = JSON.parse(this.response);

				if (typeof req.csr == "undefined") {

				} else {                
				
					var init_data = { 
						"csr": req.csr,
						"key": req.key,
						"genuine": req.genuine
					};

					var xhr = new XMLHttpRequest();
					xhr.open('POST', 'https://api.encedo.com/provisioning');
					xhr.setRequestHeader("Content-Type", "application/json");
					xhr.onload = function(e) {
						if (this.status == 200) {
							cert = JSON.parse(this.response);
							//document.querySelector('#provision').value  = "Importing...";
							var xhr = new XMLHttpRequest();
							xhr.open('POST', url+'/api/system/config/provisioning');
							xhr.setRequestHeader("Content-Type", "application/json");
							//xhr.setRequestHeader('Authorization', "Bearer "+self.jwt_token); 
							xhr.onload = function(e) {
								if (this.status == 200) {
									//document.querySelector('#provision').value  = "Done :)";                              
								};
							};
							xhr.send(JSON.stringify(cert));   
						};
					};
					xhr.send(JSON.stringify(init_data));   
				};
			};
		};
		xhr.send();
	};
	
	/**
	 * Makes request 
	 *
	 * @param {pass} 
	 * @param {success} 
	 * @param {fail} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	auth(pass, success, fail) {
		var self = this;
		return this.api('api/auth/token')
		.then(function(encedo_authinit){
			self.encedo_authinit = encedo_authinit;
			self.log(encedo_authinit);
			self.postAuthToken(encedo_authinit, pass, success, fail);
		}).catch(function(e) {
			self.error(e);
		});
	};
	
	/**
	 * Makes request 
	 *
	 * @param {pass} 
	 * @param {success} 
	 * @param {fail} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	setGLoader(loader) {
		this.gloader = loader;
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {pass} 
	 * @param {success} 
	 * @param {fail} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	argonize(pass, seed, options, func) {
		var self = this;
		return argon2.hash({
			pass: pass,
			salt: seed,
			time: 10,
			mem: 8192,
			hashLen: (options && options.keySize ? options.keySize : 32),
		}).then(function(hash){
			if(func) func(hash);
		}).catch(e => self.error(e));
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {init} 
	 * @param {pass} 
	 * @param {success} 
	 * @param {fail} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	postAuthToken(init, pass, success, fail, scope) {
		
		var self = this;
		var seed = init.eid;
		var iat = Math.floor((new Date()).getTime() / 1000);
		
		argon2.hash({
			pass: pass,
			salt: self.FromBase64(seed),
			time: 10,
			mem: 8192,
			hashLen: 32,
		}).then(function(hash){

			self.log("Secret: " + hash.hashHex);    
			var keys = nacl.box.keyPair.fromSecretKey( hash.hash );
			self.log("Prv: " + self.ToBase64(keys.secretKey));
			self.log("Pub: " + self.ToBase64(keys.publicKey));

			var remote_pub = new Uint8Array( self.FromBase64(init.spk) );
			self.log("SHARED -> Pub: " + init.spk + " L: "+remote_pub.length);
			self.log("SHARED -> Prv: " + self.ToBase64(keys.secretKey));

			var jwt_secret_base64 = self.ToBase64( nacl.scalarMult(keys.secretKey, remote_pub) );
			self.log("SHARED Sec: " + jwt_secret_base64);
			
			if(!scope) scope = 'master';

			var data = {
				"jti": init.jti,
				"aud": init.spk,
				"exp": init.exp,
				"iat": iat,
				"iss": self.ToBase64(keys.publicKey),
				"scope": scope
			};

			var header = { 
				"ecdh": "x25519"
			};

			var jwt = self.jwt_generate_hs256(header, data, CryptoJS.enc.Base64.parse(jwt_secret_base64));  
			self.log(jwt);   

			var init_data = { 
				"auth": jwt
			};
			
			self.api('api/auth/token', 'POST', init_data)
			.then(function(encedo_auth_reply){
				self.log(encedo_auth_reply);
				self.jwt_token = encedo_auth_reply.token;
				var tmp = self.parseJwt(encedo_auth_reply.token);
				scope = scope.split('#')[0];
				self.tokens[scope] = { exp: tmp.exp, sub: tmp.sub, token: encedo_auth_reply.token };
				if(success) success(init, encedo_auth_reply);
			}).catch(function(e) {
				self.error(e);
				if(fail) fail();
			});

		}).catch(e => console.error(e));
 
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {newfws} Firmware version code
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	getNewFirmware(newfws, DOMElement, callback) { 
	
		DOMElement.innerHTML = "Downloading...";
		var self = this;

		if(newfws instanceof Blob) {
			
			console.log(newfws);
			
			var fr = new FileReader();  
			
			fr.readAsArrayBuffer(newfws);
			
			fr.onload = function(){

				DOMElement.innerHTML = 'Uploading to encedo...';
			
				var xhr2 = new XMLHttpRequest();
				xhr2.open('POST', self.encedo_url + '/api/system/upgrade/upload_fw', true);
				
				if(self.jwt_token && self.jwt_token.length > 2) {
					xhr2.setRequestHeader('Authorization', "Bearer " + self.jwt_token);
				};
				
				xhr2.setRequestHeader('Content-Type', "application/octet-stream");
				xhr2.setRequestHeader('Content-Disposition', 'attachment; filename="' + 'firmware.bin' + '"');
				xhr2.timeout = 1200000;
				
				xhr2.onload = function(e) {
					if (this.status == 200) {
						self.checkNewFirmware(DOMElement, callback);
					} else {
						if(callback) callback(false, 'E0101: Error while uploading new firmware to the device.');
					};
				};
				
				xhr2.onerror  = function () {
					if(callback) callback(false, 'E0102: Error while uploading new firmware to the device.');
				};
				
				xhr2.ontimeout = function (e) {
					if(callback) callback(false, 'E0103: Error while uploading new firmware to the device (timeout).');
				};
				
				xhr2.send(fr.result);
			};
			
		} else {
	
			var xhr = new XMLHttpRequest();
			xhr.open('GET', 'https://api.encedo.com/download/firmware/'+newfws.replace(/\//g, '_').replace(/\+/g, '-').replace(/\=+$/m,'')+ '/bin', true);
			xhr.responseType = 'blob';
			xhr.onload = function(e) {
				if (this.status == 200) {
					self.log(this);
					self.log(e);

					DOMElement.innerHTML = 'Uploading to encedo...';
					var blob = this.response;
					self.log('got firmware - size:'+ blob.size);

					var xhr2 = new XMLHttpRequest();
					xhr2.open('POST', self.encedo_url + '/api/system/upgrade/upload_fw', true);
					
					if(self.jwt_token && self.jwt_token.length > 2) {
						xhr2.setRequestHeader('Authorization', "Bearer " + self.jwt_token);
					};
					
					xhr2.setRequestHeader('Content-Type', "application/octet-stream");
					xhr2.setRequestHeader('Content-Disposition', 'attachment; filename="' + 'firmware.bin' + '"');
					xhr2.timeout = 1200000;
					
					xhr2.onload = function(e) {
						if (this.status == 200) {
							self.checkNewFirmware(DOMElement, callback);
						} else {
							if(callback) callback(false, 'E0104: Error while uploading new firmware to the device.');
						};
					};
					
					xhr2.onerror  = function () {
						if(callback) callback(false, 'E0105: Error while uploading new firmware to the device (timeout).');
					};
					
					xhr2.ontimeout = function (e) {
						if(callback) callback(false, 'E0106: Error while uploading new firmware to the device (timeout).');
					};
					
					xhr2.send(blob);
				} else {
					if(callback) callback(false, 'E0107: Error while downloading new firmware from the official source.');
				};
			};
			xhr.ontimeout = function (e) {
				if(callback) callback(false, 'E0108: Error while downloading new firmware from the official source (timeout).');
			};
			xhr.onerror  = function () {
				if(callback) callback(false, 'E0109: Error while downloading new firmware from the official source.');
			};
			xhr.send(); 
		
		};
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	installNewFirmware(DOMElement, callback) {
		
		DOMElement.innerHTML = 'Installing...';
		var self = this;
		var xhr = new XMLHttpRequest();
		xhr.open('GET', this.encedo_url + '/api/system/upgrade/install_fw');
		if(self.jwt_token && self.jwt_token.length > 2) {
			xhr.setRequestHeader('Authorization', "Bearer " + self.jwt_token);  
		};		
		xhr.onload = function(e) {
			if (this.status == 200) {
				DOMElement.innerHTML = 'Update is done and waiting for reboot.';
				if(callback) callback(true);
			} else {
				if(callback) callback(false, 'E0110: Error while installing new firmware on the device.');
			};
		}
		xhr.ontimeout = function (e) {
			if(callback) callback(false, 'E0111: Error while installing new firmware on the device (timeout).');
		};
		xhr.onerror  = function () {
			if(callback) callback(false, 'E0112: Error while installing new firmware on the device.');
		};
		xhr.send();
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	checkNewFirmware(DOMElement, callback) {
		
		console.log('checkNewFirmware');
		
		DOMElement.innerHTML  = 'Checking integrity & signature...';
		var self = this;
		var xhr = new XMLHttpRequest();
		xhr.open('GET', this.encedo_url + '/api/system/upgrade/check_fw');
		if(self.jwt_token && self.jwt_token.length > 2) {
			xhr.setRequestHeader('Authorization', "Bearer " + self.jwt_token); 
		};	
		xhr.timeout = 120000;
		xhr.onload = function(e) {
			if (this.status == 200) {
				self.installNewFirmware(DOMElement, callback);
			} else if(this.status == 201 || this.status == 202) {
				setTimeout(function () {
					self.checkNewFirmware(DOMElement, callback);              
				}, 4000);
			} else {
				if(callback) callback(false, 'E0113: Error while checking new firmware correctness.');
			};
		};
		xhr.ontimeout = function (e) {
			if(callback) callback(false, 'E0114: Error while checking new firmware correctness (timeout).');
		};
		xhr.onerror  = function () {
			if(callback) callback(false, 'E0115: Error while checking new firmware correctness.');
		};		
		xhr.send();
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {newfws} Firmware version code
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	getNewDashboard(newfws, DOMElement, callback) { 
	
		DOMElement.innerHTML = "Downloading...";
		var self = this;
		var xhr = new XMLHttpRequest();
		xhr.open('GET', 'https://api.encedo.com/download/dashboard/'+newfws.replace(/\//g, '_').replace(/\+/g, '-').replace(/\=+$/m,''), true);
		xhr.responseType = 'blob';
		xhr.onload = function(e) {
			if (this.status == 200) {
				self.log(this);
				self.log(e);

				DOMElement.innerHTML = 'Uploading to Encedo...';
				var blob = this.response;
				self.log('got dashboard - size:' + blob.size);

				var xhr2 = new XMLHttpRequest();
				xhr2.open('POST', self.encedo_url + '/api/system/upgrade/upload_ui', true);
				if(self.jwt_token && self.jwt_token.length > 2) {
					xhr2.setRequestHeader('Authorization', "Bearer " + self.jwt_token);
				};
				xhr2.setRequestHeader('Content-Type', "application/octet-stream");
				xhr2.setRequestHeader('Content-Disposition', 'attachment; filename="' + 'webroot.tar' + '"');
				xhr2.timeout = 1200000;
				
				xhr2.onload = function(e) {
					if (this.status == 200) {
						self.checkNewDashboard(DOMElement, callback);
					} else {
						if(callback) callback(false, 'E0116: Error while uploading new version of Manager to the device.');
					};
				};
				
				xhr2.ontimeout = function (e) {
					if(callback) callback(false, 'E0117: Error while uploading new version of Manager to the device (timeout).');
				};
				xhr2.onerror  = function () {
					if(callback) callback(false, 'E0118: Error while uploading new version of Manager to the device.');
				};
				
				xhr2.send(blob);
			} else {
				if(callback) callback(false, 'E0119: Error while downloading new version of Manager from official source.');
			};				
		};
		xhr.ontimeout = function (e) {
			if(callback) callback(false, 'E0120: Error while downloading new version of Manager from official source (timeout).');
		};
		xhr.onerror  = function () {
			if(callback) callback(false, 'E0121: Error while downloading new version of Manager from official source.');
		};
		xhr.send(); 
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	installNewDashboard(DOMElement, callback) {
		
		DOMElement.innerHTML = 'Installing...';
		var self = this;
		var xhr = new XMLHttpRequest();
		xhr.open('GET', this.encedo_url + '/api/system/upgrade/install_ui');
		if(self.jwt_token && self.jwt_token.length > 2) {
			xhr.setRequestHeader('Authorization', "Bearer " + self.jwt_token); 
		};		
		xhr.onload = function(e) {
			if (this.status == 200) {
				DOMElement.innerHTML = 'Installation done well. Update has been finished!';
				if(callback) callback(true); 
			} else {
				DOMElement.innerHTML = 'Error while installing. Update has not been made.';
				if(callback) callback(false, 'E0122: Error while installing new version of Manager. Update has not been made.');
			};
		};
		xhr.ontimeout = function (e) {
			if(callback) callback(false, 'E0123: Error while installing new version of Manager. Update has not been made (timeout).');
		};
		xhr.onerror  = function () {
			if(callback) callback(false, 'E0124: Error while installing new version of Manager. Update has not been made.');
		};
		xhr.send();
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	checkNewDashboard(DOMElement, callback) {
		
		var self = this;
		var xhr = new XMLHttpRequest();
		var observerForCheckin = false;
		
		DOMElement.innerHTML  = 'Checking integrity & signature ...';
		
		function checkCheckinStatus() {
			xhr.open('GET', self.encedo_url + '/api/system/upgrade/check_ui');
			if(self.jwt_token && self.jwt_token.length > 2) {
				xhr.setRequestHeader('Authorization', "Bearer " + self.jwt_token);   
			};	
			xhr.send();
		};
		
		xhr.timeout = 4000;
		xhr.onload = function(e) {
			if (this.status == 200) {
				clearInterval(observerForCheckin);
				self.installNewDashboard(DOMElement, callback);
			} else if(this.status == 201) {
				setTimeout(function(){ 
					DOMElement.innerHTML  = 'Checking integrity & signature in progress ...';
					observerForCheckin = setInterval(checkCheckinStatus, 5000);
				}, 20000);
			} else if(this.status == 202) {
				
			} else {
				if(callback) callback(false, 'E0125: Error while checking new version of Manager corectness.');
			};
		};
		xhr.ontimeout = function (e) {
			if(callback) callback(false, 'E0126: Error while checking new version of Manager corectness (timeout).');
		};     
		xhr.onerror  = function () {
			if(callback) callback(false, 'E0127: Error while checking new version of Manager corectness.');
		};
		
		checkCheckinStatus();

	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {pass} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	updateCfg(pass) {
		
		var self = this;
		var seed = self.encedo_authinit.eid;
		var nonce = self.encedo_authinit.jti;
		var spk = self.encedo_authinit.spk;
		
		argon2.hash({
			pass: pass,
			salt: seed,
			time: 10,
			mem: 8192,
			hashLen: (options && options.keySize ? options.keySize : 32),
		}).then(function(hash){
			
			self.log("SecretNew: " + hash.hashHex);    
			var keys = nacl.box.keyPair.fromSecretKey( hash.hash );
			
			self.log(" Prv: " + self.ToBase64(keys.secretKey));
			self.log(" Pub: " + self.ToBase64(keys.publicKey));

			var remote_pub = new Uint8Array( self.FromBase64(spk) );
			self.log("SHARED -> Pub: " + spk);
			self.log("SHARED -> Prv: " + self.ToBase64(keys.secretKey));

			var hmac_key = self.ToBase64(nacl.scalarMult(keys.secretKey, remote_pub) );
			self.log("SHARED Secret: " + hmac_key );

			var user_nonce = nonce;
			var user_hmac = CryptoJS.enc.Base64.stringify( CryptoJS.HmacSHA256(CryptoJS.enc.Base64.parse(user_nonce), CryptoJS.enc.Base64.parse(hmac_key) ) );
			var user_key = self.ToBase64(keys.publicKey);
			self.log("user_nonce: " + user_nonce );
			self.log("user_hmac: " + user_hmac );
			self.log("user_key: " + user_key );

			var config_newuserkey = { 
				"userkey_nonce": user_nonce,
				"userkey_hmac": user_hmac,
				"userkey": user_key
			};

			var xhr = new XMLHttpRequest();
			xhr.open('POST', self.encedo_url + '/api/system/config');
			xhr.setRequestHeader("Content-Type", "application/json");
			
			if(self.jwt_token && self.jwt_token.length > 2) {
				xhr.setRequestHeader('Authorization', "Bearer "+self.jwt_token); 
			};
			
			xhr.onload = function(e) {
				if (this.status == 200) {
					let reply = JSON.parse(this.response);

				} else {
	
				};
			};
			xhr.send(JSON.stringify(config_newuserkey));   
			
		}).catch(e => console.error(e));

	};


	/**
	 * Makes request 
	 *
	 * @param {} 

	 * @return {XMLHttpRequest} Request call object
	*/
	updateTLS() {
		
		var self = this;
		var xhr = new XMLHttpRequest();
		xhr.open('POST', self.encedo_url + '/api/system/config');
		xhr.setRequestHeader("Content-Type", "application/json");
		
		if(self.jwt_token && self.jwt_token.length > 2) {
			xhr.setRequestHeader('Authorization', "Bearer "+self.jwt_token); 
		};
		
		xhr.onload = function(e) {
			if (this.status == 200) {
				let reply = JSON.parse(this.response);
				self.log(reply);
				var prefix = 'devel';
				var ip = '192.168.7.1'; 

				var xhr = new XMLHttpRequest();
				xhr.open('POST', 'https://api.encedo.com/domain/register/'+prefix);
				xhr.setRequestHeader("Content-Type", "application/json");
				xhr.onload = function(e) {
					if (this.status == 200) {
						let reply = JSON.parse(this.response);
						self.log(reply);

						var config_tls = { 
							"emp": reply.emp,
							"key": reply.key,
							"crt": reply.crt
						};

						var xhr = new XMLHttpRequest();
						xhr.open('POST', self.encedo_url + '/api/system/config');
						xhr.setRequestHeader("Content-Type", "application/json");
						
						if(self.jwt_token && self.jwt_token.length > 2) {
							xhr.setRequestHeader('Authorization', "Bearer "+self.jwt_token);
						};
						
						xhr.onload = function(e) {
						  if (this.status == 200) {
							  let reply = JSON.parse(this.response);
							  self.log(reply);
							  //document.getElementById("result").innerHTML = reply.updated;
						  } else {
							  //document.getElementById("result").innerHTML = 'error';
						  };
						};
						xhr.send(JSON.stringify({"tls":config_tls})); 

					};
				};
				xhr.send(JSON.stringify({"genuine":reply.genuine, "csr": reply.csr, 'ip':ip})); 

			} else {
				//document.getElementById("result").innerHTML = 'error';
			};
		};
		xhr.send(JSON.stringify({"gen_csr":true}));     
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {no} 
	 * @param {mode} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	mobileConnection(scope, func) {
		var self = this;
		
		return this.api('api/system/checkin')
		.then(function(data) {
			return self.api('https://api.encedo.com/checkin', 'POST', data);
		}).then(function(data) {
			return self.api('api/system/checkin', 'POST', data);
		}).then(function(data) {
			return self.api('https://api.encedo.com/notify/session');
		}).then(function(data) {
			data.scope = scope;
			return self.api('api/auth/ext/request', 'POST', data);
		}).then(function(data) {
			return self.api('https://api.encedo.com/notify/event/new', 'POST', data);
		}).then(function(data) {
			func(true, data);
		}).catch(function(e) {
			func(false, e);
			self.error(e);
		});
		
	};
	
		
	/**
	 * Makes request 
	 *
	 * @param {no} 
	 * @param {mode} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	scope(scope, address, func, elements, finalInformation, pass) {
		var self = this;
		var elementList = [];
		
		if(elements) {
			var elementList = document.querySelectorAll(elements);
		};
		
		elementList.forEach(function(userItem) {
			userItem.innerHTML = self.gloader + ' Preparing ...';
		});
		
		// Checking do we have valid token for that scope
		if(self.tokens[scope] && self.tokens[scope].token) {
			
			self.jwt_token = self.tokens[scope].token;
			self.api(address).then(function(e){
				func(true, e);
			}).catch();
			
		} else {
		
			if(pass) {
				self.api('api/auth/token')
				.then(function(encedo_authinit){
					self.postAuthToken(encedo_authinit, pass, function(){
						self.api(address).then(function(e){
							func(true, e);
						}).catch();
					}, function(e){
						func(false, e);
					}, scope);
				}).catch(function(e) {
					elementList.forEach(function(userItem) {
						userItem.innerHTML = 'Error while requesting authorization token.';
					});
					self.error(e);
				});
			};	
		};	
	};
	
	/**
	 * Makes request 
	 *
	 * @param {no} 
	 * @param {mode} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	scoped(scope, func, elements, finalInformation, pass, forceAsked) {
		var self = this;
		var elementList = [];
		
		if(elements) {
			elementList = document.querySelectorAll(elements);
		};
		
		elementList.forEach(function(userItem) {
			userItem.innerHTML = self.gloader + ' Preparing ...';
		});

		if(self.tokens[scope] && self.tokens[scope].token && !forceAsked) {
			
			elementList.forEach(function(userItem) {
				userItem.innerHTML = self.gloader + ' Almost finished ...';
			});
			self.jwt_token = self.tokens[scope].token;
			func(true, {}, true);
			
		} else {
			
			if(pass) {
				self.api('api/auth/token').then(function(encedo_authinit){
					elementList.forEach(function(userItem) {
						userItem.innerHTML = self.gloader + ' Getting token ...';
					});
					self.postAuthToken(encedo_authinit, pass, function(data){
						elementList.forEach(function(userItem) {
							userItem.innerHTML = self.gloader + ' Almost finished ...';
						});
						func(true, data, true);
					}, function(e){
						elementList.forEach(function(userItem) {
							userItem.innerHTML = 'Error while requesting authorization token.';
						});
						func(false, e, false);
					}, scope);
				}).catch(function(e) {
					func(false, e, false);
					elementList.forEach(function(userItem) {
						userItem.innerHTML = 'Error while requesting authorization token.';
					});
					self.error(e);
				});
			};
			
		};			
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {no} 
	 * @param {mode} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	mobileAuth(scope, endpoint, func, elements, finalInformation) {
		var self = this;
		var elementList = [];
		
		if(elements) {
			var elementList = document.querySelectorAll(elements);
		};
		
		return this.api('api/system/checkin')
		.then(function(data) {
			elementList.forEach(function(userItem) {
				userItem.innerHTML = self.gloader + 'Preparing...';
			});
			return self.api('https://api.encedo.com/checkin', 'POST', data);
		}).then(function(data) {
			elementList.forEach(function(userItem) {
				userItem.innerHTML = self.gloader + 'Connecting...';
			});
			return self.api('api/system/checkin', 'POST', data);
		}).then(function(data) {
			elementList.forEach(function(userItem) {
				userItem.innerHTML = self.gloader + 'Checking...';
			});
			return self.api('https://api.encedo.com/notify/session');
		}).then(function(data) {
			elementList.forEach(function(userItem) {
				userItem.innerHTML = self.gloader + 'Sending to mobile apps...';
			});
			data.scope = scope;			
			return self.api('api/auth/ext/request', 'POST', data);
		}).then(function(data) {
			elementList.forEach(function(userItem) {
				userItem.innerHTML = self.gloader + 'Creating event...';
			});
			return self.api('https://api.encedo.com/notify/event/new', 'POST', data);
			
		}).then(function(dataEvent) {
			
			var timerNow = 198;
			self.lastEventId = dataEvent.eventid;
			self.lastEventIdInfo = elementList;
			
			if(self.lastEventIdHandlerCleaned == self.lastEventId) {
				
				timerNow = 0;
				console.log('Created handler has been deleted.');
				elementList.forEach(function(userItem) {
					userItem.innerHTML = 'Event has been cancelled.';
				});
				
			} else {
				
				elementList.forEach(function(userItem) {
					userItem.innerHTML = self.gloader + 'Waiting for confirmation...';
				});

				self.lastEventIdHandler = setInterval(function() {

				timerNow--;
				
				if(timerNow > 0 && timerNow % 3 == 0) {

					self.api('https://api.encedo.com/notify/event/check/' + dataEvent.eventid).then(function(data){
						
						elementList.forEach(function(userItem) {
							userItem.innerHTML = self.gloader + 'Checking data...';
						});
						
						if(data && data.authreply) {
							
							clearInterval(self.lastEventIdHandler);
							
							self.api('api/auth/ext/token', 'POST', { authreply: data.authreply } )
							.then(function(datad){
								
								elementList.forEach(function(userItem) {
									userItem.innerHTML = 'Permission granted!';
								});

								self.jwt_token = datad.token;
								var tmp = self.parseJwt(datad.token);
								
								tmp.scope = tmp.scope.split('#')[0];

								self.tokens[tmp.scope] = { exp: tmp.exp, sub: 'Mobile', token: datad.token };
								
								if(endpoint && endpoint.length > 0) {
									
									self.api(endpoint).then(function(e){
										func(tmp.scope, data, elements);
										
										elementList.forEach(function(userItem) {
											if(finalInformation) {
												userItem.innerHTML = finalInformation;
											} else {
												userItem.innerHTML = 'All done <i class="icon-ok"></i>';
											};
										});
									}).catch();
									
								} else {
									func(tmp.scope, data, elements);
										
									elementList.forEach(function(userItem) {
										if(finalInformation) {
											userItem.innerHTML = finalInformation;
										} else {
											userItem.innerHTML = 'All done <i class="icon-ok"></i>';
										};
									});
								};
								
							}).catch(function(e) {
								func(false, 2);
								elementList.forEach(function(userItem) {
									userItem.innerHTML = 'Error, please try again <i class="icon-attention"></i>';
								});
								clearInterval(self.lastEventIdHandler);
								self.error(e);
							});
							
						} else if(data && data.deny) {
							func(false, 1);
							elementList.forEach(function(userItem) {
								userItem.innerHTML = 'Access denied <i class="icon-lock"></i>';
							});
							clearInterval(self.lastEventIdHandler);
							self.error(e);
						} else {
							
						};
						
					}).catch(function(e) {
						func(false, 3);
						elementList.forEach(function(userItem) {
							userItem.innerHTML = 'Access denied <i class="icon-lock"></i>';
						});
						clearInterval(self.lastEventIdHandler);
						self.error(e);
					});
				};
				
				if(timerNow < 0) {
					clearInterval(self.lastEventIdHandler);
					self.api('https://api.encedo.com/notify/event/' + dataEvent.eventid, 'DELETE')
					.then(function(data){
						self.lastEventId = false;
						self.log(`Event has been deleted because time run out!`);
						console.log(`Event has been deleted because time run out!`);
					}).catch(function(e) {
						func(false, 4);
						self.error(e);
					});
					elementList.forEach(function(userItem) {
						userItem.innerHTML = 'Event has been cancelled.';
					});
				};
				
			}, 300);
			
			};
		}).catch(function(e) {
			clearInterval(self.lastEventIdHandler);
			elementList.forEach(function(userItem) {
				userItem.innerHTML = 'Error occured while creating an event. Please try again.';
			});
			func(false, 5);
			self.error(e);
		});
		
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {no} 
	 * @param {mode} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	mobileAuthCleanup(func) {
		
		var self = this;
		
		if(self.lastEventId) {
			
			console.log('Mobile cleanup with given ID.');
			self.lastEventIdHandlerCleaned = self.lastEventId;
			clearInterval(self.lastEventIdHandler);
			
			if(self.lastEventIdInfo) self.lastEventIdInfo.forEach(function(userItem) {
				userItem.innerHTML = 'Event has been cancelled.';
			});
			
			self.api('https://api.encedo.com/notify/event/' + self.lastEventId, 'DELETE')
			.then(function(data){
				
				self.log(`Event with given ID has been deleted! (by mobileAuthCleanup())`);
				console.log(`Event with given ID has been deleted! (by mobileAuthCleanup())`);
				
				if(func && self.lastEventId) {
					self.lastEventId = false;
					func(false, 1);
				};

				self.lastEventId = false;
				self.lastEventIdInfo = false;
				
			}).catch(function(e) {
				if(func && self.lastEventId) {
				
					self.lastEventId = false;
					func(false, 1);
				};
				self.error(e);
			});	
		};
	};
	
	
	
	/**
	 * Makes request 
	 *
	 * @param {no} 
	 * @param {mode} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	unlockEncedoDisk(pass, no, mode, func) {
		var self = this;
		if(pass) {
			self.api('api/auth/token')
			.then(function(encedo_authinit){
				self.postAuthToken(encedo_authinit, pass, function(){
					self.api('api/storage/unlock').then(function(e){
						func(true, e);
					}).catch();
				}, function(e){
					func(false, e);
				}, 'storage:disk' + no + (mode == 'rw' ? ':rw' : ''));
			}).catch(function(e) {
				self.error(e);
			});
		};		
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {no} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	lockEncedoDisk(pass, no, func) {
		var self = this;
		if(pass) {
			self.api('api/auth/token')
			.then(function(encedo_authinit){
				self.postAuthToken(encedo_authinit, pass, function(){
					self.api('api/storage/lock').then(function(e){
						func(true, e);
					}).catch();
				}, function(e){
					func(false, e);
				}, 'storage:disk' + no);
			}).catch(function(e) {
				self.error(e);
			});
		};		
	};
	
	
	/**
	 * Makes Encedo wipeout 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	wipeout(callback) {
		var self = this;
		self.api('api/system/config', 'POST', { wipeout: true })
		.then(function(data){	
			self.log(data);
			if(callback) callback(true);
		}).catch(function(e) {
			if(callback) callback(false);
			self.error(e);
		});	
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	removeKey(kid) {
		var self = this;
		self.api('api/keymgmt/delete/' + kid, 'DELETE')
		.then(function(data){	
			self.log(data);
		}).catch(function(e) {
			self.error(e);
		});	
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	refresh() {
			
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	reboot(func) {
		var self = this;
		return self.api('api/system/reboot')
		.then(function(data){	
			if(func) func();
			self.log(data);
		}).catch(function(e) {
			self.error(e);
		});	
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	checkUpdate() {
		
	};
	
	
	/**
	 * Makes request 
	 *
	 * @param {} 
	 *
	 * @return {XMLHttpRequest} Request call object
	*/
	info() {
		this.log(this);
	};
	
	
	/**
	 * Returns variable from starting URL address or sets value  
	 *
	 * @param {name} Name of the argument
	 * @param {value} Value to set for that argument
	 * @return {string} Value set in the starting URL address or false when empty
	*/
	arg(name, value = false) {
		if(value) {
			this.args[name] = value;
		};
		if(this.args[name]) {
			return this.args[name];
		};
		return false;
	};
	
	
	/**
	 * Returns variable from starting URL address or sets value  
	 *
	 * @return {string} Hash address set in the starting URL address
	*/
	hash() {
		if(this.hash.length > 0) {
			return this.hash;
		};
		return false;
	};
	
	
	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	jwt_generate_hs256(header, data, secret) {

		header.alg = "HS256";
		header.typ = "JWT";    

		var encodedHeader = this.base64url( CryptoJS.enc.Utf8.parse(JSON.stringify(header)) );
		var encodedData = this.base64url( CryptoJS.enc.Utf8.parse(JSON.stringify(data)) );

		var signature = encodedHeader + "." + encodedData;
		signature = this.base64url( CryptoJS.HmacSHA256(signature, secret) );

		return encodedHeader + "." + encodedData + "." + signature;
	};
	
	
	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	parseJwt(token) {
		var base64Url = token.split('.')[1];
		var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
		var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
			return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
		}).join(''));

		return JSON.parse(jsonPayload);
	};


	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	genKeys() {
		var array = new Uint8Array(32);
		window.crypto.getRandomValues(array);
		this.log("Random: " + this.ToBase64(array));

		var keys = nacl.box.keyPair.fromSecretKey( array );
		this.log(" Prv: " + this.ToBase64(keys.secretKey));
		this.log(" Pub: " + this.ToBase64(keys.publicKey));
	};
	
	
	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	genKeysSharedSecret() {
		var array = new Uint8Array(32);
		window.crypto.getRandomValues(array);
		this.log("Random1: " + this.ToBase64(array));

		var keys1 = nacl.box.keyPair.fromSecretKey( array  );
		this.log(" Prv1: " + this.ToBase64(keys1.secretKey));
		this.log(" Pub1: " + this.ToBase64(keys1.publicKey));

		window.crypto.getRandomValues(array);
		this.log("Random2: " + this.ToBase64(array));

		var keys2 = nacl.box.keyPair.fromSecretKey( array  );
		this.log(" Prv2: " + this.ToBase64(keys2.secretKey));
		this.log(" Pub2: " + this.ToBase64(keys2.publicKey));

		var hmac_key = this.ToBase64(nacl.scalarMult(keys1.secretKey, keys2.publicKey) );
		this.log("SHARED Secret: " + hmac_key );

		var hmac_key2 = this.ToBase64(nacl.scalarMult(keys2.secretKey, keys1.publicKey) );
		this.log("SHARED Secret2: " + hmac_key2 );
	};
	
	
	/**
	 * Returns time 'now' in proper format  
	 *
	 * @return {string} Time 'now' in proper format Y/m/d H:i:s
	*/
	startCounting(destination) {
		var today = new Date();
		destination.html( 
			+ today.getFullYear() 
			+ "/" 
			+ _format01 ( today.getMonth( ) ) 
			+ "/" 
			+ _format01 ( today.getDate( ) ) 
			+ ' ' 
			+ today.getHours() 
			+ ":" 
			+ _format01 ( today.getMinutes( ) ) 
			+ ":" 
			+ _format01 ( today.getSeconds( ) ) 
		);
		setTimeout(function(){ _startTime(destination) }, 1000);
	};
	
	
	/**
	 * Returns time 'now' in proper format  
	 *
	 * @return {string} Time 'now' in proper format Y/m/d H:i:s
	*/
	setTime() {
		var now = new Date();
		return now.getFullYear() 
			+ "/" 
			+ this.format01 ( now.getMonth( ) + 1 ) 
			+ "/" 
			+ this.format01 ( now.getDate( ) ) 
			+ ' ' 
			+ now.getHours() 
			+ ":" 
			+ this.format01 ( now.getMinutes( ) ) 
			+ ":" 
			+ this.format01 ( now.getSeconds( ) );
	};
	
	
	/**
	 * Adds zero before given number when lower than 10  
	 *
	 * @return {string} String which has at least 2 characters
	*/
	format01(i) {
		return '' + (i < 10 ? '0' + i : i);
	};
	
	
	/**
	 * Returns error to the console
	 *
	 * @return {} 
	*/
	error(e) {
		this.log('Error', e);
	};
	
	
	/**
	 * Returns information to console but only in debug mode
	 *
	 * @return {} 
	*/
	log(...args) {
		if(this.debug) console.log(...args);
	};
	
	
	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	base64url_encode(binstr) {
		var str = btoa(binstr);
		return str.replace(/\//g, '_').replace(/\+/g, '-').replace(/\=+$/m,'');
	};


	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	base64url_decode(b64str) {
		return atob(b64str.replace(/_/g, '/').replace(/-/g, '+'));
	};
	
	
	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	ToBase64(u8) {
		return btoa(String.fromCharCode.apply(null, u8));
	};


	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	FromBase64(str) {
		return atob(str).split('').map(function (c) { return c.charCodeAt(0); });
	};
	
	
	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	fromHexString(hexString) {
		return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
	};


	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	toHexString(bytes) {
		return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
	};


	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	fromWordArray(wordArray) {
		
		var words = wordArray.words;
		var sigBytes = wordArray.sigBytes;
		var u8 = new Uint8Array(sigBytes);
		
		for (var i = 0; i < sigBytes; i++) {
			var byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
			u8[i]=byte;
		}
		return u8;
	};
	
	
	/**
	 * Checking version of an Encedo USB Device 
	 *
	 * @return {string} Encedo USB version name
	*/
	base64url(source) {
		// Encode in classical base64
		var encodedSource = CryptoJS.enc.Base64.stringify(source);    
		// Remove padding equal characters
		encodedSource = encodedSource.replace(/=+$/, '');    
		// Replace characters according to base64url specifications
		encodedSource = encodedSource.replace(/\+/g, '-');
		encodedSource = encodedSource.replace(/\//g, '_');    
		return encodedSource;
	};
	
};