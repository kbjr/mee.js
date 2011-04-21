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
	current = evt.relatedTarget || evt[fallback] || false;
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
	// Bind using dojo
	if (dojo && dojo.connect) {
		method = function(obj, evt, func) {
			var connection = dojo.connect(obj, evt, func);
			return function() {
				dojo.disconnect(connection);
			};
		};
	}
	// Bind using DOM 1 (standard)
	else if (document.addEventListener) {
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
 * A state object for tracking the last touched element
 *
 * @access  private
 */
touchState = (new (function() {
	
	// Only build it if it's needed
	if (isTouch()) {
	
		var
		self = this,
		touches = [ ],
		
		// The event tracker function
		trackerFunc = function(e) {
			for (var i = 0, c = e.changedTouches.length; i < c; i++) {
				touches.push(e.changedTouches[i]);
			}
		};
		
		// Bind the needed tracker events
		bindMultipleEvents(document, {
			touchstart: trackerFunc,
			touchmove: trackerFunc
		});
		
		// Get all of the touches stored
		self.getTouches = function(before) {
			var arr = [ ];
			for (var i = 0, c = touches.length; i < c; i++) {
				if (touches[i].identifier === before) {break;}
				arr.push(touches[i]);
			}
			return arr;
		};
		
		// Get a specific touch
		self.getTouch = function(index) {
			if (index < 0) {
				index += touches.length - 1;
			}
			try {
				return touches[i] || null;
			} catch(e) {return null;}
		};
		
	}
	
})());

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
		events = false;
		
		// Add useful mouse event support for touch devices
		if (isTouch()) {
			// The events mousedown/mouseup/mousemove should all be bound at the
			// document level to avoid a shortcoming in iOS's event target handling
			if (evt === 'mousedown' || evt === 'mouseup' || evt === 'mousemove') {
				var origObj = obj; obj = document;
				func = buildEventFunction(func, function(e) {
					return (origObj === mee.getEventElement(e));
				});
			}
			switch (evt) {
				case 'mousedown':
					evt = 'touchstart';
				break;
				case 'mouseup':
					evt = 'touchend';
				break;
				case 'mousemove':
					evt = 'touchmove';
				break;
				case 'mouseover':
					// TODO This is not emulated at the current time
				break;
				case 'mouseout':
					// TODO This is not emulated at the current time
				break;
				case 'mouseenter':
					// TODO This is not emulated at the current time
				break;
				case 'mouseleave':
					// TODO This is not emulated at the current time
				break;
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
			targ = document.elementFromPoint(touch.clientX, touch.clientY);
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
