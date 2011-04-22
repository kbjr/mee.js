/**
 * mee - Mouse Event Emulator
 * 
 * A Mouse Event Emulator For Touch Devices:
 * Emulates mousedown, mouseup, mouseover, mouseout, mousemove, mouseenter,
 * and mouseleave events using touch events and gestures. Also emulates mouseenter
 * and mouseleave in all non-IE browsers (not just touch devices).
 *
 * Also works great as a general event handler library :)
 *
 * @author     James Brumond
 * @version    0.1.1-dev
 * @copyright  Copyright 2011 James Brumond
 * @license    Dual licensed under MIT and GPL
 * @link       https://www.github.com/kbjr/mee.js
 */

(function(window) {

// Make sure Array.prototype.forEach exists
if (! Array.prototype.forEach) {
	Array.prototype.forEach = function(fun /*, thisp */) {
		'use strict';

		if (this === void 0 || this === null) {throw new TypeError();}

		var t = Object(this);
		var len = t.length >>> 0;
		if (typeof fun !== 'function') {throw new TypeError();}

		var thisp = arguments[1];
		for (var i = 0; i < len; i++) {
			if (i in t) {
				fun.call(thisp, t[i], i, t);
			}
		}
	};
};

var

/**
 * Test for an AppleWebKit touch device
 *
 * @access  private
 * @return  boolean
 */
isTouch = (function() {
	var flag = null,
	appleWebkit = /AppleWebKit/,
	touchDevice = /iPhone|iPad|iPod|Nexus/;
	return function() {
		if (flag === null) {
			flag = (appleWebkit.test(navigator.userAgent) && touchDevice.test(navigator.userAgent));
		}
		return flag;
	};
}()),

/**
 * Check if the client supports mouseenter/mouseleave events
 *
 * @access  private
 * @return  boolean
 */
supportsEnterLeave = (function() {
	var flag = null;
	return function() {
		if (flag === null) {
			var e = document.createElement('div');
			flag = ('mouseenter' in e && 'mouseleave' in e);
			e = null; // To avoid memory leaks
		}
		return flag;
	};
}()),

/**
 * Checks if an events relatedTarget (or equivilent) occured inside
 * of a given element.
 *
 * @access  private
 * @param   object    the event object
 * @param   element   the element to test
 * @param   string    the equivilent to fall back on
 * @return  boolean
 */
withinElement = function(evt, elem, fallback) {
	var ret = false,
	current = evt.relatedTarget || evt[fallback] || evt.otherTarget || false;
	if (! current) {return null;}
	try {
		while (current && current !== elem) {
			current = current.parentNode;
		}
		ret = (current === elem);
	} catch (e) {ret = false;}
	return ret;
},

/**
 * Builds an event function for binding
 *
 * @access  private
 * @param   function  the event function
 * @param   function  an optional test function
 * @return  function
 */
buildEventFunction = function(func, test) {
	return function(e) {
		var e = e || window.event;
		if (typeof test !== 'function' || test(e)) {
			return func(e);
		}
	}
},

/**
 * Performs a boolean xor
 *
 * @access  private
 * @param   mixed     the first test case
 * @param   mixed     the second test case
 * @return  boolea
 */
xor = function(first, second) {
	return (!! (!! first) ^ (!! second));
},

/**
 * Binds an event listener using any available method
 *
 * @access  private
 * @param   object    the object to bind to
 * @param   string    the event to bind to
 * @param   function  the event function
 * @return  function
 */
bindEvent = (function() {
	var method;
	// Bind using DOM 1 (standard)
	if (document.addEventListener) {
		method = function(obj, evt, func) {
			obj.addEventListener(evt, func, false);
			return function() {
				obj.removeEventListener(evt, func, false);
			};
		};
	}
	// Bind using DOM 1 (IE)
	else if (document.attachEvent) {
		method = function(obj, evt, func) {
			obj.attachEvent('on' + evt, func);
			return function() {
				obj.detachEvent('on' + evt, func);
			};
		};
	}
	// Bind using DOM 0
	else {
		method = function(obj, evt, func) {
			if (! CallStack.isCallStack(obj['on' + evt])) {
				var orig = false;
				if (typeof obj['on' + evt] === 'function') {
					orig = obj['on' + evt];
				}
				obj['on' + evt] = CallStack(orig);
			}
			obj['on' + evt].push(func);
			return function() {
				obj['on' + evt].forEach(function(stackFunc, i) {
					if (func === stackFunc) {
						obj['on' + evt].remove(i);
					}
				});
			};
		};
	}
	
	return method;
}()),

/**
 * Builds a compound unbinder function
 *
 * @access  private
 * @param   array     the individual unbinders
 * @return  function
 */
buildUnbinder = function(unbinders) {
	return function() {
		for (var i = 0, c = unbinders.length; i < c; i++) {
			unbinders[i]();
		}
	};
};

/**
 * Binds multiple events to an object, returning a single unbinder
 * for all of them.
 *
 * @access  private
 * @param   object    the object to bind to
 * @param   object    the events and functions to bind
 * @return  function
 */
bindMultipleEvents = function(obj, events) {
	var unbinders = [ ];
	for (var i in events) {
		if (events.hasOwnProperty(i)) {
			unbinders.push(bindEvent(obj, i, events[i]));
		}
	}
	return buildUnbinder(unbinders);
},

/**
 * Adds a related target to an event object
 *
 * @access  private
 * @param   object    the event object
 * @param   element   the relatedTarget
 * @param   string    the fallback property (fromElement/toElement)
 * @return  void
 */
addRelatedTarget = (function() {
	var ret = false;
	return function(e, targ, fromTo) {
		if (ret === false) {
			try {
				e.relatedTarget = targ;
				if (e.relatedTarget === targ) {
					ret = 'relatedTarget';
				} else {throw null;}
			} catch (err1) {
				try {
					e[fromTo] = targ;
					if (e[fromTo] === targ) {
						ret = 'fromTo';
					} else {throw null;}
				} catch (err2) {
					ret = 'otherTarget';
					e[ret] = targ;
				}
			}
		} else if (ret === 'fromTo') {
			e[fromTo] = targ;
		} else {
			e[ret] = targ;
		}
	};
}()),

/**
 * Moniter the touch state
 *
 * @access  private
 */
TouchState = isTouch() ? (new (function() {
	
	var
	self = this,
	states = [ ],
	lastTouched = null;
	
	/**
	 * Check (or set) if the current touch state is in an element
	 *
	 * @access  public
	 * @param   element   the element to test on
	 * @param   boolean   a new value to set to
	 * @return  boolean
	 */
	self.isIn = function(elem, setTo) {
		for (var i = 0, c = states.length; i < c; i++) {
			if (states[i].elem === elem) {
				if (typeof setTo !== 'undefined') {
					states[i].flag =!! setTo;
				}
				return states[i].flag;
			}
		}
		states.push({
			elem: elem:
			flag: (typeof setTo === 'undefined') ? false : (!! setTo)
		});
		return states[i].flag;
	};
	
	/**
	 * Set all flags to false
	 *
	 * @access  public
	 * @return  void
	 */
	self.reset = function() {
		for (var i = 0, c = states.length; i < c; i++) {
			states[i].flag = false;
		}
	};
	
	/**
	 * "Touch" an element, setting its isIn value to true and setting
	 * the element as the last touched
	 *
	 * @access  public
	 * @param   element   the element to touch
	 * @return  void
	 */
	self.touch = function(elem) {
		self.isIn(elem, true);
		lastTouched = elem;
	};
	
	/**
	 * Get the last touched element
	 *
	 * @access  public
	 * @return  element
	 */
	self.lastTouched = function() {
		return lastTouched;
	};
	
})()) : null,

/**
 * Creates a invokable callstack (an array of functions that can be called by itself)
 *
 * @access  private
 * @param   function  an optional first function
 * @return  function
 */
CallStack = (function() {
	var arrayFunctions = [
		'pop', 'push', 'reverse', 'shift', 'slice', 'splice', 'unshift', 'concat', 'forEach'
	],
	slice = function(arr) {
		return Array.prototype.slice.call(arr, 0);
	},
	// Array Remove - By John Resig (MIT Licensed)
	arrayRemove = function(arr, from, to) {
		var rest = arr.slice((to || from) + 1 || arr.length);
		arr.length = from < 0 ? arr.length + from : from;
		return arr.push.apply(arr, rest);
	};
	return function(origFunc) {
		var
		stack = [ ],
		retLast = false,
		// Build the function
		func = function() {
			var argv = slice(arguments, 0), ret = [ ];
			for (var i = 0, c = stack.length; i < c; i++) {
				ret.push(stack[i].apply(this, argv));
			}
			if (retLast) {
				return ret.pop();
			} else {
				return ret;
			}
		};
		// Extend the CallStack object with the stack array's prototype
		for (var i = 0, c = arrayFunctions.length; i < c; i++) {
			if (typeof Array.prototype[arrayFunctions[i]] === 'function') {
				func[arrayFunctions[i]] = (function(j) {
					if (j === 'concat') {
						return function() {
							var argv = slice(arguments, 0);
							for (var k = 0, c2 = argv.length; k < c2; k++) {
								if (argv[k].onlyReturnLast && argv[k].getStack) {
									argv[k] = argv[k].getStack();
								}
							}
							return stack[j].apply(stack, argv);
						}
					} else {
						return function() {
							return stack[j].apply(stack, slice(arguments, 0));
						};
					}
				}(arrayFunctions[i]));
			}
		}
		// Add the remove function
		func.remove = function(start, stop) {
			return arrayRemove(stack, start, stop);
		};
		// Hide the function contents
		func.toString = function() {
			return '[function CallStack]';
		};
		// Allow the developer to override the return functionality
		func.onlyReturnLast = function(flag) {
			retLast =!! flag;
		};
		// Gets the actual call stack array
		func.getStack = function() {
			return stack;
		};
		// Add the given function to the stack
		if (typeof origFunc === 'function') {
			func.push(origFunc);
		}
		
		return func;
	};
}());

/**
 * Test if a variable is a CallStack
 *
 * @access  public
 * @param   mixed     the variable to test
 * @return  boolean
 */
CallStack.isCallStack = function(obj) {
	return (typeof obj === 'function' && obj.toString() === '[function CallStack]');
},

// ----------------------------------------------------------------------------
//  The changes to make for touch events

touchEventChanges = {
	
	mousedown: {
		evt: 'touchstart'
		buildFunc: function(targ, func) {
			return function(e) {
				TouchState.touch(targ);
				return func(e);
			};
		}
	},
	
	mouseup: {
		evt: 'touchend',
		bindTo: document,
		buildFunc: function(targ, func) {
			return function(e) {
				if (mee.getEventElement(e) === targ) {
					addRelatedTarget(e, TouchState.lastTouched());
					var ret = func(e);
					TouchState.reset();
					return ret;
				}
			};
		}
	},
	
	mousemove: {
		evt: 'touchmove',
		bindTo: document,
		buildFunc: function(targ, func) {
			return function(e) {
				if (mee.getEventElement(e) === targ) {
					addRelatedTarget(e, TouchState.lastTouched());
					TouchState.touch(targ);
					return func(e);
				}
			};
		}
	},
	
	mouseover: {
		evt: 'touchmove',
		bindTo: document,
		buildFunc: function(targ, func) {
			return function(e) {
				if (mee.getEventElement(e) === targ && ! TouchState.isIn(targ)) {
					addRelatedTarget(e, TouchState.lastTouched());
					TouchState.touch(targ);
					return func(e);
				} else {
					TouchState.isIn(targ, false);
				}
			};
		}
	},
	
	mouseout: {
		evt: 'touchmove',
		bindTo: document,
		buildFunc: function(targ, func) {
			return function(e) {
				var evtTarg = mee.getEventElement(e);
				if (evtTarg !== targ && TouchState.isIn(targ)) {
					addRelatedTarget(e, evtTarg, 'toElement');
					TouchState.touch(evtTarg);
					TouchState.isIn(targ, false);
					evtTarg = null;
					return func(e);
				} else if (evtTarg === targ) {
					TouchState.isIn(targ, true);
				}
				evtTarg = null;
			};
		}
	},
	
	mouseenter: {
		evt: 'touchmove',
		bindTo: document,
		buildFunc: function(targ, func) {
			return function(e) {
				if (mee.getEventElement(e) === targ && ! TouchState.isIn(targ)) {
					addRelatedTarget(e, TouchState.lastTouched());
					TouchState.touch(targ);
					if (! withinElement(e, targ, 'fromElement')) {
						return func(e);
					}
				}
			};
		}
	},
	
	mouseleave: {
		evt: 'touchmove',
		bindTo: document,
		buildFunc: function(targ, func) {
			return function(e) {
				var evtTarg = mee.getEventElement(e);
				if (evtTarg !== targ && TouchState.isIn(targ)) {
					addRelatedTarget(e, evtTarg, 'toElement');
					TouchState.touch(evtTarg);
					TouchState.isIn(targ, false);
					evtTarg = null;
					if (! withinElement(e, targ, 'toElement')) {
						return func(e);
					}
				}
				evtTarg = null;
			};
		}
	}
	
};

// ----------------------------------------------------------------------------
//  External Interface


window.mee = {
	
	/**
	 * Binds an event to an object
	 *
	 * @access  public
	 * @param   object    the objec to bind to
	 * @prarm   string    the event to bind to
	 * @param   function  the event function
	 * @return  function
	 */
	bind: function(obj, evt, func) {
		// Parameter tests
		if (typeof obj !== 'object' || obj == null) {return false;}
		if (typeof evt !== 'string') {return false;}
		if (typeof func !== 'function') {return false;}
		
		// Remove an "on" from the event name
		if (/^on/.test(evt)) {evt = evt.substring(2);}
		
		// A flag telling if the event function has been built yet
		var needsBuilding = true,
		
		// The eventual return value
		ret = false,
		
		// A list of events to bind
		events = false,
		
		// Get the change data for the event
		eventChanges = touchEventChanges[evt] || false;
		
		// Add useful mouse event support for touch devices
		if (isTouch() && eventChanges) {
			var target = obj;
			if (eventChanges.evt) {
				evt = eventChanges.evt;
			}
			if (eventChanges.bindTo) {
				obj = eventChanges.bindTo;
			}
			if (eventChanges.buildFunc) {
				needsBuilding = false;
				func = eventChanges.buildFunc(target, func);
			}
		}
		
		// Add mouseenter/mouseleave events to non-support UAs
		else if (! supportsEnterLeave()) {
			switch (evt) {
				case 'mouseenter':
					evt = 'mouseover';
					func = buildEventFunction(func, function(e) {
						return (! withinElement(e, obj, 'toElement'));
					});
					needsBuilding = false;
				break;
				case 'mouseleave':
					evt = 'mouseleave';
					func = buildEventFunction(func, function(e) {
						return (! withinElement(e, obj, 'fromElement'));
					});
					needsBuilding = false;
				break;
			}
		}
		
		// Check if we haven't previously built the event function and
		// do so if still needed.
		if (needsBuilding) {
			func = buildEventFunction(func);
		}
		
		// Handle binding of complex events
		if (events) {
			return bindMultipleEvents(obj, events);
		} else {
			return bindEvent(obj, evt, func);
		}
	},
	
	/**
	 * Unbinds a mee.js bound event
	 *
	 * @access  public
	 * @param   function  the unbinder returned by mee.bind()
	 * @return  void
	 */
	unbind: function(unbinder) {
		unbinder();
	},
	
	/**
	 * Get the actual event target element (works around the iOS target
	 * always telling you the target is the originating element).
	 *
	 * @link    http://stackoverflow.com/questions/3918842/how-to-find-out-the-actual-event-target-of-touchmove-javascript-event
	 *
	 * @access  public
	 * @param   object    the event object to test
	 * @return  node
	 */
	getEventElement: function(evt) {
		var targ;
		if (isTouch() && evt.touches && evt.touches[0]) {
			// Get event target from a touch event
			var touch = evt.touches[0];
			targ = document.elementFromPoint(touch.pageX, touch.pageY);
		} else {
			// Get the event target
			if (e.target) {
				targ = evt.target;
			} else if (e.srcElement) {
				targ = evt.srcElement;
			}
			// Avoid a safari bug
			if (targ.nodeType === 3) {
				targ = targ.parentNode;
			}
		}
		return targ;
	},
	
	// Expose the support functions in case someone wants
	// access to that information
	UA: {
	
		/**
		 * Checks if the UA is a supported touch device running AppleWebKit
		 *
		 * @access  public
		 * @return  boolean
		 */
		isTouchDevice: function() {
			return isTouch();
		},
	
		/**
		 * Checks if the UA supports mouseenter/mouseleave events
		 *
		 * @access  public
		 * @return  boolean
		 */
		supportsEnterLeave: function() {
			return supportsEnterLeave();
		}
	
	}
	
};

}(window));

/* End of file mee.js */
