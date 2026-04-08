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
		} else if(e.target.parentNode.parentNode && e.target.parentNode.parentNode.matches(selector)) {
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

const downloadFile = (file, name) => {
  const element = document.createElement('a');
  element.setAttribute('href', file);
  element.setAttribute('download', name);

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

window.mobileAndTabletCheck = function() {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};

var initMain = function() {
	
	var defaultName = 'my.ence.do';
	var tmpUrl = window.location.protocol + '//' + window.location.hostname;
	var hashAddress = document.location.hash;
	
	if(hashAddress.length > 1) {
		tmpUrl = window.location.protocol + '//' + hashAddress.replace('#', '');
	};
	
	let app = new Encedo(tmpUrl);
	let _os = getOS();
	let connected = false;
	let timerHere = document.getElementById('timerHere');
	let finishButton = document.getElementById('finishButton');
	let finishButtonDOM = document.getElementById('finishButtonDOM');
	let authenticate_search = document.getElementById('authenticate_search');
	let status_encedoDevice = document.getElementById('status_encedoDevice');
	let status_encedoSoftware = document.getElementById('status_encedoSoftware');
	
	let introductionDOM = document.getElementById('introductionDOM');
	if(mobileAndTabletCheck()) {
		introductionDOM.innerHTML = '<p class="animatedX moved">This procedure works only on desktop.</p>';
	};
	
	finishButtonDOM.href = tmpUrl.replace('http', 'https').replace('httpss', 'https');
	
	changePage(startPage ? startPage : 'home');
	
	var timeoutToDownload = false;
	var periodicToPing = false;
	var periodicToConnect = false;
	var periodicToWaiter = false;
	
	var waiterCounter = 0;
	var alreadyPinged = 0;
	var addressOnTheList = 1;
	
	function checkEncedo() {
		app.ping(function(){
			console.log('connection established');
			clearInterval(periodicToConnect);
			makeCheckin();
		}, function(){
			alreadyPinged++;
			console.log('Try number: ' + alreadyPinged);
			console.log('connection fail');
			if(alreadyPinged == 4) {
				clearInterval(periodicToConnect);
			};
		});
	};
	
	function checkEncedoAfterRescue() {
		app.ping(function(){
			console.log('connection established after rescue');
			clearInterval(periodicToPing);
			makeCheckinAfterRescue();
		}, function(){
			alreadyPinged++;
			console.log('Try number: ' + alreadyPinged);
			console.log('connection fail after rescue');
			if(alreadyPinged == 10) {
				clearInterval(periodicToPing);
				makeCheckinAfterRescue();
			};
		});
	};
	
	function makeRescue() {
		finishButton.classList.remove('index');
		finishButton.href = 'http://'+authenticate_search.value+'/rescue.html';
		status_encedoDevice.innerHTML = 'Not connected to Encedo Device!';
	};
	
	function makeCheckinAfterRescue() {
		status_encedoDevice.innerHTML = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Checking after reboot ...';
		app.check(function(update){
			changePage('finish');
		});
	};

	function makeCheckin() {	
		app.check(function(update){
			
			setTimeout(function(){ 
			
				connected = true;
				
				status_encedoDevice.innerHTML = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span>  &nbsp; Connection established ...';
				
				let version_firmware_available = document.getElementById('update_status_info');
				let version_dashboard_available = document.getElementById('update_status_info2');
				
				if(!app.encedo_update_firmware) {
					version_firmware_available.innerHTML = '<strong>Up to date. Perfect!</strong>'; 
				} else {
					version_firmware_available.innerHTML = '<span class="name makeAction animatedX buttonCTA" rel="update_firmware">Update now</span>'; 
				};
				
				if(!app.encedo_update_dashboard) {
					version_dashboard_available.innerHTML = '<strong>Up to date. Perfect!</strong>'; 
				} else {
					version_dashboard_available.innerHTML = '<span class="name makeAction animatedX buttonCTA" rel="update_dashboard">Update now</span>'; 
				};
				
			if (typeof app.encedo_status.inited != "undefined") {  //22.08.2025
				app.api('api/system/config/attestation').then(function(data){
					console.log(data);
					return app.api('https://api.encedo.com/domain/register/my', 'POST', data);
				}).then(function(data){
					return app.api('api/system/config', 'POST', { tls: data} );
				}).then(function(){
					
					status_encedoDevice.innerHTML = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span>  &nbsp; Please wait few seconds ...';
					
					setTimeout(function(){ 
						status_encedoDevice.innerHTML = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Encedo is rebooting ...';
						app.reboot();
						
					}, 4900);
					
					setTimeout(function(){ 
					
						app.url(app.encedo_url.replace('http', 'https').replace('httpss', 'https'));
						
						checkEncedoAfterRescue();
					
						alreadyPinged = 0;
						periodicToPing = setInterval(checkEncedoAfterRescue, 5000);
							
						status_encedoDevice.innerHTML = '<span class="loader-container"><span></span><span></span><span></span><span></span><span></span></span> &nbsp; Checking after reboot ...';
					}, 10900);

				}).catch(function(e){
					
				});
			}	 else {
				changePage('finish');
			}
			}, 300);

		}, function(){
			
		});
	};
	
	register('gotodashboard', function() {
		window.location.replace(tmpUrl.replace('http', 'https').replace('httpss', 'https'));
	});
	
	register('start', function() {	
		alreadyPinged = 0;
		periodicToConnect = setInterval(checkEncedo, 5000);	
	});
	
	register('__start', function() {
		clearInterval(periodicToConnect);
	});	

};