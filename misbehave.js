/*global define:false */
/**
* Copyright 2012-2017 Craig Campbell
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*
* Mousetrap is a simple keyboard shortcut library for Javascript with
* no external dependencies
*
* @version 1.6.2
* @url craig.is/killing/mice
*
* 2018 - Porting to ES6 Module by Fabio Cevasco
*/

// Check if mousetrap is used inside browser, if not, return
/*if (!window) {
  return;
}*/

/**
* mapping of special keycodes to their corresponding keys
*
* everything in this dictionary cannot use keypress events
* so it has to be here to map to the correct keycodes for
* keyup/keydown events
*
* @type {Object}
*/
var _MAP = {
  8: 'backspace',
  9: 'tab',
  13: 'enter',
  16: 'shift',
  17: 'ctrl',
  18: 'alt',
  20: 'capslock',
  27: 'esc',
  32: 'space',
  33: 'pageup',
  34: 'pagedown',
  35: 'end',
  36: 'home',
  37: 'left',
  38: 'up',
  39: 'right',
  40: 'down',
  45: 'ins',
  46: 'del',
  91: 'meta',
  93: 'meta',
  224: 'meta'
};

/**
* mapping for special characters so they can support
*
* this dictionary is only used incase you want to bind a
* keyup or keydown event to one of these keys
*
* @type {Object}
*/
var _KEYCODE_MAP = {
  106: '*',
  107: '+',
  109: '-',
  110: '.',
  111 : '/',
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
    220: '\\',
    221: ']',
    222: '\''
};

/**
* this is a mapping of keys that require shift on a US keypad
* back to the non shift equivelents
*
* this is so you can use keyup events with these keys
*
* note that this will only work reliably on US keyboards
*
* @type {Object}
*/
var _SHIFT_MAP = {
  '~': '`',
  '!': '1',
  '@': '2',
  '#': '3',
  '$': '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
  '(': '9',
        ')': '0',
        '_': '-',
        '+': '=',
        ':': ';',
        '\"': '\'',
        '<': ',',
        '>': '.',
        '?': '/',
        '|': '\\'
};

/**
* this is a list of special strings you can use to map
* to modifier keys when you specify your keyboard shortcuts
*
* @type {Object}
*/
var _SPECIAL_ALIASES = {
  'option': 'alt',
  'command': 'meta',
  'return': 'enter',
  'escape': 'esc',
  'plus': '+',
  'mod': /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta' : 'ctrl'
};

/**
* variable to store the flipped version of _MAP from above
* needed to check if we should use keypress or not when no action
* is specified
*
* @type {Object|undefined}
*/
var _REVERSE_MAP;

/**
* loop through the f keys, f1 to f19 and add them to the map
* programatically
*/
for (var i = 1; i < 20; ++i) {
  _MAP[111 + i] = 'f' + i;
}

/**
* loop through to map numbers on the numeric keypad
*/
for (i = 0; i <= 9; ++i) {

  // This needs to use a string cause otherwise since 0 is falsey
  // mousetrap will never fire for numpad 0 pressed as part of a keydown
  // event.
  //
  // @see https://github.com/ccampbell/mousetrap/pull/258
  _MAP[i + 96] = i.toString();
}

/**
* cross browser add event method
*
* @param {Element|HTMLDocument} object
* @param {string} type
* @param {Function} callback
* @returns void
*/
function _addEvent(object, type, callback) {
  if (object.addEventListener) {
    object.addEventListener(type, callback, false);
    return;
  }

  object.attachEvent('on' + type, callback);
}

/**
* takes the event and returns the key character
*
* @param {Event} e
* @return {string}
*/
function _characterFromEvent(e) {

  // for keypress events we should return the character as is
  if (e.type == 'keypress') {
    var character = String.fromCharCode(e.which);

    // if the shift key is not pressed then it is safe to assume
    // that we want the character to be lowercase.  this means if
    // you accidentally have caps lock on then your key bindings
    // will continue to work
    //
    // the only side effect that might not be desired is if you
    // bind something like 'A' cause you want to trigger an
    // event when capital A is pressed caps lock will no longer
    // trigger the event.  shift+a will though.
    if (!e.shiftKey) {
      character = character.toLowerCase();
    }

    return character;
  }

  // for non keypress events the special maps are needed
  if (_MAP[e.which]) {
    return _MAP[e.which];
  }

  if (_KEYCODE_MAP[e.which]) {
    return _KEYCODE_MAP[e.which];
  }

  // if it is not in the special map

  // with keydown and keyup events the character seems to always
  // come in as an uppercase character whether you are pressing shift
  // or not.  we should make sure it is always lowercase for comparisons
  return String.fromCharCode(e.which).toLowerCase();
}

/**
* checks if two arrays are equal
*
* @param {Array} modifiers1
* @param {Array} modifiers2
* @returns {boolean}
*/
function _modifiersMatch(modifiers1, modifiers2) {
  return modifiers1.sort().join(',') === modifiers2.sort().join(',');
}

/**
* takes a key event and figures out what the modifiers are
*
* @param {Event} e
* @returns {Array}
*/
function _eventModifiers(e) {
  var modifiers = [];

  if (e.shiftKey) {
    modifiers.push('shift');
  }

  if (e.altKey) {
    modifiers.push('alt');
  }

  if (e.ctrlKey) {
    modifiers.push('ctrl');
  }

  if (e.metaKey) {
    modifiers.push('meta');
  }

  return modifiers;
}

