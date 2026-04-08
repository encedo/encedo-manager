function log(t, c, g, s) { console.log('%c' + t, (c && c.length == 6 ? 'color: #' + c + '; ' : '') + (g && g.length == 6 ? 'background-color: #' + g + '; ' : '') + (s ? 'font-weight: bold;' : '')); }
log('Welcome my friend!', '000000', 'f5f5f5', true); 
var _api = function(url, func, givenObj, timeout, external) {
	var xhr = new XMLHttpRequest();
	var prepareData = (givenObj ? JSON.stringify(givenObj) : '');
	xhr.onload = function () {
		if (xhr.readyState === 4 && (xhr.status >= 200 && xhr.status < 300)) {
			func(true, JSON.parse(xhr.responseText));
		} else { 
			setTimeout(function(){
				func(false);
				_api(url, func, givenObj, timeout, external);
			}, (timeout ? timeout : 5000));
		}
	};
	if(external) {
		xhr.open('GET', url);
	} else {
		xhr.open('POST', 'api-' + url);
	}
	xhr.setRequestHeader("Content-Type", "application/json");
	xhr.send(prepareData);
};

function canUseWebP() {
    var elem = document.createElement('canvas');
    if (!!(elem.getContext && elem.getContext('2d'))) {
        return elem.toDataURL('image/webp').indexOf('data:image/webp') == 0;
    }
    return false;
}

function addClass(element, className) {
  element.classList.add(className);
};

function hasClass(element, className) {
	return element.classList.contains(className);
};

function removeClass(element, className) {
	element.classList.remove(className);
};

function loadScript(url, func) {
	var script = document.createElement('script');
	if(func) script.onload = func();
	document.head.appendChild(script);
	script.src = url;	
};

const throttle = (func, limit) => {
  let lastFunc;
  let lastRan;
  return function() {
    const context = this;
    const args = arguments;
    if (!lastRan) {
      func.apply(context, args);
      lastRan = Date.now();
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(function() {
        if ((Date.now() - lastRan) >= limit) {
          func.apply(context, args);
          lastRan = Date.now();
        }
      }, limit - (Date.now() - lastRan));
    }
  }
};

function on(container, event, selector, handler) {
	container.addEventListener(event, function(e){
		if (e.target.matches(selector)) {
			handler(e.target);
		} else if(e.target.parentNode.matches(selector)) {
			handler(e.target.parentNode);
		} else if(e.target.parentNode.parentNode.matches(selector)) {
			handler(e.target.parentNode.parentNode);
		};
		e.stopPropagation();
	});
};

function getOS() {
  var userAgent = window.navigator.userAgent,
      platform = window.navigator.platform,
      macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'],
      windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'],
      iosPlatforms = ['iPhone', 'iPad', 'iPod'],
      os = null;

  if (macosPlatforms.indexOf(platform) !== -1) {
    os = 'MacOS';
  } else if (iosPlatforms.indexOf(platform) !== -1) {
    os = 'iOS';
  } else if (windowsPlatforms.indexOf(platform) !== -1) {
    os = 'Windows';
  } else if (/Android/.test(userAgent)) {
    os = 'Android';
  } else if (!os && /Linux/.test(platform)) {
    os = 'Linux';
  };

  return os;
};

const downloadFile = (file) => {
  const element = document.createElement('a');
  element.setAttribute('href', file);
  element.setAttribute('download', true);

  element.style.display = 'none';

  document.body.appendChild(element);

  element.click();
  document.body.removeChild(element);
};

function absolutePosition(el) {
	let found,
		left = 0,
		top = 0,
		width = 0,
		height = 0,
		offsetBase = absolutePosition.offsetBase;
	if (!offsetBase && document.body) {
		offsetBase = absolutePosition.offsetBase = document.createElement('div');
		offsetBase.style.cssText = 'position:absolute;left:0;top:0';
		document.body.appendChild(offsetBase);
	}
	if (el && el.ownerDocument === document && 'getBoundingClientRect' in el && offsetBase) {
		var boundingRect = el.getBoundingClientRect();
		var baseRect = offsetBase.getBoundingClientRect();
		found = true;
		left = boundingRect.left - baseRect.left;
		top = boundingRect.top - baseRect.top;
		width = boundingRect.right - boundingRect.left;
		height = boundingRect.bottom - boundingRect.top;
	}
	return {
		found: found,
		left: left,
		top: top,
		width: width,
		height: height,
		right: left + width,
		bottom: top + height
	};
};

