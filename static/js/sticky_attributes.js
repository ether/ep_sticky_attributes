exports.postAceInit = function(hook, context){
  $('#bold, #italic, #underline, #strikethrough').bind('click', function(button){
    var padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;
    return padeditor.ace.callWithAce(function (ace) {
      rep = ace.ace_getRep();
      if(rep.selStart[0] == rep.selEnd[0] && rep.selEnd[1] == rep.selStart[1]){
        ace.ace_replaceRange(rep.selStart, rep.selEnd, "V");
        ace.ace_performSelectionChange([rep.selStart[0],rep.selStart[1]-1], rep.selStart, false);
        ace.ace_toggleAttributeOnSelection($(button)[0].currentTarget.id);
        ace.ace_toggleAttributeOnSelection("hidden");
      }
    }, "stickyAttribute");
  });
};

// Change the attribute into a class	
exports.aceAttribsToClasses = function(hook, context){
  console.log("attribs", context);
  if(context.key.indexOf("hidden") !== -1){
    return ['hidden'];
  }
}

exports.aceKeyEvent = function(hook, callstack, editorInfo, rep, documentAttributeManager, evt){
  var evt = callstack.evt;
  var k = evt.keyCode;
  var rep = callstack.rep;
  var documentAttributeManager = callstack.documentAttributeManager;
  var attributes = {
    66: "bold",
    73: "italic",
    85: "underline"
  }
  if(rep.selStart[0] == rep.selEnd[0] && rep.selEnd[1] == rep.selStart[1]){
    if(evt.ctrlKey && (k == 66 || k == 73 || k == 85) && evt.type == "keyup"){
      // handling bold, italic or underline event
      callstack.editorInfo.ace_replaceRange(undefined, undefined, "V");
      var attribute = attributes[k]; // which attribute is it?
      // we need to know if the previous char has the attribute bold or not?
      if(rep.selStart[1] != 1){
        rep.selStart[1] = rep.selStart[1]-1;
        rep.selEnd[1] = rep.selEnd[1]-1;
        var isApplied = callstack.editorInfo.ace_getAttributeOnSelection(attribute);
        rep.selStart[1] = rep.selStart[1]+1;
        rep.selEnd[1] = rep.selEnd[1]+1;
      }
      rep.selStart[1] = rep.selStart[1]-1;
      if(!isApplied){ // If the attribute is not already applied
        callstack.editorInfo.ace_setAttributeOnSelection(attribute, true);
      }else{
        callstack.editorInfo.ace_setAttributeOnSelection(attribute, false);
      }
      documentAttributeManager.setAttributesOnRange(rep.selStart, rep.selEnd, [ ['hidden', true] ]);
    }
  }
}

exports.aceEditEvent = function(hook, call, editorInfo, rep, documentAttributeManager){
  // If it's not a click or a key event and the text hasn't changed then do nothing
  if(!(call.callstack.type == "handleClick") && !(call.callstack.type == "handleKeyEvent") && !(call.callstack.docTextChanged)){
    return false;
  }
  setTimeout(function(){ // avoid race condition..
    // the caret is in a new position..  Let's do some funky shit
    if ( call.editorInfo.ace_getAttributeOnSelection("bold") ) { // show the button as being depressed..  Not sad, but active.. You know the drill bitches.
      $('#bold > a').addClass('activeButton');
    }else{
      $('#bold > a').removeClass('activeButton');
    }
    if ( call.editorInfo.ace_getAttributeOnSelection("italic") ) { // show the button as being depressed..  Not sad, but active.. You know the drill bitches.
      $('#italic > a').addClass('activeButton');
    }else{
      $('#italic > a').removeClass('activeButton');
    }
    if ( call.editorInfo.ace_getAttributeOnSelection("underline") ) { // show the button as being depressed..  Not sad, but active.. You know the drill bitches.
      $('#underline > a').addClass('activeButton');
    }else{
      $('#underline > a').removeClass('activeButton');
    }

  },250);
}

exports.aceEditorCSS = function(hook_name, cb){return ["/ep_sticky_attributes/static/css/ace.css"];} // inner pad CSS