/**
* prevents default for this event
*
* @param {Event} e
* @returns void
*/
function _preventDefault(e) {
  if (e.preventDefault) {
    e.preventDefault();
    return;
  }

  e.returnValue = false;
}

/**
* stops propogation for this event
*
* @param {Event} e
* @returns void
*/
function _stopPropagation(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
    return;
  }

  e.cancelBubble = true;
}

/**
* determines if the keycode specified is a modifier key or not
*
* @param {string} key
* @returns {boolean}
*/
function _isModifier(key) {
  return key == 'shift' || key == 'ctrl' || key == 'alt' || key == 'meta';
}

/**
* reverses the map lookup so that we can look for specific keys
* to see what can and can't use keypress
*
* @return {Object}
*/
function _getReverseMap() {
  if (!_REVERSE_MAP) {
    _REVERSE_MAP = {};
    for (var key in _MAP) {

      // pull out the numeric keypad from here cause keypress should
      // be able to detect the keys from the character
      if (key > 95 && key < 112) {
        continue;
      }

      if (_MAP.hasOwnProperty(key)) {
        _REVERSE_MAP[_MAP[key]] = key;
      }
    }
  }
  return _REVERSE_MAP;
}

/**
* picks the best action based on the key combination
*
* @param {string} key - character for key
* @param {Array} modifiers
* @param {string=} action passed in
*/
function _pickBestAction(key, modifiers, action) {

  // if no action was picked in we should try to pick the one
  // that we think would work best for this key
  if (!action) {
    action = _getReverseMap()[key] ? 'keydown' : 'keypress';
  }

  // modifier keys don't work as expected with keypress,
  // switch to keydown
  if (action == 'keypress' && modifiers.length) {
    action = 'keydown';
  }

  return action;
}

/**
* Converts from a string key combination to an array
*
* @param  {string} combination like "command+shift+l"
* @return {Array}
*/
function _keysFromString(combination) {
  if (combination === '+') {
    return ['+'];
  }

  combination = combination.replace(/\+{2}/g, '+plus');
  return combination.split('+');
}

/**
* Gets info for a specific key combination
*
* @param  {string} combination key combination ("command+s" or "a" or "*")
* @param  {string=} action
* @returns {Object}
*/
function _getKeyInfo(combination, action) {
  var keys;
  var key;
  var i;
  var modifiers = [];

  // take the keys from this pattern and figure out what the actual
  // pattern is all about
  keys = _keysFromString(combination);

  for (i = 0; i < keys.length; ++i) {
    key = keys[i];

    // normalize key names
    if (_SPECIAL_ALIASES[key]) {
      key = _SPECIAL_ALIASES[key];
    }

    // if this is not a keypress event then we should
    // be smart about using shift keys
    // this will only work for US keyboards however
    if (action && action != 'keypress' && _SHIFT_MAP[key]) {
      key = _SHIFT_MAP[key];
      modifiers.push('shift');
    }

    // if this key is a modifier then add it to the list of modifiers
    if (_isModifier(key)) {
      modifiers.push(key);
    }
  }

  // depending on what the key combination is
  // we will try to pick the best event for it
  action = _pickBestAction(key, modifiers, action);

  return {
    key: key,
    modifiers: modifiers,
    action: action
  };
}

function _belongsTo(element, ancestor) {
  if (element === null || element === document) {
    return false;
  }

  if (element === ancestor) {
    return true;
  }

  return _belongsTo(element.parentNode, ancestor);
}