function fillForm(form, data) {

	for(var key in data) { 
		let element = document.querySelectorAll((form ? '#' + form + ' ' : '') + '*[name="'+key+'"]');
		
		element.forEach(function(el, it){
			let tag = el.tagName.toLowerCase();
			let type = el.type.toLowerCase();

			if(type != 'file' && type != 'radio' && type != 'checkbox') {
				el.value = data[key];
			} else if(type == 'radio' || type == 'checkbox') {
				if((Array.isArray(data[key]) && data[key].includes(el.value)) || el.value == data[key]) {
					el.checked = true;
				} else {
					el.checked = false;
				}
			}			
		});		
		
	}

};

function setCharAt(str,index,chr) {
    if(index > str.length-1) return str;
    return str.substring(0,index) + chr + str.substring(index+1);
}

function changeWord(element, newWord) {
	
	if(!element) return;
	
	const tag = element.tagName ? element.tagName.toLowerCase() : false;
	let wordNow = false;
	let i = 0;
	
	if(tag == 'span' || tag == 'p' || tag == 'a') {
		wordNow = element.innerHTML;
	} else if(tag == 'input') {
		wordNow = element.value;
	};
	
	
	
	var oldWordLength = wordNow.length;
	var newWordLength = newWord.length;
	
	element.dataset.now = wordNow;
	
	if(newWord == wordNow) return;
	
	for(i = 0; i < Math.max(newWordLength, oldWordLength); i++) {
		
		setTimeout(function(j){
			
			wordNow = element.dataset.now;
			
			if(j < newWordLength) {
				if(j <= oldWordLength) {
					wordNow = setCharAt(wordNow, j, newWord.charAt(j));
					console.log('1', wordNow, j, newWord.charAt(j));
				} else {
					wordNow = wordNow.concat('', newWord.charAt(j));
					console.log('2', wordNow, j, newWord.charAt(j));
				}
				
				
			} else {
				if(wordNow[j]) {
					wordNow = setCharAt(wordNow, j, ' ');
					console.log('3', wordNow, j, newWord.charAt(j));
				} else {
					wordNow = wordNow.concat('', ' ');
					console.log('4', j, newWord.charAt(j));
				}
			}
			if(tag == 'span' || tag == 'p' || tag == 'a') {
				element.innerHTML = wordNow;
			} else if(tag == 'input') {
				element.value = wordNow;
			};
			
			element.dataset.now = wordNow;
			
		}, i*i*10+150, i);

	};
			
};

if(canUseWebP()) {
	addClass(document.body, 'webp');
} else {
	addClass(document.body, 'no-webp');
}

let body, html, height, vheight, width, vwidth = false;

