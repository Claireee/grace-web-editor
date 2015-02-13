/*jslint browser: true*/
/*globals $, Blob, FileReader, URL, alert, atob, btoa, confirm, prompt*/

"use strict";

var path = require("path");

require("setimmediate");

exports.setup = function (tree) {
  var input, onOpenCallbacks, name, newFile, upload, currentDirectory, lastSelect, currentOpenedFile;
  var rightClickFile, rightClickDire, openedFile, uploadStoreCurrentDirectory, uploadStoreLastSelect;
  
  input = $("#upload-input");
  upload = $("#upload");
  newFile = $("#new-file");

  onOpenCallbacks = [];

  function validateGivenName(givenName, category, directory) {
   if (givenName[0] === ".") {
      alert("Names must not begin with a dot.");
      return false;
    }

    if (!/^[\w.]+$/.test(givenName)) {
      alert("Only letters, dots, numbers, and underscores are allowed.");
      return false;
    }

    if (directory !== undefined) {
      givenName = directory.attr("dire-name") + "/" + givenName;
    }

    if (localStorage.hasOwnProperty(category + ":" + givenName)) {
      alert("That name is already taken.");
      return false;
    }

    return true;
  }

  function validateName(givenName, category, directory) {
    if (arguments.length === 2) {
      return validateGivenName(givenName, category, currentDirectory);

    } else if (arguments.length === 3){
      return validateGivenName(givenName, category, directory);
    }
  }

  function getName(lastName, category, directory) {
    var name = prompt("Name of " + category + ":");

    if (name !== null && name.length > 0) {
      if (path.extname(name) === "") {
        name += path.extname(lastName);
      }

      if (arguments.length === 2) {

        if (!validateName(name, category)) {
          return getName(name, category);
        }

      } else if (arguments.length === 3) {
        
        if (!validateName(name, category, directory)) {
          return getName(name, category, directory);
        }
      }

      return name;
    }

    return false;
  }

  function contents(name) {
    if (!localStorage.hasOwnProperty("file:" + name)) {
      throw new Error("No such file " + name);
    }

    return localStorage["file:" + name];
  }

  function onOpen(callback) {
    onOpenCallbacks.push(callback);
  }

  function openFile(name) {
    var content, slashIndex, dir, noChange;

    if (!localStorage.hasOwnProperty("file:" + name)) {
      throw new Error("Open of unknown file " + name);
    }

    noChange = false;

    if (currentDirectory !== undefined) {

      if (currentDirectory.hasClass("directory")) {

        if (currentDirectory.find("ul").css('display') === "none") {
          slashIndex = name.lastIndexOf("/");

          if (slashIndex !== -1) {
            dir = name.substring(0, slashIndex);
          } 

          if (currentDirectory.attr("dire-name") === dir) {
            noChange = true;
          }
        }
      }
    } 

    if (!noChange) {

      if (lastSelect !== undefined) {
        lastSelect.css({'font-weight': '', 'color': ''});
      }

      tree.find('[data-name="' + name + '"]').css({'font-weight': 'bold', 'color': '#FF0000'});
      lastSelect = tree.find('[data-name="' + name + '"]');
      localStorage.coloredName = "file:" + name;
    }
    
    slashIndex = name.lastIndexOf("/");

    if (slashIndex !== -1) {
      dir = name.substring(0, slashIndex);
      currentDirectory = tree.find('[dire-name="' + dir + '"]');
    } else {
      currentDirectory = undefined;
    }
    
    openedFile = name;
    localStorage.currentFile = name;
    content = localStorage["file:" + name];

    if (isText(name)) {
      $("#image-view").addClass("hidden");
      $("#audio-view").addClass("hidden");

      var audioTag = document.querySelector('audio');
      audioTag.src = "";
      audioTag.type = "";

      onOpenCallbacks.forEach(function (callback) {
        callback(name, content);
      });
    } else if (isImage(name)) {
      $("#grace-view").addClass("hidden");
      $("#audio-view").addClass("hidden");
      $("#image-view").removeClass("hidden");

      var audioTag = document.querySelector('audio');
      audioTag.src = "";
      audioTag.type = "";

      var imageTag = document.querySelector('img');
      imageTag.src = content;
    } else if (isAudio(name)) {
      $("#grace-view").addClass("hidden");
      $("#image-view").addClass("hidden");
      $("#audio-view").removeClass("hidden");

      var audioTag = document.querySelector('audio');
      audioTag.src = content;
      audioTag.type = mediaType(name);
    }
  }

  function save(content) {
    if (!currentOpenedFile) {
      throw new Error("Save when no file is open");
    }

    localStorage["file:" + currentOpenedFile] = content;
  }

  function rename(from, to, reOpenFile) {
    var content, file, newDataName, slashIndex, directory;

    file = from;

    if (!file) {
      throw new Error("Rename when no file is open");
    }

    if (!to) {
      return;
    }

    if (path.extname(to) === "") {
      to += path.extname(from);
    }

    newDataName = to;
    slashIndex = file.lastIndexOf("/");

    if (slashIndex !== -1) {
      directory = tree.find('[dire-name="' + file.substring(0, slashIndex) + '"]');
      newDataName = file.substring(0, slashIndex) + "/" + newDataName;
    } else {
      directory = undefined;
    }

    if (!validateName(to, "file", directory)) {
      return;
    }

    content = localStorage["file:" + file];
    delete localStorage["file:" + file];

    localStorage["file:" + newDataName] = content;
    tree.find('[data-name="' + file + '"]').attr("data-name", newDataName);
    tree.find('[data-name="' + newDataName + '"]').find(".file-name").text(to);

    if (from === localStorage.currentFile) {
      localStorage.currentFile = newDataName;
    }

    if (reOpenFile) {
      openFile(newDataName);
    }
  }

  function renameDirectory(from, to) {
    var content, newDireName, slashIndex, directory;

    if (!from) {
      return;
    }

    if (!to) {
      return;
    }

    newDireName = to;
    slashIndex = from.lastIndexOf("/");

    if (slashIndex !== -1) {
      directory = tree.find('[dire-name="' + from.substring(0, slashIndex) + '"]');
      newDireName = from.substring(0, slashIndex) + "/" + newDireName;
    } else {
      directory = undefined;
    }

    if (!validateName(to, "directory", directory)) {
      return;
    }

    content = localStorage["directory:" + from];
    delete localStorage["directory:" + from];

    localStorage["directory:" + newDireName] = content;
    tree.find('[dire-name="' + from + '"]').attr("dire-name", newDireName);
    tree.find('[dire-name="' + newDireName + '"]').find(".directory-name").contents().get(0).nodeValue = to;

    renameChildren(from.length, newDireName);
  }

  function renameChildren(startIndex, newDireName) {
    var content, oldName, newName;
    var dire = tree.find('[dire-name="' + newDireName + '"]');

    dire.find("ul").children().each(function () {

      if ($(this).hasClass("file")) {
        oldName = $(this).attr("data-name");
        newName = newDireName + oldName.substring(startIndex);
        content = localStorage["file:" + oldName];
        delete localStorage["file:" + oldName];

        localStorage["file:" + newName] = content;
        tree.find('[data-name="' + oldName + '"]').attr("data-name", newName);
    
        if (oldName === localStorage.currentFile) {
          localStorage.currentFile = newName;
        }
        
      } else if ($(this).hasClass("directory")) {
        oldName = $(this).attr("dire-name");
        newName = newDireName + oldName.substring(startIndex);
        content = localStorage["directory:" + oldName];
        delete localStorage["directory:" + oldName];

        localStorage["directory:" + newName] = content;
        tree.find('[dire-name="' + oldName + '"]').attr("dire-name", newName);
      }
    });
  }

  function removeIndicator(file) {
    if (isText(file)) {
      tree.find('[data-name="' + file + '"]').children(".icon").removeClass("withIndicator");
      tree.find('[data-name="' + file + '"]').children(".icon").addClass("noIndicator");
    }
  }

  function removeGivenFile(file) {
    if (!file) {
      throw new Error("Remove when no file is open");
    }

    delete localStorage["file:" + file];
    tree.find('[data-name="' + file + '"]').remove();

    if (openedFile === file) {
      if (isText(file)) {
        $("#grace-view").addClass("hidden");
      } else if (isImage(file)) {
        $("#image-view").addClass("hidden");
      } else if (isAudio(file)) {
        $("#audio-view").addClass("hidden");
      } 
    }
  }

  function remove(name){
    if (arguments.length === 0) {
      removeGivenFile(localStorage.currentFile);
      delete localStorage.currentFile;

    } else if (arguments.length === 1){
      removeGivenFile(name);

      if (name === localStorage.currentFile) {
        delete localStorage.currentFile;
      }
    }
  }

  function removeDirectory(dire){
    var direName = dire.attr("dire-name");

    if (!dire.find("ul")[0].hasChildNodes()){
      delete localStorage["directory:" + direName];
      tree.find('[dire-name="' + direName + '"]').remove();

    } else {
      dire.find("ul").children().each(function () {
        if ($(this).hasClass("file")) {
          remove($(this).attr("data-name"));
        } else if ($(this).hasClass("directory")) {
          removeDirectory($(this));
        }
      });
      delete localStorage["directory:" + direName];
      tree.find('[dire-name="' + direName + '"]').remove();
    }
  }

  function isChanged(name, value) {
    if (!localStorage.hasOwnProperty("file:" + name)) {
      throw new Error("Cannot compare change non-existent file " + name);
    }

    if (isText(name)) {
      tree.find('[data-name="' + name + '"]').children(".icon").removeClass("noIndicator");
      tree.find('[data-name="' + name + '"]').children(".icon").addClass("withIndicator");
    }

    currentOpenedFile = name;
    return localStorage["file:" + name] !== value;
  }

  function isText(name) {
    var ext = path.extname(name);

    return ext === "" ||
    ext === ".grace" || ext === ".txt" || ext === ".json" ||
    ext === ".xml" || ext === ".js" || ext === ".html" || ext === ".xhtml";
  }

  function isImage(name) {
    var ext = path.extname(name);

    return ext === ".jpg" || ext === ".jpeg" || ext === ".bmp" || ext === ".gif" || ext === ".png";
  }

  function isAudio(name) {
    var ext = path.extname(name);

    return ext === ".mp3" || ext === ".ogg" || ext === ".wav";
  }

  function mediaType(name) {
    var ext = path.extname(name);
    var type = "";

    switch (ext) {
      case ".mp3":
        type = "audio/mpeg";
        break;
      case ".ogg":
        type = "audio/ogg";
        break;
      case ".wav":
        type = "audio/wav";
        break;
    }

    return type;
  }

  function toggleMenu (menu) {
    menu.finish().toggle(100).

    css({
      top: event.pageY + "px",
      left: event.pageX + "px"
    });
  }

  function rightClickCreate (directory, category) {
    var storeCurrentDirectory = currentDirectory;
    var storeLastSelect = lastSelect;
    currentDirectory = directory;

    if (category === "file") {
      createFile();  
    } else if (category === "directory") {
      createDirectory();  
    }
     
    if (lastSelect === storeLastSelect) {
      currentDirectory = storeCurrentDirectory;
    }
  }

  function addFile(name) {
    var div, inserted, li, parent, slashIndex;

    li = $("<li>");
    li.addClass("file");
    li.attr("data-name", name);

    if (isText(name)) {
      div = $("<div>");
      div.addClass("icon");
      div.addClass("noIndicator");
      li.append(div);
    }

    div = $("<div>");
    div.addClass("file-name");

    slashIndex = name.lastIndexOf("/");

    if (slashIndex !== -1) {
      name = name.substring(slashIndex + 1);
    } 

    div.text(name);
    li.append(div);

    if (path.extname(name) === ".grace") {
      li.addClass("grace");
    }

    inserted = false;

    if (currentDirectory === undefined) {
      parent = tree;
    } else {
      parent = currentDirectory.children().children();
    }

    parent.children().each(function () {
      if (path.extname($(this).text()).substring(1) === path.extname(name).substring(1) && $(this).hasClass("file")) {
        if ($(this).text() > name) {
          $(this).before(li);
          inserted = true;
          return false;
        }
      } else if (path.extname($(this).text()).substring(1) > path.extname(name).substring(1) && $(this).hasClass("file")) {
        $(this).before(li);
        inserted = true;
        return false;
      }
    });

    if (!inserted) {
      parent.append(li);
    }

    li.draggable({
      revert: "invalid",
      scroll: false,
      helper: "clone",
      appendTo: "body"
    });

    return li;
  }

  function addDirectory(name) {
    var div, inserted, li, ul, parent, slashIndex;

    li = $("<li>");
    li.addClass("directory");
    li.attr("dire-name", name);

    div = $("<div>");
    div.addClass("icon");
    div.addClass("close");
    li.append(div);

    div = $("<div>");
    div.addClass("directory-name");

    slashIndex = name.lastIndexOf("/");

    if (slashIndex !== -1) {
      name = name.substring(slashIndex + 1);
    } 

    div.text(name);
    ul = $("<ul>");
    ul.css({'display': 'block'});

    div.append(ul);
    li.append(div);

    if (currentDirectory === undefined) {
      parent = tree;
    } else {
      parent = currentDirectory.children().children();
    }

    inserted = false;

    parent.children().each(function () {
      if ($(this).text() > name || $(this).hasClass("file")) {
        $(this).before(li);
        inserted = true;
        return false;
      }
    });
  
    if (!inserted) {
      parent.append(li);
    }

    li.draggable({
      revert: "invalid",
      scroll: false,
      helper: "clone",
      appendTo: "body"
    });

    li.droppable({
      greedy: true,
      scroll: false,
      tolerance: "pointer",

      drop: function(event, ui) {
        if (ui.draggable.hasClass("file")) {

          if (!dropFile(ui.draggable, li)) {
            ui.draggable.draggable("option", "revert", true);
          }

        } else if (ui.draggable.hasClass("directory")) {

          if (!dropDirectory(ui.draggable, li)) {
            ui.draggable.draggable("option", "revert", true);
          }
        }
      }
    });

    return li;
  }

  function dropFile(draggedFile, droppedDire) {
    var droppedName, dir, content, storeCurrentDirectory;
    var draggedName = draggedFile.attr("data-name");
    var name = draggedName;
    var slashIndex = draggedName.lastIndexOf("/");

    if (droppedDire !== tree) {
      droppedName = droppedDire.attr("dire-name");

      if (slashIndex !== -1) {
        dir = draggedName.substring(0, slashIndex);
        name = draggedName.substring(slashIndex + 1);
      }

      if (droppedName === dir) {
        return false;
      }

    } else {

      if (slashIndex !== -1) {
        name = draggedName.substring(slashIndex + 1);
      } else {
        return false;
      }

      droppedDire = undefined;
    }

    if (!validateName(name, "file", droppedDire)) {
      name = getName(name, "file", droppedDire);

      if (!name) {
        return false;
      }
    }

    if (droppedDire !== undefined) {
      name = droppedName + "/" + name;
    }

    storeCurrentDirectory = currentDirectory;
    currentDirectory = droppedDire;

    addFile(name);
    currentDirectory = storeCurrentDirectory;

    if (draggedFile.children().hasClass("withIndicator")) {
      tree.find('[data-name="' + name + '"]').children(".icon").removeClass("noIndicator");
      tree.find('[data-name="' + name + '"]').children(".icon").addClass("withIndicator");
    }

    content = localStorage["file:" + draggedName];
    delete localStorage["file:" + draggedName];
    tree.find('[data-name="' + draggedName + '"]').remove();
    localStorage["file:" + name] = content;

    if (openedFile === draggedName) {
      openFile(name);

    } else if (lastSelect !== undefined) {
      if (lastSelect.attr("data-name") === draggedName) {
        lastSelect.css({'font-weight': '', 'color': ''});
        tree.find('[data-name="' + name + '"]').css({'font-weight': 'bold', 'color': '#FF0000'});
        lastSelect = tree.find('[data-name="' + name + '"]');
      }
    }
    
    return true;
  }

  function dropDirectory(draggedDire, droppedDire) {
    var droppedName, dir, newDire, display, content, storeCurrentDirectory;
    var draggedName = draggedDire.attr("dire-name");
    var name = draggedName;
    var slashIndex = draggedName.lastIndexOf("/");

    if (droppedDire !== tree) {
      droppedName = droppedDire.attr("dire-name");

      if (slashIndex !== -1) {
        dir = draggedName.substring(0, slashIndex);
        name = draggedName.substring(slashIndex + 1);
      }

      if (droppedName === dir) {
        return false;
      }

    } else {

      if (slashIndex !== -1) {
        name = draggedName.substring(slashIndex + 1);
      } else {
        return false;
      }

      droppedDire = undefined;
    }

    if (!validateName(name, "directory", droppedDire)) {
        name = getName(name, "directory", droppedDire);

        if (!name) {
          return false;
        }
    }

    if (droppedDire !== undefined) {
      name = droppedName + "/" + name;
    }

    storeCurrentDirectory = currentDirectory;
    currentDirectory = droppedDire;

    newDire = addDirectory(name);
    currentDirectory = storeCurrentDirectory;

    display = draggedDire.find("ul").css('display');
    newDire.children().children("ul").css({'display': display});

    if (newDire.find("ul").css('display') === "block") {
      newDire.children(".icon").removeClass("close");
      newDire.children(".icon").addClass("open");
    }

    modifyChildren(draggedDire, newDire);

    if (currentDirectory !== undefined) {
      if (currentDirectory.attr("dire-name") === draggedName) {
          if (lastSelect !== undefined) {
            lastSelect.css({'font-weight': '', 'color': ''});
          }
        newDire.children().css({'font-weight': 'bold', 'color': '#FF0000'});
        newDire.children().find("*").css({'color': '#000000'});
        newDire.children().find(".file").css({'font-weight': 'normal'});

        currentDirectory = newDire;
        lastSelect = newDire.find("*");
      }
    }

    content = localStorage["directory:" + draggedName];
    delete localStorage["directory:" + draggedName];
    tree.find('[dire-name="' + draggedName + '"]').remove();
    localStorage["directory:" + name] = content;

    return true;
  }

  function modifyChildren(draggedDire, newDire) {
    draggedDire.children().children().children().each(function () {

      if ($(this).hasClass("file")) {
        dropFile($(this), newDire);

      } else if ($(this).hasClass("directory")) {
        dropDirectory($(this), newDire);
      }
    });
  }

  function createFile() {
    var file = prompt("Name of new file:");

    if (file !== null && file.length > 0) {
      if (path.extname(file) === "") {
        file += ".grace";
      }

      if (!validateName(file, "file")) {
        file = getName(file, "file");

        if (!file) {
          return;
        }
      }

      if (currentDirectory !== undefined) {
        file = currentDirectory.attr("dire-name") + "/" + file;
      }

      localStorage["file:" + file] = "";
      addFile(file).click();
    }
  }

  function createDirectory() {
    var directory = prompt("Name of new directory:");

    if (directory !== null && directory.length > 0) {
      if (!validateName(directory, "directory")) {
        directory = getName(directory, "directory");

        if (!directory) {
          return;
        }
      }

      if (currentDirectory !== undefined) {
        directory = currentDirectory.attr("dire-name") + "/" + directory;
      }

      localStorage["directory:" + directory] = "";
      addDirectory(directory).click();
    }
  }

  upload.click(function () {
    input.click();
  });

  input.change(function () {
    var i, l, file, fileName, fileNameList, lastValid;
    var hasFinished = true;

    function readFileList(currentFileName, currentFile){
      var reader = new FileReader();

      reader.onload = function (event) {
        var result = event.target.result;
        
        try {
          localStorage["file:" + currentFileName] = result;
        }
        catch (err) {
          console.error(err.message);
          return;
        }
        
        addFile(currentFileName);

        if (lastValid === currentFileName) {
          openFile(currentFileName);

          if (uploadStoreLastSelect !== undefined){

            if (lastSelect === uploadStoreLastSelect) {
              currentDirectory = uploadStoreCurrentDirectory;
            }
          }
        }
      };

      if (isText(currentFileName)) {
        reader.readAsText(currentFile);
      } else if (isImage(currentFileName) || isAudio(currentFileName)){
        reader.readAsDataURL(currentFile);
      }
    }

    fileNameList = [];

    for (i = 0, l = this.files.length; i < l; i += 1) {
      file = this.files[i];
      fileName = file.name;

        if (!validateName(fileName, "file")) {
          if (!confirm("Rename the file on upload?")) {
            continue;
          }

          fileName = getName(fileName, "file");

          if (!fileName) {
            continue;
          }
        }

      if (currentDirectory !== undefined) {
        fileName = currentDirectory.attr("dire-name") + "/" + fileName;
      }

      fileNameList[i] = fileName;
    }

    for (i = 0; i < l; i += 1) {
      if (fileNameList[i] !== undefined) {
        hasFinished = false;
        readFileList(fileNameList[i], this.files[i]);
        lastValid = fileNameList[i];
      }
    }

    if (hasFinished) {
      if (uploadStoreLastSelect !== undefined){
        if (lastSelect === uploadStoreLastSelect) {
          currentDirectory = uploadStoreCurrentDirectory;
        }
      }
    }
  });

  newFile.click(function () {
    $(".clickNew-menu").toggle();
  });

  tree.on("click", ".directory", function(e) {
    e.stopPropagation();

    var slashIndex, dir;
    var current = $(this);
    var noChange = false;

    if (currentDirectory !== undefined) {

      if (currentDirectory.hasClass("directory")) {

        if (currentDirectory.find("ul").css('display') === "none") {
          slashIndex = current.attr("dire-name").lastIndexOf("/");

          if (slashIndex !== -1) {
            dir = current.attr("dire-name").substring(0, slashIndex);
          } else {
            dir = current.attr("dire-name");
          }

          if (currentDirectory.attr("dire-name") === dir) {
            noChange = true;
          }
        }
      }
    }

    if (!noChange) {
      if (lastSelect !== undefined) {
        lastSelect.css({'font-weight': '', 'color': ''});
      }

      current.children().css({'font-weight': 'bold', 'color': '#FF0000'});
      current.children().find("*").css({'color': '#000000'});
      current.children().find(".file").css({'font-weight': 'normal'});

      currentDirectory = current;
      lastSelect = current.find("*");
      localStorage.coloredName = "directory:" + current.attr("dire-name");
    }

    if (current.find("ul").css('display') === "none") {
      current.children().children("ul").css({'display': 'block'});
      current.children(".icon").removeClass("close");
      current.children(".icon").addClass("open");
        
    } else if (current.find("ul").css('display') === "block") {
      current.children().children("ul").css({'display': 'none'});
      current.children(".icon").removeClass("open");
      current.children(".icon").addClass("close");
    }
  });

  tree.on("click", ".file", function (e) {
    e.stopPropagation();
    var name = $(this).attr("data-name");
    openFile(name);
  });

  tree.on("click", function (e) {
    if (lastSelect !== undefined) {
        lastSelect.css({'font-weight': '', 'color': ''});
    }

    lastSelect = undefined;
    currentDirectory = undefined;
    localStorage.coloredName = "";
  });

  tree.droppable({
    greedy: true,
    scroll: false,

    drop: function(event, ui) {
      if (ui.draggable.hasClass("file")) {

        if (!dropFile(ui.draggable, tree)) {
          ui.draggable.draggable("option", "revert", true);
        }

      } else if (ui.draggable.hasClass("directory")) {

        if (!dropDirectory(ui.draggable, tree)) {
          ui.draggable.draggable("option", "revert", true);
        }
      }
    }
  });

  tree.on("contextmenu", ".file", function (e) {
    e.stopPropagation();
    e.preventDefault();

    rightClickFile = $(this);
    toggleMenu($(".rightClickFile-menu"));

    return false;
  });

  tree.on("contextmenu", ".directory", function (e) {
    e.stopPropagation();
    e.preventDefault();

    rightClickDire = $(this);
    toggleMenu($(".rightClickDire-menu"));

    return false;
  });

  tree.on("contextmenu", function (e) {
    e.stopPropagation();
    e.preventDefault();

    toggleMenu($(".rightClickTree-menu"));

    return false;
  });

  $(document).bind("mousedown", function (e) {
    var index;
    var menus = [".rightClickFile-menu", ".rightClickDire-menu", ".rightClickTree-menu", ".clickNew-menu"];

    for (index in menus) {
      if (!$(e.target).parents(menus[index]).length > 0) {
        $(menus[index]).hide(100);
      } 
    }
  });

  $(".rightClickFile-menu li").click(function() {
    var rightClickFileName = rightClickFile.attr("data-name");

    switch($(this).attr("rightClickFile-action")) {
      case "delete": 
        if (confirm("Are you sure you want to delete this file?")) {
          remove(rightClickFileName);
        }
      break;

      case "rename": 
        var newName = prompt("Please enter a new name for the file");
        var reOpenFile = false;
        
        if (openedFile === rightClickFileName) {
          reOpenFile = true;
        } 

        rename(rightClickFileName, newName, reOpenFile);
      break;
    }

    $(".rightClickFile-menu").hide(100);
  });

  $(".rightClickDire-menu li").click(function() {

    switch($(this).attr("rightClickDire-action")) {
      case "newFile": 
        rightClickCreate(rightClickDire, "file");
      break;

      case "newDire": 
        rightClickCreate(rightClickDire, "directory");
      break;
      
      case "upload": 
        uploadStoreCurrentDirectory = currentDirectory;
        uploadStoreLastSelect = lastSelect;
        currentDirectory = rightClickDire;
        upload.click();
      break;

      case "delete": 
        if (confirm("Are you sure you want to delete this whole directory?")) {
          removeDirectory(rightClickDire);
        }
      break;

      case "rename": 
        var newName = prompt("Please enter a new name for the directory");
        renameDirectory(rightClickDire.attr("dire-name"), newName);
      break;
    }
  
    $(".rightClickDire-menu").hide(100);
  });

  $(".rightClickTree-menu li").click(function() {

    switch($(this).attr("rightClickTree-action")) {
      case "newFile": 
        rightClickCreate(undefined, "file");
      break;

      case "newDire": 
        rightClickCreate(undefined, "directory");
      break;

      case "upload":
        uploadStoreCurrentDirectory = currentDirectory;
        uploadStoreLastSelect = lastSelect;
        currentDirectory = undefined;
        upload.click();
      break;
    }
  
    $(".rightClickTree-menu").hide(100);
  });

  $(".clickNew-menu li").click(function() {
    switch($(this).attr("clickNew-action")) {
      case "file": 
        createFile();
      break;

      case "directory": 
        createDirectory();
      break;
    }
  
    $(".clickNew-menu").hide(100);
  });

  for (name in localStorage) {
    if (localStorage.hasOwnProperty(name) &&
        name.substring(0, 5) === "file:") {

      var fileName = name.substring(5);
      var slashIndex = fileName.lastIndexOf("/");
      
      if (slashIndex === -1) {
        currentDirectory = undefined;
      } else {
        currentDirectory = tree.find('[dire-name="' + fileName.substring(0, slashIndex) + '"]');
      }

      addFile(fileName);

    } else if (localStorage.hasOwnProperty(name) &&
        name.substring(0, 10) === "directory:") {

      var dire;
      var direName = name.substring(10);
      var slashIndex = direName.lastIndexOf("/");
      
      if (slashIndex === -1) {
        currentDirectory = undefined;
      } else {
        currentDirectory = tree.find('[dire-name="' + direName.substring(0, slashIndex) + '"]');
      }

      dire = addDirectory(direName);

      dire.children().children("ul").css({'display': 'none'});
      dire.children(".icon").removeClass("open");
      dire.children(".icon").addClass("close");
    }
  }

  if (localStorage.hasOwnProperty("currentFile")) {
    setImmediate(function () {
      var storeColoredName = localStorage.coloredName;

      openFile(localStorage.currentFile);
      localStorage.coloredName = storeColoredName;

      if (localStorage.coloredName.substring(0, 5) !== "file:") {
        tree.find('[data-name="' + localStorage.currentFile + '"]').css({'font-weight': '', 'color': ''});
      }
        
      if (localStorage.coloredName === "") {
        tree.click();
      } else if (localStorage.coloredName.substring(0, 10) === "directory:") {  
        tree.find('[dire-name="' + localStorage.coloredName.substring(10) + '"]').click();
        tree.find('[dire-name="' + localStorage.coloredName.substring(10) + '"]').click();
      } 
    });
  }

  global.graceHasFile = function (name) {
    return localStorage.hasOwnProperty("file:" + name);
  };

  global.graceReadFile = function (name) {
    var data = localStorage["file:" + name];

    if (!isText(name)) {
      data = atob(data);
    }

    return URL.createObjectURL(new Blob([data]));
  };

  return {
    contents: contents,
    save: save,
    rename: rename,
    removeIndicator: removeIndicator,
    remove: remove,
    onOpen: onOpen,
    isChanged: isChanged
  };
};