function Mousetrap(targetElement) {
  var self = this;

  targetElement = targetElement || document;

  if (!(self instanceof Mousetrap)) {
    return new Mousetrap(targetElement);
  }

  /**
  * element to attach key events to
  *
  * @type {Element}
  */
  self.target = targetElement;

  /**
  * a list of all the callbacks setup via Mousetrap.bind()
  *
  * @type {Object}
  */
  self._callbacks = {};

  /**
  * direct map of string combinations to callbacks used for trigger()
  *
  * @type {Object}
  */
  self._directMap = {};

  /**
  * keeps track of what level each sequence is at since multiple
  * sequences can start out with the same sequence
  *
  * @type {Object}
  */
  var _sequenceLevels = {};

  /**
  * variable to store the setTimeout call
  *
  * @type {null|number}
  */
  var _resetTimer;

  /**
  * temporary state where we will ignore the next keyup
  *
  * @type {boolean|string}
  */
  var _ignoreNextKeyup = false;

  /**
  * temporary state where we will ignore the next keypress
  *
  * @type {boolean}
  */
  var _ignoreNextKeypress = false;

  /**
  * are we currently inside of a sequence?
  * type of action ("keyup" or "keydown" or "keypress") or false
  *
  * @type {boolean|string}
  */
  var _nextExpectedAction = false;

  /**
  * resets all sequence counters except for the ones passed in
  *
  * @param {Object} doNotReset
  * @returns void
  */
  function _resetSequences(doNotReset) {
    doNotReset = doNotReset || {};

    var activeSequences = false,
    key;

    for (key in _sequenceLevels) {
      if (doNotReset[key]) {
        activeSequences = true;
        continue;
      }
      _sequenceLevels[key] = 0;
    }

    if (!activeSequences) {
      _nextExpectedAction = false;
    }
  }

  /**
  * finds all callbacks that match based on the keycode, modifiers,
  * and action
  *
  * @param {string} character
  * @param {Array} modifiers
  * @param {Event|Object} e
  * @param {string=} sequenceName - name of the sequence we are looking for
  * @param {string=} combination
  * @param {number=} level
  * @returns {Array}
  */
  function _getMatches(character, modifiers, e, sequenceName, combination, level) {
    var i;
    var callback;
    var matches = [];
    var action = e.type;

    // if there are no events related to this keycode
    if (!self._callbacks[character]) {
      return [];
    }

    // if a modifier key is coming up on its own we should allow it
    if (action == 'keyup' && _isModifier(character)) {
      modifiers = [character];
    }

    // loop through all callbacks for the key that was pressed
    // and see if any of them match
    for (i = 0; i < self._callbacks[character].length; ++i) {
      callback = self._callbacks[character][i];

      // if a sequence name is not specified, but this is a sequence at
      // the wrong level then move onto the next match
      if (!sequenceName && callback.seq && _sequenceLevels[callback.seq] != callback.level) {
        continue;
      }

      // if the action we are looking for doesn't match the action we got
      // then we should keep going
      if (action != callback.action) {
        continue;
      }

      // if this is a keypress event and the meta key and control key
      // are not pressed that means that we need to only look at the
      // character, otherwise check the modifiers as well
      //
      // chrome will not fire a keypress if meta or control is down
      // safari will fire a keypress if meta or meta+shift is down
      // firefox will fire a keypress if meta or control is down
      if ((action == 'keypress' && !e.metaKey && !e.ctrlKey) || _modifiersMatch(modifiers, callback.modifiers)) {

        // when you bind a combination or sequence a second time it
        // should overwrite the first one.  if a sequenceName or
        // combination is specified in this call it does just that
        //
        // @todo make deleting its own method?
        var deleteCombo = !sequenceName && callback.combo == combination;
        var deleteSequence = sequenceName && callback.seq == sequenceName && callback.level == level;
        if (deleteCombo || deleteSequence) {
          self._callbacks[character].splice(i, 1);
        }

        matches.push(callback);
      }
    }

    return matches;
  }

  /**
  * actually calls the callback function
  *
  * if your callback function returns false this will use the jquery
  * convention - prevent default and stop propogation on the event
  *
  * @param {Function} callback
  * @param {Event} e
  * @returns void
  */
  function _fireCallback(callback, e, combo, sequence) {

    // if this event should not happen stop here
    if (self.stopCallback(e, e.target || e.srcElement, combo, sequence)) {
      return;
    }

    if (callback(e, combo) === false) {
      _preventDefault(e);
      _stopPropagation(e);
    }
  }

  /**
  * handles a character key event
  *
  * @param {string} character
  * @param {Array} modifiers
  * @param {Event} e
  * @returns void
  */
  self._handleKey = function(character, modifiers, e) {
    var callbacks = _getMatches(character, modifiers, e);
    var i;
    var doNotReset = {};
    var maxLevel = 0;
    var processedSequenceCallback = false;

    // Calculate the maxLevel for sequences so we can only execute the longest callback sequence
    for (i = 0; i < callbacks.length; ++i) {
      if (callbacks[i].seq) {
        maxLevel = Math.max(maxLevel, callbacks[i].level);
      }
    }

    // loop through matching callbacks for this key event
    for (i = 0; i < callbacks.length; ++i) {

      // fire for all sequence callbacks
      // this is because if for example you have multiple sequences
      // bound such as "g i" and "g t" they both need to fire the
      // callback for matching g cause otherwise you can only ever
      // match the first one
      if (callbacks[i].seq) {

        // only fire callbacks for the maxLevel to prevent
        // subsequences from also firing
        //
        // for example 'a option b' should not cause 'option b' to fire
        // even though 'option b' is part of the other sequence
        //
        // any sequences that do not match here will be discarded
        // below by the _resetSequences call
        if (callbacks[i].level != maxLevel) {
          continue;
        }

        processedSequenceCallback = true;

        // keep a list of which sequences were matches for later
        doNotReset[callbacks[i].seq] = 1;
        _fireCallback(callbacks[i].callback, e, callbacks[i].combo, callbacks[i].seq);
        continue;
      }

      // if there were no sequence matches but we are still here
      // that means this is a regular match so we should fire that
      if (!processedSequenceCallback) {
        _fireCallback(callbacks[i].callback, e, callbacks[i].combo);
      }
    }

    // if the key you pressed matches the type of sequence without
    // being a modifier (ie "keyup" or "keypress") then we should
    // reset all sequences that were not matched by this event
    //
    // this is so, for example, if you have the sequence "h a t" and you
    // type "h e a r t" it does not match.  in this case the "e" will
    // cause the sequence to reset
    //
    // modifier keys are ignored because you can have a sequence
    // that contains modifiers such as "enter ctrl+space" and in most
    // cases the modifier key will be pressed before the next key
    //
    // also if you have a sequence such as "ctrl+b a" then pressing the
    // "b" key will trigger a "keypress" and a "keydown"
    //
    // the "keydown" is expected when there is a modifier, but the
    // "keypress" ends up matching the _nextExpectedAction since it occurs
    // after and that causes the sequence to reset
    //
    // we ignore keypresses in a sequence that directly follow a keydown
    // for the same character
    var ignoreThisKeypress = e.type == 'keypress' && _ignoreNextKeypress;
    if (e.type == _nextExpectedAction && !_isModifier(character) && !ignoreThisKeypress) {
      _resetSequences(doNotReset);
    }

    _ignoreNextKeypress = processedSequenceCallback && e.type == 'keydown';
  };

  /**
  * handles a keydown event
  *
  * @param {Event} e
  * @returns void
  */
  function _handleKeyEvent(e) {

    // normalize e.which for key events
    // @see http://stackoverflow.com/questions/4285627/javascript-keycode-vs-charcode-utter-confusion
    if (typeof e.which !== 'number') {
      e.which = e.keyCode;
    }

    var character = _characterFromEvent(e);

    // no character found then stop
    if (!character) {
      return;
    }

    // need to use === for the character check because the character can be 0
    if (e.type == 'keyup' && _ignoreNextKeyup === character) {
      _ignoreNextKeyup = false;
      return;
    }

    self.handleKey(character, _eventModifiers(e), e);
  }

  /**
  * called to set a 1 second timeout on the specified sequence
  *
  * this is so after each key press in the sequence you have 1 second
  * to press the next key before you have to start over
  *
  * @returns void
  */
  function _resetSequenceTimer() {
    clearTimeout(_resetTimer);
    _resetTimer = setTimeout(_resetSequences, 1000);
  }

  /**
  * binds a key sequence to an event
  *
  * @param {string} combo - combo specified in bind call
  * @param {Array} keys
  * @param {Function} callback
  * @param {string=} action
  * @returns void
  */
  function _bindSequence(combo, keys, callback, action) {

    // start off by adding a sequence level record for this combination
    // and setting the level to 0
    _sequenceLevels[combo] = 0;

    /**
    * callback to increase the sequence level for this sequence and reset
    * all other sequences that were active
    *
    * @param {string} nextAction
    * @returns {Function}
    */
    function _increaseSequence(nextAction) {
      return function() {
        _nextExpectedAction = nextAction;
        ++_sequenceLevels[combo];
        _resetSequenceTimer();
      };
    }

    /**
    * wraps the specified callback inside of another function in order
    * to reset all sequence counters as soon as this sequence is done
    *
    * @param {Event} e
    * @returns void
    */
    function _callbackAndReset(e) {
      _fireCallback(callback, e, combo);

      // we should ignore the next key up if the action is key down
      // or keypress.  this is so if you finish a sequence and
      // release the key the final key will not trigger a keyup
      if (action !== 'keyup') {
        _ignoreNextKeyup = _characterFromEvent(e);
      }

      // weird race condition if a sequence ends with the key
      // another sequence begins with
      setTimeout(_resetSequences, 10);
    }

    // loop through keys one at a time and bind the appropriate callback
    // function.  for any key leading up to the final one it should
    // increase the sequence. after the final, it should reset all sequences
    //
    // if an action is specified in the original bind call then that will
    // be used throughout.  otherwise we will pass the action that the
    // next key in the sequence should match.  this allows a sequence
    // to mix and match keypress and keydown events depending on which
    // ones are better suited to the key provided
    for (var i = 0; i < keys.length; ++i) {
      var isFinal = i + 1 === keys.length;
      var wrappedCallback = isFinal ? _callbackAndReset : _increaseSequence(action || _getKeyInfo(keys[i + 1]).action);
      _bindSingle(keys[i], wrappedCallback, action, combo, i);
    }
  }

  /**
  * binds a single keyboard combination
  *
  * @param {string} combination
  * @param {Function} callback
  * @param {string=} action
  * @param {string=} sequenceName - name of sequence if part of sequence
  * @param {number=} level - what part of the sequence the command is
  * @returns void
  */
  function _bindSingle(combination, callback, action, sequenceName, level) {

    // store a direct mapped reference for use with Mousetrap.trigger
    self._directMap[combination + ':' + action] = callback;

    // make sure multiple spaces in a row become a single space
    combination = combination.replace(/\s+/g, ' ');

    var sequence = combination.split(' ');
    var info;

    // if this pattern is a sequence of keys then run through this method
    // to reprocess each pattern one key at a time
    if (sequence.length > 1) {
      _bindSequence(combination, sequence, callback, action);
      return;
    }

    info = _getKeyInfo(combination, action);

    // make sure to initialize array if this is the first time
    // a callback is added for this key
    self._callbacks[info.key] = self._callbacks[info.key] || [];

    // remove an existing match if there is one
    _getMatches(info.key, info.modifiers, {type: info.action}, sequenceName, combination, level);

    // add this call back to the array
    // if it is a sequence put it at the beginning
    // if not put it at the end
    //
    // this is important because the way these are processed expects
    // the sequence ones to come first
    self._callbacks[info.key][sequenceName ? 'unshift' : 'push']({
      callback: callback,
      modifiers: info.modifiers,
      action: info.action,
      seq: sequenceName,
      level: level,
      combo: combination
    });
  }

  /**
  * binds multiple combinations to the same callback
  *
  * @param {Array} combinations
  * @param {Function} callback
  * @param {string|undefined} action
  * @returns void
  */
  self._bindMultiple = function(combinations, callback, action) {
    for (var i = 0; i < combinations.length; ++i) {
      _bindSingle(combinations[i], callback, action);
    }
  };

  // start!
  _addEvent(targetElement, 'keypress', _handleKeyEvent);
  _addEvent(targetElement, 'keydown', _handleKeyEvent);
  _addEvent(targetElement, 'keyup', _handleKeyEvent);
}