window.onload = function(ev) {
	
	body = document.body;
	html = document.documentElement;
	height = Math.max( body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight );
	vheight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
	width = Math.max( body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth );
	vwidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
	
	
	log('Page has been loaded in ' + (parseInt(Date.now()) - __time) + ' miliseconds.');
	log('Crazy fast!', '990000', 'eeeeee', true);
		
	let targets = [];
	let watched = document.querySelectorAll(".lazyLoad, .runtime, .watched");
	function getInitialPositions() {
		targets = [];
		for (key = 0; key < watched.length; key++) {
			var box = absolutePosition(watched[key]);
			watched[key].setAttribute('data-top', box.top);
			watched[key].setAttribute('data-bottom', box.bottom);
			watched[key].setAttribute('data-class', watched[key].className);
			targets.push([watched[key], watched[key].className, box.top-vheight-(width > 600 ? 200 : 400), box.bottom + (width > 600 ? 200 : 300), box.top-vheight, box.bottom]);
		};
	};
	
	const onPositionHandler = throttle(getInitialPositions, 800);	
	
	onPositionHandler();
	
	window.addEventListener('resize', (e) => {
		onPositionHandler();
	}, { capture: false, passive: true });
	
	var already = false;
	var loaded = [];
	
	const onScroll = function(where) {
		var i = 0;
		for (key in targets) {
			setTimeout(function(obj){
				
				const tag = obj[0].tagName ? obj[0].tagName.toLowerCase() : false;
				
				if(obj[2] <= where && obj[3] >= where) {
					
					if(obj[0].getAttribute('data-preloaded') != '1') {
						
						obj[0].setAttribute('data-preloaded', '1');
						obj[0].className = obj[0].className + ' preloaded';
						
						if(tag == 'img') {
							obj[0].src = obj[0].getAttribute("data-src");
						}
						
						if(tag == 'div' && hasClass(obj[0], 'runtime')) {
							runtime.forEach(function(have){
								if(have.id == obj[0].getAttribute('id') && !loaded.includes(have.id)) {
									have.fun();
									loaded.push(have.id);
								}
							});
						}	
						
					}
				}
				
				onPositionHandler();
				
			}, 1, targets[key]);
			
			setTimeout(function(obj){
				
				const tag = obj[0].tagName ? obj[0].tagName.toLowerCase() : false;
				
				if(obj[4] <= where && obj[5] >= where) {
					
					obj[1] = obj[0].className.replace(' visible', '');
					obj[0].className = obj[1] + ' visible';
					
					if(obj[0].getAttribute('data-already-visible') != '1') {
						obj[0].setAttribute('data-already-visible', '1');
						obj[0].className = obj[0].className + ' alreadyVisible';
					}
					
				} else {
					removeClass(obj[0], 'visible');
				}
				
				onPositionHandler();
				
			}, i*17, targets[key]);
			
			i++;
		}

		if(where > 200) {
			if(!already) {
				addClass(body, 'changed');
				already = true;
			}
		} else {
			removeClass(body, 'changed');
			already = false;
		}
	};
	
	setTimeout(function(){
		onScroll(window.scrollY);
	}, 100);
	
	// shortcut for invoking activities' actions
	makeAction = function(name, arg) {
		if(actions[name]) actions[name](arg);
	};
	
	const TITLE = 'Encedo Dashboard';
	var lastPage = false;
	var lastClass = 'transparent';
	
	var pageContainer = document.getElementById('pageContainer');
	var appContainer = document.getElementById('appContainer');
	
	var is_dark_mode = localStorage.getItem('darkmode');
	
	if(is_dark_mode && is_dark_mode == 'on') {
		body.classList.add('black');
	};
	
	register('reverseColors', function(data){
		body.classList.toggle('black');
		
		if(body.classList.contains('black')) {
			localStorage.setItem('darkmode', 'on');
		} else {
			localStorage.setItem('darkmode', 'off');
		};
	});

	changePage = function(name) {
		
		var clsNew = '';
		var elementNow = document.getElementById(name);
		
		if(elementNow && elementNow.dataset && elementNow.dataset.class) {
			var clsNew = elementNow.dataset.class.split(' ');
		}
		
		if(lastPage) {
			makeAction('__' + lastPage);
			document.getElementById(lastPage).classList.remove('pageActive');
		}
		
		if(lastClass) {
			var cls = lastClass.split(' ');
			cls.forEach(function(e){
				if(!clsNew.includes(e)) {
					appContainer.classList.remove(e);
				}
			});
		}

		setTimeout(function(elementNow){ 
		
			lastPage = name;
			window.scrollTo(0, 0);
			elementNow.classList.add('pageActive');
			//bakeBread(elementNow);
			makeAction(name);
			
			if(elementNow.dataset){ 
			
				if(elementNow.dataset.class) {
					clsNew.forEach(function(e){
						appContainer.classList.add(e);
					});
					lastClass = elementNow.dataset.class;
				}
				
				if(elementNow.dataset.title) {
					window.document.title = elementNow.dataset.title;
				} else {
					window.document.title = TITLE;
				}
				
			}
			
		}, 600, elementNow);
		
	};
	
	on(document, 'click', '.makeAction', function(e){
		var rel = e.getAttribute("rel").split('/');
		e.dataset.active = 'true';
		if(actions[rel[0]]) {
			actions[rel[0]](rel[1], rel[2], rel[3], rel[4]);
		};
	});
	
	on(document, 'click', '.changePage', function(e){
		var rel = e.getAttribute("rel");
		changePage(rel);
	});
	
	var breacrumbsDOM = document.getElementById('TPLbreadcrumbs');
	
	var bakeBread = function(element) {
		
		breacrumbsDOM.childNodes.forEach(function(child, it){
			if(child.nodeType != 3) {
				setTimeout(function(child){
					child.remove();
				}, it*50, child);
			};
		});
		
		setTimeout(function(element){
			if(element && element.dataset && element.dataset.title) {
				var html = '';
				html += '<span class="crumb animatedX moved moved2 changePage" rel="home">Home</span>';
				html += '<i class="icon-angle-right animatedX moved moved2"></i>';
				
				if(element.dataset.parent) {
					var parental = document.getElementById(element.dataset.parent);
					if(parental) {
						html += '<span class="crumb animatedX moved moved2 changePage" rel="'+parental.getAttribute('id')+'">'+parental.dataset.title+'</span>';
						html += '<i class="icon-angle-right animatedX moved moved2"></i>';
					};
				};
				
				html += '<span class="crumb animatedX moved moved2 changePage" rel="'+element.getAttribute('id')+'">'+element.dataset.title+'</span>';
				breacrumbsDOM.innerHTML = html;
			};
		}, 700, element);
		
	};
	
	window.addEventListener('popstate', function(event) {
		changePage(event.state.url);
	});
	
	initMain();
	
	const onScrollHandler = throttle(onScroll, 200);	
	let ticking = false;
	let last_known_scroll_position = 0;
	
	
	
	window.addEventListener('scroll', (e) => {
	  last_known_scroll_position = window.scrollY;
	  if (!ticking) {
		window.requestAnimationFrame( () => {
			onScrollHandler(last_known_scroll_position);
		  ticking = false;
		});
		ticking = true;
	  }
	}, { capture: false, passive: true });
	
	var i, toggles = document.getElementsByClassName('toggle');
	for (i = 0; i < toggles.length; i++) {
		var obj = toggles[i];
		setTimeout(function(element) {
			element.onclick = function(ev) {
				ev.stopPropagation();
				ev.cancelBubble = true;
				var id = element.attributes.rel.value;
				var objX = document.getElementById(id);
				if(objX.className.indexOf('dead') != -1) {
					objX.className = objX.className.replace('dead', '');
					if(element.dataset.class) {
						element.classList.add(element.dataset.class);
					};
				} else {
					objX.className = objX.className + ' dead';
					if(element.dataset.class) {
						element.classList.remove(element.dataset.class);
					};
				}
				
			};
		}, 1, toggles[i]);
	}			
	
	function serialize(form) {
		if (!form || form.nodeName !== "FORM") {
			return;
		}
		var i, j, q = [];
		let x = {};
		for (i = form.elements.length - 1; i >= 0; i = i - 1) {
			if (form.elements[i].name === "") {
				continue;
			}
			switch (form.elements[i].nodeName) {
			case 'INPUT':
				switch (form.elements[i].type) {
				case 'text':
				case 'email':
				case 'date':
				case 'time':
				case 'hidden':
				case 'password':
				case 'button':
				case 'reset':
				case 'submit':
					x[form.elements[i].name] = (form.elements[i].value);
					break;
				case 'checkbox':
					if(!Array.isArray(x[form.elements[i].name])) {
						x[form.elements[i].name] = [];
					}
					if (form.elements[i].checked) {
						x[form.elements[i].name].push(form.elements[i].value);
					}						
					break;
				case 'radio':
					if (form.elements[i].checked) {
						x[form.elements[i].name] = (form.elements[i].value);
					}						
					break;
				case 'file':
					break;
				}
				break;			 
			case 'TEXTAREA':
				x[form.elements[i].name] = (form.elements[i].value);
				break;
			case 'SELECT':
				switch (form.elements[i].type) {
				case 'select-one':
					x[form.elements[i].name] = (form.elements[i].value);
					break;
				case 'select-multiple':
					for (j = form.elements[i].options.length - 1; j >= 0; j = j - 1) {
						if (form.elements[i].options[j].selected) {
							x[form.elements[i].name] = (form.elements[i].value);
						}
					}
					break;
				}
				break;
			case 'BUTTON':
				switch (form.elements[i].type) {
				case 'reset':
				case 'submit':
				case 'button':
					x[form.elements[i].name] = (form.elements[i].value);
					break;
				}
				break;
			}
		}
		return x;
	};

	let mobileMenuStatus = false;
	const menuMenu = document.getElementById('menu-menu');
	const mobileMenu = document.getElementById('mobileMenu');
	if(menuMenu && mobileMenu) mobileMenu.onclick = () => {
		if(mobileMenuStatus){
			menuMenu.className = 'clearfix';
			mobileMenuStatus = false;
		} else {
			menuMenu.className = 'active clearfix';
			mobileMenuStatus = true;
		}
	};
	
	
	let asyncForms = document.getElementsByClassName('async');
	for (key in asyncForms) {
		if (asyncForms.hasOwnProperty(key) && /^0$|^[1-9]\d*$/.test(key) && key <= 4294967294) {
			const after = asyncForms[key].getAttribute('data-action');
			var obj = asyncForms[key];
			let submitButtons = obj.getElementsByClassName('makeSubmit');
			let changer = obj.getElementsByClassName('changeText');
			let changer2 = obj.getElementsByClassName('changeValue');
			let namesSaved = [];
			let namesSaved2 = [];
			
			
			if(submitButtons) {
				 for (i = 0; i < submitButtons.length; i++) {
					submitButtons[i].onclick = function(_ev){
						_ev.stopPropagation();
						var data = serialize(obj);
						if(actions[after]) {
							actions[after](data);
						}
						return false;
					};
				 };
			  };
		   
			obj.onsubmit = function(_ev) {
				_ev.stopPropagation();
				var data = serialize(obj);
				if(actions[after]) {
					actions[after](data);
				}
				return false;
			};
		};
	};
	
	let asyncForms2 = document.getElementsByClassName('async2');
	for (key in asyncForms2) {
		if (asyncForms.hasOwnProperty(key) && /^0$|^[1-9]\d*$/.test(key) && key <= 4294967294) {
		   const address = asyncForms2[key].attributes.rel.value;
		   const after = asyncForms2[key].getAttribute('data-after');
		   let obj = asyncForms2[key];
           let changer = obj.getElementsByClassName('changeText');
           let changer2 = obj.getElementsByClassName('changeValue');
		   let namesSaved = [];
           let namesSaved2 = [];
        
			asyncForms2[key].onsubmit = function(_ev) {
           
           if(changer) {
             for (i = 0; i < changer.length; i++) {
              var objo = changer[i];
                namesSaved[i] = objo.textContent;
                objo.disabled = true;
                if(objo.dataset && objo.dataset.loading) {
                  objo.innerHTML = objo.dataset.loading;
                }
             }
           }
           
           if(changer2) {
             for (i = 0; i < changer2.length; i++) {
              var objo = changer2[i];
                namesSaved2[i] = objo.textContent;
                objo.disabled = true;
                if(objo.dataset && objo.dataset.loading) {
                  objo.value = objo.dataset.loading;
                }
             }
           }
        
			var data = serialize(obj);
            if(obj.dataset) {
					data._dataset = obj.dataset;
            } else {
               data._dataset = {};
            }
           
				_ev.stopPropagation();
				_api(address, function(status, res){
					if(after) {
                  
						if(after.indexOf('?') > -1) {
							changePage(after);
						} else {
							changePage(after);
						}
					} 
				}, data, 1000);
				return false;
			};
			
		};
	};	
	
};

