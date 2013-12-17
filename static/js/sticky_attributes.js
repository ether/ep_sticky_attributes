var attributes = {
  66: "bold",
  73: "italic",
  85: "underline",
  27: "strikethrough"
}

exports.postAceInit = function(hook, context){
  $('#bold, #italic, #underline, #strikethrough').bind('click', function(button){
    var padeditor = require('ep_etherpad-lite/static/js/pad_editor').padeditor;
    return padeditor.ace.callWithAce(function (ace) {
      rep = ace.ace_getRep();
      if(rep.selStart[0] == rep.selEnd[0] && rep.selEnd[1] == rep.selStart[1]){
        var attribute = $(button)[0].currentTarget.id;
        ace.ace_replaceRange(rep.selStart, rep.selEnd, "V");
        if(rep.selStart[1] != 1){ // seems messy but basically this is required to know if we're following a previous attribute
          rep.selStart[1] = rep.selStart[1]-1;
          rep.selEnd[1] = rep.selEnd[1]-1;
          var isApplied = ace.ace_getAttributeOnSelection(attribute);
          rep.selStart[1] = rep.selStart[1]+1;
          rep.selEnd[1] = rep.selEnd[1]+1;
        }
        rep.selStart[1] = rep.selStart[1]-1; // overwrite the secret hidden character
        if(!isApplied){ // If the attribute is not already applied
          ace.ace_setAttributeOnSelection(attribute, true);
          $('#'+attribute+' > a').addClass('activeButton');
        }else{
          ace.ace_setAttributeOnSelection(attribute, false);
          $('#'+attribute+' > a').removeClass('activeButton');
        }
        ace.ace_toggleAttributeOnSelection("hidden");
      }
    }, "stickyAttribute");
  });
};

// Change the attribute into a class	
exports.aceAttribsToClasses = function(hook, context){
  // console.log("attribs", context);
  if(context.key.indexOf("hidden") !== -1){
    return ['hidden'];
  }
}

exports.aceKeyEvent = function(hook, callstack, editorInfo, rep, documentAttributeManager, evt){
  var evt = callstack.evt;
  var k = evt.keyCode;
  var rep = callstack.rep;
  var documentAttributeManager = callstack.documentAttributeManager;
  // If no text is selected..
  if(rep.selStart[0] == rep.selEnd[0] && rep.selEnd[1] == rep.selStart[1]){
    if(evt.ctrlKey && (k == 66 || k == 73 || k == 85) && evt.type == "keyup"){
      // handling bold, italic or underline event
      callstack.editorInfo.ace_replaceRange(undefined, undefined, "V"); // puts in a secret hidden cahracter
      var attribute = attributes[k]; // which attribute is it?
      // we need to know if the previous char has the attribute bold or not?
      if(rep.selStart[1] != 1){ // seems messy but basically this is required to know if we're following a previous attribute
        rep.selStart[1] = rep.selStart[1]-1;
        rep.selEnd[1] = rep.selEnd[1]-1;
        var isApplied = callstack.editorInfo.ace_getAttributeOnSelection(attribute);
        rep.selStart[1] = rep.selStart[1]+1;
        rep.selEnd[1] = rep.selEnd[1]+1;
      }
      rep.selStart[1] = rep.selStart[1]-1; // overwrite the secret hidden character
      if(!isApplied){ // If the attribute is not already applied
        callstack.editorInfo.ace_setAttributeOnSelection(attribute, true);
        $('#'+attribute+' > a').addClass('activeButton');
      }else{
        callstack.editorInfo.ace_setAttributeOnSelection(attribute, false);
        $('#'+attribute+' > a').removeClass('activeButton');
      }
      documentAttributeManager.setAttributesOnRange(rep.selStart, rep.selEnd, [ ['hidden', true] ]); // hides the car
    }
  }

  // If text is selected IE Control B is placed when a selection is highlighted
  if(rep.selStart[0] !== rep.selEnd[0] && rep.selEnd[1] !== rep.selStart[1]){
    if(evt.ctrlKey && (k == 66 || k == 73 || k == 85) && evt.type == "keyup"){
      checkAttr(callstack);
    }
  }
}

function checkAttr(call){
  var rep = call.rep;
  setTimeout(function(){ // avoid race condition..
    if(rep.selStart[1] != 1){ // seems messy but basically this is required to know if we're following a previous attribute
      $.each(attributes, function(k,attribute){
        rep.selStart[1] = rep.selStart[1]-1;
        rep.selEnd[1] = rep.selEnd[1]-1;
        var isApplied = call.editorInfo.ace_getAttributeOnSelection(attribute);
        if(isApplied){
          $('#'+attribute+' > a').addClass('activeButton');
        }else{
          $('#'+attribute+' > a').removeClass('activeButton');
        }
        rep.selStart[1] = rep.selStart[1]+1;
        rep.selEnd[1] = rep.selEnd[1]+1;
      });
    }
  },250);
}

exports.aceEditEvent = function(hook, call, editorInfo, rep, documentAttributeManager){
  // If it's not a click or a key event and the text hasn't changed then do nothing
  if(!(call.callstack.type == "handleClick") && !(call.callstack.type == "handleKeyEvent") && !(call.callstack.docTextChanged)){
    return false;
  }
  checkAttr(call);
}

exports.aceEditorCSS = function(hook_name, cb){return ["/ep_sticky_attributes/static/css/ace.css"];} // inner pad CSS