/**
* binds an event to mousetrap
*
* can be a single key, a combination of keys separated with +,
* an array of keys, or a sequence of keys separated by spaces
*
* be sure to list the modifier keys first to make sure that the
* correct key ends up getting bound (the last key in the pattern)
*
* @param {string|Array} keys
* @param {Function} callback
* @param {string=} action - 'keypress', 'keydown', or 'keyup'
* @returns void
*/
Mousetrap.prototype.bind = function(keys, callback, action) {
  var self = this;
  keys = keys instanceof Array ? keys : [keys];
  self._bindMultiple.call(self, keys, callback, action);
  return self;
};

/**
* unbinds an event to mousetrap
*
* the unbinding sets the callback function of the specified key combo
* to an empty function and deletes the corresponding key in the
* _directMap dict.
*
* TODO: actually remove this from the _callbacks dictionary instead
* of binding an empty function
*
* the keycombo+action has to be exactly the same as
* it was defined in the bind method
*
* @param {string|Array} keys
* @param {string} action
* @returns void
*/
Mousetrap.prototype.unbind = function(keys, action) {
  var self = this;
  return self.bind.call(self, keys, function() {}, action);
};

/**
* triggers an event that has already been bound
*
* @param {string} keys
* @param {string=} action
* @returns void
*/
Mousetrap.prototype.trigger = function(keys, action) {
  var self = this;
  if (self._directMap[keys + ':' + action]) {
    self._directMap[keys + ':' + action]({}, keys);
  }
  return self;
};

