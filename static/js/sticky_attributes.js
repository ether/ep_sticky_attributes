'use strict';

const attributes = {
  66: 'bold',
  73: 'italic',
  85: 'underline',
  53: 'strikethrough',
};
const lineAttributes = {
  alignLeft: 'left',
  alignCenter: 'center',
  alignJustify: 'justify',
  alignRight: 'right',
};

const getStickyState = () => {
  if (!clientVars.sticky) clientVars.sticky = {};
  if (!clientVars.sticky.lineAttributes) clientVars.sticky.lineAttributes = {};
  return clientVars.sticky;
};

exports.getStickyLineAttributeFromButton = (buttonEle) => {
  if (!buttonEle) return null;
  const dataKey = $(buttonEle).data('key');
  if (dataKey && lineAttributes[dataKey]) return ['align', lineAttributes[dataKey]];
  const dataAlign = $(buttonEle).data('align');
  if (dataAlign == null) return null;
  return ['align', ['left', 'center', 'justify', 'right'][Number(dataAlign)]];
};

exports.applyStickyLineAttributes = (rep, documentAttributeManager, sticky) => {
  if (!rep.selStart || !rep.selEnd || !sticky || !sticky.lineAttributes) return false;
  const isNotSelection = (rep.selStart[0] === rep.selEnd[0] && rep.selEnd[1] === rep.selStart[1]);
  if (!isNotSelection) return false;
  let changed = false;
  $.each(sticky.lineAttributes, (attribute, value) => {
    if (value == null) return;
    if (documentAttributeManager.getAttributeOnLine(rep.selStart[0], attribute) === value) return;
    documentAttributeManager.setAttributeOnLine(rep.selStart[0], attribute, value);
    changed = true;
  });
  return changed;
};

exports.postAceInit = (hook, context) => {
  // On click of a bold etc. button
  $('.buttonicon-bold, .buttonicon-italic, .buttonicon-underline, .buttonicon-strikethrough')
      .parent().parent().bind('click', (button) => {
        const padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;
        return padeditor.ace.callWithAce((ace) => {
          const rep = ace.ace_getRep();

          // if we're not selecting any text
          if (rep.selStart[0] === rep.selEnd[0] && rep.selEnd[1] === rep.selStart[1]) {
            // get the clicked attribute IE bold, italic
            const buttonEle = $(button)[0].currentTarget;
            const attribute = $(buttonEle).data('key');

            // seems messy but basically this is required to know if we're
            // following a previous attribute
            let isApplied;
            if (rep.selStart[1] !== 1) {
              isApplied = ace.ace_getAttributeOnSelection(attribute, true);
            }
            const isFirstCharacter = (rep.selStart[1] === 0);
            if (!isFirstCharacter) rep.selStart[1] += 1;

            // Append a hidden character the current caret position
            ace.ace_replaceRange(rep.selStart, rep.selEnd, 'V');

            rep.selStart[1] -= 1; // overwrite the secret hidden character

            if (!isApplied) { // If the attribute is not already applied
              // console.log("enabling", attribute, "on selection");
              ace.ace_setAttributeOnSelection(attribute, true);
              $(`.buttonicon-${attribute}`).parent().addClass('activeButton');
            } else {
              ace.ace_setAttributeOnSelection(attribute, false);
              $(`.buttonicon-${attribute}`).parent().removeClass('activeButton');
            }
            ace.ace_toggleAttributeOnSelection('hidden');
          }
        }, 'stickyAttribute');
      });

  $('body').on(
      'click',
      'li[data-key="alignLeft"], li[data-key="alignCenter"], ' +
      'li[data-key="alignJustify"], li[data-key="alignRight"]',
      function () {
        const padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;
        return padeditor.ace.callWithAce((ace) => {
          const rep = ace.ace_getRep();
          if (rep.selStart[0] !== rep.selEnd[0] || rep.selEnd[1] !== rep.selStart[1]) return;
          const sticky = getStickyState();
          const stickyLineAttribute = exports.getStickyLineAttributeFromButton(this);
          if (!stickyLineAttribute) return;
          sticky.lineAttributes[stickyLineAttribute[0]] = stickyLineAttribute[1];
        }, 'stickyLineAttribute');
      });
};