var initMain = function() {
	
	var tmpUrl = 'http://192.168.7.1';
	var hashAddress = document.location.hash;
	
	if(hashAddress.length > 1) {
		tmpUrl = window.location.protocol + '//' + hashAddress.replace('#', '');
	};
	
	let app = new Encedo(tmpUrl);
	let _os = getOS();
	let status_encedoDevice = document.getElementById('status_encedoDevice');
	let status_encedoSoftware = document.getElementById('status_encedoSoftware');
	let status_driverDownload = document.getElementById('status_driverDownload');
	let status_operatingSystem = document.getElementById('status_operatingSystem');
	
	changePage(startPage ? startPage : 'home');
	
	if(_os == 'Windows') {
		status_operatingSystem.innerHTML = 'Your operating system is Windows. It means that proper functioning of Encedo Device requires installing simple driver.';
		status_driverDownload.innerHTML = 'Please download driver from that source: <a href="https://encedo.com/a/Encedo_USBNet_ECM_v3.40.0_2020-12-17_setup.exe">https://encedo.com/a/Encedo_USBNet_ECM_v3.40.0_2020-12-17_setup.exe</a>';
	} else if(_os == MacOS || _os == Linux) { 
		status_operatingSystem.innerHTML = 'Good news everyone! Your operating system is ' + _os + '. It means that proper driver is already installed on your machine and you can go to the next step.';
		status_driverDownload.innerHTML = 'You are good to go to the next step.';
	};
	
	var timeoutToDownload = false;
	var periodicToConnect = false;

	
	function checkEncedo() {
		
		app.check(function(update){
			
			clearInterval(periodicToConnect);
			
			status_encedoDevice.innerHTML = 'Successfully connected to Encedo Device!';
			status_encedoSoftware.innerHTML = 'Device firmware version: ' + app.encedo_version_firmware;
			
			status_operatingSystem.innerHTML = '';
			status_driverDownload.innerHTML = '';

			app.api('api/system/config/attestation').then(function(data){
				console.log(data);
				return app.api('https://api.encedo.com/domain/register/my', 'POST', data);
			}).then(function(data){
				return app.api('api/system/config', 'POST', { tls: data} );
			}).then(function(){
				app.check();
			}).catch(function(e){
				
			});

		}, function(){
			
		});
	};
	
	register('check', function() {
		periodicToConnect = setInterval(checkEncedo, 4000);	
	});
	
	register('__check', function() {
		clearInterval(periodicToConnect);
	});	
	
};