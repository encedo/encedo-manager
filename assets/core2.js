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
		if (e.target && e.target.matches(selector)) {
			handler(e.target);
		} else if(e.target.parentNode && e.target.parentNode.matches(selector)) {
			handler(e.target.parentNode);
		} else if(e.target.parentNode && e.target.parentNode.parentNode && e.target.parentNode.parentNode.matches(selector)) {
			handler(e.target.parentNode.parentNode);
		};
		e.stopPropagation();
	});
};

const on2 = (selector, eventType, childSelector, eventHandler) => {
  const elements = document.querySelectorAll(selector)
  for (element of elements) {
    element.addEventListener(eventType, eventOnElement => {
      if (eventOnElement.target.matches(childSelector)) {
        eventHandler(eventOnElement)
      };
    });
  };
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
		let element = form.querySelectorAll('*[name="'+key+'"]');
		
		element.forEach(function(el, it){
			let tag = el.tagName.toLowerCase();
			let type = el.type.toLowerCase();

			if(type != 'file' && type != 'radio' && type != 'checkbox') {
				el.value = data[key];
				el.dataset.value = data[key];
			} else if(type == 'radio' || type == 'checkbox') {
				if((Array.isArray(data[key]) && data[key].includes(el.value)) || el.value == data[key]) {
					el.checked = true;
					el.dataset.checked = 1;
				} else {
					el.checked = false;
					el.dataset.checked = 0;
				}
			} else {
				el.dataset.value = data[key];
				el.value = data[key];
			};				
		});		
		
	};

};

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
			case 'range':
			case 'button':
			case 'reset':
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
			case 'button':
				x[form.elements[i].name] = (form.elements[i].value);
				break;
			}
			break;
		}
	}
	return x;
};

