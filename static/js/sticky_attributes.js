var attributes = {
  66: "bold",
  73: "italic",
  85: "underline",
  53: "strikethrough"
}

exports.postAceInit = function(hook, context){
  // On click of a bold etc. button
  $('.buttonicon-bold, .buttonicon-italic, .buttonicon-underline, .buttonicon-strikethrough').parent().parent().bind('click', function(button){
    var padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;
    return padeditor.ace.callWithAce(function (ace) {
      rep = ace.ace_getRep();

      // if we're not selecting any text
      if(rep.selStart[0] == rep.selEnd[0] && rep.selEnd[1] == rep.selStart[1]){

        // get the clicked attribute IE bold, italic
        var buttonEle = $(button)[0].currentTarget;
        var attribute = $(buttonEle).data("key");

        if(rep.selStart[1] !== 1){ // seems messy but basically this is required to know if we're following a previous attribute
          var isApplied = ace.ace_getAttributeOnSelection(attribute, true);
        }
        var isFirstCharacter = (rep.selStart[1] === 0);
        if(!isFirstCharacter) rep.selStart[1] = rep.selStart[1]+1;

        // Append a hidden character the current caret position
        ace.ace_replaceRange(rep.selStart, rep.selEnd, "V");

        rep.selStart[1] = rep.selStart[1]-1; // overwrite the secret hidden character

        if(!isApplied){ // If the attribute is not already applied
          // console.log("enabling", attribute, "on selection");
          ace.ace_setAttributeOnSelection(attribute, true);
          $('.buttonicon-'+attribute).parent().addClass('activeButton');
        }else{
          ace.ace_setAttributeOnSelection(attribute, false);
          $('.buttonicon-'+attribute).parent().removeClass('activeButton');
        }
        ace.ace_toggleAttributeOnSelection("hidden");
      }
    }, "stickyAttribute");
  });
};

// Change the attribute into a class
exports.aceAttribsToClasses = function(hook, context){
  if(context.key.indexOf("hidden") !== -1){
    return ['hidden'];
  }
}

exports.aceKeyEvent = function(hook, callstack, cb){
  var evt = callstack.evt;
  var k = evt.keyCode;
  var documentAttributeManager = callstack.documentAttributeManager;
  var isAttributeKey = (evt.ctrlKey && (k == 66 || k == 73 || k == 85 || k == 53) && evt.type === "keyup");
  clientVars.sticky = {};

  if(isAttributeKey){
    var attribute = attributes[k]; // which attribute is it?
    clientVars.sticky.setAttribute = true;
    clientVars.sticky.attribute = attribute;
  }else{
    clientVars.sticky.setAttribute = false;
    return false;
  }
}

function checkAttr(context, documentAttributeManager){
  var rep = context.rep;
  if(rep.selStart[1] != 1){ // seems messy but basically this is required to know if we're following a previous attribute
    $.each(attributes, function(k,attribute){
      var isApplied = documentAttributeManager.getAttributeOnSelection(attribute, true);
      if(isApplied){
        $('.buttonicon-'+attribute).parent().addClass('activeButton');
      }else{
        $('.buttonicon-'+attribute).parent().removeClass('activeButton');
      }
    });
  }
}


exports.aceEditEvent = function(hook, context, editorInfo){
  var call = context.callstack;
  var documentAttributeManager = context.documentAttributeManager;
  var padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;

  if(call.type !== "idleWorkTimer") return;
  var rep = context.documentAttributeManager.rep;
  if(!rep.selStart && !rep.selEnd) return;

  // Are we supposed to be applying or removing an attribute?
  if(!clientVars.sticky || !clientVars.sticky.setAttribute){
    var isToProcess = false;
  }else{
    var isToProcess = true;
  }

  if(isToProcess){
    // Looks like we have work to do.. Let's go!
    var isNotSelection = (rep.selStart[0] == rep.selEnd[0] && rep.selEnd[1] == rep.selStart[1]);
    var hiddenCharacterSpan = (rep.selStart[1] === rep.selEnd[1]-1);
    var hiddenCharacterSelected = documentAttributeManager.getAttributeOnSelection("hidden", false);
    var isFirstCharacter = (rep.selStart[1] === 0);
    var attribute = clientVars.sticky.attribute;

    // console.log("isNotSelection", isNotSelection, "hiddenCharacterSpan", hiddenCharacterSpan, "hiddenCharSelected", hiddenCharacterSelected);
    // console.log("isFirstCharacter", isFirstCharacter, "clientVars.sticky", clientVars.sticky);
  }

  // Create a hidden element and set the attribute on it
  if(isNotSelection && isToProcess){
    if(!isFirstCharacter) rep.selStart[1] = rep.selStart[1]-1;
    var isApplied = documentAttributeManager.getAttributeOnSelection(attribute, false);
    if(!isFirstCharacter) rep.selStart[1] = rep.selStart[1]+1;

    // Create a hidden character
    padeditor.ace.callWithAce(function (ace) {
      ace.ace_replaceRange(undefined, undefined, "V"); // puts in a secret hidden cahracter
    });

    rep.selStart[1] = rep.selStart[1]-1; // overwrite the secret hidden character

    if(!isApplied){ // If the attribute is not already applied
      padeditor.ace.callWithAce(function (ace) {
        ace.ace_setAttributeOnSelection(attribute, true);
      });
      $('.buttonicon-'+attribute).parent().addClass('activeButton');
    }else{
      padeditor.ace.callWithAce(function (ace) {
        ace.ace_setAttributeOnSelection(attribute, false);
      });
      $('.buttonicon-'+attribute).parent().removeClass('activeButton');
    }

    // Set the hidden character to hidden
    documentAttributeManager.setAttributesOnRange(rep.selStart, rep.selEnd, [ ['hidden', true] ]); // hides the char

  }

  if(clientVars.sticky){
    clientVars.sticky.setAttribute = false;
  }

  setTimeout(function(){
    checkAttr(context, documentAttributeManager);
  }, 100);
}

exports.aceEditorCSS = function(hook_name, cb){return ["/ep_sticky_attributes/static/css/ace.css"];} // inner pad CSS