/**
* resets the library back to its initial state.  this is useful
* if you want to clear out the current keyboard shortcuts and bind
* new ones - for example if you switch to another page
*
* @returns void
*/
Mousetrap.prototype.reset = function() {
  var self = this;
  self._callbacks = {};
  self._directMap = {};
  return self;
};

/**
* should we stop this event before firing off callbacks
*
* @param {Event} e
* @param {Element} element
* @return {boolean}
*/
Mousetrap.prototype.stopCallback = function(e, element) {
  var self = this;

  // if the element has the class "mousetrap" then no need to stop
  if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
    return false;
  }

  if (_belongsTo(element, self.target)) {
    return false;
  }

  // stop for input, select, and textarea
  return element.tagName == 'INPUT' || element.tagName == 'SELECT' || element.tagName == 'TEXTAREA' || element.isContentEditable;
};

/**
* exposes _handleKey publicly so it can be overwritten by extensions
*/
Mousetrap.prototype.handleKey = function() {
  var self = this;
  return self._handleKey.apply(self, arguments);
};

/**
* allow custom key mappings
*/
Mousetrap.addKeycodes = function(object) {
  for (var key in object) {
    if (object.hasOwnProperty(key)) {
      _MAP[key] = object[key];
    }
  }
  _REVERSE_MAP = null;
};

/**
* Init the global mousetrap functions
*
* This method is needed to allow the global mousetrap functions to work
* now that mousetrap is a constructor function.
*/
Mousetrap.init = function() {
  var documentMousetrap = Mousetrap(document);
  for (var method in documentMousetrap) {
    if (method.charAt(0) !== '_') {
      Mousetrap[method] = (function(method) {
        return function() {
          return documentMousetrap[method].apply(documentMousetrap, arguments);
        };
      } (method));
    }
  }
};

Mousetrap.init();
/*
// expose mousetrap to the global object
window.Mousetrap = Mousetrap;

// expose as a common js module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Mousetrap;
}

// expose mousetrap as an AMD module
if (typeof define === 'function' && define.amd) {
  define(function() {
    return Mousetrap;
  });
}
*/

/*
* Simple Javascript undo and redo.
* https://github.com/ArthurClemens/Javascript-Undo-Manager
* Ported to ES6 by Fabio Cevasco
*/

function removeFromTo(array, from, to) {
  array.splice(from,
    !to ||
    1 + to - from + (!(to < 0 ^ from >= 0) && (to < 0 || -1) * array.length));
    return array.length;
}

var UndoManager = function UndoManager() {
  this.commands = [];
  this.index = -1;
  this.limit = 0;
  this.isExecuting = false;
  this.callback = null;
};


// functions
//execute;

UndoManager.prototype.execute = function execute (command, action) {
  if (!command || typeof command[action] !== "function") {
    return this;
  }
  this.isExecuting = true;

  command[action]();

  this.isExecuting = false;
  return this;
};

