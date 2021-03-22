'use strict';

const attributes = {
  66: 'bold',
  73: 'italic',
  85: 'underline',
  53: 'strikethrough',
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

  clientVars.sticky = {};

  if (isAttributeKey) {
    const attribute = attributes[k]; // which attribute is it?
    clientVars.sticky.setAttribute = true;
    clientVars.sticky.attribute = attribute;
  } else {
    clientVars.sticky.setAttribute = false;
    return cb(false);
  }

  return cb();
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
  if (!clientVars.sticky || !clientVars.sticky.setAttribute) {
    isToProcess = false;
  }
  let isNotSelection = false;
  let isFirstCharacter;
  let attribute;

  if (isToProcess) {
    // Looks like we have work to do.. Let's go!
    isNotSelection = (rep.selStart[0] === rep.selEnd[0] && rep.selEnd[1] === rep.selStart[1]);
    isFirstCharacter = (rep.selStart[1] === 0);
    attribute = clientVars.sticky.attribute;
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

  if (clientVars.sticky) {
    clientVars.sticky.setAttribute = false;
  }

  setTimeout(() => {
    checkAttr(context, documentAttributeManager);
  }, 100);
  return cb();
};

exports.aceEditorCSS = (hookName) => ['/ep_sticky_attributes/static/css/ace.css'];