// Change the attribute into a class
exports.aceAttribsToClasses = (hook, context) => {
  if (context.key.indexOf('hidden') !== -1) {
    return ['hidden'];
  }
};

exports.aceKeyEvent = (hook, callstack, cb) => {
  const evt = callstack.evt;
  const k = evt.keyCode;
  const isAttributeKey = (
    evt.ctrlKey && (
      k === 66 || k === 73 || k === 85 || k === 53) && evt.type === 'keyup');

  // Don't clobber an already-pending sticky on every unrelated keyup.
  // aceEditEvent only consumes clientVars.sticky on the next
  // `idleWorkTimer` tick, which typically fires *after* the key-up of
  // the character that was just typed. The old code reset
  // `clientVars.sticky = {}` at the top of every aceKeyEvent, so the
  // keyup of the next typed character cleared the sticky state before
  // the idleWorkTimer had a chance to apply bold — the keyboard
  // shortcut silently did nothing (#64). The consumer in aceEditEvent
  // already resets `setAttribute` back to false once it has applied.
  const sticky = getStickyState();

  if (isAttributeKey) {
    sticky.setAttribute = true;
    sticky.attribute = attributes[k];
    return cb();
  }

  return cb(false);
};

const checkAttr = (context, documentAttributeManager) => {
  const rep = context.rep;
  // seems messy but basically this is required to know if
  // we're following a previous attribute
  if (rep.selStart[1] !== 1) {
    $.each(attributes, (k, attribute) => {
      const isApplied = documentAttributeManager.getAttributeOnSelection(attribute, true);
      if (isApplied) {
        $(`.buttonicon-${attribute}`).parent().addClass('activeButton');
      } else {
        $(`.buttonicon-${attribute}`).parent().removeClass('activeButton');
      }
    });
  }
};


exports.aceEditEvent = (hook, context, cb) => {
  const call = context.callstack;
  const documentAttributeManager = context.documentAttributeManager;
  const padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;

  if (call.type !== 'idleWorkTimer') return cb();
  const rep = context.documentAttributeManager.rep;
  if (!rep.selStart && !rep.selEnd) return cb();

  // Are we supposed to be applying or removing an attribute?
  let isToProcess = true;
  const sticky = getStickyState();
  if (!sticky.setAttribute) {
    isToProcess = false;
  }
  let isNotSelection = false;
  let isFirstCharacter;
  let attribute;

  if (isToProcess) {
    // Looks like we have work to do.. Let's go!
    isNotSelection = (rep.selStart[0] === rep.selEnd[0] && rep.selEnd[1] === rep.selStart[1]);
    isFirstCharacter = (rep.selStart[1] === 0);
    attribute = sticky.attribute;
  }

  // Create a hidden element and set the attribute on it
  if (isNotSelection && isToProcess) {
    if (!isFirstCharacter) rep.selStart[1] -= 1;
    const isApplied = documentAttributeManager.getAttributeOnSelection(attribute, false);
    if (!isFirstCharacter) rep.selStart[1] += 1;

    // Create a hidden character
    padeditor.ace.callWithAce((ace) => {
      ace.ace_replaceRange(undefined, undefined, 'V'); // puts in a secret hidden cahracter
    });

    rep.selStart[1] -= 1; // overwrite the secret hidden character

    if (!isApplied) { // If the attribute is not already applied
      padeditor.ace.callWithAce((ace) => {
        ace.ace_setAttributeOnSelection(attribute, true);
      });
      $(`.buttonicon-${attribute}`).parent().addClass('activeButton');
    } else {
      padeditor.ace.callWithAce((ace) => {
        ace.ace_setAttributeOnSelection(attribute, false);
      });
      $(`.buttonicon-${attribute}`).parent().removeClass('activeButton');
    }

    // Set the hidden character to hidden
    documentAttributeManager.setAttributesOnRange(
        rep.selStart, rep.selEnd, [['hidden', true]]); // hides the char
  }

  if (sticky) sticky.setAttribute = false;
  exports.applyStickyLineAttributes(rep, documentAttributeManager, sticky);

  setTimeout(() => {
    checkAttr(context, documentAttributeManager);
  }, 100);
  return cb();
};

exports.aceEditorCSS = (hookName) => ['/ep_sticky_attributes/static/css/ace.css'];