/*
Add a command to the queue.
*/
UndoManager.prototype.add = function add (command) {
  if (this.isExecuting) {
    return this;
  }
  // if we are here after having called undo,
  // invalidate items higher on the stack
  this.commands.splice(this.index + 1, this.commands.length - this.index);

  this.commands.push(command);

  // if limit is set, remove items from the start
  if (this.limit && this.commands.length > this.limit) {
    removeFromTo(this.commands, 0, -(this.limit+1));
  }

  // set the current index to the end
  this.index = this.commands.length - 1;
  if (this.callback) {
    this.callback();
  }
  return this;
};
/*
Pass a function to be called on undo and redo actions.
*/
UndoManager.prototype.setCallback = function setCallback (callbackFunc) {
  this.callback = callbackFunc;
};
/*
Perform undo: call the undo function at the current index and decrease the index by 1.
*/
UndoManager.prototype.undo = function undo () {
  var command = this.commands[this.index];
  if (!command) {
    return this;
  }
  this.execute(command, "undo");
  this.index -= 1;
  if (this.callback) {
    this.callback();
  }
  return this;
};
/*
Perform redo: call the redo function at the next index and increase the index by 1.
*/
UndoManager.prototype.redo = function redo () {
  var command = this.commands[this.index + 1];
  if (!command) {
    return this;
  }
  this.execute(command, "redo");
  this.index += 1;
  if (this.callback) {
    this.callback();
  }
  return this;
};
/*
Clears the memory, losing all stored states. Reset the index.
*/
UndoManager.prototype.clear = function clear () {
  var prev_size = this.commands.length;

  this.commands = [];
  this.index = -1;

  if (this.callback && (prev_size > 0)) {
    this.callback();
  }
};
UndoManager.prototype.hasUndo = function hasUndo () {
  return this.index !== -1;
};
UndoManager.prototype.hasRedo = function hasRedo () {
  return this.index < (this.commands.length - 1);
};
UndoManager.prototype.getCommands = function getCommands () {
  return this.commands;
};
UndoManager.prototype.getIndex = function getIndex () {
  return this.index;
};
UndoManager.prototype.setLimit = function setLimit (l) {
  this.limit = l;
};

var getSections = function (elem, callback) {
  var sel, range, tempRange, prefix = '', selected = '', suffix = '';

  if (document.activeElement !== elem) {
    suffix = elem.textContent;
  } else if (typeof window.getSelection !== 'undefined') {
    sel = window.getSelection();
    selected = sel.toString();
    if (sel.rangeCount) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.collapse(true);
    }
    tempRange = document.createRange();
    tempRange.selectNodeContents(elem);
    tempRange.setEnd(range.startContainer, range.startOffset);
    prefix = tempRange.toString();

    tempRange.selectNodeContents(elem);
    tempRange.setStart(range.endContainer, range.endOffset);
    suffix = tempRange.toString();

    tempRange.detach();
  } else if ( (sel = document.selection) && sel.type != 'Control') {
    range = sel.createRange();
    tempRange = document.body.createTextRange();
    selected = tempRange.text;

    tempRange.moveToElementText(elem);
    tempRange.setEndPoint('EndToStart', range);
    prefix = tempRange.text;

    tempRange.moveToElementText(elem);
    tempRange.setEndPoint('StartToEnd', range);
    suffix = tempRange.text;
  }

  if (callback)
    { return callback({ prefix: prefix, selected: selected, suffix: suffix }, sel) }
  else
    { return { prefix: prefix, selected: selected, suffix: suffix } }
};

var getTextNodesIn = function (node) {
  var textNodes = [];
  if (node.nodeType == 3) {
    textNodes.push(node);
  } else {
    var children = node.childNodes;
    for (var i = 0, len = children.length; i < len; ++i) {
      textNodes.push.apply(textNodes, getTextNodesIn(children[i]));
    }
  }
  return textNodes
};

var setSelection = function (elem, start, end) {
  if (document.createRange && window.getSelection) {
    var range = document.createRange();
    range.selectNodeContents(elem);
    var textNodes = getTextNodesIn(elem);
    var foundStart = false;
    var charCount = 0, endCharCount;

    for (var i = 0, textNode; textNode = textNodes[i++]; ) {
      endCharCount = charCount + textNode.length;
      if (!foundStart && start >= charCount && (start < endCharCount || (start == endCharCount && i <= textNodes.length))) {
        range.setStart(textNode, start - charCount);
        foundStart = true;
      }
      if (foundStart && end <= endCharCount) {
        range.setEnd(textNode, end - charCount);
        break
      }
      charCount = endCharCount;
    }

    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  } else if (document.selection && document.body.createTextRange) {
    var textRange = document.body.createTextRange();
    textRange.moveToElementText(elem);
    textRange.collapse(true);
    textRange.moveEnd('character', end);
    textRange.moveStart('character', start);
    textRange.select();
  }
};

var allNewLines = /\r\n|\r|\n/g;

var onNewLine = /\r\n|\r|\n/;

var leadingWhitespace = /^\s*/;

var allCharacters = /./g;

var removeIfStartsWith = function (s) { return function (line) { return line.startsWith(s) ? line.slice(s.length) : line; }; };

var defineNewLine = function () {
  var ta = document.createElement('textarea');
  ta.value = '\n';
  if (ta.value.length === 2)
    { return '\r\n' }
  else
    { return '\n' }
};