function setCharAt(str,index,chr) {
    if(index > str.length-1) return str;
    return str.substring(0,index) + chr + str.substring(index+1);
};

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
				} else {
					wordNow = wordNow.concat('', newWord.charAt(j));
				}
				
				
			} else {
				if(wordNow[j]) {
					wordNow = setCharAt(wordNow, j, ' ');
				} else {
					wordNow = wordNow.concat('', ' ');
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

let body, html, height, vheight, width, vwidth, lastActiveActionTrigger = false;

var inform = false;
var perform = false;
var handleFiles = false;
var tempAfterInit = false;

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
	
	const TITLE = 'Encedo Manager';
	var lastPage = false;
	var lastClass = 'transparent';
	var pageChangerHandler = false;
	
	var pageContainer = document.getElementById('pageContainer');
	var appContainer = document.getElementById('appContainer');
	
	var is_dark_mode = localStorage.getItem('darkmode');
	
	var d = new Date();
    var darkTimes = d.getHours();

	if((is_dark_mode && is_dark_mode == 'on')) {
		body.classList.add('black');
	};
	
	if(!is_dark_mode && (darkTimes >= 19 || darkTimes < 7)) {
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
	
	function closeAllPages(exclude) {
		var pages = pageContainer.querySelectorAll(".page:not(#"+exclude+")");
		pages.forEach(function(item){
			item.classList.remove('pagePrepared');
			item.classList.remove('pageActive');
		});
	};

	changePage = function(name) {
		
		var clsNew = '';
		var titleNow = '';
		var elementNow = document.getElementById(name);
		var elementBefore = false;
		
		if(!elementNow) {
			console.log('Page not found, redirecting to home page');
			changePage('home');
			
			return;
		}
		
		if(elementNow && elementNow.dataset && elementNow.dataset.init && !tempAfterInit) {
			console.log('Device not initialised, redirecting to INIT form.');
			changePage('gettingStarted');
			return;
		};
		
		if(elementNow && elementNow.dataset && elementNow.dataset.preinit && tempAfterInit) {
			console.log('Device already initialised, redirecting to home page.');
			changePage('home');
			return;
		};
		
		if(elementNow && elementNow.dataset && elementNow.dataset.class) {
			var clsNew = elementNow.dataset.class.split(' ');
		};
		
		elementNow.classList.add('pagePrepared');
		
		if(lastPage) {
			makeAction('__' + lastPage);
			elementBefore = document.getElementById(lastPage).classList;
			elementBefore.remove('pageActive');
		};
		
		if(lastClass) {
			var cls = lastClass.split(' ');
			cls.forEach(function(e){
				if(!clsNew.includes(e)) {
					appContainer.classList.remove(e);
				};
			});
		};
		
		window.document.title = TITLE;
		history.pushState({ page: name }, window.document.title);
		
		setTimeout(function(elementNow){ 
			if(elementBefore) {
				elementBefore.remove('pagePrepared');
				elementNow.classList.add('pagePrepared');
			};
		}, 500, elementNow);
		
		clearTimeout(pageChangerHandler);

		pageChangerHandler = setTimeout(function(elementNow){ 
		
			window.scrollTo(0, 0);
			closeAllPages(name);
			elementNow.classList.add('pageActive');
			
			bakeBread(elementNow);
			makeAction(name);
			lastPage = name;
			
			document.location.hash = name + (_redirected ? ':' + _redirectedAddressRaw : '');
			
			if(elementNow.dataset){ 
			
				if(elementNow.dataset.class) {
					clsNew.forEach(function(e){
						appContainer.classList.add(e);
					});
					lastClass = elementNow.dataset.class;
				};
				
				if(elementNow.dataset.title) {
					window.document.title = elementNow.dataset.title;
				};
				
			};
			
		}, 600, elementNow);
		
	};
	
	window.onpopstate = function(event) {
		if(event && event.state && event.state.url) {
			changePage(event.state.url);
		};
	};
	
	on(document, 'click', '.makeAction', function(e){
		var rel = e.getAttribute("rel").split('/');
		e.dataset.active = 'true';
		if(actions[rel[0]]) {
			lastActiveActionTrigger = e;
			actions[rel[0]](rel[1], rel[2], rel[3], rel[4]);
		};
	});
	
	on(document, 'click', '.changePage', function(e){
		var rel = e.getAttribute("rel");
		changePage(rel);
	});
	
	on(document, 'click', '.tabber li', function(e){
		var parent = e.parentNode;
		var children = parent.getElementsByTagName('li');
		for (i = 0; i < children.length; i++) {
			var obj = children[i];
			setTimeout(function(element) {
				element.classList.remove('active');
			}, 1, children[i]);
		};
		setTimeout(function(element) {
			element.classList.add('active');
			if(element.dataset && element.dataset.action) {
				var after = element.dataset.action.split('/');
				if(actions[after[0]]) {
					actions[after[0]](after[1], after[2], after[3], after[4]);
				} else {
					console.log('Action not found!');
				};
			};
		}, 20, e);
	});
	
	document.addEventListener("change", function(event) {
	  let element = event.target;
	  if (element && element.matches(".form-element-field")) {
		element.classList[element.value ? "add" : "remove"]("-hasvalue");
	  }
	});
	
	var breacrumbsDOM = document.getElementById('TPLbreadcrumbs');
	
	var bakeBread = function(element) {
		
		breacrumbsDOM.childNodes.forEach(function(child, it){
			if(child.nodeType != 3) {
				setTimeout(function(child){
					child.remove();
				}, it*120, child);
			};
		});
		
		setTimeout(function(element){
			if(element && element.dataset && element.dataset.title) {
				var html = '';
				html += '<span class="crumb animatedX moved moved2 changePage" rel="home"><i class="icon-home"></i> Home</span>';
				
				
				if(element.dataset.parent) {
					var parental = document.getElementById(element.dataset.parent);
					if(parental && parental.getAttribute('id') != 'home') {
						html += '<i class="icon-angle-right animatedX moved moved2"></i>';
						html += '<span class="crumb animatedX moved moved2 changePage" rel="'+parental.getAttribute('id')+'">'+parental.dataset.title+'</span>';
					};
				};
				
				if(element.getAttribute('id') != 'home') {
					html += '<i class="icon-angle-right animatedX moved moved2"></i>';
					html += '<span class="crumb animatedX moved moved2 changePage" rel="'+element.getAttribute('id')+'">'+element.dataset.title+'</span>';
				};
				breacrumbsDOM.innerHTML = html;
			};
		}, 700, element);
		
	};
	
	window.addEventListener('popstate', function(event) {
		if(event && event.state && event.state.url) {
			changePage(event.state.url);
		};
	});
	
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
		};
	};
	
	function makeProgressB(element, start, end, label, time) {
		var bar = document.createElement("div");
		var valuer = document.createElement("span");
		bar.classList.add('bar');
		element.appendChild(bar);
		bar.appendChild(valuer);
		var clicker = start;
		var timer = setInterval(function(){
			if(clicker>= end) {
				clearInterval(timer);
			};
			clicker++;
			bar.style.width = clicker + '%';
			valuer.innerHTML = clicker + label;
		}, 1000);
	};		
	
	let progressB = document.getElementsByClassName('progressB');
	for (key in progressB) {
		if (progressB.hasOwnProperty(key) && /^0$|^[1-9]\d*$/.test(key) && key <= 4294967294) {
			var obj = progressB[key];
			makeProgressB(
				obj, 
				(obj.dataset.start ? obj.dataset.start : 0),
				(obj.dataset.end ? obj.dataset.end : 100),
				(obj.dataset.label ? obj.dataset.label : '%'),
				(obj.dataset.time ? obj.dataset.time : 60),
			);
		};
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
			
			if(submitButtons && submitButtons.length > 0) {

				 for (i = 0; i <= submitButtons.length; i++) {
					 
					if(submitButtons[i]) submitButtons[i].onclick = function(_ev){
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
				} else {
					console.log('Action not found!');
				};
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
	
	initMain();
	
};

var initMain = function() {
	
	var tmpUrl = window.location.protocol + '//' + window.location.hostname;
	var tmpCache = false;
	var tmpAsked = false;
	var tempPaired = false;
	var tempPairedFirst = false;
	var tempLoader = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span>  &nbsp; ';
	
	var hashAddress = document.location.hash;
	
	if(hashAddress.length > 1) {
		var tmpadr = hashAddress.split(':');
		if(tmpadr.length > 1) {
			tmpUrl = window.location.protocol + '//' + tmpadr[1];
		};
	};
	
	var app = new Encedo(tmpUrl);
	app.setGLoader(tempLoader);
	//var dashb = new Dashboard(tmpUrl, document.getElementById('TLnotifications-content'));
	var periodicToConnect = false;
	var connectionCheckup = false;
	var encedo_status_head = document.getElementById('encedo_status_head');
	var storage_available = false;
	
	//dashb.notify('Morbi fringilla nisi nibh, at suscipit', 'Nullam gravida ipsum ut velit euismod, a pharetra ante tristique. Pellentesque eleifend ex ac mi pulvinar, a ornare nisl fermentum.', 'good', 2);
	//dashb.notify('Phasellus consequat et ligula a pretium', 'Cras non augue nec elit pretium iaculis. Fusce mollis finibus feugiat.', 'bad', 1);
	
	setTimeout(function(){
		var imgLazy = document.querySelectorAll('img[data-src]');
		imgLazy.forEach(function(item){
			item.src = item.dataset.src;
		});
	}, 2200);
	
	// Just print some info about starting variables
	app.info();
	
		var swalPendingObj = {
	  title: 'Check mobile application',
	  html: '<div id="popupStatus">Waiting for user interaction...</div>',
	  showConfirmButton: false,
	  showCancelButton: true,
	  timerProgressBar: true,
	  cancelButtonText: 'Use password',
	  timer: 60000
	};
	
	var swalOkObj = {
	  icon: 'success',
	  title: 'Operation succeeded',
	  html: 'Access has been granted with mobile app',
	  showConfirmButton: false,
	  timerProgressBar: true,
	  timer: 3000
	};
	
	var swalErrorObj = {
	  icon: 'error',
	  title: 'Error with mobile authentication',
	  showConfirmButton: false,
	  timerProgressBar: true,
	  timer: 3000
	};
	
	var swalDeniedObj = {
	  icon: 'error',
	  title: 'Access denied by mobile app',
	  showConfirmButton: false,
	  timerProgressBar: true,
	  timer: 3000
	};
	
	var usePasswordOneTime = function(result){
		
	};
	
	inform = function(result, comment) {
		Swal.fire({
		  icon: (result ? 'success' : 'error'),
		  title: (result ? 'Operation succeeded' : 'Error occured'),
		  text: comment,
		  showConfirmButton: false,
		  timerProgressBar: true,
		  timer: 2200
		});
	};
	
	perform = function(scopeBlock, address, func, elements, finalInformation) {
		
		if(scopeBlock.length < 5) return false;
		
		var scope = false;
		var scopeFinal = false;
		var scopes = scopeBlock.split(' ');
		
		for(key in scopes) {
			
			var scopeNow = scopes[key];
		
			if(app.tokens[scopeNow] && app.tokens[scopeNow].token) {
				if(app.tokens[scopeNow].exp*1000 - app.encedo_time - app.encedo_time_offset*1000 < 5000) {
					app.tokens[scopeNow] = false;
					delete app.tokens[scopeNow];
				} else {
					if(!scope) scope = scopeNow;
				};
			};
		};
		
		if(!scope) scope = scopes[0];
		
		if(app.tokens[scope] && app.tokens[scope].token) {
				
			app.scoped(scope, function(status, data, passer){
				if(status) status = scope;
				func(status, 'local', data, passer);	
			}, elements, finalInformation, false);
				
		} else {		

			if(tempPairedFirst && !tmpCache && scope != 'system:config' && scope != 'auth:ext:pair') {
				
				var swal = Swal.fire(swalPendingObj).then(function(result){
					
					tempPairedFirst = false;
					perform(scope, address, func, elements, finalInformation);
					tempPairedFirst = true;
					
					app.mobileAuthCleanup(func);
					
					setTimeout(function(){
						app.mobileAuthCleanup(func);
					}, 3000);

				});
				
				
				app.mobileAuth(scope, address, function(status, data){
					if(status) {
						func(status, 'mobile', data);	
						Swal.fire(swalOkObj);
					} else {
						if(data == 1) {
							func(false, data);
							Swal.fire(swalDeniedObj);
						} if(data == 5) {

							Swal.fire(swalErrorObj);
							setTimeout(function(){
								tempPairedFirst = false;
								perform(scope, address, func, elements, finalInformation);
								tempPairedFirst = true;
							}, 2000);
							
						} else {
							func(false, data);
							Swal.fire(swalErrorObj);
						};
					};
				}, elements, finalInformation, swal);
				
			} else {

				confirmX(function(passik){
					app.scoped(scope, function(status, data, passer){
						if(status) status = scope;
						func(status, 'local', data, passer);	
						if(!status && !passer && tmpAsked) {
							Swal.fire({
							  icon: 'error',
							  title: 'Password is incorrect. Please try again.',
							  showConfirmButton: false,
							  timer: 2200
							});
							blindsClose();
							curtainClose();
							tmpCache = false;
						};
					}, elements, finalInformation, passik);

				}, function(){
					
					var swal = Swal.fire(swalPendingObj).then(function(result){

						tempPairedFirst = false;
						perform(scope, address, func, elements, finalInformation);
						tempPairedFirst = true;
						
						app.mobileAuthCleanup(func);
						
						setTimeout(function(){
							app.mobileAuthCleanup(func);
						}, 2000);
					
						setTimeout(function(){
							app.mobileAuthCleanup(func);
						}, 4000);
					
					});
					
					app.mobileAuth(scope, address, function(status, data){
						
						if(status) {
							func(status, 'mobile', data);
							Swal.fire(swalOkObj);
						} else {
							if(data == 1) {
								func(false, data);
								Swal.fire(swalDeniedObj);
							} if(data == 5) {

								Swal.fire(swalErrorObj);
								setTimeout(function(){
									tempPairedFirst = false;
									perform(scope, address, func, elements, finalInformation);
									tempPairedFirst = true;
								}, 2000);
								
							} else {
								func(false, data);
								Swal.fire(swalErrorObj);
							};
						};
						
					}, elements, finalInformation, swal);
				}, scope);
					
			};
			
		};
		
	};
	
	/*		
		Swal.fire({
		  title: 'Are you sure?',
		  text: "You won't be able to revert this!",
		  icon: 'warning',
		  showCancelButton: true,
		  showLoaderOnConfirm: true,
		  reverseButtons: true,
		  confirmButtonColor: '#3085d6',
		  cancelButtonColor: '#d33',
		  confirmButtonText: 'Yes, wipe it all!'
		}).then((result) => {
		  if (result.isConfirmed) {

		  };
		});
	*/
	
	function refreshVersion() {
		app.version().then(function(data){
			
			let version_firmware = document.getElementById('version_firmware');
			let version_dashboard = document.getElementById('version_dashboard');

			version_firmware.innerHTML = app.encedo_version_firmware;
			version_dashboard.innerHTML = _DVERSION;
			
			makeCheckin();
			
		}).catch(function(e){
			app.error(e);
		});
	};
	
	var refreshEncedoTS = false;
	var encedoLastUptime = 0;
	var encedoDisconnected = false;
	var encedoMaxTemperature = 0;
	var encedoStatusConnectionHandler = false;
	var hardwareTemperatureChart = document.getElementById('hardwareTemperatureChart');
	var hardwareStatusMainContainer = document.getElementById('hardwareStatusMainContainer');
	
	function prepareStatusConnection() {
		encedoStatusConnectionHandler = new XMLHttpRequest();		
		encedoStatusConnectionHandler.timeout = 2200;
		encedoStatusConnectionHandler.onreadystatechange = function () {
			if(encedoStatusConnectionHandler.readyState == 4 && encedoStatusConnectionHandler.status != 200) {
				whenNotConnected(encedoStatusConnectionHandler);
			};
		};
		
		encedoStatusConnectionHandler.onload = function () {
			if (encedoStatusConnectionHandler.readyState === 4 && (encedoStatusConnectionHandler.status >= 200 && encedoStatusConnectionHandler.status < 300)) {
				var data = false;
				if(encedoStatusConnectionHandler.responseText) {
					data = JSON.parse(encedoStatusConnectionHandler.responseText);
				}
				whenConnected(data)
			} else {
				whenNotConnected(encedoStatusConnectionHandler);
			}
		};
		
		encedoStatusConnectionHandler.onerror  = function () {
			whenNotConnected(encedoStatusConnectionHandler);
		};
	};
	
	//prepareStatusConnection();
	
	function whenConnected(data) {
		
		var pairing = '';
		if(tempAfterInit) {
			if(tempPaired) {
				pairing = ' and paired';
			} else {
				pairing = ' ';
			};
		} else {
			pairing = ' but not personalized yet';
		};
		
		if(data.fls_state == 0) {
			encedo_status_head.classList.remove('failer');
			encedo_status_head.innerHTML = '<span class="named changePage" rel="hardware">Online' + pairing+ '</span>';
		} else {
			encedo_status_head.classList.add('failer');
			encedo_status_head.innerHTML = '<span class="named changePage" rel="hardware">Failure</span>';
		}
		encedo_status_head.classList.remove('offline');
		
		encedoMaxTemperature = Math.max(encedoMaxTemperature, data.temp);

		tickStatusTempAndConn(data.temp);
		
		if(data.ts) {
			var time_formatted = data.ts.replace('T', ' ').replace('Z', '');
			app.encedo_time = Date.parse(data.ts.replace('T', ' ').replace('Z', ''));
			app.encedo_time_offset = (Date.now() - app.encedo_time)/1000;
		} else {
			app.encedo_time = 0;
			app.encedo_time_offset = 0;
			refreshEncedoTS = true;
			var time_formatted = 'Refreshing...';
		};
		var uptime_formatted = new Date(1000 * data.uptime).toISOString().substr(11, 8);
		
		var storage0 = 'Not found';
		var storage1 = 'Not found';
		
		if(data.storage) {
			if(data.storage[0]) {
				var strg0 = data.storage[0].split(':');
				storage0 = formatBytes(strg0[0]*512, 2);
				if(strg0[1] == '-') storage0 += ', locked';
				if(strg0[1] == 'r' || strg0[1] == 'r') storage0 += ', opened to read';
				if(strg0[1] == 'rw') storage0 += ', opened to write';
				
				if(data.storage[1]) {
					var strg1 = data.storage[1].split(':');
					storage1 = formatBytes(strg1[0]*512, 2);
					if(strg1[1] == '-') storage1 += ', locked';
					if(strg1[1] == 'r' || strg1[1] == 'r') storage1 += ', opened to read';
					if(strg1[1] == 'rw') storage1 += ', opened to write';
				};
			};
		};
		
		var fls_state = (data.fls_state == 0 ? 'OK, safe and sound!' : 'Error: ' + data.fls_state);
		
		hardwareStatusMainContainer.innerHTML = `<div class="item updtItem animatedX moved">
				<h3>Date and time</h3>
				<p>${time_formatted}</p>
			</div>
			<div class="item updtItem animatedX moved">
				<h3>Uptime</h3>
				<p>${uptime_formatted}</p>
			</div>
			<div class="item updtItem animatedX moved">
				<h3>Temperature</h3>
				<p>${data.temp}<sup>o</sup>C (${encedoMaxTemperature} <sup>o</sup>C max)</p>
			</div>
			<div class="item updtItem animatedX moved">
				<h3>Selfcheck status</h3>
				<p>${fls_state}</p>
			</div>
			<div class="item updtItem animatedX moved">
				<h3>Primary storage</h3>
				<p>${storage0}</p>
			</div>
			<div class="item updtItem animatedX moved">
				<h3>Encrypted storage</h3>
				<p>${storage1}</p>
			</div>`;
					
		if(refreshEncedoTS || (encedoDisconnected && encedoLastUptime > data.uptime)) {
			refreshEncedoTS = false;
			checkStatus(false);
		};
		
		encedoDisconnected = 0;
		encedoLastUptime = data.uptime;
		
	};
	
	function whenNotConnected() {
		console.log('Offline!');
		encedoDisconnected++;
		encedo_status_head.innerHTML = '<span class="named changePage" rel="hardware">Offline</span>';
		encedo_status_head.classList.add('offline');
		tickStatusTempAndConn(0);
	};
	
	function tickStatusTempAndConn(temp) {
		
		if(hardwareTemperatureChart.childElementCount > 180) {
			hardwareTemperatureChart.children[0].remove();
		};
		
		if(temp > 0) {
			hardwareTemperatureChart.innerHTML += '<span class="ticker" style="height: ' + temp + 'px;" title="' + temp + ' celcius degrees"></span>';
		} else {
			hardwareTemperatureChart.innerHTML += '<span class="ticker tickerEmpty" style="height: 0px;"></span>';
		};
	};
	
	var encedoStatusConnectionHandlerLimiter = false;
	
	function checkConnection() {
		clearTimeout(encedoStatusConnectionHandlerLimiter);
		encedoStatusConnectionHandlerLimiter = setTimeout(function(){
			if(encedoStatusConnectionHandler) {
				encedoStatusConnectionHandler.open('GET', app.encedo_url + '/api/system/status');
				encedoStatusConnectionHandler.send('');
			};
		}, 500);
	};
	
	window.addEventListener('blur', checkConnection);
	window.addEventListener('focus', checkConnection);
	
	function checkEncedo() {
		app.ping(function(){
			console.log('Connection with Encedo established!');
			clearInterval(periodicToConnect);
			//connectionCheckup = setInterval(checkConnection, 6000);
			checkStatus(true);
		}, function(){
			alreadyPinged++;
			console.log('Connection to Encedo failed');
			console.log('Try number: ' + alreadyPinged);
			if(alreadyPinged == 8) {
				clearInterval(periodicToConnect);
			};
		});
	};
	
	var menuAfterInit = document.getElementById('menuAfterInit');
	var menuBeforeInit = document.getElementById('menuBeforeInit');
	
	var devicesOptions = false;
	var devicesPossibleOptions = {
		'ppa': ['keychain', 'storage', 'thirdparties', 'pairing', 'logger'],
		'epa': ['keychain', 'pairing']
	};
	
	function prepareOptions(deviceType) {
		devicesOptions = devicesPossibleOptions[deviceType];
		
		var elementsToHideEPA = document.querySelectorAll('.fullEPAonly');
		elementsToHideEPA.forEach(function(item){
			item.classList.add('index');
		});
		
		var elementsToHidePPA = document.querySelectorAll('.fullPPAonly');
		elementsToHidePPA.forEach(function(item){
			item.classList.add('index');
		});
		
		let fields_init_allow_keysearch_no = document.getElementById('fields_init_allow_keysearch_no');
		let fields_init_allow_keysearch_yes = document.getElementById('fields_init_allow_keysearch_yes');
		let initHostnameDetailsFields = document.getElementById('initHostnameDetailsFields');
		
		if(deviceType == 'epa') {
			fields_init_allow_keysearch_no.checked = true;
			fields_init_allow_keysearch_yes.checked = false;
			
			elementsToHideEPA.forEach(function(item){
				item.classList.remove('index');
			});
			
			initHostnameDetailsFields.classList.remove('c3d');
			
			document.getElementById('storageBlockIndex').remove();
		
		} else {
			fields_init_allow_keysearch_no.checked = false;
			fields_init_allow_keysearch_yes.checked = true;
			
			elementsToHidePPA.forEach(function(item){
				item.classList.remove('index');
			});
		};
	};
	
	function checkStatus(redirection) {
		
		setTimeout(function(){
			addClass(body, 'loaded');
			addClass(body, 'loadedF');
		}, 100);

		app.status().then(function(data){
			
			encedo_status_head.innerHTML = '<span class="named changePage" rel="hardware">Online</span>';
			encedo_status_head.classList.remove('offline');
			
			encedoDisconnected = false;
			app.tokens = {};
			
			if(app.encedo_status && typeof app.encedo_status.inited !== 'undefined') {
				if(redirection) changePage('gettingStarted'); 
				menuBeforeInit.classList.remove('deader');
				manualUpdate.classList.remove('deader');
			} else {
				tempAfterInit = true;
				menuAfterInit.classList.remove('deader');
				if(redirection) {
					if(app.encedo_update_dashboard || app.encedo_update_firmware) {
						changePage('update'); 
					} else {
						changePage(startPage ? startPage : 'home');
					};
				};
			};
			
			getDevices();
			checkConnection();
			
			if(app.encedo_status) {
				
				if(app.encedo_status.hostname) {
					document.getElementById('dashboard_username').innerHTML = app.encedo_status.hostname;
				};
				
				if(app.encedo_status.https && window.location.protocol != 'https:') {
					window.location.replace(`https:${location.href.substring(location.protocol.length)}`);
				};	

				checkStorage(app.encedo_status);
			};
			
			
			app.version().then(function(data){
				prepareOptions(app.encedo_type);
				makeCheckin();
			}).catch(function(e){
				prepareOptions(app.encedo_type);
				makeCheckin();
				app.error(e);
			});
			
			prepareStatusConnection();
			
		}).catch(function(e) {
			app.error(e);
		});
	};
	
	function checkStorage(status) {
		
		var isThereStorage = document.querySelectorAll('.isThereStorage');
		var isThereNoStorage = document.querySelectorAll('.isThereNoStorage');
		
		if(status.storage) {
					
			storage_available = true;
			
			
			isThereStorage.forEach(function(item){
				item.classList.remove('index');
			});
			
			
			isThereNoStorage.forEach(function(item){
				item.classList.add('index');
			});
		
			handleStorage(0, status.storage);
			handleStorage(1, status.storage);
			
		} else {
			
			storage_available = false;
			
			isThereStorage.forEach(function(item){
				item.classList.add('index');
			});
			
			isThereNoStorage.forEach(function(item){
				item.classList.remove('index');
			});
			
		};
	};
	
	function checkEncedoAndVersion() {
		addClass(body, 'loaded');
		addClass(body, 'loadedF');
		makeCheckin();
		refreshVersion();
	};
	
	
	// Check also should be rewritten to Promises but for now it will stay as it is
	// There shoulbe break when whole dashboard is offline (otherwise it will break on second stage of check()
	function makeCheckin() {
		
		app.check(function(update){
			
			if(app.encedo_type == 'ppa') {
			
				setTimeout(function(){ 

					let update_available = document.getElementById('update_available');
					let version_firmware_available = document.getElementById('version_firmware_available');
					let version_dashboard_available = document.getElementById('version_dashboard_available');
					
					if(version_firmware_available) {
						if(!app.encedo_update_firmware) {
							version_firmware_available.innerHTML = '<strong>Up to date. Perfect!</strong>'; 
						} else {
							version_firmware_available.innerHTML = '<span class="name makeAction animatedX buttonCTA" rel="update_firmware">Update now &nbsp; <i class="icon-cogs"></i> </span>';
						};
					};
					
					if(version_dashboard_available) {
						if(!app.encedo_update_dashboard) {
							version_dashboard_available.innerHTML = '<strong>Up to date. Perfect!</strong>';  
						} else {
							version_dashboard_available.innerHTML = '<span class="name makeAction animatedX buttonCTA" rel="update_dashboard">Update now &nbsp; <i class="icon-cogs"></i> </span>'; 
						};
					};
					
					if(app.encedo_update_firmware || app.encedo_update_dashboard) {
						update_available.classList.remove('index');
					} else {
						update_available.classList.add('index');
					};
					 
				}, 300);
			};

		}, function(){
			changePage('error');
		});
	
	};
	
	periodicToConnect = setInterval(checkEncedo, 4000);
	checkEncedo();
	
	function formatBytes(a,b=2,k=1024){with(Math){let d=floor(log(a)/log(k));return 0==a?"0 Bytes":parseFloat((a/pow(k,d)).toFixed(max(0,b)))+" "+["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB"][d]}};
	
	function handleStorage(id, storagePayload) {
		var statuses = { 'rw' : '<i class="icon-lock-open"></i> Unlocked to read and write', 'ro': '<i class="icon-lock-open"></i> Unlocked (read only)', '-': '<i class="icon-lock"></i> Locked and hidden' };
		var disc = storagePayload[id].split(':');
		var html = '<span>Status: <strong class="disk'+id+'_status">'+statuses[disc[1]]+'</strong></span><br><span title="Size in bytes: '+disc[0]+'">Storage size: ' + formatBytes(disc[0]*512, 2) + '</span>';
		
		if(disc[1] && disc[1] == '-') {
			html += `<div class="form-checkbox form-checkbox-inline form-checkbox-10topmargin">
				<label class="form-checkbox-label">
					<input name="agree" class="form-checkbox-field" type="checkbox" id="permWritable${id}">
					<i class="form-checkbox-button"></i>
					<span>With permission to write</span>
				</label>
			</div>`;
			html += '<a class="buttonCTA buttonCTAS makeAction" rel="mobileUnlockDisk'+id+'">Unlock &nbsp; <i class="icon-lock-open"></i></a>';
		} else if(disc[1] && (disc[1] == 'rw' || disc[1] == 'ro')) {
			
			var note = 'With permission to write';
			var withPerms = 'checked="checked"';
			
			if(disc[1] == 'ro') {
				note = 'Without permission to write';
				withPerms = '';
			};
			
			html += `<div class="form-checkbox form-checkbox-inline form-checkbox-10topmargin" style="filter: grayscale(1); opacity: 0.4;">
				<label class="form-checkbox-label" style="cursor: default;">
					<input name="agree" class="form-checkbox-field" type="checkbox" disabled ${withPerms}>
					<i class="form-checkbox-button"></i>
					<span>${note}</span>
				</label>
			</div>`;
			html += '<a class="buttonCTA buttonCTAS makeAction" rel="mobileLockDisk'+id+'">Lock &nbsp; <i class="icon-lock"></i></a>';
		};

		document.getElementById('storage' + id + '_status').innerHTML = html;
	};
	
	var apper = document.getElementById('appContainer');
	var blinds = document.getElementById('blinds');
	var blindsDB = false;
	var blindsCloseButton = document.getElementById('blindsClose');
	var blindsContainer = document.getElementById('blindsContainer');
	var blindsWrapper = document.getElementById('blindsWrapper');
	var blindsStorage = document.getElementById('blindsStorage');
	var blindsTriggerOnClose = false;
	
	function blindsOpen(data, leave) {
		
		if(data) {
			data.after(blindsStorage);
			blindsWrapper.appendChild(data);
			blindsDB = data;
			
			if(data.dataset.onclose) {
				blindsTriggerOnClose = data.dataset.onclose;
			} else {
				blindsTriggerOnClose = false;
			};
		};
		
		apper.classList.add('blurred');
		blinds.classList.add('active');
		
	};
	
	function blindsClose() {
		if(blindsDB) {
			blindsStorage.after(blindsDB);
		};
		if(blindsTriggerOnClose) {
			makeAction(blindsTriggerOnClose);
		};
		apper.classList.remove('blurred');
		blinds.classList.remove('active');
	};
	
	blindsCloseButton.onclick = function(){
		blindsClose();
	};
	
	var curtain = document.getElementById('curtain');
	
	function curtainOpen(memo) {
		if(!memo) {
			curtain.innerHTML = '';
		} else {
			curtain.innerHTML = '<div class="insider">'+memo+'</div>';
		};
		curtain.classList.add('curtain--active');
	};
	
	function curtainClose() {
		curtain.classList.remove('curtain--active');
	};
	
	var mobileAuthMonit = document.getElementById('mobileAuthMonit');
	var mobileAuthByDefault = document.getElementById('mobileAuthByDefault');
	
	register('stopMobileAuth', function(kid, descr){
		tempPairedFirst = false;
		mobileAuthByDefault.classList.add('index');
		Swal.fire({
		  icon: 'success',
		  title: 'Primary mobile authentication has been turned off.',
		  showConfirmButton: false,
		  timer: 2200
		});
	});
	
	register('toggleMobileAuth', function(){
		
		var result = document.querySelector('input[name="mobile_auth_checker"]:checked').value;
		
		if(result == 2) {
			
			tempPairedFirst = false;
			//mobileAuthMonit.classList.add('offliner');
			//mobileAuthMonit.innerHTML = '<span class="name makeAction" rel="toggleMobileAuth">Mobile auth OFF</span>';
			mobileAuthByDefault.classList.add('index');
			Swal.fire({
			  icon: 'success',
			  title: 'Primary mobile authentication has been turned off.',
			  showConfirmButton: false,
			  timer: 2200
			});
			
		} else {
			
			tempPairedFirst = true;
			//mobileAuthMonit.classList.remove('offliner');
			//mobileAuthMonit.innerHTML = '<span class="name makeAction" rel="toggleMobileAuth">Mobile auth ON</span>';
			mobileAuthByDefault.classList.remove('index');
			Swal.fire({
			  icon: 'success',
			  title: 'Primary mobile authentication has been turned on.',
			  showConfirmButton: false,
			  timer: 2200
			});
			
		};
	});
	
	
	/* Consider rewriting it to Promises */
	register('authenticate', function(data){
		
		let authenticate_button = document.getElementById('authenticate_button');
		let authenticate_password = document.getElementById('authenticate_password');
		let authenticate_button_label = document.getElementById('authenticate_button_label');
		
		//authenticate_button.innerHTML = '&nbsp;  <i class="icon-lock-open"></i> &nbsp;';
		
		changeWord(authenticate_button_label, 'Authenticating...');
		
		setTimeout(function(){
			app.auth(data.password, function(result){
				
				if(app.encedo_update_dashboard) {
					changePage('update_dashboard'); 
				} else {
					if(app.encedo_update_firmware) {
						changePage('update'); 
					} else {
						changePage('home'); 
					};
				};
				
				document.getElementById('dashboard_username').innerHTML = result.lbl;
				changeWord(authenticate_button_label, 'Great! We got it!');
			}, function(){
				//authenticate_button.innerHTML = '&nbsp; Something wrong <i class="icon-lock-open"></i> &nbsp;';
				changeWord(authenticate_button_label, 'Something wrong...');
			});
		}, 300);
		
	});
	
	var fields_init_ipaddr = document.getElementById('fields_init_ipaddr');
	var fields_init_hostname = document.getElementById('fields_init_hostname');
	var fields_init_useremail = document.getElementById('fields_init_useremail');
	var fields_init_customprefix = document.getElementById('fields_init_customprefix');
	var fields_init_ipaddr_mandatory = document.getElementById('fields_init_ipaddr_mandatory');
	var fields_init_useremail_mandatory = document.getElementById('fields_init_useremail_mandatory');
	var fields_init_customprefix_textarea = document.getElementById('fields_init_customprefix_textarea');
	
	fields_init_hostname.onchange = function(ev){
		var resultHTML = '<option disabled="" value="" class="form-select-placeholder"></option><option value="192.168.7.1" selected="">192.168.7.1</option>';
		if(fields_init_hostname.value == 'custom') {
			fields_init_ipaddr.disabled = false;
			fields_init_useremail.required = true;
			fields_init_customprefix.required = true;
			fields_init_ipaddr_mandatory.innerHTML = '(customisable)';
			fields_init_useremail_mandatory.innerHTML = '(mandatory)';
			fields_init_customprefix_textarea.classList.remove('index');
			for(i = 8; i < 33; i++) {
				resultHTML += `<option value="192.168.${i}.1">192.168.${i}.1</option>`;
			};
			fields_init_ipaddr.innerHTML = resultHTML;
		} else {
			fields_init_ipaddr.disabled = true;
			fields_init_ipaddr.value = '192.168.7.1';
			fields_init_useremail.required = false;
			fields_init_customprefix.required = false;
			fields_init_ipaddr_mandatory.innerHTML = '(fixed)';
			fields_init_useremail_mandatory.innerHTML = '(optional)';
			fields_init_customprefix_textarea.classList.add('index');
			fields_init_ipaddr.innerHTML = resultHTML;
		};
	};
	
	var gettingStartedInitForm = document.getElementById('gettingStartedInitForm');	
	var layeredStorageEncrSet = [[
			[0x51,0xA1],
			[0x53,0xA3]
		],[
			[0x50,0xA0],
			[0x50,0xA0]
		],
	];
	
	var alreadyPinged = 0;
	var storageAmount = 0;
	var periodicToPing = false;
	var ipsAdded = false;
	var alreadyChangedListOfPrefixes = false;
	var storageDetailsAbout = document.getElementById('storageDetailsAbout');
	var storageDetailsAboutChange = document.getElementById('storageDetailsAboutChange');
	var fields_init_storage_size = document.getElementById('fields_init_storage_size');
	var fields_init_storage_size_change = document.getElementById('fields_init_storage_size_change');
	var status_encedoDevice = document.getElementById('status_encedoDevice');
	var statusDOM = document.getElementById('encedo_init_status');
	var encedo_after_init_status = document.getElementById('encedo_after_init_status');
	var statusDomainDOM = document.getElementById('encedo_init_status_domain');
	
	var encedoInitToken = false;

	register('about', function(){
		
	});
	
	register('beforeStart', function(){
		
	});
	
	register('gettingStarted', function(){
		
		loadClever({ type: 'js', name: 'jspdf.min_v1.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-BSr7kTTTNkWf6o616UenQnGU0ydQv6+ZOBgfWeBrybSPbVqcHgrM6RUSC0cxnhG7' });
		
		loadClever({ type: 'js', name: 'zxcvbn_v4_2_2.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-jhGcGHNZytnBnH1wbEM3KxJYyRDy9Q0QLKjE65xk+aMqXFCdvFuYIjzMWAAWBBtR' });
		
		loadClever({ type: 'js', name: 'qr-code-styling_v1_5_0.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-HlO9KP92M4cZMU3Ly4wp/RuF5f1xzwHEKTZ+KIeOCdNXOVHIMnLwzjYrFdaWc0ix' });
		
		loadClever({ type: 'js', name: 'jsbip39_v1.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-RJEnQkZzL33Qh+Pz8OI5stjVl6ejLqQf32pcMUtNjGddDO+HkKUWRY+RNh9WfwpW' }); 
		
		loadClever({ type: 'js', name: 'wordlist_english_v1.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-njqBv+vTpqAxsnrfa4zGgRb8hwBL2AJgasM059PJh0pmUQuAIlfwr9eYxltq8HH+' }); 
		
		loadClever({ type: 'js', name: 'sjcl-bip39_v1.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-LZJB30TTEi+cEasaZSnXG3bYyNVi9nUnMtjfJKo0usFmVht31nWcT06Jsw9Tvw+m' });
		
		if(app.encedo_type != 'epa') {
		
			if(!alreadyChangedListOfPrefixes) {
				
				alreadyChangedListOfPrefixes = true;
			
				app.api('https://api.encedo.com/domain/predefs').then(function(data){
					var resultHTML = '<option disabled="" value="" class="form-select-placeholder"></option>';
					if(data && data.prefix) {
						var prefixes = data.prefix.reverse();
						for(key in prefixes) {
							var i = prefixes[key];
							if(i == 'my') {
								resultHTML += `<option value="${i}" selected="">${i}.ence.do</option>`;
							} else {
								resultHTML += `<option value="${i}">${i}.ence.do</option>`;
							};
						};
						resultHTML += `<option value="custom">custom prefix</option>`;
					} else {
						resultHTML += `<option value="my" selected="">my.ence.do</option><option value="dev">dev.ence.do</option><option value="devel">devel.ence.do</option><option value="moje">moje.ence.do</option><option value="custom">custom prefix</option>`;
					};
					fields_init_hostname.innerHTML = resultHTML;
				}).catch(function(e){
					
				});
			};
		
		} else {
			var resultHTML = '<option disabled="" value="" class="form-select-placeholder"></option>';
			resultHTML += `<option value="custom">custom prefix</option>`;
			fields_init_hostname.innerHTML = resultHTML;
			fields_init_hostname.onchange();
		};
		
		var totalStorageAmount = 0;
		var availableStorageSize = document.getElementById('availableStorageSize');
		
		if(app.encedo_status.storage) {
			
			if(app.encedo_status.storage[0]) {
				totalStorageAmount += parseInt(app.encedo_status.storage[0].split(':')[0]);
			};
			if(app.encedo_status.storage[1]) {
				totalStorageAmount += parseInt(app.encedo_status.storage[1].split(':')[0]);
			};

			storageAmount = (totalStorageAmount/1024/1024/2);
			fields_init_storage_size.max = Math.floor(storageAmount);
			availableStorageSize.innerHTML = storageAmount.toFixed(2) + 'GB';

			storageDetailsAbout.innerHTML = 'Regular storage size: ' + fields_init_storage_size.value + 'GB';
		} else {
			availableStorageSize.innerHTML = 'No storage.';
			storageDetailsAbout.innerHTML = 'No storage.';
		};
		
	});
	
	fields_init_storage_size.onchange = function(ev) {
		storageDetailsAbout.innerHTML = 'Regular storage size: ' + fields_init_storage_size.value + 'GB';
	};
	
	fields_init_storage_size.oninput = function(ev) {
		storageDetailsAbout.innerHTML = 'Regular storage size: ' + fields_init_storage_size.value + 'GB';
	};
	
	fields_init_storage_size_change.onchange = function(ev) {
		storageDetailsAboutChange.innerHTML = 'Regular storage size: ' + fields_init_storage_size_change.value + 'GB';
	};
	
	fields_init_storage_size_change.oninput = function(ev) {
		storageDetailsAboutChange.innerHTML = 'Regular storage size: ' + fields_init_storage_size_change.value + 'GB';
	};
	
	var lastPrefixCheckup = false;
	var customPrefixCheckerHint = document.getElementById('customPrefixCheckerHint');
	var customPrefixCheckerTimeout = false;
	
	
	function checkPrefixAva() {
		
		clearInterval(customPrefixCheckerTimeout);
		
		customPrefixCheckerTimeout = setInterval(function(){

			let prefix = fields_init_customprefix.value;
			if(prefix != lastPrefixCheckup) {
				
				customPrefixCheckerHint.innerHTML = 'Checking domain availability...';
				
				lastPrefixCheckup = prefix;
				
				app.api('https://api.encedo.com/domain/check/' + prefix).then(function(data) {
					//fields_init_customprefix.setCustomValidity('Domain has already taken. Proceed only if this is your domain and want to restore it with a new device.');
					customPrefixCheckerHint.innerHTML = '<strong>Domain has already taken. Proceed only if this is your domain and want to restore it with a new device.</strong>';
				}).catch(function(e) {
					customPrefixCheckerHint.innerHTML = 'This prefix is free to take. <i class="icon-ok"></i>';
					fields_init_customprefix.setCustomValidity('');
				});

			};
		}, 1000)
		
	};
	
	fields_init_customprefix.addEventListener('keydown', checkPrefixAva); 
	fields_init_customprefix.addEventListener('keyup', checkPrefixAva); 
	fields_init_customprefix.addEventListener('change', checkPrefixAva); 
	fields_init_customprefix.addEventListener('input', checkPrefixAva); 
	
	var hostnameAfterChange = false;
	var workerDomainCheckerID = false;
	var genPDF = false;
	var genPDFPrinted = false;
	var rebootAfterInit = false;
	var alreadyPingedAfterInit = 0;
	var connectionDeviceReadyAfterInit = false;
	var printingButtonAfterInit = document.getElementById('printingButtonAfterInit');
	var startingButtonAfterInit = document.getElementById('startingButtonAfterInit');
	
	function checkEncedoAfterDomainChange() {
		app.ping(function(){
			console.log('connection established after rescue');
			clearInterval(periodicToPing);
			makeCheckinAfterDomainChange();
		}, function(){
			alreadyPinged++;
			console.log('Try number: ' + alreadyPinged);
			console.log('connection fail after rescue');
			if(alreadyPinged == 10) {
				clearInterval(periodicToPing);
				makeCheckinAfterDomainChange();
			};
		});
	};
	
	function makeCheckinAfterDomainChange() {
		
		statusDomainDOM.innerHTML = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span>  &nbsp;  Checking after reboot ...';
		
		app.check(function(update){
			
			statusDomainDOM.innerHTML = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span>  &nbsp;  We ready to goooooo ...';
			
			rebootAfterInit = true;
			tempAfterInit = true;
			
			if(_redirected) {
				document.location.hash = '#devices:' + hostnameAfterChange;
				changePage('devices');
			} else {
				if(hostnameAfterChange != 'my.ence.do') {
					document.location.href = 'https://' + hostnameAfterChange + '/#devices';
				} else {
					changePage('devices');
				};
			};
			
		});
	};
	
	var pdfDataToPopulate = false;
	
	function populatePDFTemplate(data) {
		for(const key in data) {
			var element = document.getElementById('pdf_' + key);
			if(element) element.innerHTML = data[key];
		};
	};
	
	register('start_init', function(){
		
		console.log('Starting with INIT');
		
		var data = {};
		var basicData = false;
		var domainPrefix = fields_init_hostname.value;
		var startingButtonAfterInit = document.getElementById('startingButtonAfterInit');
		
		data.userid = document.getElementById('fields_init_userid').value;
		data.useremail = document.getElementById('fields_init_useremail').value;
		if(domainPrefix == 'custom') {
			data.gen_csr = true;
			data.hostname = fields_init_customprefix.value + '.ence.do';
		} else {
			data.gen_csr = false;
			data.hostname = domainPrefix + '.ence.do';
		};
		if(fields_init_ipaddr && fields_init_ipaddr.length > 6) {
			data.ipaddr = fields_init_ipaddr.value + '/24';
		} else {
			data.ipaddr = '192.168.7.1/24';
		};
		data.passU = document.getElementById('fields_init_pass').value;
		
		tmpCache = data.passU;
		
		data.storage_disk0size = fields_init_storage_size.value*2097152;
		
		var serialized = serialize(gettingStartedInitForm);

		data.storage_mode = layeredStorageEncrSet[parseInt(serialized.fields_init_show_disk)-1][parseInt(serialized.fields_init_disk_mode)-1][parseInt(serialized.fields_init_encryption_mode)-1];
		
		if(serialized.fields_init_trust_time && serialized.fields_init_trust_time == '1') {
			data.trusted_ts = true;
		} else {
			data.trusted_ts = false;
		};
		
		if(serialized.fields_init_allow_remote && serialized.fields_init_allow_remote == '1') {
			data.trusted_backend = true;
		} else {
			data.trusted_backend = false;
		};
		
		if(serialized.fields_init_allow_keysearch && serialized.fields_init_allow_keysearch == '1') {
			data.allow_keysearch = true;
		} else {
			data.allow_keysearch = false;
		};
		
		basicData = data;
		
		hostnameAfterChange = data.hostname;
		
		statusDOM.innerHTML = 'Initialising process has started and is working ...';
		
		changePage('initialisationPage');
		
		app.init(data, statusDOM, function(result, words, token){
			
			console.log('Inside INIT');
			
			app.jwt_token = token;
			
			encedoInitToken = result.token;
			
			var result = result;
			var result2 = result;
			
			app.api('api/system/config').then(function(data){
				
				app.log(data);
				
				app.encedo_config = data;

				document.getElementById("init_words_result").innerHTML = words;
				document.getElementById("init_hostname_result").innerHTML = data.hostname;
				document.getElementById("init_instanceid_result").innerHTML = result.instanceid;
				
				const now = new Date();
				
				pdfDataToPopulate = { issued: now.toISOString(), instanceid: result.instanceid, hostname: data.hostname, words: words, user: data.user + (data.email.length > 2 ? ' (' + data.email + ')': ''), hardware: app.encedo_version_hardware, firmware: app.encedo_version_firmware, devid: app.encedo_config.devid, eid: app.encedo_config.eid, eid_sign: app.encedo_config.eid_sign, settings: 'Trust Encedo time source: ' + (basicData.trusted_ts ? 'Yes' : 'No') + ' / Allow remote managment: ' + (basicData.trusted_backend ? 'Yes' : 'No') + ' / Allow keysearch by description: ' + (basicData.allow_keysearch ? 'Yes' : 'No') };
				
				populatePDFTemplate(pdfDataToPopulate);
				genPDF = generatePDF2(words);
					
				if(domainPrefix == 'custom') {
					
					startingButtonAfterInit.innerHTML = ' &nbsp; Start with domain setup <i class="icon-angle-right"></i> &nbsp;';
					startingButtonAfterInit.classList.add('makeAction');
					startingButtonAfterInit.classList.remove('changePage');
					startingButtonAfterInit.attributes.rel.value = 'checkDomainAfterInit';
					
					let registerPayload = { genuine: result.genuine, csr: result.csr, ip: fields_init_ipaddr.value };
					
					if(app.encedo_type == 'epa') {
						registerPayload = { genuine: 'EPA:GenuineToken', csr: result.csr, cname: _redirectedAddressRaw };
					};
					
					app.api('https://api.encedo.com/domain/register/' + fields_init_customprefix.value, 'POST', registerPayload).then(function(data2){
						
						if(data2) {
							
							app.jwt_token = result.token;
							workerDomainCheckerID = data2.id;
							app.api('api/system/config', 'POST', { tls: data2 } ).then(function(data3){
						
								if(data3) {
									
									statusDOM.innerHTML = 'Preparing device ...';
										
									var checkDeviceReadyAfterInitWrapper = function(){
										checkDeviceReadyAfterInit(function(){
											makeAction('checkDomainAfterInit');
										}, function(){
											statusDOM.innerHTML = 'Error while waiting for device to be ready ...';
										});
									};
									
									clearTimeout(connectionDeviceReadyAfterInit);
									connectionDeviceReadyAfterInit = setInterval(checkDeviceReadyAfterInitWrapper, 3000);
									
								} else {
									initRollback(result.token, 1);
									console.log('After Cert fail');
								};
								
							});
							
						} else {
							
							initRollback(result.token, 2);
							console.log('Cert atest fail');
							app.error(error);
							
						};
						
					}).catch(function(error){
						
						initRollback(result.token, 3);
						console.log('Cert atest fail');
						app.error(error);
					});
					
				} else {
					
					app.api('https://api.encedo.com/domain/register/' + domainPrefix, 'POST', { genuine: (result.genuine ? result.genuine : app.encedo_authinit.genuine) })
					.then(function(data2){
						
						if(data2) {

							app.jwt_token = result.token;
							
							app.api('api/system/config', 'POST', { tls: data2 } ).then(function(){
								
								statusDOM.innerHTML = 'Preparing device ...';
							
								var checkDeviceReadyAfterInitWrapper = function(){
									checkDeviceReadyAfterInit(function(){
										changePage('tutorial');
									}, function(){
										statusDOM.innerHTML = 'Error while waiting for device to be ready ...';
									});
								};
								
								connectionDeviceReadyAfterInit = setInterval(checkDeviceReadyAfterInitWrapper, 3000);
								
							}).catch(function(error){
								
								app.jwt_token = result.token;
								initRollback(result.token, 4);

								console.log('Cert atest fail 2');
								app.error(error);
								
							});
						
						} else {
							console.log('After Cert fail');
						};
						
					}).catch(function(error){
						
						app.jwt_token = result.token;
						initRollback(result.token, 5);

						console.log('Cert atest fail');
						app.error(error);
						
					});

				};
				
			}).catch(function(error) {
				
				initRollback(result.token, 6);
				app.error(error);
				
			});

		
		}, function(error){
			
			initRollback(false, 7);
			console.log('Inside INIT FAILED!');
			app.error(error);
			
		});
		
	});

	function checkDeviceReadyAfterInit(func, fail) {
		app.ping(function(data){
			
			if(app.encedo_type == 'epa') {
				console.log('Device is ready to use and reboot.');
				clearInterval(connectionDeviceReadyAfterInit);
				if(func) func();
			} else {
				if(data.format) {
					if(data.format == 'done') {
						console.log('Device is ready to use and reboot.');
						clearInterval(connectionDeviceReadyAfterInit);
						if(func) func();
					};
				} else {
					console.log('Device is ready to use.');
					clearInterval(connectionDeviceReadyAfterInit);
					if(func) func();
				};
			};
			
		}, function(){
			
			alreadyPingedAfterInit++;
			console.log('Connection to Encedo failed');
			console.log('Try number: ' + alreadyPinged);
			if(alreadyPingedAfterInit == 8) {
				initRollback(false, 8);
				clearInterval(connectionDeviceReadyAfterInit);
				if(fail) fail();
			};
			
		});
	};
	
	function checkDeviceReadyAfterInitOLD(func, fail) {
		app.ping(function(data){
			
			if(data.format && data.format == 'done') {
				console.log('Device is ready to use and reboot.');
				clearInterval(connectionDeviceReadyAfterInit);
				if(func) func();
			}
			
		}, function(){
			
			alreadyPingedAfterInit++;
			console.log('Connection to Encedo failed');
			console.log('Try number: ' + alreadyPinged);
			if(alreadyPingedAfterInit == 8) {
				initRollback(false, 8);
				clearInterval(connectionDeviceReadyAfterInit);
				if(fail) fail();
			};
			
		});
	};
	
	var connectionCheckupAfterWipeout = false;
	
	function checkConnectionAfterWipeout() {
		app.ping(function(){
			console.log('Connection with Encedo established!');
			clearInterval(connectionCheckupAfterWipeout);
			app.check(function(){

				changePage('initialisationError');
				
			}, function(){
				checkConnectionAfterWipeout();
			});		
		}, function(){
			alreadyPinged++;
			console.log('Connection to Encedo failed');
			console.log('Try number: ' + alreadyPinged);
			if(alreadyPinged == 8) {
				clearInterval(connectionCheckupAfterWipeout);
			};
		});
	};
	
	function initRollback(token, id) {
		
		if(encedoInitToken) {
			app.jwt_token = encedoInitToken;
		} else {
			console.log('Rollback failed because of lack of token on stage: ' + id);
			return false;
		};
		
		console.log('Rollback with wipeout with ID: ' + id);
		
		app.wipeout(function(result){
			alreadyPinged = 0;
			setTimeout(function(){ 
			
				app.jwt_token = '';
				connectionCheckupAfterWipeout = setInterval(checkConnectionAfterWipeout, 4000);
				
			}, 8000);
		});
	};
	
	register('tutorial2', function(){
		populatePDFTemplate(pdfDataToPopulate);
		doc = generatePDF2('test test23 test3', true);
		genPDFPrinted = true;
		changePage('tutorial');
	});
	
	function handleCopyTextFromParagraph(content, element) {
	  const cb = navigator.clipboard;
	  const paragraph = document.createElement('p');
	  paragraph.innerHTML = content;
	  cb.writeText(paragraph.innerText).then(function(){
		  if(element) {
			  element.innerHTML = '<i class="icon-ok"></i> Copied';
			  setTimeout(function(){
				  element.innerHTML = '<i class="icon-clone"></i> Copy';
			  }, 5000);
		  }
	  });
	};
	
	function releaseStartButton() {
		if(genPDFPrinted) {
			if(hostnameAfterChange != 'my.ence.do') {
				startingButtonAfterInit.innerHTML = ' &nbsp; Next step <i class="icon-angle-right"></i> &nbsp;';
				startingButtonAfterInit.classList.add('makeAction');
				startingButtonAfterInit.classList.remove('changePage');
				startingButtonAfterInit.attributes.rel.value = 'refreshAfterInit';
			} else {
				tempAfterInit = true;
				startingButtonAfterInit.innerHTML = ' &nbsp; Start using Encedo <i class="icon-angle-right"></i> &nbsp;';
				startingButtonAfterInit.classList.add('changePage');
				startingButtonAfterInit.classList.remove('makeAction');
				startingButtonAfterInit.attributes.rel.value = 'devices';
			};
			startingButtonAfterInit.classList.remove('buttonCTAG');
			startingButtonAfterInit.classList.remove('buttonCTAC');
			printingButtonAfterInit.classList.add('buttonCTAG');
		};
	};
	
	register('clipboardCopy', function(id){
		var source = document.getElementById(id);
		if(source) {
			handleCopyTextFromParagraph(source.innerText, lastActiveActionTrigger);
		};
	});
	
	register('printMePlease', function(){
		populatePDFTemplate(pdfDataToPopulate);
		doc = generatePDF2('sample', true);
		genPDFPrinted = true;
		
		menuAfterInit.classList.remove('deader');
		menuBeforeInit.classList.add('deader');
		
		printingButtonAfterInit.innerHTML = ' &nbsp; Printing ... &nbsp; <i class="icon-angle-up"></i> &nbsp;';
					
		setTimeout(function(){ 
			releaseStartButton();
			printingButtonAfterInit.innerHTML = ' &nbsp; Print &nbsp; <i class="icon-angle-up"></i> &nbsp;';
		}, 3500);
		
	});
	
	function registerDomain(data) {
		app.api('api/system/config', 'POST', { tls: data} ).then(function(data){
			//makeAction('refreshAfterInit');
			changePage('tutorial');
		}).catch(function(e){ 
			initRollback(false, 12);
		});
	};
	
	var howManyChecksAfterInit = 0;
	
	register('checkDomainAfterInit', function(){
		
		changePage('domainSetupPage');
		
		statusDomainDOM.innerHTML = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span>  &nbsp;  Waiting for email confirmation. Check your inbox now!';
		
		clearInterval(periodicToPing);
		
		howManyChecksAfterInit = 0;
					
		periodicToPing = setInterval(function(){
			
			howManyChecksAfterInit++;
			
			if(howManyChecksAfterInit > 60) {
				
				clearInterval(periodicToPing);
				initRollback(false, 14);
				howManyChecksAfterInit = 0;
				
			} else {
			
				app.api('https://api.encedo.com/domain/register/' + workerDomainCheckerID).then(function(data){
					
					if(data && data.status && data.status == "email_confirmed") {
						statusDomainDOM.innerHTML = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span>  &nbsp; Confirmed! Now we are preparing your device to be ready... ';
					};

					if(data && data.status && data.status == "done") {
						clearInterval(periodicToPing);
						registerDomain(data);
					};
					
					if(data && data.status && data.status == "failed") {
						clearInterval(periodicToPing);
						initRollback(false, 13);
					};
					
				}).catch(function(e){ 
					if(howManyChecksAfterInit > 2) {
						clearInterval(periodicToPing);
						initRollback(false, 14);
					};
				});
			
			}
			
		}, 4000);
		
	});
	
	register('refreshAfterInit', function(){
		
		changePage('devicePreparingAfterInit');
		
		encedo_after_init_status.innerHTML = 'Please wait few seconds ...';
		
		if(hostnameAfterChange != 'my.ence.do') {
					
			encedo_after_init_status.innerHTML = 'Encedo is rebooting ...';
			app.reboot();
			
			setTimeout(function(){ 
						
				app.url('https://' + hostnameAfterChange);
				_startingURL = 'https://' + hostnameAfterChange;
				
				if(_redirected) {
					document.location.hash = '#devices:' + hostnameAfterChange;
					_redirectedAddressRaw = hostnameAfterChange;
				};
				
				checkEncedoAfterDomainChange();
			
				alreadyPinged = 0;
				periodicToPing = setInterval(checkEncedoAfterDomainChange, 5000);
					
				encedo_after_init_status.innerHTML = 'Checking after reboot ...';
			}, 12900);
		
		} else {
			tempAfterInit = true;
			rebootAfterInit = true;
		};
		
	});
	
	var tokensStatusContainer = document.getElementById('tokensStatusContainer');
	var hardwareStatusContainer = document.getElementById('hardwareStatusContainer');
	var healthCheckStatus = document.getElementById('healthCheckStatus');
	var healthCheckNames = {
		last_selftest_ts: 'Last selftest time',
		selftest_ts: 'Current selftest time',
		last_fls_state: 'Last selftest result',
		last_entropytest_ts: 'Last entropy test',
		kat_busy: 'Known Answer Test',
		last_kat_ts: 'Last Known Answer Test',
		fls_state: 'Fail state status',
		se_state: 'Selftest status'
	};
	
	function printTokenStatus() {
		var found = false;
		var result = '<table class="table animatedX moved" width="100%" cellspacing="5" cellpadding="5"><thead><tr><td><strong>User</strong></td><td><strong>Scope</strong></td><td><strong>Valid to</strong></td><td><strong></strong></td><td></td></tr></thead><tbody>';
		
		for(let key in app.tokens) {
			
			var val = app.tokens[key];
			var validto = 'Unknown';
			var uptime = 'Unknown';
			var uptime_formatted = 'Unknown';
			
			if(app.encedo_time_offset && val.exp > 0) {
				validto = (new Date(val.exp*1000 + app.encedo_time_offset*1000).toISOString()).toString().replace('T', ' ').replace('Z', '').substr(0, 19);
			};
			
			if(val.exp) {
				uptime = val.exp * 1000 - app.encedo_time - app.encedo_time_offset*1000 - 5000;
				uptime_formatted = new Date(uptime).toISOString().substr(11, 8);
			};

			var sub = (val.sub ? val.sub : '?');

			result += `<tr><td><strong>${sub}</strong></td><td>${key}</td><td>${validto}</td><td>${uptime_formatted}</td><td><a class="specialLink makeAction" rel="removeToken/${key}"><i class="icon-cancel"></i> Remove</a></td></tr>`;
			found = true;
		};
		result += '</tbody></table>';
		if(!found) result = '<p>There are no scope tokens in this session yet.</p>';
		tokensStatusContainer.innerHTML = result;
	};
	
	function printHardwareStatus(data) {
		var result = '<table class="table animatedX moved" width="100%" cellspacing="5" cellpadding="5">';
		for(let key in data) {
			var val = data[key];
			result += `<tr><td>${key}</td><td>${val}</td></tr>`;
		};
		result += '</table>';
		hardwareStatusContainer.innerHTML = result;
	};
	
	function healthCheckStatusPrint(data) {
		var result = '<table class="table animatedX moved" width="100%" cellspacing="5" cellpadding="5">';
		for(let key in data) {
			var val = data[key];
			if(key == 'kat_busy') {
				val = (data[key] ? 'is performing right now...' : 'Done');
			} else if(key.indexOf('_ts') != -1) {
				if(val > 0) {
					val = (new Date(val*1000).toISOString()).toString().replace('T', ' ').replace('Z', '').replace('.000', '');
				} else {
					val = 'Unknown';
				}
			} else {
				val = (val == 0 ? 'OK: no errors found' : 'Error: ' + val);
			};
			
			if(healthCheckNames[key]) key = healthCheckNames[key];
			
			result += `<tr><td>${key}</td><td>${val}</td></tr>`;
		};
		result += '</table><br><br>';
		return result;
	};
	
	
	function printHardwareStatus(data) {
		var result = '<table class="table animatedX moved" width="100%" cellspacing="5" cellpadding="5">';
		for(let key in data) {
			var val = data[key];
			result += `<tr><td>${key}</td><td>${val}</td></tr>`;
		};
		result += '</table>';
		hardwareStatusContainer.innerHTML = result;
	};
	
	register('removeToken', function(tokenID){
		if(tokenID) {
			for(let key in app.tokens) {
				if(key == tokenID) {
					app.tokens[key] = false;
					delete app.tokens[key];
				};
			};
		};
		printTokenStatus();
	});
	
	register('refreshScopesInfo', function(){
		checkConnection();
		printTokenStatus();
	});
	
	register('hardware', function(){	
		checkConnection();
		printTokenStatus();
		app.api('api/system/version').then(function(data){
			printHardwareStatus(data);
		}).catch(function(e) {
			app.error(e);
		});
	});
	
	register('update', function(){
		refreshVersion();
	});
	
	register('updateCFG', function(){
		var pass = prompt('Type your password here');
		if(pass) {
			app.updateCfg(pass);
		}
	});
	
	register('updateTLS', function(){
		app.updateTLS();
	});
	
	register('update_firmware_page', function(){
		//dashb.notify('Quisque id iaculis arcu, at tristique arcu', 'Nunc condimentum nibh eu felis posuere ultrices.');
	});
	
	var simulate_date = false;
	
	/* Pairing is one-way job in this scenario so making it with a Promise is not neccessary */
	register('blinds1', function(data){
		var blinderTester = document.getElementById('blinderTester');
		blindsOpen(blinderTester);
	});
	
	register('blinds2', function(data){
		var blinderTester = document.getElementById('blinderTester');
		blindsOpen(blinderTester);
	});
	
	var pairingTimerHandler = false;
	
	register('cleanQR', function(data){
		var label = document.getElementById('qrcode_information');
		var placer = document.getElementById("qrcode_placer");
		label.innerHTML = '';
		placer.innerHTML = '';
		if(pairingTimerHandler) clearInterval(pairingTimerHandler);
	});
	
	register('pairdeviceNow', function(data){
		
		confirmX(function(passik){
			
			curtainOpen('<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Password checking ... ');
			
			app.scoped('system:config', function(status, data){
				
				if(status) {
					
					curtainOpen('<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Generating QR Code in progresss... ');

					app.api('api/system/config').then(function(data) {
						
						app.pair(function(data, user, req){
				
							app.log(data);
							app.log('---');
							app.log(user);
							app.log('---');
							var hash = CryptoJS.SHA256(req);
							//app.log(hash);
							//app.log(hash.toString(CryptoJS.enc.Base64));
							
							var result = { link: data.link, hash: hash.toString(CryptoJS.enc.Base64), user: user.user, email: user.email, hostname: user.hostname };
							simulate_date = result;

							var textToGenerate = JSON.stringify(result);

							const qrCode = new QRCodeStyling({
								width: 600,
								height: 600,
								data: textToGenerate,
								image: "assets/img/apple-touch-icon.png",
								dotsOptions: {
									color: "#404B7C",
									type: "rounded"
								},
								backgroundOptions: {
									color: "#ffffff",
								},
								imageOptions: {
									crossOrigin: "anonymous",
									margin: 10
								}
							});
							

							var timerNow = 60;
							var label = document.getElementById('qrcode_information');
							var placer = document.getElementById("qrcode_placer");
							var qrcode_handler = document.getElementById('qrcode_handler');
							
							label.innerHTML = 'Generating QR Code...';
							
							qrCode.append(placer);
		
							blindsOpen(qrcode_handler);
							
							curtainClose();
							
							pairingTimerHandler = setInterval(function() {
								
								label.innerHTML = 'You have ' + timerNow + ' seconds to scan this QR Code.';
								timerNow--;
								
								if(timerNow % 4 == 0) {
									var rid = data.rid;
									app.api('https://api.encedo.com/notify/register/check/' + rid)
									.then(function(data){
										
										if(data && data.reply) {
											
											clearInterval(pairingTimerHandler);
											placer.innerHTML = '';
											label.innerHTML = '';
									
											app.api('api/auth/ext/validate', 'POST', data )
											.then(function(datad){
												
												app.api('https://api.encedo.com/notify/register/finalise/' + rid, 'POST', datad)
												.then(function(data){
													console.log('Device paired with success!');
													tempPaired = true;
													checkConnection();
													getDevices();
													blindsClose();
													curtainClose();
													inform(true, 'Yaaay! Device has been paired!');
													
												}).catch(function(e) {
													getDevices();
													blindsClose();
													curtainClose();
													inform(false, 'Problem while trying to pair a device', 'Please try again later. 1');
													app.error(e);
												});
												
											}).catch(function(e) {
												getDevices();
												blindsClose();
												curtainClose();
												inform(false, 'Problem while trying to pair a device', 'Please try again later. 1');
												app.error(e);
											});
											
										}
									}).catch(function(e) {
										console.log(e);
										getDevices();
										blindsClose();
										curtainClose();
										if(e && e.status > 0) {
											if(e.status == 410) {
												inform(false, 'Pairing denied by mobile app');
											} else {
												inform(false, 'Problem while trying to pair a device.', 'Please try again later.');
											};
										};
										
										app.error(e);
									});
								};
								
								if(timerNow < 0) {
									clearInterval(pairingTimerHandler);
									placer.innerHTML = '';
									label.innerHTML = '';
									blindsClose();
									curtainClose();
									inform(false, 'Code has expired.', 'Please try again.');
									
								};
								
							}, 1000);
							
						}, function(e){
							
							blindsClose();
							curtainClose();
							
							if(e && e.status == 401) {
								inform(false, 'Password is incorrect. Please try again.');
								tmpCache = false;
							} else {
								inform(false, 'Problem while trying to pair a device', 'Please try again later.');
							};
							
						}); 
						
						
					}).catch(function(e) {
						
						blindsClose();
						curtainClose();
						
						if(e && e.status == 401) {
							inform(false, 'Password is incorrect. Please try again.');
							tmpCache = false;
						} else {
							inform(false, 'Problem while trying to pair a device', 'Please try again later.');
						};
						
					});
				
				} else {
					
					blindsClose();
					curtainClose();
					inform(false, 'Password is incorrect. Please try again.');
					tmpCache = false;
					
				};

			}, false, false, passik, true);
			
			
		}, false, 'device:pair');
		

		
	});
	
	register('simulatepair', function(data){
		// Only for simulatin purposes, not used in final application

		app.api(simulate_date.link).then(function(data){
			
			var parsed = app.parseJwt(data.request);
			
			var array = new Uint8Array(32);
			window.crypto.getRandomValues(array);
			var aid_key = nacl.box.keyPair.fromSecretKey( array );
			
			var fid = "token Firebase";
			var label = "Nazwa telefonu";
			var reply = genReply(parsed, aid_key, label, fid);
			
			return app.api(simulate_date.link, 'POST', reply)
			.then(function(data){
				
			}).catch(function(e) {
				app.error(e);
			});
		}).catch(function(e) {
			app.error(e);
		});
	});	
	
	function genReply(request_payload, aid_key_raw, label, fid) {
  
		var jti = request_payload.jti;
		var eat = request_payload.eat;
		var eid = request_payload.iss;
		var epk = request_payload.aud;
		
		//generate JWT
		var remote_pub = new Uint8Array( FromBase64(eid) );
		var jwt_secret_base64 = ToBase64( nacl.scalarMult(aid_key_raw.private, remote_pub) );

		var data = {
		  "jti": jti,
		  "eat": eat,
		  "iss": ToBase64(aid_key_raw.public),
		  "aud": eid,
		  "epk": epk,
		  "label": label
		};
		
		var header = { 
		  "ecdh": "x25519"
		};

		var jwt = jwt_generate_hs256(header, data, CryptoJS.enc.Base64.parse(jwt_secret_base64));  

		//generate MAC
		var remote_pub2 = new Uint8Array( FromBase64(epk) );
		var secret_base64 = ToBase64( nacl.scalarMult(aid_key_raw.private, remote_pub2) );

		var mac = CryptoJS.enc.Base64.stringify( CryptoJS.HmacSHA256(jwt + fid, CryptoJS.enc.Base64.parse(secret_base64)) );
		
		var reply_array = { 
		  "reply": jwt,
		  "fid": fid,
		  "mac": mac,
		  "aid": ToBase64(aid_key_raw.public)
		};
		  
		return reply_array;
	};
	
	function performHealthCheck() {
		healthCheckStatus.innerHTML = '<h2>Starting health check ... </h2>';
		app.api('api/system/selftest').then(function(data){
			
			if(data && data.fls_state && data.fls_state > 0) {
			
				healthCheckStatus.innerHTML = '<h2 style="color: #cc0000 !important;"><i class="icon-fire"></i> Houston, we have a problem!</h2>';
			
			} else {
				
				healthCheckStatus.innerHTML = '<h2><i class="icon-ok"></i> Encedo device is in perfect condition!</h2>';
				
			};
			
			healthCheckStatus.classList.remove('index');
			healthCheckStatus.innerHTML += healthCheckStatusPrint(data);
			
		}).catch(function(e) {
			healthCheckStatus.innerHTML = '<h2><i class="icon-cancel"></i> Some error occured. Please try again or contact tech support.</h2>';
			app.error(e);
		});
	};
	
	
	register('healthCheck', function(data){

		var tokenFound = false;
		for(let key in app.tokens) {
			if(app.tokens[key] && app.tokens[key].token && app.tokens[key].exp*1000 - app.encedo_time - app.encedo_time_offset*1000 > 5000) {
				tokenFound = true;
				app.jwt_token = app.tokens[key].token;
			};
		};

		if(tokenFound || tempAfterInit === false) {
			performHealthCheck();
		} else {
			perform('system:config', false, function(status, data){
			
				if(status) {
					performHealthCheck();
				};
				
			}, false, false);
		};
		
	});
	
	
	var alreadyLogs = [];
	var consoleApp = document.getElementById('consoleApp');
	var consoleDetails = document.getElementById('consoleDetails');
	var consoleDetailsRaw = document.getElementById('consoleDetailsRaw');
	
	var logger_results = [
		'<i class="icon-ok"></i>',
		'<i class="icon-cancel"></i>',
		'<i class="icon-fire"></i>'
	];
	var logger_results_names = [
		'OK    ',
		'ERROR ',
		'FAIL  '
	];
	var logger_types = [
		['Log integrity key created', false],
		['System power up', false],
		['System rebooted', false],
		['System shutdown', false],
		['Firmware/Software upgraded', false],
		['Entropy test failed', false],
		['TLS connection error', 'RAW'],
		['Self-Test passed', false],
		['Entered not-secure state', false],
		['Log files listed', false],
		['Deleted log file', false],
		['Read log file (%)', 'LOG'],
		['Access scope check failed for %', 'RAW'],
		['Access token created - password auth for %', 'RAW'],
		['Access token created - mobile auth for %', 'RAW'],
		['New mobile device paired (KID: %)', 'KID'],
		['-', false],
		['-', false],
		['Configuration updated', false],
		['Real-time clock time set (%)', 'TIME'],
		['New key generated (KID: %)', 'KID'],
		['Key deleted (KID: %)', 'KID'],
		['Public key imported (KID: %)', 'KID'],
		['Key access token created (KID: %)', 'KID'],
		['Key integrity check failed (KID: %)', 'CODE'],
		['Key attributes changed (KID: %)', 'KID'],
		['New key derived (KID: %)', 'KID'],
		['-', false],
		['-', false],
		['Device personalized', false],
		['HASH operation performed (%)', 'KID'],
		['HASH verify performed (%)', 'KID'],
		['ExDSA signature created (%)', 'KID'],
		['ExDSA signature verified (%)', 'KID'],
		['Key WRAP performed (%)', 'KID'],
		['Key UNWRAP performed (%)', 'KID'],
		['Data encrypted (%)', 'KID'],
		['Data decrypted (%)', 'KID'],
		['ECDH operation performed (%)', 'KID']
	];
	
	function get_log_added(key) {
		let epoch = parseInt(key, 16);
		let epoch_formatted = new Date(epoch*1000).toISOString().substr(0, 19).replace('Z', ' ').replace('T', ' ');
		if(epoch < 10000) {
			epoch_formatted = '-';
		};
		let element = { lid: key, epoch: epoch, when: epoch_formatted };
		alreadyLogs[element.lid] = element;
	};
	
	function get_logger(page) {
		
		if(!page) page = 1;
		
		perform('logger:get', false, function(status, data){
			
			if(status) {
				
				if(app.encedo_type != 'epa') {
				
					let offset = '';
					
					if(page > 1) {
						offset = '/' + (120*(page-1));
					};
					
					app.api('api/logger/list' + offset).then(function(data){
						
						for(key of data.id) {
							get_log_added(key);
						};
						
						if(data.total > page*120) {
							get_logger((page+1));
						} else {
							print_logger();
						};

					}).catch(function(e) {
						app.error(e);
					});
					
				} else {
					
					app.api('api/logger/key').then(function(data){
						console.log(data);
						
						let key = data.key;
						let nonce = data.nonce;
						let nonce_signed = data.nonce_signed;
						
						consoleApp.innerHTML = `<br><p class="animatedX moved specialCode fulled"><span class="desc">Key:</span> <strong id="consolelog_logger_key">${key}</strong><span class="copy copyThis makeAction" rel="clipboardCopy/consolelog_logger_key"><i class="icon-clone"></i> Copy</span></p>`;
						
						var consoleLogProgress = document.querySelectorAll('.consoleLogProgress');
						consoleLogProgress.forEach(function(item){
							item.innerHTML = ``;
						});

					}).catch(function(e) {
						app.error(e);
					});
					
				};
			
			};
	
		}, '.consoleLogProgress', 'Please choose log file to read');
	};
	
	function print_logger() {
		
		//alreadyLogs.sort((a, b) => (a.epoch > b.epoch) ? 1 : -1);
		
		var resultHTML = '<table class="table animatedX moved" width="100%" cellspacing="5" cellpadding="5"><thead><tr><td width="1%"><strong>No</strong></td><td width="91%"><strong>Date</strong></td><td width="1%"><strong></strong></td><td width="1%"><strong></strong></td></tr></thead><tbody>';
		
		var i = 1;
		
		for(key in alreadyLogs) {
			
			let el = alreadyLogs[key];
			
			resultHTML += `<tr><td>${i}</td><td>${el.when}</td><td class="nowrap"><a class="animatedX moved makeAction specialLink" rel="openLogFile/${el.lid}"><i class="icon-info-circled"></i> Details</a></td><td class="nowrap"><a class="animatedX moved makeAction specialLink" rel="exportLogFile/${el.lid}"><i class="icon-download"></i> Download</a></td></tr>`;
			
			i++;
			
		};
		
		consoleApp.innerHTML = resultHTML + '</table>';
		
		let elements = document.querySelectorAll('.consoleLogProgress');
		elements.forEach(function(userItem) {
			userItem.innerHTML = 'List is ready and listed below.';
		});		
		
	};
	
	function base64url_decode(data) {	
		let result = false;
		try {
			result = atob(str_pad(strtr(data, '-_', '+/'), (data.length % 4), '=', 'STR_PAD_RIGHT'));
		} catch(error) {
		};
        return result;
	};
	
	function strncmp (str1, str2, lgth) {
	  const s1 = (str1 + '').substr(0, lgth);
	  const s2 = (str2 + '').substr(0, lgth);
	  return ((s1 === s2) ? 0 : ((s1 > s2) ? 1 : -1));
	};
	
	function compare(a, b) {
	  for (let i = a.length; -1 < i; i -= 1) {
		if ((a[i] !== b[i])) return false;
	  }
	  return true;
	};
	
	function ab2str(buf) {
	  return String.fromCharCode.apply(null, new Uint16Array(buf));
	};
	
	function check_log_integrity(sign_key, data){
		
		let log_array = data.split("\n");

        let keyS = '';
        let cnt = 0;
		
		for (ident in log_array) {
			
			let line = log_array[ident];
			
			if(!line || line[0] == '#' || line.length < 3) {
				continue;
			};
			
			let splitter = line.split('|');
			let tmpCounter = parseInt(splitter[0], 16);
			
			if ((splitter[2] == 0) && (splitter[3] == 0)) {
				keyS = splitter[4];
				let nonce = new Uint8Array( FromBase64( keyS.replace(/_/g, '/').replace(/-/g, '+') ) );
				let signa = splitter[5];
				let nonce_signed = new Uint8Array( FromBase64( signa.replace(/_/g, '/').replace(/-/g, '+') ) );

				let edkey = new Uint8Array( FromBase64( sign_key ));
				let test = nacl.sign.detached.verify(nonce, nonce_signed, edkey );
				app.log('log_sign: ' + test);
				if (test == false) {
					return false;
				};
				cnt = tmpCounter;
			};

			if ((tmpCounter != cnt+1) && (tmpCounter != cnt)) {
				app.log('Lines are corrupted: tmp: ' + tmpCounter + ', cnt: ' + cnt);
				return false;
			};
			
			cnt = tmpCounter;
			
			var cutoff = line.lastIndexOf('|')+1;
			var msg = line.substr(0, cutoff);
			var hmacS = line.substr(cutoff);
			var hmac = new Uint8Array( FromBase64( hmacS.replace(/_/g, '/').replace(/-/g, '+') ) );
			
			var key = CryptoJS.enc.Base64.parse( keyS.replace(/_/g, '/').replace(/-/g, '+') );
			var h = fromWordArray( CryptoJS.HmacSHA256(msg, key ) ).subarray(0, 16);
			
			if (ab2str(hmac) != ab2str(h)) {
				app.log('HMAC failed at line: ' + cnt);
				return false;
			};
        };

        return true;
	};
	
	function reverseString(str) {
	  let reversedString = ''
	  for (let i = str.length - 1; i >= 0; i--) {
		reversedString += str[i]
	  }
	  return reversedString;
	};
	
	function parse_logger(id, data) {
		
		let ids = parseInt(id, 16);
		let ids_formatted = new Date(ids*1000).toISOString().substr(0, 19).replace('Z', ' ').replace('T', ' ');
		
		var resultHTML = '<br><p><a class="buttonCTA animatedX moved makeAction" rel="exportLogFilePDF/'+id+'"> Print in PDF &nbsp; <i class="icon-download"></i> </a></p><br><table class="table table animatedX moved" width="100%" cellspacing="5" cellpadding="5" id="consoleDetailsTable"><thead><tr><td><strong>No</strong></td><td><strong>Date</strong></td><td><strong>Type of event</strong></td><td><strong>Result</strong></td><td><strong>Subject</strong></td></tr></thead><tbody>';
		
		var resultRAW = '<h2 style="font-size: 220%;">Operation log details</h2><h3>Session timestamp: '+ids_formatted+'</h3>';
		
		let lines = data.split("\n");
		
		for (key in lines) {
			
			let line = lines[key];
			if(!line || line[0] == '#' || line.length < 3) {
				continue;
			};
			
			let el = line.split('|');
			let no = parseInt(el[0], 16);
			
			let epoch = parseInt(el[1], 16);
			let epoch_formatted = new Date(epoch*1000).toISOString().substr(0, 19).replace('Z', ' ').replace('T', ' ');
			if(epoch < 10000) {
				epoch_formatted = '-';
			};
			let type_id = parseInt(el[2], 16);
			
			let subject = '-';
			
			if(el[4].length > 2 && type_id > 0) {
				
				subject = new Uint8Array( FromBase64( el[4].replace(/_/g, '/').replace(/-/g, '+') ) );
				subject = toHexString(subject);
					
				alreadyDevices.forEach(function(el, it){
					if(el.kid == subject) {
						subject = el.label;
					};
				});

			} else if(el[4] == 'M') {
				subject = 'Master';
			} else if(el[4] == 'U') {
				subject = 'User';
			} else {
				subject = '-';
			};

			let extData = el[5];
			if(extData && extData.length > 1) {
				extData = new Uint8Array( FromBase64( extData.replace(/_/g, '/').replace(/-/g, '+') ) );
				//console.log(FromBase64( el[5].replace(/_/g, '/').replace(/-/g, '+') ));
				//console.log();
				//console.log(extData);
				extData = toHexString(extData);
				//console.log(extData);
				
			};
			
			let logger_desc = logger_types[type_id][0];
			
			if(logger_types[type_id][1]) {
				if(logger_types[type_id][1] == 'TIME') {

					let timetoCinvert = FromBase64( el[5].replace(/_/g, '/').replace(/-/g, '+') );
					ts = (timetoCinvert[3] * 256*256*256) + (timetoCinvert[2] * 256*256) + ( timetoCinvert[1] * 256) +  timetoCinvert[0];
					let epoch_formatted = new Date(ts*1000).toISOString().substr(0, 19).replace('Z', ' ').replace('T', ' ');

					extData = 'TIME: ' + epoch_formatted;
					logger_desc = logger_desc.replace('%', epoch_formatted);
					
				} else if(logger_types[type_id][1] == 'LOG') {
					
					if(el[5] && el[5].length > 0) {
						let datef = atob( el[5].replace(/_/g, '/').replace(/-/g, '+') );
						extData = 'RAW: ' + datef;
						
						let epoch_formatted = new Date(parseInt(datef, 16)*1000).toISOString().substr(0, 19).replace('Z', ' ').replace('T', ' ');
						logger_desc = logger_desc.replace('%', '<a class="makeAction coloredLink" rel="openLogFile/'+datef+'">'+epoch_formatted+'</a>');
					} else {
						extData = 'Empty';
					};
					
				} else if(logger_types[type_id][1] == 'RAW') {
					
					if(el[5] && el[5].length > 0) {
						let datef = atob( el[5].replace(/_/g, '/').replace(/-/g, '+') );
						extData = 'RAW: ' + datef;
						logger_desc = logger_desc.replace('%', datef);
					} else {
						extData = 'Empty';
					};
					
				} else if(logger_types[type_id][1] == 'CODE') {
					
					if(el[5] && el[5].length > 0) {
						extData = 'ERROR: ' + atob( el[5].replace(/_/g, '/').replace(/-/g, '+') );
						logger_desc = logger_desc.replace('%', extData)
					} else {
						extData = 'Empty';
					};
					
				} else if(logger_types[type_id][1] == 'KID') {
					
					if(el[5] && el[5].length > 0) {
						let kid = new Uint8Array( FromBase64( el[5].replace(/_/g, '/').replace(/-/g, '+') ) );
						kid = toHexString(kid);
						extData = 'KID: ' + kid;
						logger_desc = logger_desc.replace('%', '<a class="makeAction coloredLink" rel="openKey/'+kid+'">'+kid+'</a>');
					} else {
						extData = 'No Key';
					};
					
				} else {
					
					extData = logger_types[type_id][1] + ':' + extData;
					
				};
				extData = '<i class="icon-eye" title="'+extData+'"></i>';
			} else {
				extData = '';
			};
			
			resultHTML += `<tr class="resultX${el[3]}"><td>${no}</td><td class="nobreak">${epoch_formatted}</td><td class="breakw">${logger_desc}</td><td style="text-align: center; vertical-align: middle;">${logger_results[el[3]]}</td><td class="nobreak">${subject}</td></tr>`;
			
			logger_desc = logger_desc.replace(/(<([^>]+)>)/gi, "");
			
			resultRAW += `<div>${no}.  ${epoch_formatted}  -  ${logger_results_names[el[3]]}      ${logger_desc}</div><br>`;
			
		};
		
		resultRAW += '<br><br><p align="right" style="font-size: 95%; text-align: right"><strong>- END OF FILE -</strong></p>';
		resultHTML += '</tbody></table>';
		
		return [resultHTML, resultRAW];
	};
	
	register('consolelog', function(){
		get_logger();
	});
	
	register('exportLogFile', function(id){
		perform('logger:get', false, function(status, data){
			
			if(status) {
				
				app.api('api/logger/key').then(function(signature){
					
					app.api('api/logger/' + id, 'GET_FILE').then(function(data){
						
					}).catch(function(e) {
						app.error(e);
					});
					
				}).catch(function(e) {
					app.error(e);
				});
			
			};
			
		}, false, false);
	});
		
	register('exportLogFilePDF', function(id){

		var doc = new jsPDF();
		var img = new Image;
		
		img.onload = function() {
			img.height = 96;
			img.width = 96;
			img.style.width = '96px';
			img.style.height = '96px';
			doc.addImage(this, 162, 15);
			doc.fromHTML(document.getElementById('consoleDetailsRaw'), 25, 15, { width: 160 });
		
			if(print) {
				doc.autoPrint();
			};
			var iframe = document.getElementById('init_iframe_log');	
			iframe.src = doc.output('datauristring');
			
		};
		
		img.onerror = function() {
			doc.fromHTML(document.getElementById('consoleDetailsRaw'), 25, 15, { width: 160 });
		
			if(print) {
				doc.autoPrint();
			};
			var iframe = document.getElementById('init_iframe_log');	
			iframe.src = doc.output('datauristring');

		};
		
		if(_redirected) {
			img.src = _assetsHere + "img/android-chrome-512x512c.png";
		} else {
			img.src = _startingURL + "/assets/img/android-chrome-512x512c.png";
		};

	});
	
	register('openLogFile', function(id){
		
		consoleDetails.innerHTML = '';
		consoleDetailsRaw.innerHTML = '';
		
		perform('logger:get', false, function(status, data){
			
			if(status) {
				
				app.api('api/logger/key').then(function(signature){
					
					perform('logger:get', false, function(status, data){

						app.api('api/logger/' + id).then(function(data){
							
							loadClever({ type: 'js', name: 'jspdf.min_v1.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-BSr7kTTTNkWf6o616UenQnGU0ydQv6+ZOBgfWeBrybSPbVqcHgrM6RUSC0cxnhG7' });

							changePage('consolelog_show');
							let preparedLogDetails = parse_logger(id, data);
							consoleDetails.innerHTML = preparedLogDetails[0];
							consoleDetailsRaw.innerHTML = preparedLogDetails[1];
							let verification = check_log_integrity(signature.key, data);
							
							if(!verification) {
								inform(false, 'Log file seems to be corrupted. Beware!');
							};
							
						}).catch(function(e) {
							inform(false, 'Error while opening log file');
							app.error(e);
						});
					
					}, false, false);
					
				}).catch(function(e) {
					inform(false, 'Error while opening log file');
					app.error(e);
				});
			
			};
			
		}, false, false);
	});
	
	var openedDevice = false;
	var alreadyDevices = [];
	var devicesContainer = document.getElementById('devicesContainer');
	var whenThereIsNoDevices = document.getElementById('whenThereIsNoDevices');
	var whenThereIsNoDevicesButton = document.getElementById('whenThereIsNoDevicesButton');
	
	let qrCodeMainGetApp = false;
	
	function printDevices(devices) {
		
		var html = '';
		var found = false;
		devices.forEach(function(el, it){
			
			var s = new Date(el.created * 1000)
			var date = s.toISOString().replace('T', ' ').replace('Z', '').substr(0, 19);
			var time = s.toISOString().replace('T', ' ').replace('Z', '').substr(0, 19);
			found = true;

			html += '<div class="element updtItem animatedX moved makeAction" rel="openDevice/' + el.kid + '/'+el.descr.replaceAll('/', '-')+'"><h3 class="name">' + el.label + '</h3><p class="status"><span class="type">Created: ' + date +'</span><span class="type">Type: <strong>' + el.type.replaceAll(',', ', ') + '</strong></span></p></div>';
			
		});
		
		if(!found) {
			
			tempPaired = false;
			tempPairedFirst = false;
			
			html = `<h2 class="animatedX moved">There are no devices to show yet!</h2>
						
					<p class="animatedX moved">Just few clicks to go and you are in heaven where usability and privacy comes together as one! Any paired device will be visible here and available to see and edit.</p>`;
			
			devicesContainer.classList.remove('c3x');
			devicesContainer.classList.remove('c2xd');
			mobileAuthMonit.classList.add('index');
			whenThereIsNoDevices.classList.remove('dead');
			whenThereIsNoDevicesButton.classList.add('index');
			
		} else {
			
			tempPaired = true;
			tempPairedFirst = true;
			
			devicesContainer.classList.add('c3x');
			mobileAuthMonit.classList.remove('index');
			
			if(devices.length < 3) {
				devicesContainer.classList.add('c2xd');
			} else {
				devicesContainer.classList.remove('c2xd');
			};
			
			whenThereIsNoDevices.classList.add('dead');
			whenThereIsNoDevicesButton.classList.remove('index');
			
		};
		
		devicesContainer.innerHTML = html;
		
		if(!tempPaired) {
			var placer = document.getElementById("qrcode_about");
			if(qrCodeMainGetApp) qrCodeMainGetApp.append(placer);
		};
	};
	
	function syncDevices() {
		
		perform('system:config', false, function(status, data){
			
			app.paired(function(data){
				var toRemove = [];
				for(challenge in alreadyDevices) {
					var found = false;
					for(key in data) {
						if(alreadyDevices[challenge].descr == 'RVhUQUlE' + data[key].pid) {
							found = true;
							console.log('Found!');
						};
					};
					if(!found) {
						toRemove.push(alreadyDevices[challenge]);
					};
				};
				removeDevicesAfterSync(toRemove);
			}, function(){
				
			});
	
		}, false, false);
	};
	
	function removeDevicesAfterSync(ids) {
		
		var howManyToRemove = ids.length;
		var howManyToRemoveStill = 0;
		
		if(howManyToRemove > 0) {
		
			Swal.fire({
			  title: 'Some devices are hanging',
			  text: "Do you want to  remove them from this device?",
			  icon: 'warning',
			  showCancelButton: true,
			  showLoaderOnConfirm: true,
			  reverseButtons: true,
			  confirmButtonColor: '#3085d6',
			  cancelButtonColor: '#d33',
			  confirmButtonText: 'Yes, please'
			}).then((result) => {
				if (result.isConfirmed) {

					perform('keymgmt:del', false, function(status, data){
						
						for(toRemove in ids) {
							app.api('api/keymgmt/delete/' + ids[toRemove].kid, 'DELETE')
							.then(function(datas){
								howManyToRemoveStill++;
								if(howManyToRemove == howManyToRemoveStill) {
									cleanupAfterRemovingDevices();
								};
							}).catch(function(e) {
								app.error(e);
							});
						};

					}, false, false);

				};
			});
		
		} else {
			
			Swal.fire(
			  'Operation succeeded',
			  'List of devices is synchronized with mobile apps.',
			  'success'
			);
			
		};
		
	};
	
	function cleanupAfterRemovingDevices() {
		
		Swal.fire(
		  'Operation succeeded',
		  'List of devices is now synchronized with mobile apps.',
		  'success'
		);
					
		getDevices();
	};
	
	var is_key_search_allowed = true;
	
	function getDevices(forceCheck) {
		
		if(!tempAfterInit) return;
		
		if(!is_key_search_allowed) {
			
			perform('keymgmt:search', false, function(status, data){
				
				if(status) {
		
					app.api('api/keymgmt/search', 'POST', { descr: '^RVhUQUlE'}).then(function(datax2){
						printDevices(datax2.list);
						alreadyDevices = datax2.list;
					}).catch(function(e) {
						app.error(e);
					});
				
				};
				
			}, false, false);
			
		} else {
			
			app.api('api/keymgmt/search', 'POST', { descr: '^RVhUQUlE'}).then(function(data){
				
				printDevices(data.list);
				alreadyDevices = data.list;
				is_key_search_allowed = true;
				
			}).catch(function(e) {
				
				is_key_search_allowed = false;
				
				app.checkPairing(function(result){

					if(result.paired && forceCheck) {
						
						perform('keymgmt:search', false, function(status, data){
				
							if(status) {
					
								app.api('api/keymgmt/search', 'POST', { descr: '^RVhUQUlE'}).then(function(datax2){
									printDevices(datax2.list);
									alreadyDevices = datax2.list;
								}).catch(function(e) {
									app.error(e);
								});
							
							};
							
						}, false, false);
					};
				});
				app.error(e);
			});
		
		}
		
	};

	
	register('devices', function(data){
		loadClever({ type: 'js', name: 'qr-code-styling_v1_5_0.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-HlO9KP92M4cZMU3Ly4wp/RuF5f1xzwHEKTZ+KIeOCdNXOVHIMnLwzjYrFdaWc0ix' }, function(){
			
			qrCodeMainGetApp = new QRCodeStyling({
				width: 300,
				height: 300,
				data: 'https://encedo.com/getmobileauth',
				image: "assets/img/apple-touch-icon.png",
				dotsOptions: {
					color: "#404B7C",
					type: "rounded"
				},
				backgroundOptions: {
					color: "#ffffff",
				},
				imageOptions: {
					crossOrigin: "anonymous",
					margin: 10
				}
			});
			
			var placer = document.getElementById("qrcode_about");
			if(placer && qrCodeMainGetApp) {
				qrCodeMainGetApp.append(placer);
			};
			
		});
		getDevices(true);
	});
	
	register('device_edit', function(data){
		if(openedDevice && openedDevice.label) {
			var device_label_new = document.getElementById('device_label_new');
			device_label_new.value = openedDevice.label;
		};
	});
	
	register('devices_sync', function(data){
		syncDevices();
	});
	
	register('device_save_changes', function(data){
		var device_label_new = document.getElementById('device_label_new');
		if(openedDevice && openedDevice.kid && device_label_new.value.length > 2) {
			app.api('api/keymgmt/update', 'POST', { kid: openedDevice.kid, label: device_label_new.value, descr: openedDevice.descr })
			.then(function(data){
				changePage('devices');
			}).catch(function(e) {
				app.error(e);
			});
		};
	});
	
	register('openDevice', function(kid, descr){	
		var found = false;
		alreadyDevices.forEach(function(el, it){	
			if(kid == el.kid) {
				
				var s = new Date(el.created * 1000)
				var date = s.toISOString().replace('T', ' ').replace('Z', '').substr(0, 19);
				
				el.createdX = date;

				var up = new Date(el.updated * 1000)
				var date = up.toISOString().replace('T', ' ').replace('Z', '').substr(0, 19);
				
				el.updatedX = date;
				
				openedDevice = el;
			
				found = el;
			};
		});
		if(!found) {
			changePage('problem');
		} else {
			
			var device_detailsList = document.getElementById('device_details').querySelectorAll('.fillByKey');
			device_detailsList.forEach(function(el){
				var rel = el.getAttribute('rel');
				if(found[rel]) {
					el.innerHTML = found[rel];
				};
			});
			
			changePage('device_details');
		}
	});
	
	register('removeDevice', function(){

		Swal.fire({
		  title: 'Are you sure?',
		  text: "Do you want to unpair and remove this device?",
		  icon: 'warning',
		  showCancelButton: true,
		  showLoaderOnConfirm: true,
		  reverseButtons: true,
		  confirmButtonColor: '#3085d6',
		  cancelButtonColor: '#d33',
		  confirmButtonText: 'Yes, please'
		}).then((result) => {
		  if (result.isConfirmed) {
			
			if(openedDevice) {
				
				confirmX(function(passik){
					app.scoped('auth:ext:pair', function(status, data){
				
						if(status) {
					
							var pid = openedDevice.descr.substr(8);
							app.unpair(pid, function(){
								app.api('api/keymgmt/delete/' + openedDevice.kid, 'DELETE')
								.then(function(data){
									changePage('devices');
								}).catch(function(e) {
									app.error(e);
								});
							}, function(){
								app.api('api/keymgmt/delete/' + openedDevice.kid, 'DELETE')
								.then(function(data){
									changePage('devices');
								}).catch(function(e) {
									app.error(e);
								});
							});
						
						};
						
					}, false, false, passik);
				}, false, 'device:remove');
			};
			
		  };
		});
		
	});
	
	var openedKey = false;
	var alreadyKeys = [];
	var keychainDOM = document.getElementById('keychain');
	var keychainContainer = document.getElementById('keychainContainer');
	
	function get_key_added(key) {
		var s = new Date(key.created * 1000);
		key._created = s.toISOString().replace('T', ' ').replace('Z', '').substr(0, 19);
		var s2 = new Date(key.updated * 1000);
		key._updated = s2.toISOString().replace('T', ' ').replace('Z', '').substr(0, 19);
		
		if(key.type.indexOf('ATT') != -1) {
			if(key.descr && key.descr.indexOf('RVRTRlRY') != -1) {
				key._kind = 'apps';
			} else {
				key._kind = 'user';
			};
		} else if(key.type.indexOf('ATT') == -1 && key.type.indexOf('PKEY') == -1 && key.type.indexOf('AES') == -1 && key.type.indexOf('SHA') == -1 && key.type.indexOf('_DER') == -1) {
			key._kind = 'imported';
		} else {
			key._kind = 'others';
		};
		
		if(key.type.indexOf('_DER') != -1) {
			key._kind = 'others';
		};

		alreadyKeys[key.kid] = key;
	};
	
	function get_keys(filter, page) {
		
		if(!page) {
			page = 1;
			alreadyKeys = [];
		};
		
		perform('keymgmt:list', false, function(status, data){
			
			if(status) {
				
				let offset = '';
				
				if(page > 1) {
					offset = '/' + (15*(page-1));
				};
				
				app.api('api/keymgmt/list' + offset).then(function(data){
					
					for(key of data.list) {
						get_key_added(key);
					};
					
					if(data.total > page*15) {
						get_keys(filter, (page+1));
					} else {
						print_keys(filter);
					};

				}).catch(function(e) {
					app.error(e);
				});
			
			};
	
		}, false, false);
	};
	
	function print_keys(filter) {
		
		var html = '';
		var countedKeys = 0;
		
		for(key in alreadyKeys) {
			
			let el = alreadyKeys[key];
			
			if(filter != 'all' && el._kind != filter) {
				continue;
			};		
						
			var share = '<i class="icon-share animatedX makeAction" rel="shareKey/' + el.kid + '"></i>';
			
			if(el.type.indexOf('AES') != -1 || el.type.indexOf('SHA') != -1) {
				share = '';
			};

			html += '<div class="element updtItem animatedX moved makeAction" rel="openKey/' + el.kid + '"><h3 class="name"><i class="icon-key"></i> ' + el.label + '</h3><p class="status"><span class="type">'+el.type.replaceAll(',', ', ')+'</span><span class="type">'+el._created+'</span></p><span class="icons">'+share+' <i class="icon-cog animatedX"></i> <i class="icon-cancel animatedX makeAction" rel="removeKey/' + el.kid + '"></i></span></div>';
			
			countedKeys++;
		};
		
		keychainContainer.innerHTML = html;
		
		keychainContainer.classList.add('c3x');
		
		if(countedKeys < 3) {
			if(html.length < 4) {
				keychainContainer.innerHTML = '<h3>There are no keys to show.</h3>';
			};
			keychainContainer.classList.add('c2xd');
		} else {
			keychainContainer.classList.remove('c2xd');
		};
	};
	
	register('get_keys', function(filter){
		get_keys(filter);
	});
	
	register('changeKeychainView', function(type){
		if(type == 'list') {
			keychainContainer.classList.add('listed');
		} else {
			keychainContainer.classList.remove('listed');
		};
	});

	register('keychain', function(data){
		var recto = keychainDOM.querySelectorAll('.tabber li');
		if(recto && recto[0]) {
			recto[0].click();
		};
	});
	
	var key_details_descrDOM = document.getElementById('key_details_descrDOM');
	var key_details_pubkeyDOM = document.getElementById('key_details_pubkeyDOM');
	var key_share_button_submit = document.getElementById('key_share_button_submit');
	
	register('openKey', function(kid, descr){
		
		var found = false;
		
		for(key in alreadyKeys) {
			let el = alreadyKeys[key];
			if(kid == el.kid) {
				openedKey = el;
				found = true;
			};
		};
		
		if(!found) {
			changePage('problem');
		} else {
			
			perform('keymgmt:get', false, function(status, data){
			
				if(status) {
					
					app.api('api/keymgmt/get/' + openedKey.kid)
					.then(function(data){
						
						openedKey.pubkey = (data.pubkey ? data.pubkey : data.der);
						openedKey.pubkey_type = data.type;
						
						if(openedKey.descr && openedKey.descr.length > 3) {
							key_details_descrDOM.classList.remove('index');
						} else {
							key_details_descrDOM.classList.add('index');
						};
						
						if(openedKey.pubkey && openedKey.pubkey.length > 3) {
							key_details_pubkeyDOM.classList.remove('index');
						} else {
							key_details_pubkeyDOM.classList.add('index');
						};
						
						var key_detailsList = document.getElementById('key_details').querySelectorAll('.fillByKey');
						key_detailsList.forEach(function(el){
							var rel = el.getAttribute('rel');
							if(openedKey[rel] && openedKey[rel] !== "undefined") {
								el.innerHTML = openedKey[rel];
							};
						});
						
						if(data.type.indexOf('AES') != -1 || data.type.indexOf('SHA') != -1) {
							key_share_button_submit.classList.add('index');
						} else {
							key_share_button_submit.classList.remove('index');
						};
						
						changePage('key_details');
						
					}).catch(function(e) {
						app.error(e);
						changePage('problem');
					});
				
				};
				
			}, false, false);	
			
		};
	});
	
	register('shareKey', function(kid, descr){
		
		var found = false;
		
		for(key in alreadyKeys) {
			let el = alreadyKeys[key];
			if(kid == el.kid) {
				openedKey = el;
				found = true;
			};
		};
		
		if(!found) {
			changePage('problem');
		} else {
			
			perform('keymgmt:get', false, function(status, data){
			
				if(status) {
					
					app.api('api/keymgmt/get/' + openedKey.kid)
					.then(function(data){
						
						openedKey.pubkey = (data.pubkey ? data.pubkey : data.der);
						openedKey.pubkey_type = data.type;
						
						var key_detailsList = document.getElementById('key_details').querySelectorAll('.fillByKey');
						key_detailsList.forEach(function(el){
							var rel = el.getAttribute('rel');
							if(openedKey[rel] && openedKey[rel] !== "undefined") {
								el.innerHTML = openedKey[rel];
							};
						});
						
						changePage('key_share');
						
					}).catch(function(e) {
						app.error(e);
						changePage('problem');
					});
				
				};
				
			}, false, false);	
			
		};
	});
	
	register('removeKey', function(kid){
		
		if(openedKey || kid) {
		
			Swal.fire({
			  title: 'Are you sure you want to remove this key from a keychain?',
			  text: "You won't be able to revert this!",
			  icon: 'warning',
			  showCancelButton: true,
			  showLoaderOnConfirm: true,
			  reverseButtons: true,
			  confirmButtonColor: '#3085d6',
			  cancelButtonColor: '#d33',
			  confirmButtonText: 'Yes, wipe it all!'
			}).then((result) => {
			  if (result.isConfirmed) {
				  
				perform('keymgmt:del', false, function(status, data){
				
					if(status) {
						app.api('api/keymgmt/delete/' + (kid ? kid : openedKey.kid), 'DELETE').then(function(data){
							changePage('keychain');
						}).catch(function(e) {
							app.error(e);
						});
						
					};
					
				}, false, false);
				
			  };
			});
		
		};
	
	});
	
	register('key_use', function(kid){
		
		if(openedKey || kid) {
			
			perform('keymgmt:use:' + (kid ? kid : openedKey.kid), false, function(status, data){
			
				if(status, data) {
					
					setTimeout(function(){
						
						console.log(app.tokens);
						
						if(app.tokens['keymgmt:use:' + (kid ? kid : openedKey.kid)]) {
							let tokeno = app.tokens['keymgmt:use:' + (kid ? kid : openedKey.kid)].token;
							
							Swal.fire(
							  'Auth Token Generated',
							  tokeno,
							  'success'
							);
						} else {
							Swal.fire(
							  'Operation error',
							  'Token has not been generated or found.',
							  'error'
							);
						};
						
					}, 600);

					
					
				} else {
					Swal.fire(
					  'Operation error',
					  'Token has not been generated or found.',
					  'error'
					);
				};
				
			}, false, false);
			
		};
	});
	
	var key_label_edit = document.getElementById('key_label_edit');
	var key_descr_edit = document.getElementById('key_descr_edit');
	var key_edit_submit_button = document.getElementById('key_edit_submit_button');	
	
	var fields_key_import_mode = document.getElementById('fields_key_import_mode');
	var fields_key_import_type = document.getElementById('fields_key_import_type');
	var fields_key_import_label = document.getElementById('fields_key_import_label');
	var fields_key_import_descr = document.getElementById('fields_key_import_descr');
	var fields_key_import_pubkey = document.getElementById('fields_key_import_pubkey');
	
	fields_key_import_type.onchange = setKeyImportMode;
	
	function setKeyImportMode() {
		
		let selected = fields_key_import_type.options[fields_key_import_type.selectedIndex];
		let resultHTML = `<option disabled="" selected="" value="" class="form-select-placeholder"></option>`;
		
		if(selected.dataset && selected.dataset.type && selected.dataset.type != 'none') {
			
			fields_key_import_mode.disabled = false;
			
			let options = selected.dataset.type.split(';');
			for(type of options) {
				resultHTML += `<option value="${type}" selected>${type}</option>`;
			};	
			
		} else {
			fields_key_import_mode.disabled = true;
			resultHTML += `<option value="" selected>-</option>`;
		};
		
		fields_key_import_mode.classList.add('-hasvalue');
		fields_key_import_mode.innerHTML = resultHTML;
	};
	
	function checkIfKeyDetailsChanged() {
		if(key_label_edit.value != key_edit_field_label_value || key_descr_edit.value != key_edit_field_descr_value) {
			key_edit_submit_button.classList.remove('buttonCTAG');
		} else {
			key_edit_submit_button.classList.add('buttonCTAG');
		};
	};	

	var key_edit_field_label_value = false;
	var key_edit_field_descr_value = false;
	
	key_label_edit.onchange = checkIfKeyDetailsChanged;
	key_descr_edit.onchange = checkIfKeyDetailsChanged;
	key_label_edit.onkeyup = checkIfKeyDetailsChanged;
	key_descr_edit.onkeyup = checkIfKeyDetailsChanged;
	key_label_edit.onkeydown = checkIfKeyDetailsChanged;
	key_descr_edit.onkeydown = checkIfKeyDetailsChanged;
	
	register('key_edit', function(data){
		if(openedKey && openedKey.label) {
			key_label_edit.value = openedKey.label;
			if(openedKey.descr && openedKey.descr.length > 1 && openedKey.descr != 'undefined') {
				key_descr_edit.value = openedKey.descr;
			} else {
				key_descr_edit.value = '';
			};
			key_edit_field_label_value = openedKey.label;
			key_edit_field_descr_value = key_descr_edit.value;
		};
	});
	
	
	function fillImportForm(data) {
		
		if(!data || !data.key || !data.key.pubkey) {
			return false;
		};
		
		fields_key_import_pubkey.value = data.key.pubkey;
		
		if(data.key.label) {
			fields_key_import_label.value = decodeURIComponent(escape(window.atob(data.key.label)));
		};
				
		if(data.key.type) {
			var type = data.key.type.split(',');
			var first = false;
			var last = false;
			for(const now of type) {
				last = now.trim();
			};
			if(last) {
				fields_key_import_type.value = last;
				fields_key_import_type.classList.add('-hasvalue');
				setKeyImportMode();
			};
		};
		
		if(data.key.descr) {
			fields_key_import_descr.value = data.key.descr;
		};
		
		fields_key_import_mode.disabled = true;
		fields_key_import_type.disabled = true;
		fields_key_import_pubkey.disabled = true;
		
	};
	
	function confirmationForImportShareCode(code, redirect) {
		
		var result = JSON.parse(atob(code.replaceAll(' ', '')));
			
		if(result) {
			
			Swal.fire({
			  title: 'Do you want to import public key',
			  text: decodeURIComponent(escape(window.atob(result.note))),
			  showCancelButton: true,
			  showLoaderOnConfirm: true,
			  reverseButtons: true,
			  confirmButtonColor: '#3085d6',
			  cancelButtonColor: '#d33',
			  confirmButtonText: 'Yes, import now'
			}).then((confirmation) => {
			  if (confirmation.isConfirmed) {
				  fillImportForm(result);
			  } else if(result.isDenied) {
				  if(redirect) changePage(redirect);
			  };
			});
			
		} else {
			
			inform(false, 'This share-code is not working');
			
		};
		
	};
	
	function handleImportShareCode(result) {
		if(result.isConfirmed && result.value) {
			confirmationForImportShareCode(result.value, false);
		};
	};
	
	register('importNewKeyWithCode', function(data){
		var objSet = {
		  title: 'Paste share code below',
		  input: 'textarea',
		  inputAttributes: {
			autocapitalize: 'off'
		  },
		  width: 600,
		  showCancelButton: true,
		  confirmButtonText: 'Import',
		  showLoaderOnConfirm: true,
		  reverseButtons: true,
		  preConfirm: handleImportShareCode
		};

		Swal.fire(objSet).then(handleImportShareCode);
	});
	
	var key_share_code = false;
	
	var key_share_kid = document.getElementById('key_share_kid');
	var key_share_type = document.getElementById('key_share_type');
	var key_share_pubkey = document.getElementById('key_share_pubkey');
	var key_share_label = document.getElementById('key_share_label');
	var key_share_notes = document.getElementById('key_share_notes');
	var key_share_email = document.getElementById('key_share_email');
	var key_share_descr = document.getElementById('key_share_descr');
	var key_details_sharecode = document.getElementById('key_details_sharecode');
	
	var editKeyForm = document.getElementById('editKeyForm');
	var shareKeyForm = document.getElementById('shareKeyForm');
	var importNewKeyForm = document.getElementById('importNewKeyForm');
	var createNewKeyForm = document.getElementById('createNewKeyForm');
			
	register('key_share', function(data){
		
		shareKeyForm.reset();
		
		if(openedKey && openedKey.label && openedKey.type) {
			key_share_label.value = openedKey.label;
			key_share_kid.innerHTML = openedKey.kid;
			key_share_type.value = openedKey.type;
			key_share_pubkey.value = openedKey.pubkey;
			if(openedKey.descr && openedKey.descr !== "undefined") {
				key_share_descr.value = openedKey.descr;
			};
		};
		
	});
	
	function handlePublicKeyShareViaEmailError() {
		Swal.fire(
		  'Operation error',
		  'Share-code has NOT been sent to user. Please try again.',
		  'error'
		);
	};
	
	function handlePublicKeyShareViaEmail(result) {
		if(result.isConfirmed && key_share_code && result.value && result.value.length > 4) {
			
			app.api('https://api.encedo.com/share/emailpubkey', 'POST', { email: result.value, msg: btoa(JSON.stringify(key_share_code)), auth: '' }).then(function(status){
				if(status) {
					Swal.fire(
					  'Operation succeeded',
					  'Share-code has been sent to user.',
					  'success'
					);
				} else {
					handlePublicKeyShareViaEmailError();
				};
			}).catch(function(e) {
				handlePublicKeyShareViaEmailError();
				app.error(e);
			});
			
		} else if(result.isDenied) {
			
		};
	};
	
	register('key_share_send', function(data){
		if(openedKey && openedKey.label && openedKey.type) {
			key_share_code = {
				"key": {
					"pubkey": openedKey.pubkey,
					"type": openedKey.type.replace('ATT,', '').replace('PKEY,', ''),
					"descr": openedKey.descr,
					"label": btoa(unescape(encodeURIComponent(key_share_label.value)))
				},
				"note": btoa(unescape(encodeURIComponent(key_share_notes.value)))
			};
			key_details_sharecode.innerHTML = btoa(JSON.stringify(key_share_code));
			
			
			var objSet = {
			  title: 'Please type email address',
			  input: 'email',
			  inputAttributes: {
				autocapitalize: 'off'
			  },
			  width: 600,
			  showCancelButton: true,
			  confirmButtonText: 'Send',
			  showLoaderOnConfirm: true,
			  reverseButtons: true,
			  preConfirm: handlePublicKeyShareViaEmail
			};

			Swal.fire(objSet).then(handlePublicKeyShareViaEmail);
			
		};
	});
	
			
	
	register('key_share_generate', function(data){
		if(openedKey && openedKey.pubkey && openedKey.type) {
			key_share_code = {
				"key": {
					"pubkey": openedKey.pubkey,
					"type": openedKey.type.replace('ATT,', '').replace('PKEY,', ''),
					"descr": openedKey.descr,
					"label": btoa(unescape(encodeURIComponent(key_share_label.value)))
				},
				"note": btoa(unescape(encodeURIComponent(key_share_notes.value)))
			};
			key_details_sharecode.innerHTML = btoa(JSON.stringify(key_share_code));
			changePage('key_share_ready');
		};
	});
	
	/*
	register('key_share_send', function(data){
		
		var key_label_new = document.getElementById('key_label_new');
		
		if(openedKey && openedKey.kid && key_label_new.value.length > 2) {
			
			perform('keymgmt:upd', false, function(status, data){
			
				if(status) {
					
					app.api('api/keymgmt/update', 'POST', { kid: openedKey.kid, label: key_label_new.value, descr: openedKey.descr }).then(function(data){
						changePage('keychain');
					}).catch(function(e) {
						app.error(e);
					});
					
				};
			
			}, false, false);
			
			
		};
	});
	*/
	
	var fields_key_label = document.getElementById('fields_key_label');
	var fields_key_type = document.getElementById('fields_key_type');
	var fields_key_mode = document.getElementById('fields_key_mode');
	var fields_key_descr = document.getElementById('fields_key_descr');
	var fields_key_pubkey = document.getElementById('fields_key_pubkey');
	
	fields_key_type.onchange = function(){
		
		let selected = fields_key_type.options[fields_key_type.selectedIndex];
		let resultHTML = `<option disabled="" selected="" value="" class="form-select-placeholder"></option>`;
		
		if(selected.dataset && selected.dataset.type && selected.dataset.type != 'none') {
			
			fields_key_mode.disabled = false;
			
			let options = selected.dataset.type.split(';');
			for(type of options) {
				resultHTML += `<option value="${type}" selected>${type}</option>`;
			};				
		} else {
			fields_key_mode.disabled = true;
			resultHTML += `<option value="" selected>-</option>`;
		};
		
		fields_key_mode.classList.add('-hasvalue');
		fields_key_mode.innerHTML = resultHTML;
		
	};
	
	register('key_new', function(data){
		createNewKeyForm.reset();
		fields_key_type.onchange();
	});
	
	register('key_new_create', function(data){
		
		var newKeyData = serialize(createNewKeyForm);
		if(newKeyData.descr == '') {
			delete newKeyData.descr;
		};
		
		perform('keymgmt:gen', false, function(status, data){
			if(status) {
				app.api('api/keymgmt/create', 'POST', newKeyData)
				.then(function(data){
					inform(true, 'New key has been created!');
					createNewKeyForm.reset();
					changePage('keychain');
				}).catch(function(e) {
					inform(false, 'New key has not been created');
					app.error(e);
				});
			} else {
				inform(false, 'New key has not been created');
			};
		}, false, false);
	});
	
	register('key_edit_save', function(data){
		
		var changed = false;
		var newKeyData = serialize(editKeyForm);
		
		if(newKeyData.label != key_edit_field_label_value) {
			changed = true;
		};
		
		if(newKeyData.descr == key_edit_field_descr_value) {
			delete newKeyData.descr;
		} else {
			changed = true;
		};
		
		if(!changed) {
			
			inform(false, 'You need to change at least one field.');
			
		} else {
		
			if(openedKey && openedKey.kid && key_label_edit.value.length > 1) {
				
				perform('keymgmt:upd', false, function(status, data){
				
					if(status) {
						
						newKeyData.kid = openedKey.kid;
						
						app.api('api/keymgmt/update', 'POST', newKeyData).then(function(data){
							inform(true, 'Key details has been changed!');
							changePage('keychain');
						}).catch(function(e) {
							inform(false, 'Key details has not been changed!');
							app.error(e);
						});
						
					} else {
						inform(false, 'Key details has not been changed!');
					};
				
				}, false, false);
				
				
			};
		
		};
	});
	
	register('key_import', function(data){
		
		fields_key_import_mode.disabled = false;
		fields_key_import_type.disabled = false;
		fields_key_import_pubkey.disabled = false;
		
		importNewKeyForm.reset();
		fields_key_import_type.onchange();
		
		if(_args && _args.arg) {
			confirmationForImportShareCode(_args.arg, 'home');
		};
		
	});
	
	register('key_new_import', function(data){
		
		var newKeyData = serialize(importNewKeyForm);
		if(newKeyData.descr == '') {
			delete newKeyData.descr;
		};
		
		perform('keymgmt:imp', false, function(status, data){
			
			if(status) {
				app.api('api/keymgmt/import', 'POST', newKeyData)
				.then(function(data){
					inform(true, 'New key has been imported!');
					importNewKeyForm.reset();
					changePage('keychain');
				}).catch(function(e) {
					inform(false, 'New key has not been imported!');
					app.error(e);
				});
			} else {
				inform(false, 'New key has not been imported!');
			};
			
		}, false, false);
	});

	
	/*  --------------------------------------
	    Config change and wipeout handling
	    --------------------------------------  */
		
	var userEID = false;
	var userEIDsign = false;
	var userSPK = false;
	var userNONCE = false;
	var nowMasterPassphraseDOMID = false;
	var nowMasterPassphraseValue = false;
	var settingsDOM = document.getElementById('settings');
	var changeStorageForm = document.getElementById('changeStorageForm');
	var changeUserDataForm = document.getElementById('changeUserDataForm');
	var changePasswordForm = document.getElementById('changePasswordForm');
	var changeFirmwareManualy = document.getElementById('changeFirmwareManualy');
	var changeFirmwareManualy2 = document.getElementById('changeFirmwareManualy2');
	var deviceWipeoutManualy = document.getElementById('deviceWipeoutManualy');
	
	let storage_volume_now = false;
	let storage_change_with_format = false;
	
	function enableSettingsForm() {
		
		changeStorageForm.classList.remove('disabledForm');
		changeUserDataForm.classList.remove('disabledForm');
		changePasswordForm.classList.remove('disabledForm');
		changeFirmwareManualy.classList.remove('disabledForm');
		deviceWipeoutManualy.classList.remove('disabledForm');
		
		let buttons = settingsDOM.querySelectorAll('button[name="submit"]');
		buttons.forEach(function(item){
			item.classList.remove('buttonCTAG');
		});
		
	};
	
	function disableSettingsForm() {
		
		changeStorageForm.classList.add('disabledForm');
		changeUserDataForm.classList.add('disabledForm');
		changePasswordForm.classList.add('disabledForm');
		changeFirmwareManualy.classList.add('disabledForm');
		deviceWipeoutManualy.classList.add('disabledForm');
		
		let buttons = settingsDOM.querySelectorAll('button[name="submit"]');
		buttons.forEach(function(item){
			item.classList.remove('buttonCTAG');
		});
		
	};
	
	function handleMasterPassphrase(result) {

		if(result.isConfirmed && nowMasterPassphraseDOMID) {
			
			app.api('api/auth/token').then(function(encedo_authinit){

				var scope = 'system:config';
				var m = new Mnemonic("english");
				var seed = m.toSeed(nowMasterPassphraseValue.trim());
					
				var keys = nacl.box.keyPair.fromSecretKey( fromHexString(seed.substr(1, 64)) );
				app.log("MASTER Prv: " + ToBase64(keys.secretKey));
				app.log("MASTER Pub: " + ToBase64(keys.publicKey));
				
				var remote_pub = new Uint8Array( self.FromBase64(encedo_authinit.spk) );
				app.log("SHARED -> Pub: " + encedo_authinit.spk + " L: "+remote_pub.length);
				app.log("SHARED -> Prv: " + self.ToBase64(keys.secretKey));

				var jwt_secret_base64 = self.ToBase64( nacl.scalarMult(keys.secretKey, remote_pub) );
				app.log("SHARED Sec: " + jwt_secret_base64);
				
				var iat = Math.floor((new Date()).getTime() / 1000);
				
				var data = {
					"jti": encedo_authinit.jti,
					"aud": encedo_authinit.spk,
					"exp": encedo_authinit.exp,
					"iat": iat,
					"iss": app.ToBase64(keys.publicKey),
					"scope": scope
				};

				var header = { 
					"ecdh": "x25519"
				};
				
				var jwt = app.jwt_generate_hs256(header, data, CryptoJS.enc.Base64.parse(jwt_secret_base64)); 
				
				app.log(jwt);   

				var init_data = { 
					"auth": jwt
				};

				app.api('api/auth/token', 'POST', init_data)
				.then(function(encedo_auth_reply){
					app.log(encedo_auth_reply);
					app.jwt_token = encedo_auth_reply.token;
					var tmp = app.parseJwt(encedo_auth_reply.token);
					app.tokens[scope] = { exp: tmp.exp, sub: tmp.sub, token: encedo_auth_reply.token };
					prepareSettingsForm();
					enableSettingsForm();
					inform(true, 'Master Passphrase is correct!');
				}).catch(function(e) {
					inform(false, 'Master Passphrase is not correct!');
					app.error(e);
				});		
			
				
			}).catch(function(e) {
				inform(false, 'Problem while trying to use Master Passphrase. Please try again.');
				app.error(e);
			});
			
		};
	};
	
	function prepareSettingsForm() {
		app.api('api/system/config').then(function(data){
			
			userEID = data.eid;
			userEIDsign = data.eid_sign;
			
			userSPK = data.spk;
			userNONCE = data.nonce;

			var userObj = {
				user: data.user,
				email: data.email,
				origin: data.origin,
				trusted_backend: (data.trusted_backend ? 1 : 2),
				trusted_ts: (data.trusted_ts ? 1 : 2),
				allow_keysearch: (data.allow_keysearch ? 1 : 2),
			};
			
			fillForm(changeUserDataForm, userObj);
			
			var foundPattern = false;
			for(a = 0; a <= 1; a++) {
				for(b = 0; b <= 1; b++) {
					for(c = 0; c <= 1; c++) {
						if(!foundPattern && layeredStorageEncrSet[a][b][c] == data.storage_mode) {
							foundPattern = [a, b, c];
						};
					};
				};
			};

			if(app.encedo_status.storage) {
				
				var storageObj = {
					fields_init_show_disk: (foundPattern[0]+1),
					fields_init_disk_mode: (foundPattern[1]+1),
					fields_init_encryption_mode: (foundPattern[2]+1),
					volume: Math.round(data.storage_disk0size/2097152),
				};
				
				fillForm(changeStorageForm, storageObj);
			
				fields_init_storage_size_change.value = Math.round(data.storage_disk0size/2097152);
				
				var totalStorageAmount = 0;
				
				if(app.encedo_status.storage[0]) {
					totalStorageAmount += parseInt(app.encedo_status.storage[0].split(':')[0]);
				};
				
				if(app.encedo_status.storage[1]) {
					totalStorageAmount += parseInt(app.encedo_status.storage[1].split(':')[0]);
				};
				
				var availableStorageSizeChange = document.getElementById('availableStorageSizeChange');
				storageAmount = (totalStorageAmount/1024/1024/2);
				fields_init_storage_size_change.max = Math.floor(storageAmount);
				availableStorageSizeChange.innerHTML = storageAmount.toFixed(2) + 'GB';

				storageDetailsAboutChange.innerHTML = 'Regular storage size: ' + fields_init_storage_size_change.value + 'GB';

				storage_volume_now = serialize(changeStorageForm);
			};
			
			enableSettingsForm();
			
		}).catch(function(e) {
			
			disableSettingsForm();
			app.error(e);
			
		});
	};
	
	register('settings_by_passphrase', function(data){
		
		nowMasterPassphraseDOMID = 'abc' + parseInt(Math.random()*Math.random()*46782364923%748923);
		
		var objSet = {
		  title: 'Master Passphrase',
		  html:	'<textarea cols="30" rows="3" id="'+nowMasterPassphraseDOMID+'" style="width: 100%; padding: 15px; border-radius: 9px; border-color: #ccc; color: #111; font-weight: bold; font-size: 108%;"></textarea>',
		  width: 600,
		  showCancelButton: true,
		  confirmButtonText: 'Confirm <i class="icon-lock-open"></i>',
		  showLoaderOnConfirm: true,
		  reverseButtons: true,
		  preConfirm: handleMasterPassphrase,
		  backdrop: 'rgba(0,0,0,0.5)',
		  preConfirm: function(){
			  var elems = document.getElementById(nowMasterPassphraseDOMID);
			  nowMasterPassphraseValue = elems.value;
		  },
		  didOpen: () => {
			autocomplete(document.getElementById(nowMasterPassphraseDOMID), WORDLISTS["english"]);
		  },
		  willClose: () => {
			
		  }
		};

		Swal.fire(objSet).then(handleMasterPassphrase);
	});
	
	register('settings', function(data){
		
		loadClever({ type: 'js', name: 'zxcvbn_v4_2_2.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-jhGcGHNZytnBnH1wbEM3KxJYyRDy9Q0QLKjE65xk+aMqXFCdvFuYIjzMWAAWBBtR' });
		
		loadClever({ type: 'js', name: 'jsbip39_v1.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-RJEnQkZzL33Qh+Pz8OI5stjVl6ejLqQf32pcMUtNjGddDO+HkKUWRY+RNh9WfwpW' }); 
		
		loadClever({ type: 'js', name: 'wordlist_english_v1.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-njqBv+vTpqAxsnrfa4zGgRb8hwBL2AJgasM059PJh0pmUQuAIlfwr9eYxltq8HH+' }); 
		
		loadClever({ type: 'js', name: 'sjcl-bip39_v1.js', required: true, firstPaint: false, loaded: false, external: true, integrity: 'sha384-LZJB30TTEi+cEasaZSnXG3bYyNVi9nUnMtjfJKo0usFmVht31nWcT06Jsw9Tvw+m' });
		
		perform('system:config', false, function(status, data){
			if(status) {
				prepareSettingsForm();
			};
		}, false, false);
	});
	
	function hashPassword() {
		
	};

	register('password_change', function(data){
		
		perform('system:config', false, function(status, data){
			
			if(status) {
				
				var passU = document.getElementById('edit_fields_init_pass').value;
				var seed = userEID;

				argon2.hash({
					pass: passU,
					salt: FromBase64(seed),
					time: 10,
					mem: 8192,
					hashLen: 32,
				}).then(function(hash2){
					
					var keys_newpass = nacl.box.keyPair.fromSecretKey(hash2.hash);
					
					var remote_pub = new Uint8Array( FromBase64(userSPK) );
					
					var secret = nacl.scalarMult(keys_newpass.secretKey, remote_pub);
					var secret_b64 = ToBase64(secret);

					var mac_base64 = CryptoJS.enc.Base64.stringify( CryptoJS.HmacSHA256( CryptoJS.enc.Base64.parse(userNONCE), CryptoJS.enc.Base64.parse(secret_b64) ) );
				   
					var dataPassword = {
					  "userkey": ToBase64(keys_newpass.publicKey),
					  "userkey_nonce": userNONCE,
					  "userkey_hmac": mac_base64
					};
					
					app.api('api/system/config', 'POST', dataPassword ).then(function(data){
						
						Swal.fire(
						  'Operation succeeded',
						  'Password has been changed.',
						  'success'
						);
						
					}).catch(function(e) {
						
						Swal.fire(
						  'Operation error',
						  'Password has not been changed.',
						  'error'
						);
						
						app.error(e);
						
					});
					
				}).catch(function(hash2){
					console.log('error while hashing new password');
				});	
				
			};
			
		}, false, false);
			
		
	});
	
	register('storage_change_mode', function(data){
		
		perform('system:config', false, function(status, data){
			
			if(status) {
				
				var dataStorage = serialize(changeStorageForm);
				var dataFinal = {};

				dataFinal.storage_mode = layeredStorageEncrSet[parseInt(dataStorage.fields_init_show_disk)-1][parseInt(dataStorage.fields_init_disk_mode)-1][parseInt(dataStorage.fields_init_encryption_mode)-1];
			
				app.api('api/system/config', 'POST', dataFinal ).then(function(data){
					
					Swal.fire({
					  icon: 'success',
					  title: 'Do not unplug the device please.',
					  text: 'Storage is being set up right now!',
					  showConfirmButton: false,
					  timerProgressBar: true,
					  timer: 28200
					});
					
					var checkDeviceReadyAfterInitWrapper = function(){
						checkDeviceReadyAfterInit(function(){
							
							Swal.fire(
							  'Operation succeeded',
							  'Storage settings has been changed.',
							  'success'
							);
							
						}, function(){
							
							Swal.fire(
							  'Operation error',
							  'Storage settings has not been changed.',
							  'error'
							);
							
						});
					};
					
					checkDeviceReadyAfterInitWrapper();
					
					connectionDeviceReadyAfterInit = setInterval(checkDeviceReadyAfterInitWrapper, 3000);

				}).catch(function(e) {
					
					Swal.fire(
					  'Operation error',
					  'Storage settings has not been changed.',
					  'error'
					);
					
					app.error(e);
					
				});
			
			};
			
		}, false, false);
		
	});
	
	function storageChange(dataStorage, format) {
		perform('system:config', false, function(status, data){
	
			if(status) {
				
				var dataFinal = {};
				
				dataFinal.storage_mode = layeredStorageEncrSet[parseInt(dataStorage.fields_init_show_disk)-1][parseInt(dataStorage.fields_init_disk_mode)-1][parseInt(dataStorage.fields_init_encryption_mode)-1];
				
				if(format) {
					dataFinal.storage_disk0size = fields_init_storage_size_change.value*2097152;
				};
				
				app.api('api/system/config', 'POST', dataFinal ).then(function(data){
					
					Swal.fire({
					  icon: 'success',
					  title: 'Do not unplug the device please.',
					  text: (format ? 'Storage is being formatted right now!' : 'Changes in progress'),
					  showConfirmButton: false,
					  timerProgressBar: true,
					  timer: 28200
					});
					
					var checkDeviceReadyAfterInitWrapper = function(){
						checkDeviceReadyAfterInit(function(){
							
							Swal.fire(
							  'Operation succeeded',
							  'Storage settings has been changed.',
							  'success'
							);
							
						}, function(){
							
							Swal.fire(
							  'Operation error',
							  'Storage settings has not been changed.',
							  'error'
							);
							
						});
					};
					
					checkDeviceReadyAfterInitWrapper();
					
					connectionDeviceReadyAfterInit = setInterval(checkDeviceReadyAfterInitWrapper, 3000);

				}).catch(function(e) {
					
					Swal.fire(
					  'Operation error',
					  'Storage settings has not been changed.',
					  'error'
					);
					
					app.error(e);
					
				});
			
			};
			
		}, false, false);
	};
	
	register('storage_change', function(data){
		
		var dataStorage = serialize(changeStorageForm);
		
		if(dataStorage.volume != storage_volume_now.volume || dataStorage.fields_init_encryption_mode != storage_volume_now.fields_init_encryption_mode) {
			
			Swal.fire({
			  title: 'Are you sure?',
			  text: "This will format storage and remove all the data stored there!",
			  icon: 'warning',
			  showCancelButton: true,
			  showLoaderOnConfirm: true,
			  reverseButtons: true,
			  confirmButtonColor: '#3085d6',
			  cancelButtonColor: '#d33',
			  confirmButtonText: 'Yes, am sure!'
			}).then((result) => {
				if (result.isConfirmed) {
				  storageChange(dataStorage, true);
				};
			});
			
		} else {
			
			storageChange(dataStorage, false);
			
		};
		
	});
	
	register('userdata_change', function(data){
		
		perform('system:config', false, function(status, data){
			
			if(status) {
				
				var dataPersonal = serialize(changeUserDataForm);
				
				dataPersonal.trusted_ts = (dataPersonal.trusted_ts == 1 ? true : false);
				dataPersonal.trusted_backend = (dataPersonal.trusted_backend == 1 ? true : false);
				dataPersonal.allow_keysearch = (dataPersonal.allow_keysearch == 1 ? true : false);
			
				app.api('api/system/config', 'POST', dataPersonal ).then(function(data){
					
					Swal.fire(
					  'Operation succeeded',
					  'User data has been changed.',
					  'success'
					);
					
				}).catch(function(e) {
					
					Swal.fire(
					  'Operation error',
					  'User data has not been changed.',
					  'error'
					);
					
					app.error(e);
					
				});
			
			};
			
		}, false, false);
		
	});
	
	
	var connectionCheckupAfterReboot = false;
	
	function checkConnectionAfterReboot() {
		
		app.ping(function(){

			console.log('Connection with Encedo established!');
			clearInterval(connectionCheckupAfterReboot);	
			
			app.tokens = {};
			printTokenStatus();
			isUpdateInProgress = false;
			curtainClose();
			makeCheckin();
			
		}, function(){
			
			alreadyPinged++;
			console.log('Connection to Encedo failed');
			console.log('Try number: ' + alreadyPinged);
			if(alreadyPinged == 18) {
				clearInterval(connectionCheckupAfterReboot);
				curtainClose();
				Swal.fire(
				  'Reconnect the device and refresh page.',
				  'Unplug device from USB and plug again and hit F5.',
				  'error'
				);
			};
			
		});
	};
	
	
	register('encedoReboot', function(data){
		Swal.fire({
		  title: 'Are you sure?',
		  text: "All unsaved changes will be lost",
		  icon: 'warning',
		  showCancelButton: true,
		  showLoaderOnConfirm: true,
		  reverseButtons: true,
		  confirmButtonColor: '#3085d6',
		  cancelButtonColor: '#d33',
		  confirmButtonText: 'Yes, reboot now!'
		}).then((result) => {
		  if (result.isConfirmed) {
			perform('system:config', false, function(data){
				
				curtainOpen('<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Reboot in progresss... ');
				
				app.reboot(function(result){
					connectionCheckupAfterReboot = setInterval(checkConnectionAfterReboot, 3000);
				});
			}, false, false);
		  };
		});
		
	});
	
	var connectionCheckupAfterWipeout2 = false;
	
	function checkConnectionAfterWipeout2() {
		
		app.ping(function(){

			console.log('Connection with Encedo established!');
			clearInterval(connectionCheckupAfterWipeout2);	
			
			if(_redirected) {
				document.location.hash = '#:my.ence.do';
				window.location.reload();
			} else {
				document.location.href = 'https://my.ence.do/';
			};
			
		}, function(){
			
			alreadyPinged++;
			console.log('Connection to Encedo failed');
			console.log('Try number: ' + alreadyPinged);
			if(alreadyPinged == 18) {
				clearInterval(connectionCheckupAfterWipeout2);
				curtainClose();
				Swal.fire(
				  'Reconnect the device and refresh page.',
				  'Unplug device from USB and plug again and hit F5.',
				  'error'
				);
			};
			
		});
	};
	
	register('manual_update', function(data){
		manual_update_file.click();
	});
	
	register('manual_update_before_init', function(data){
		manual_update_file_before_init.click();
	});
	
	handleFiles = function(files) {
		
		let file = false;
		
		if(files) {
			files = [...files];
			let i = 1;
			files.forEach(function(item){
				file = item;
			});
		};
		
		if(!file) return;
		
		console.log(file);
					
		Swal.fire({
		  title: 'Are you sure?',
		  text: "You won't be able to revert this upgrade!",
		  icon: 'warning',
		  showCancelButton: true,
		  showLoaderOnConfirm: true,
		  reverseButtons: true,
		  confirmButtonColor: '#3085d6',
		  cancelButtonColor: '#d33',
		  confirmButtonText: 'Yes, perform upgrade'
		}).then((result) => {
		  if (result.isConfirmed) {
			  
			if(tempAfterInit) {  
			
				perform('system:upgrade', false, function(status, data){
					
					if(status) {
						
						isUpdateInProgress = true;
						
						curtainOpen('<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Upgrade in progresss... ');
					
						finalEncedoFirmwareUpdate(file);
					
					} else {
						
						curtainClose();
						
						isUpdateInProgress = false;
						
					};
					
				}, false, false);
				
			} else {
				
				isUpdateInProgress = true;
				
				curtainOpen('<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Upgrade in progresss... ');
			
				finalEncedoFirmwareUpdate(file);
				
			};
		  };
		});
	};
	
	register('wipeout', function(data){
		Swal.fire({
		  title: 'Are you sure?',
		  text: "You won't be able to revert this!",
		  icon: 'warning',
		  showCancelButton: true,
		  showLoaderOnConfirm: true,
		  reverseButtons: true,
		  confirmButtonColor: '#3085d6',
		  cancelButtonColor: '#d33',
		  confirmButtonText: 'Yes, wipe it all!'
		}).then((result) => {
		  if (result.isConfirmed) {
			perform('system:config', false, function(data){
				
				curtainOpen('<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Wipeout in progresss... ');
				
				app.wipeout(function(result){
					app.url('https://my.ence.do');
					connectionCheckupAfterWipeout2 = setInterval(checkConnectionAfterWipeout2, 3000);
				});
			}, false, false);
		  };
		});
		
	});
	
	var periodicToConnectAfterUpgrade = false;
	var isUpdateInProgress = false;
	
	function checkEncedoAfterUpdate() {
		app.ping(function(){
			app.tokens = {};
			printTokenStatus();
			isUpdateInProgress = false;
			curtainClose();
			clearInterval(periodicToConnectAfterUpgrade);
			makeCheckin();
		}, function(){
			
		});
	};
	
	function finalEncedoFirmwareUpdate(file) {
		var element = document.getElementById('update_status_info');
		element.innerHTML = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span>  &nbsp; ';
		var element_status = document.createElement("strong");
		element.appendChild(element_status);
	
		app.getNewFirmware(file, element_status, function(status, errorLog){
			if(status) {
				element_status.innerHTML = '<span id="version_firmware_available"><strong>Checking after upgrade ... </strong></span>';
				setTimeout(function(){
					
					element.innerHTML = '<span id="version_firmware_available"></span>';
					checkEncedoAfterUpdate();
					periodicToConnectAfterUpgrade = setInterval(checkEncedoAfterUpdate, 4000);
					
				}, 20000);
			} else {
				
				isUpdateInProgress = false;
				curtainClose();
				element.innerHTML = '<span><strong>'+errorLog+'</strong></span>';
				
			};
		});
	};

	register('update_firmware', function(data){

		if(app.encedo_update_firmware && !isUpdateInProgress && app.encedo_type != 'epa') {
			
			if(tempAfterInit) {
			
				perform('system:upgrade', false, function(status, data){
			
					if(status) {
						
						isUpdateInProgress = true;
						
						curtainOpen('<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Upgrade in progresss... ');
					
						finalEncedoFirmwareUpdate(app.encedo_update_firmware);
					
					} else {
						
						curtainClose();
						
						isUpdateInProgress = false;
						
					};

				 }, false, false);
				 
			} else {
				
				isUpdateInProgress = true;
				
				curtainOpen('<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Upgrade in progresss... ');
				
				finalEncedoFirmwareUpdate(app.encedo_update_firmware);
				
			};
		} else {
			if(isUpdateInProgress) {
				inform(false, 'Another Update is in progress.');
			};
		};
	});
	
	function finalEncedoDashboardUpdate() {
		var element = document.getElementById('update_status_info2');
		element.innerHTML = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span>  &nbsp; ';
		var element_status = document.createElement("strong");
		element.appendChild(element_status);
		
		app.getNewDashboard(app.encedo_update_dashboard, element_status, function(status, errorLog){
			if(status) {
				element_status.innerHTML = '<span id="version_dashboard_available"><strong>Reloading ... </strong></span>';
				setTimeout(function(){
					
					element.innerHTML = '<span id="version_dashboard_available"></span>';
					//checkEncedoAfterUpdate();
					window.location.reload(true);
					isUpdateInProgress = false;
					curtainClose();
					
				}, 3000);
				
			} else {
				element.innerHTML = '<span><strong>'+errorLog+'</strong></span>';
				isUpdateInProgress = false;
				curtainClose();
			};
		});
	};
	
	register('update_dashboard', function(data){
		if(app.encedo_update_dashboard && !isUpdateInProgress && app.encedo_type != 'epa') {
			
			if(tempAfterInit) {
			
				perform('system:upgrade', false, function(status, data){
			
					if(status) {
						
						isUpdateInProgress = true;
						
						curtainOpen('<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Upgrade in progresss... ');
					
						finalEncedoDashboardUpdate();
					
					} else {
						
						curtainClose();
						
						isUpdateInProgress = false;
						
					};
					
				}, false, false);
			
			} else {
				
				isUpdateInProgress = true;
				
				curtainOpen('<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Upgrade in progresss... ');
				
				finalEncedoDashboardUpdate();
				
			};

		} else {
			if(isUpdateInProgress) {
				inform(false, 'Another Update is in progress.');
			};
		};
		
	});
	
	register('forceupdate', function(data){
		// Removed, to be rewritten as async callbacks
	});
	
	register('break', function(data){
		// We just want to reload a page to loose information about auth token
		window.location.reload();
	});
	
	function confirmX(func, mobile, scope) {
		if(tmpCache) {
			func(tmpCache);
		} else {
			
			var scopeRaw = false;
			var scopePayload = false;
			var message = 'Grant access to perform an operation';
			
			var objSetExecute = function(result){
				var ticker = document.getElementById('confirmWithTick');
				if(result.isConfirmed) {
					tmpAsked = true;
					if(ticker && ticker.checked) {
						tmpCache = result.value;
					};
					if(func) func(result.value);
				} else if(result.isDenied) {
					mobileAuthByDefault.classList.remove('index');
					if(mobile) mobile();
				};
			};
			
			// Scope hunting
			for(var key in _scopes) {
				if(key == scope) {
					scopeRaw = scope;
				};
			};
			
			if(!scopeRaw) {
				for(var key in _scopes) {
					if(!scopeRaw) {
						var re = new RegExp(key, "");
						var matching = scope.match(re);
						if(matching != null) {
							scopeRaw = key;
							scopePayload = matching;
						};
					};
				};
			};	
			
			if(_scopes[scopeRaw]) {
			
				var scopeNow = JSON.parse(JSON.stringify(_scopes[scopeRaw]));
				message = scopeNow.question_header.replaceAll('%' + i, scopePayload[i]);
				message = message.replaceAll('<br>', ' ').replaceAll('<strong>', '').replaceAll('</strong>', '');
				
			};
			
			var objSet = {
			  title: 'Enter password',
			  text: message,
			  input: 'password',
			  footer: '<label for="confirmWithTick"><input type="checkbox" value="1" id="confirmWithTick"> &nbsp; Save password for this session </label>',
			  inputAttributes: {
				autocapitalize: 'off'
			  },
			  width: 600,
			  timerProgressBar: true,
			  timer: 45000,
			  showCancelButton: true,
			  confirmButtonText: 'Confirm <i class="icon-lock-open"></i>',
			  showLoaderOnConfirm: true,
			  reverseButtons: true,
			  preConfirm: objSetExecute
			};
			
			/*
			if(tempPaired) {
				objSet.showDenyButton = true;
				objSet.denyButtonText = 'Mobile';
				objSet.title = 'Please type your password below or use mobile app';
			};
			*/
			Swal.fire(objSet).then(objSetExecute);
		};
	};
	
	function storageChangeError(labels, error, disk) {
		labels.forEach(function(item){
			item.classList.remove('animated');
			item.innerHTML = 'Error while unlocking <i class="icon-lock"></i>';
		});
		app.error(error);
		app.api('api/system/status').then(function(data) {
			handleStorage(disk, data.storage);
		}).catch(function(e) {
			
		});
	};
	
	register('securestorage', function(){
		app.api('api/system/status').then(function(data) {
			handleStorage(0, data.storage);
			handleStorage(1, data.storage);
		}).catch(function(e) {
			
		});
	});
	
	register('mobileUnlockDisk0', function(data){
		
		var writable = false;
		var endpoint = 'api/storage/unlock/ro';
		var permsToThis = 'storage:disk0 storage:disk0:rw';
		var checkPermsToWrite = document.getElementById('permWritable0');
		if(checkPermsToWrite && checkPermsToWrite.checked) {
			writable = true;
			endpoint = 'api/storage/unlock/rw';
			permsToThis = 'storage:disk0:rw';
		};
		
		perform(permsToThis, false, function(status, authType){
			
			var labels = document.querySelectorAll('.makeAction[rel="mobileUnlockDisk0"]');
			
			if(status) {
			 
				labels.forEach(function(item){
					item.classList.add('animated');
					item.innerHTML = 'Unlocking... <i class="icon-lock-open"></i>';
				});
				
				if(authType == 'mobile') {
				
					if(status == 'storage:disk0:rw') {
						endpoint = 'api/storage/unlock/rw';
					} else if(status == 'storage:disk0') {
						endpoint = 'api/storage/unlock/ro';
					};
				
				};
				
				app.api(endpoint).then(function(data){
					
					console.log('Disk 0 has been unlocked with permissions to write.');
					app.api('api/system/status').then(function(data) {
						handleStorage(0, data.storage);
					}).catch(function(e) {
						
					});
					
				}).catch(function(e) {
					if(!e) e = false;
					storageChangeError(labels, e, 0);
				});
			
			} else {
				storageChangeError(labels, status, 0);
			};

		}, '.disk0_status', 'Primary storage has been unlocked');

	});
	
	register('mobileUnlockDisk1', function(data){
		
		var writable = false;
		var endpoint = 'api/storage/unlock/ro';
		var permsToThis = 'storage:disk1 storage:disk1:rw';
		var checkPermsToWrite = document.getElementById('permWritable1');
		if(checkPermsToWrite && checkPermsToWrite.checked) {
			writable = true;
			endpoint = 'api/storage/unlock/rw';
			permsToThis = 'storage:disk1:rw';
		};
		
		perform(permsToThis, false, function(status, authType){
			
			var labels = document.querySelectorAll('.makeAction[rel="mobileUnlockDisk1"]');
			
			if(status) {
				
				labels.forEach(function(item){
					item.classList.add('animated');
					item.innerHTML = 'Unlocking... <i class="icon-lock-open"></i>';
				});
				
				if(authType == 'mobile') {
				
					if(status == 'storage:disk1:rw') {
						endpoint = 'api/storage/unlock/rw';
					} else if(status == 'storage:disk1') {
						endpoint = 'api/storage/unlock/ro';
					};
				
				};
				
				app.api(endpoint).then(function(data){

					console.log('Disk 1 has been unlocked with permissions to write.');
					app.api('api/system/status').then(function(data) {
						handleStorage(1, data.storage);
					}).catch(function(e) {

					});
					
				}).catch(function(e) {
					if(!e) e = false;
					storageChangeError(labels, e, 1);
				});
			
			} else {
				storageChangeError(labels, status, 1);
			};

		}, '.disk1_status', 'Encrypted storage has been unlocked');
	});
	
	register('mobileLockDisk0', function(data){
		
		perform('storage:disk0 storage:disk0:rw', false, function(status, data){
			
			var labels = document.querySelectorAll('.makeAction[rel="mobileLockDisk0"]');
			
			if(status) {
				
				labels.forEach(function(item){
					item.classList.add('animated');
					item.innerHTML = 'Locking... <i class="icon-lock"></i>';
				});
			
				app.api('api/storage/lock').then(function(data){
					app.api('api/system/status').then(function(data) {
						handleStorage(0, data.storage);
					}).catch(function(e) {
						
					});
				}).catch(function(e) {
					storageChangeError(labels, e, 0);
				});
			
			} else {
				storageChangeError(labels, status, 0);
			};

		}, '.disk0_status', 'Primary storage has been locked');

	});
	
	register('mobileLockDisk1', function(data){
		
		perform('storage:disk1 storage:disk1:rw', false, function(status, data){
			
			var labels = document.querySelectorAll('.makeAction[rel="mobileLockDisk1"]');
			
			if(status) {
			
				labels.forEach(function(item){
					item.classList.add('animated');
					item.innerHTML = 'Locking... <i class="icon-lock"></i>';
				});
				
				app.api('api/storage/lock').then(function(data){
					app.api('api/system/status').then(function(data) {
						handleStorage(1, data.storage);
					}).catch(function(e) {
						
					});
				}).catch(function(e) {
					storageChangeError(labels, e, 1);
				});
			
			} else {
				storageChangeError(labels, status, 1);
			};

		}, '.disk1_status', 'Encrypted storage has been locked');

	});

	
	var fields_init_pass = document.getElementById('fields_init_pass');
	var fields_init_passr = document.getElementById('fields_init_passr');
	var edit_fields_init_pass = document.getElementById('edit_fields_init_pass');
	var edit_fields_init_passr = document.getElementById('edit_fields_init_passr');
	var password_checker = document.getElementById('password_checker');
	var password_repeated = document.getElementById('password_repeated');
	var edit_password_checker = document.getElementById('edit_password_checker');
	var edit_password_repeated = document.getElementById('edit_password_repeated');
	var pass_labels = ['Password is too weak to be secure.', 'Password is too weak to be secure.', 'Numbers and big letters might help make it better.', 'Almost secure, another special charactes maybe?', 'Great! Your password has perfect strength.'];
	
	function checkPassword(data) {
		if(fields_init_pass.value.length > 4) {
			
			let passer = fields_init_pass.value;
			let result = zxcvbn(passer);
			
			password_checker.classList.remove('level0', 'level1', 'level2', 'level3', 'level4');
			password_checker.classList.add('level' + result.score);
			password_checker.innerHTML = pass_labels[result.score];
			
			if(result.score < 4) {
				fields_init_pass.setCustomValidity(pass_labels[result.score]);
			} else {
				fields_init_pass.setCustomValidity('');
			};

			
			if(fields_init_passr.value.length > 4) {
				if(fields_init_passr.value != fields_init_pass.value) {
					password_repeated.innerHTML = 'Both passwords must be the same.';
					password_repeated.classList.add('level0');
					password_repeated.classList.remove('level4');
					fields_init_passr.setCustomValidity('Password Must be Matching.');
				} else {
					password_repeated.innerHTML = 'Both passwords are the same.';
					password_repeated.classList.add('level4');
					password_repeated.classList.remove('level0');
					fields_init_passr.setCustomValidity('');
				};	
			};
		
		} else {
			
			password_checker.classList.remove('level1', 'level2', 'level3', 'level4');
			password_checker.classList.add('level0');
			password_checker.innerHTML = 'Minimum length of password is 10 characters.';
			
			password_repeated.classList.remove('level0');
			password_repeated.innerHTML = '';
			
		};
	};

	fields_init_pass.addEventListener('keydown', checkPassword); 
	fields_init_passr.addEventListener('keydown', checkPassword); 
	fields_init_pass.addEventListener('keyup', checkPassword); 
	fields_init_passr.addEventListener('keyup', checkPassword); 

	
	function checkNewPassword(data) {
		if(edit_fields_init_pass.value.length > 4) {
			
			let passer = edit_fields_init_pass.value;
			let result = zxcvbn(passer);
			
			edit_password_checker.classList.remove('level0', 'level1', 'level2', 'level3', 'level4');
			edit_password_checker.classList.add('level' + result.score);
			edit_password_checker.innerHTML = pass_labels[result.score];
			
			if(result.score < 4) {
				edit_fields_init_pass.setCustomValidity(pass_labels[result.score]);
			} else {
				edit_fields_init_pass.setCustomValidity('');
			};

			
			if(edit_fields_init_passr.value.length > 4) {
				if(edit_fields_init_passr.value != edit_fields_init_pass.value) {
					edit_password_repeated.innerHTML = 'Both passwords must be the same.';
					edit_password_repeated.classList.add('level0');
					edit_password_repeated.classList.remove('level4');
					edit_fields_init_passr.setCustomValidity('Password Must be Matching.');
				} else {
					edit_password_repeated.innerHTML = 'Both passwords are the same.';
					edit_password_repeated.classList.add('level4');
					edit_password_repeated.classList.remove('level0');
					edit_fields_init_passr.setCustomValidity('');
				};	
			};
		
		} else {
			
			edit_password_checker.classList.remove('level1', 'level2', 'level3', 'level4');
			edit_password_checker.classList.add('level0');
			edit_password_checker.innerHTML = 'Minimum length of password is 10 characters.';
			
			edit_password_repeated.classList.remove('level0');
			edit_password_repeated.innerHTML = '';
			
		};
	};	
	
	edit_fields_init_pass.addEventListener('keydown', checkNewPassword); 
	edit_fields_init_passr.addEventListener('keydown', checkNewPassword); 
	edit_fields_init_pass.addEventListener('keyup', checkNewPassword); 
	edit_fields_init_passr.addEventListener('keyup', checkNewPassword); 
	
	/* Oldies goldies */

  function onError(e) {
	console.log('Error', e);
  };
   
  ToBase64 = function (u8) {
	return btoa(String.fromCharCode.apply(null, u8));
  };

  FromBase64 = function (str) {
	return atob(str).split('').map(function (c) { return c.charCodeAt(0); });
  };

  const fromHexString = hexString =>
	new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

  const toHexString = bytes =>
	bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
  //console.log(toHexString(new Uint8Array([0, 1, 2, 42, 100, 101, 102, 255])))
  //console.log(fromHexString('0001022a646566ff'))

  function fromWordArray(wordArray) {
	var words = wordArray.words;
	var sigBytes = wordArray.sigBytes;
	var u8 = new Uint8Array(sigBytes);
	for (var i = 0; i < sigBytes; i++) {
	  var byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
	  u8[i]=byte;
	};
	return u8;
  };

  function jwt_generate_hs256(header, data, secret) {

	function base64url(source) {
	  // Encode in classical base64
	  encodedSource = CryptoJS.enc.Base64.stringify(source);    
	  // Remove padding equal characters
	  encodedSource = encodedSource.replace(/=+$/, '');    
	  // Replace characters according to base64url specifications
	  encodedSource = encodedSource.replace(/\+/g, '-');
	  encodedSource = encodedSource.replace(/\//g, '_');    
	  return encodedSource;
	};
	
	header.alg = "HS256";
	header.typ = "JWT";    
	
	var encodedHeader = base64url( CryptoJS.enc.Utf8.parse(JSON.stringify(header)) );
	var encodedData = base64url( CryptoJS.enc.Utf8.parse(JSON.stringify(data)) );

	var signature = encodedHeader + "." + encodedData;
	signature = base64url( CryptoJS.HmacSHA256(signature, secret) );

	return encodedHeader + "." + encodedData + "." + signature;
  };

};

function generatePDF(phrase) {
	var doc = new jsPDF();

	doc.fromHTML(document.getElementById('contentForPDF'), 25, 15, { width: 160 });
	
	var iframe = document.getElementById('init_iframe');	
	iframe.src = doc.output('datauristring');
	
	return doc;
};

function generatePDF2(secure, print) {
	var doc = new jsPDF();
	
	var img = new Image;
	img.onload = function() {
		img.height = 96;
		img.width = 96;
		img.style.width = '96px';
		img.style.height = '96px';
		doc.addImage(this, 162, 15);
		doc.fromHTML(document.getElementById('contentForPDF'), 25, 15, { width: 160 });
	
		if(print) {
			doc.autoPrint();
		};
		var iframe = document.getElementById('init_iframe');	
		iframe.src = doc.output('datauristring');
		
	};
	
	img.onerror = function() {
	    doc.fromHTML(document.getElementById('contentForPDF'), 25, 15, { width: 160 });
	
		if(print) {
			doc.autoPrint();
		};
		var iframe = document.getElementById('init_iframe');	
		iframe.src = doc.output('datauristring');

	};
	
	if(_redirected) {
		img.src = _assetsHere + "img/android-chrome-512x512c.png";  // some random imgur image
	} else {
		img.src = _startingURL + "/assets/img/android-chrome-512x512c.png";  // some random imgur image
	};

};

function autocomplete(inp, arr, stored) {

	  var currentFocus;

	  inp.addEventListener("input", function(e) {
		  var a, b, i, val = this.value;

		  closeAllLists();
		  let valTemp = val.split(' ');
		  val = valTemp[valTemp.length-1];
		  valTemp.splice(-1, 1);
		  if (!val) { return false;}
		  currentFocus = -1;

		  a = document.createElement("DIV");
		  a.setAttribute("id", this.id + "autocomplete-list");
		  a.setAttribute("class", "autocomplete-items");

		  this.parentNode.appendChild(a);

		  let counter = 0;
		  let last = false;
		  for (i = 0; i < arr.length; i++) {

			if (arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase() && counter < 12) {

			  b = document.createElement("div");
			  b.innerHTML = "<strong>" + arr[i].substr(0, val.length) + "</strong>";
			  b.innerHTML += arr[i].substr(val.length);

			  b.innerHTML += "<input type='hidden' value='" + arr[i] + "'>";
			  
			  last = arr[i];

			  b.addEventListener("click", function(e) {

				  inp.value = valTemp.join(' ') + ' ' + this.getElementsByTagName("input")[0].value;

				  closeAllLists();
			  });
			  counter++;
			  a.appendChild(b);
			}
		  };
		  
		  if(counter == 1) {
			  inp.value = valTemp.join(' ') + ' ' + last + ' ';
			  closeAllLists();
		  };
		  
	  });

	  inp.addEventListener("keydown", function(e) {
		  var x = document.getElementById(this.id + "autocomplete-list");
		  if (x) x = x.getElementsByTagName("div");
		  if (e.keyCode == 40) {
			/*If the arrow DOWN key is pressed,
			increase the currentFocus variable:*/
			currentFocus++;
			/*and and make the current item more visible:*/
			addActive(x);
		  } else if (e.keyCode == 38) { //up
			/*If the arrow UP key is pressed,
			decrease the currentFocus variable:*/
			currentFocus--;
			/*and and make the current item more visible:*/
			addActive(x);
		  } else if (e.keyCode == 13) {
			/*If the ENTER key is pressed, prevent the form from being submitted,*/
			e.preventDefault();
			if (currentFocus > -1) {
			  /*and simulate a click on the "active" item:*/
			  if (x) x[currentFocus].click();
			}
		  }
	  });
	  function addActive(x) {
		/*a function to classify an item as "active":*/
		if (!x) return false;
		/*start by removing the "active" class on all items:*/
		removeActive(x);
		if (currentFocus >= x.length) currentFocus = 0;
		if (currentFocus < 0) currentFocus = (x.length - 1);
		/*add class "autocomplete-active":*/
		x[currentFocus].classList.add("autocomplete-active");
	  }
	  function removeActive(x) {
		/*a function to remove the "active" class from all autocomplete items:*/
		for (var i = 0; i < x.length; i++) {
		  x[i].classList.remove("autocomplete-active");
		}
	  }
	  function closeAllLists(elmnt) {
		/*close all autocomplete lists in the document,
		except the one passed as an argument:*/
		var x = document.getElementsByClassName("autocomplete-items");
		for (var i = 0; i < x.length; i++) {
		  if (elmnt != x[i] && elmnt != inp) {
		  x[i].parentNode.removeChild(x[i]);
		}
	  }
	}
	
	/*execute a function when someone clicks in the document:*/
	document.addEventListener("click", function (e) {
		//closeAllLists(e.target);
	});
};
function str_pad (input, padLength, padString, padType) {
  let half = ''
  let padToGo
  const _strPadRepeater = function (s, len) {
    let collect = ''
    while (collect.length < len) {
      collect += s
    };
    collect = collect.substr(0, len)
    return collect
  };
  input += ''
  padString = padString !== undefined ? padString : ' '
  if (padType !== 'STR_PAD_LEFT' && padType !== 'STR_PAD_RIGHT' && padType !== 'STR_PAD_BOTH') {
    padType = 'STR_PAD_RIGHT'
  };
  if ((padToGo = padLength - input.length) > 0) {
    if (padType === 'STR_PAD_LEFT') {
      input = _strPadRepeater(padString, padToGo) + input
    } else if (padType === 'STR_PAD_RIGHT') {
      input = input + _strPadRepeater(padString, padToGo)
    } else if (padType === 'STR_PAD_BOTH') {
      half = _strPadRepeater(padString, Math.ceil(padToGo / 2))
      input = half + input + half
      input = input.substr(0, padLength)
    };
  };
  return input
};

function strtr(s, p, r) {
	return !!s && {
		2: function () {
			for (var i in p) {
				s = strtr(s, i, p[i]);
			}
			return s;
		},
		3: function () {
			return s.replace(RegExp(p, 'g'), r);
		},
		0: function () {
			return;
		}
	}[arguments.length]();
};

function strpos(haystack, needle, offset) {
  var i = (haystack+'').indexOf(needle, (offset || 0));
  return i === -1 ? false : i;
};

function strrpos(haystack, needle, offset) {
  let i = -1
  if (offset) {
    i = (haystack + '')
      .slice(offset)
      .lastIndexOf(needle) 
    if (i !== -1) {
      i += offset
    };
  } else {
    i = (haystack + '')
      .lastIndexOf(needle)
  };
  return i >= 0 ? i : false
};

(function(){
	
	function handlePublicKeyShareViaEmail() {
		inform(true, 'Invitation has been sent.');
	};
	
	register('app_filetransfer_generate', function(){
		changePage('app_filetransfer_created');
	});	
	
	register('app_filetransfer_receive_form_submit', function(){
		changePage('app_filetransfer_receive_decoded');
	});	
	
	register('app_filetransfer_invitation_form_submit', function(){
		inform(true, 'New contact has been created.');
		changePage('app_filetransfer_ready');
	});	

	register('app_filetransfer_send_form_submit', function(){
		perform('keymgmt:get', false, function(status, data){
		
			if(status) {
				changePage('app_filetransfer_send_already');
			};
			
		}, false, false);
		
	});	
	
	register('app_filetransfer_receive_download', function(){
		perform('keymgmt:get', false, function(status, data){
		
			if(status) {
				changePage('app_filetransfer_ready');
			};
			
		}, false, false);
		
	});	
	
	register('app_filetransfer_invite_submit', function(data){
		var objSet = {
		  title: 'Please type email address',
		  input: 'email',
		  inputAttributes: {
			autocapitalize: 'off'
		  },
		  width: 600,
		  showCancelButton: true,
		  confirmButtonText: 'Send',
		  showLoaderOnConfirm: true,
		  reverseButtons: true,
		  preConfirm: handlePublicKeyShareViaEmail
		};

		Swal.fire(objSet).then(handlePublicKeyShareViaEmail);
	});
	
	let dropArea = document.getElementById('filetransferHere');
	let filesDone = 0;
	let filesToDo = 0;
	let uploadProgress = [];
	let progressBar = document.getElementById('progress-bar');

	;['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
	  dropArea.addEventListener(eventName, preventDefaults, false)
	})

	function preventDefaults (e) {
	  e.preventDefault()
	  e.stopPropagation()
	};
	
	;['dragenter', 'dragover'].forEach(eventName => {
	  dropArea.addEventListener(eventName, highlight, false)
	});

	;['dragleave', 'drop'].forEach(eventName => {
	  dropArea.addEventListener(eventName, unhighlight, false)
	});

	function highlight(e) {
	  dropArea.classList.add('highlight')
	};

	function unhighlight(e) {
	  dropArea.classList.remove('highlight')
	};

	dropArea.addEventListener('drop', handleDrop, false)

	function handleDrop(e) {
	  let dt = e.dataTransfer
	  let files = dt.files

	  handleFiles(files)
	};
	
	function handleFiles(files) {
	  files = [...files];
	  initializeProgress(files.length);
	  files.forEach(uploadFile);
	  files.forEach(previewFile);
	};
	
	function uploadFile(file) {
	  let url = 'YOUR URL HERE'
	  let formData = new FormData()

	  formData.append('file', file)

	  fetch(url, {
		method: 'POST',
		body: formData
	  })
	  .then(() => { /* Done. Inform the user */ })
	  .catch(() => { /* Error. Inform the user */ })
	};
	
	function uploadFile(file) {
	  let url = 'YOUR URL HERE'
	  let formData = new FormData()

	  formData.append('file', file);
	  
	};
	
	function previewFile(file) {
	  let reader = new FileReader();
	  reader.readAsDataURL(file);
	  reader.onloadend = function() {
		let img = document.createElement('div');
		img.innerHTML = file.name;
		document.getElementById('filetransferGalleryHere').appendChild(img);
	  }
	};
	
	function initializeProgress(numfiles) {
	  progressBar.value = 0
	  filesDone = 0
	  filesToDo = numfiles
	};

	function progressDone() {
	  filesDone++
	  progressBar.value = filesDone / filesToDo * 100
	};
	
	function initializeProgress(numFiles) {
	  progressBar.value = 0
	  uploadProgress = []

	  for(let i = numFiles; i > 0; i--) {
		uploadProgress.push(0)
	  }
	}

	function updateProgress(fileNumber, percent) {
	  uploadProgress[fileNumber] = percent
	  let total = uploadProgress.reduce((tot, curr) => tot + curr, 0) / uploadProgress.length
	  progressBar.value = total
	};
	
	const interaction = document.querySelector('.c-interaction');
	const toggleButton = document.querySelector('.c-interaction__toggle');

	toggleButton.addEventListener('click',() => {
	  interaction.classList.toggle('c-interaction__options');
	});
  
})();