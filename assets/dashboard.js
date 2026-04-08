/*!
 * Dashboard v0.69.420
 *
 * module created by Maciej Kupisiewicz 
 *
 * Released under the MIT license
 * Date: 2021-05-20T21:47Z
 */
class Dashboard {
	
	/**
	 * Creates an Dashboard Object and set starting values for variables
	 *
	 * @param {url} URL address that this instance is working on
	 * @return {} 
	*/

	constructor(url, notifierDOM, params) {
		this.debug = false;
		this.timenow = this.setTime();
		this.dashboard_version = '0.69.420';
		this.dashboard_online = window.navigator.onLine;
		this.notifyContainer = notifierDOM;
		
		this.actions = [];
		this.boot = [];
		
		/** We would like to handle all the variables that comes with our starting address */
		this.hash = document.location.hash.substring(1);
		this.args = document.location.href.replace('#'+this.hash, '').split('?');
		this.last = document.location.href.replace(this.url, '').split('?')[0];
		
		/** Preparing url variables to further usage */
		if(this.args && this.args.length > 1) {
			var tmp = this.args[1];
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
	 * 
	 *
	 * @param {name} 
	 * @return {} 
	*/
	state(name) {
		
	};
	
	
	/**
	 * 
	 *
	 * @param {name} 
	 * @param {func} 
	 * @return {} 
	*/
	register(name, func) {
		
	};
	
	
	/**
	 * 
	 *
	 * @param {name} 
	 * @return {} 
	*/
	action(name) {
		
	};
	
	/**
	 * 
	 *
	 * @param {name} 
	 * @return {} 
	*/
	notify(header, content, type, timer) {
		
		if(!timer) timer = 6;
		
		var div = document.createElement('div');
		div.classList.add('notification');
		
		let className = '';
		let icon = '';
		
		if(type == 'good') {
			icon = 'ok';
			div.classList.add('notification--good');
		} else if(type == 'bad') {
			timer = 20;
			icon = 'heart';
			div.classList.add('notification--bad');
		};
		
		div.innerHTML = '<span class="close"><i class="icon-cancel"></i></span><p class="header"><i class="icon-'+icon+'"></i> '+header+'</p><p class="content">'+content+'</p>';
		
		var close = div.querySelectorAll('.close');
		close.forEach(function(el, it){
			el.onclick = function(){
				div.classList.add('notification--dead');
			};
		});
		
		this.notifyContainer.insertBefore(div, this.notifyContainer.firstChild);
		
		setTimeout(function(){
			div.classList.add('notification--dead');
		}, timer*1000);
		
		setTimeout(function(global){
			global.notifyContainer.removeChild(div);
		}, timer*1000+2000, this);
				
	};
	
	
	/**
	 * Sets value saved in data storage
	 *
	 * @param {name} Name of the variable
	 * @param {value} Mixed data to store
	 * @return {} 
	*/
	setParam(name, value) {
		localStorage.setItem('db.' + name, value);
		return true;
	};
	
	
	/**
	 * Return value saved in that variable
	 *
	 * @param {name} 
	 * @return {mixed} Return value saved in that variable  
	*/
	getParam(name) {
		return localStorage.getItem('db.' + name);
	};
	
	
	/**
	 * 
	 *
	 * @param {name} 
	 * @return {} 
	*/
	page(name) {
		
	};
	
	
	
	/**
	 * Creates working breadcrumbs 
	 *
	 * @param {} No params required
	 *
	 * @return {} It changes DOM element without returning anything
	*/
	bakeBread() {
		
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
	reboot() {
		
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
	
};