var Editable = function Editable(elem, ref) {
  if ( ref === void 0 ) ref = {};
  var autoIndent = ref.autoIndent; if ( autoIndent === void 0 ) autoIndent = true;
  var autoOpen = ref.autoOpen; if ( autoOpen === void 0 ) autoOpen = true;
  var autoStrip = ref.autoStrip; if ( autoStrip === void 0 ) autoStrip = true;
  var overwrite = ref.overwrite; if ( overwrite === void 0 ) overwrite = true;
  var softTabs = ref.softTabs; if ( softTabs === void 0 ) softTabs = 2;
  var replaceTab = ref.replaceTab; if ( replaceTab === void 0 ) replaceTab = true;
  var pairs = ref.pairs; if ( pairs === void 0 ) pairs = [['(', ')'], ['[', ']'], ['{', '}'], ['"'], ["'"]];
  var oninput = ref.oninput; if ( oninput === void 0 ) oninput = function () {};
  var undoLimit = ref.undoLimit; if ( undoLimit === void 0 ) undoLimit = 0;
  var behavior = ref.behavior;
  var store = ref.store;


  var editable = this;
  var handler = behavior(defineNewLine(), softTabs ? ' '.repeat(softTabs) : '\t');

  var undoMgr = new UndoManager();
  undoMgr.setLimit(undoLimit);

  var setDom = function (value) {
    var content = value.prefix + value.selected + value.suffix;
    elem.textContent = content;
    oninput(content, value);
    setSelection(elem, value.prefix.length, value.prefix.length + value.selected.length);
  };

  var update = function (content) {
    var previous = store();
    undoMgr.add({
      undo : function () { setDom(previous); },
      redo : function () { setDom(content); }
    });
    store(content);
    setDom(content);
  };

  var keys = new Mousetrap(elem);
  keys.stopCallback = function () { return false; }; // work without needing to set combokeys class on elements

  keys.bind('mod+z', function () { undoMgr.undo(); return false });
  keys.bind('shift+mod+z', function () { undoMgr.redo(); return false });

  if (autoIndent) {
    keys.bind('enter', function () { return getSections(elem, function (ref) {
      var prefix = ref.prefix;
      var selected = ref.selected;
      var suffix = ref.suffix;

      update(handler.autoIndent(prefix, selected, suffix));
      return false
    }); });
  }

  if (autoStrip) {
    keys.bind('backspace', function () { return getSections(elem, function (ref, selection) {
      var prefix = ref.prefix;
      var selected = ref.selected;
      var suffix = ref.suffix;

      if (selection.isCollapsed && handler.testAutoStrip(pairs, prefix, selected, suffix)) {
        update(handler.autoStrip(prefix, selected, suffix));
        return false
      }
    }); });
  }

  var fnAutoOpen = function (opening, closing) { return function () { return getSections(elem, function (ref) {
    var prefix = ref.prefix;
    var selected = ref.selected;
    var suffix = ref.suffix;

    update(handler.autoOpen(opening, closing, prefix, selected, suffix));
    return false
  }); }; };

  var fnOverwrite = function (closing) { return function () { return getSections(elem, function (ref, selection) {
    var prefix = ref.prefix;
    var selected = ref.selected;
    var suffix = ref.suffix;

    if (selection.isCollapsed && handler.testOverwrite(closing, prefix, selected, suffix)) {
      update(handler.overwrite(closing, prefix, selected, suffix));
      return false
    }
  }); }; };

  pairs.forEach(function (ref) {
    var opening = ref[0];
    var closing = ref[1];

    if (closing) {
      if (autoOpen){ keys.bind(opening, fnAutoOpen(opening, closing)); }
      if (overwrite) { keys.bind(closing, fnOverwrite(closing)); }
    } else {
      if (autoOpen && overwrite) {
        keys.bind(opening, function () { return getSections(elem, function (ref, selection) {
          var prefix = ref.prefix;
          var selected = ref.selected;
          var suffix = ref.suffix;

          if (selection.isCollapsed && handler.testOverwrite(opening, prefix, selected, suffix))
            { update(handler.overwrite(opening, prefix, selected, suffix)); }
          else
            { update(handler.autoOpen(opening, opening, prefix, selected, suffix)); }
          return false
        }); });
      } else {
        if (autoOpen){ keys.bind(opening, fnAutoOpen(opening, opening)); }
        if (overwrite) { keys.bind(opening, fnOverwrite(opening)); }
      }
    }
  });

  if (replaceTab) {
    keys.bind('tab', function () { return getSections(elem, function (ref) {
      var prefix = ref.prefix;
      var selected = ref.selected;
      var suffix = ref.suffix;

      update(handler.tabIndent(prefix, selected, suffix));
      return false
    }); });

    keys.bind('shift+tab', function () { return getSections(elem, function (ref) {
      var prefix = ref.prefix;
      var selected = ref.selected;
      var suffix = ref.suffix;

      update(handler.tabUnindent(prefix, selected, suffix));
      return false
    }); });
  }

  editable.inputListener = elem.addEventListener('input', function () { return getSections(elem, update); });

  oninput(elem.textContent, store());

  // expose for haxxoers
  editable.elem = elem;
  editable.handler = handler;
  editable.undoMgr = undoMgr;
  editable.store = store;
  editable.setDom = setDom;
  editable.update = update;
  editable.keys = keys;
};

Editable.prototype.destroy = function destroy () {
  this.elem.removeEventListener('input', this.inputListener);
  this.keys.detach();
  this.undoMgr.clear();
};

Editable.prototype.focus = function focus () {
  this.elem.focus();
};

Editable.prototype.blur = function blur () {
  this.elem.blur();
};

