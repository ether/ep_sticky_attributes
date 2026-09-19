'use strict';

const attributes = {
  66: 'bold',
  73: 'italic',
  85: 'underline',
  53: 'strikethrough',
};

// Etherpad stores attribute values as strings and an attribute counts as
// "set" whenever its value is a non-empty string (see linestylefilter's
// `if (!key || !value) continue;`). `''` is therefore the only value that
// actually removes an attribute. The old code passed the boolean `false`,
// which `AttributeMap.set()` stringifies to `'false'` — a non-empty value,
// so the character kept rendering as bold/italic/… and pressing the button
// a second time never turned the style off (#63).
const ATTRIB_ON = 'true';
const ATTRIB_OFF = '';

// Core marks a depressed formatting button by putting `selected` on the <a>
// wrapping the icon (SELECT_BUTTON_CLASS in ace2_inner). `activeButton` is
// kept alongside it for backwards compatibility with custom skins, but no
// shipped skin styles it, which is why sticky mode never looked pressed
// (#65).
const ACTIVE_BUTTON_CLASSES = 'activeButton selected';

const setButtonState = (attribute, isActive) => {
  $(`.buttonicon-${attribute}`).parent().toggleClass(ACTIVE_BUTTON_CLASSES, !!isActive);
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

            // `getAttributeOnSelection(attribute, true)` answers "does the
            // character *before* the caret have this attribute?", and it does
            // so by decrementing `rep.selStart[1]` in place. Snapshot the
            // caret column and put it back afterwards rather than trying to
            // guess how far the probe moved it.
            //
            // The old code skipped the probe entirely when the caret sat at
            // column 1 and then still applied the `+= 1` compensation, which
            // left `rep.selStart` one column *past* `rep.selEnd`. That both
            // made the second button press re-apply the attribute instead of
            // clearing it and handed `replaceRange()` an inverted range
            // ("Invalid changeset: claimed length does not match actual
            // length"). See #63.
            const caretColumn = rep.selStart[1];
            const isFirstCharacter = (caretColumn === 0);
            const isApplied =
                !isFirstCharacter && ace.ace_getAttributeOnSelection(attribute, true);
            rep.selStart[1] = caretColumn;

            // Append a hidden character the current caret position
            ace.ace_replaceRange(rep.selStart, rep.selEnd, 'V');

            rep.selStart[1] -= 1; // overwrite the secret hidden character

            if (!isApplied) { // If the attribute is not already applied
              // console.log("enabling", attribute, "on selection");
              ace.ace_setAttributeOnSelection(attribute, ATTRIB_ON);
              setButtonState(attribute, true);
            } else {
              ace.ace_setAttributeOnSelection(attribute, ATTRIB_OFF);
              setButtonState(attribute, false);
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

  // Don't clobber an already-pending sticky on every unrelated keyup.
  // aceEditEvent only consumes clientVars.sticky on the next
  // `idleWorkTimer` tick, which typically fires *after* the key-up of
  // the character that was just typed. The old code reset
  // `clientVars.sticky = {}` at the top of every aceKeyEvent, so the
  // keyup of the next typed character cleared the sticky state before
  // the idleWorkTimer had a chance to apply bold — the keyboard
  // shortcut silently did nothing (#64). The consumer in aceEditEvent
  // already resets `setAttribute` back to false once it has applied.
  if (!clientVars.sticky) clientVars.sticky = {};

  if (isAttributeKey) {
    clientVars.sticky.setAttribute = true;
    clientVars.sticky.attribute = attributes[k];
    return cb();
  }

  return cb(false);
};

const checkAttr = (context, documentAttributeManager) => {
  const rep = context.rep;
  if (!rep.selStart) return;
  // Every `getAttributeOnSelection(…, true)` call walks `rep.selStart[1]`
  // back by one character, so without restoring it between iterations the
  // second attribute would be read one column too far left, the third two
  // columns too far left, and so on. Restore the caret column after each
  // probe so all four buttons report on the same character.
  const caretColumn = rep.selStart[1];
  // `prevChar` only kicks in for a collapsed caret, so the only case with
  // nothing to look at is a caret parked at the very start of a line.
  const isCollapsed = (rep.selStart[0] === rep.selEnd[0] && rep.selStart[1] === rep.selEnd[1]);
  const nothingToRead = (isCollapsed && caretColumn === 0);
  $.each(attributes, (k, attribute) => {
    const isApplied =
        !nothingToRead && documentAttributeManager.getAttributeOnSelection(attribute, true);
    rep.selStart[1] = caretColumn;
    setButtonState(attribute, isApplied);
  });
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
        ace.ace_setAttributeOnSelection(attribute, ATTRIB_ON);
      });
      setButtonState(attribute, true);
    } else {
      padeditor.ace.callWithAce((ace) => {
        ace.ace_setAttributeOnSelection(attribute, ATTRIB_OFF);
      });
      setButtonState(attribute, false);
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