function store(value) {
  function gettersetter() {
    if (arguments.length) {
      value = arguments[0];
    }
    return value
  }
  return gettersetter
}

var autoIndent = function (newLine, tab, prefix, selected, suffix) {
  var prevLine = prefix.split(onNewLine).splice(-1)[0];
  var prefEnd = prefix.slice(-1);
  var suffStart = suffix.charAt(0);

  if ((prevLine.match(/\(/g) || []).length > (prevLine.match(/\)/g) || []).length) {
    var whitespace = prevLine.match(leadingWhitespace)[0];
    prefix += newLine + whitespace + prevLine.slice(whitespace.length, prevLine.lastIndexOf('(') + 1).replace(allCharacters, ' ');
  } else if (prefEnd === '{') {
    prefix += newLine + prevLine.match(leadingWhitespace)[0] + tab;
    if (suffStart === '}')
      { suffix = newLine + prevLine.match(leadingWhitespace)[0] + suffix; }
  } else {
    prefix += newLine + prevLine.match(leadingWhitespace)[0];
  }
  selected = '';
  if (suffix === '') { suffix = newLine; }
  return { prefix: prefix, selected: selected, suffix: suffix }
};

var autoOpen = function (opening, closing, prefix, selected, suffix) {
  prefix += opening;
  suffix = closing + suffix;
  return { prefix: prefix, selected: selected, suffix: suffix }
};

var autoStrip = function (prefix, selected, suffix) {
  prefix = prefix.slice(0, -1);
  suffix = suffix.slice(1);
  return { prefix: prefix, selected: selected, suffix: suffix }
};

// content in selection is handled in index.js
var testAutoStrip = function (pairs, prefix, selected, suffix) {
  var result = false;
  pairs.forEach(function (ref) {
    var opening = ref[0];
    var closing = ref[1];

    closing = closing ? closing : opening;
    if (prefix.slice(-1) === opening && suffix.charAt(0) === closing) { result = true; }
  });
  return result
};

var overwrite = function (closing, prefix, selected, suffix) {
  prefix += closing;
  suffix = suffix.slice(1);
  return { prefix: prefix, selected: selected, suffix: suffix }
};

// content in selection is handled in index.js
var testOverwrite = function (closing, prefix, selected, suffix) {
  return suffix.charAt(0) === closing
};

var tabIndent = function (newLine, tab, prefix, selected, suffix) {
  var prefLines = prefix.split(onNewLine);
  var prevLine = prefLines.splice(-1)[0];

  if (selected === '') {
    if (tab === '\t' || prevLine.length % tab.length === 0) {
      prefix += tab;
    } else {
      prefix += ' '.repeat(tab.length - prevLine.length % tab.length);
    }
  } else {
    prevLine = tab + prevLine;
    prefix = prefLines.concat(prevLine).join(newLine);
    selected = selected.replace(allNewLines, newLine + tab);
  }
  return { prefix: prefix, selected: selected, suffix: suffix }
};

var tabUnindent = function (newLine, tab, prefix, selected, suffix) {
  var lines = selected.split(onNewLine);
  var prevLine = prefix.split(onNewLine).splice(-1)[0];

  if (lines.length === 1) {
    if (prefix.endsWith(tab))
      { prefix = prefix.slice(0, -tab.length); }
    else { // indent instead
      if (tab === '\t' || prevLine.length % tab.length === 0) {
        prefix += tab;
      } else {
        prefix += ' '.repeat(tab.length - prevLine.length % tab.length);
      }
    }
  } else {
    var prevLength = prevLine.length;
    if (prevLength) {
      prevLine = removeIfStartsWith(tab)(prevLine);
      prefix = prefix.slice(0, -prevLength) + prevLine;
    }
    lines = lines.map(removeIfStartsWith(tab));
    selected = lines.join(newLine);
  }
  return { prefix: prefix, selected: selected, suffix: suffix }
};

function JsBehavior(newLine, tab) {
  return {
    autoIndent    : function () {
      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];

      return autoIndent.apply(void 0, [ newLine, tab ].concat( args ));
  },
    autoOpen      : autoOpen,
    autoStrip     : autoStrip,
    testAutoStrip : testAutoStrip,
    overwrite     : overwrite,
    testOverwrite : testOverwrite,
    tabIndent     : function () {
      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];

      return tabIndent.apply(void 0, [ newLine, tab ].concat( args ));
  },
    tabUnindent   : function () {
      var args = [], len = arguments.length;
      while ( len-- ) args[ len ] = arguments[ len ];

      return tabUnindent.apply(void 0, [ newLine, tab ].concat( args ));
  }
  }
}

var Misbehave = (function (Editable$$1) {
  function Misbehave(elem, opts) {
    if ( opts === void 0 ) opts = {};

    if (typeof opts.store === 'undefined') { opts.store = store(getSections(elem)); }
    if (typeof opts.behavior === 'undefined') { opts.behavior = JsBehavior; }

    Editable$$1.call(this, elem, opts);
  }

  if ( Editable$$1 ) Misbehave.__proto__ = Editable$$1;
  Misbehave.prototype = Object.create( Editable$$1 && Editable$$1.prototype );
  Misbehave.prototype.constructor = Misbehave;

  return Misbehave;
}(Editable));

export { Misbehave };
