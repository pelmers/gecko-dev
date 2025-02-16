/* vim: set ts=2 et sw=2 tw=80: */
/* Any copyright is dedicated to the Public Domain.
   http://creativecommons.org/publicdomain/zero/1.0/ */

// Tests that keyboard interaction works fine with the table widget

"use strict";

const TEST_URI = "data:text/xml;charset=UTF-8,<?xml version='1.0'?>" +
  "<?xml-stylesheet href='chrome://global/skin/global.css'?>" +

  // Uncomment these lines to help with visual debugging. When uncommented they
  // dump a couple of thousand errors in the log (bug 1258285)
  // "<?xml-stylesheet href='chrome://devtools/skin/light-theme.css'?>" +
  // "<?xml-stylesheet href='chrome://devtools/skin/widgets.css'?>" +

  "<window xmlns='http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul'" +
  " title='Table Widget' width='600' height='500'>" +
  "<box flex='1' class='theme-light'/></window>";
const TEST_OPT = "chrome,titlebar,toolbar,centerscreen,resizable,dialog=no";

const {TableWidget} = require("devtools/client/shared/widgets/TableWidget");

var doc, table;

function test() {
  waitForExplicitFinish();
  let win = Services.ww.openWindow(null, TEST_URI, "_blank", TEST_OPT, null);

  win.addEventListener("load", function onLoad() {
    win.removeEventListener("load", onLoad, false);

    waitForFocus(function() {
      doc = win.document;
      table = new TableWidget(doc.querySelector("box"), {
        initialColumns: {
          col1: "Column 1",
          col2: "Column 2",
          col3: "Column 3",
          col4: "Column 4"
        },
        uniqueId: "col1",
        emptyText: "This is dummy empty text",
        highlightUpdated: true,
        removableColumns: true,
      });
      startTests();
    });
  });
}

function endTests() {
  table.destroy();
  doc.defaultView.close();
  doc = table = null;
  finish();
}

var startTests = Task.async(function*() {
  populateTable();
  yield testKeyboardInteraction();
  endTests();
});

function populateTable() {
  table.push({
    col1: "id1",
    col2: "value10",
    col3: "value20",
    col4: "value30"
  });
  table.push({
    col1: "id2",
    col2: "value14",
    col3: "value29",
    col4: "value32"
  });
  table.push({
    col1: "id3",
    col2: "value17",
    col3: "value21",
    col4: "value31",
    extraData: "foobar",
    extraData2: 42
  });
  table.push({
    col1: "id4",
    col2: "value12",
    col3: "value26",
    col4: "value33"
  });
  table.push({
    col1: "id5",
    col2: "value19",
    col3: "value26",
    col4: "value37"
  });
  table.push({
    col1: "id6",
    col2: "value15",
    col3: "value25",
    col4: "value37"
  });
  table.push({
    col1: "id7",
    col2: "value18",
    col3: "value21",
    col4: "value36",
    somethingExtra: "Hello World!"
  });
  table.push({
    col1: "id8",
    col2: "value11",
    col3: "value27",
    col4: "value34"
  });
  table.push({
    col1: "id9",
    col2: "value11",
    col3: "value23",
    col4: "value38"
  });
}

// Sends a click event on the passed DOM node in an async manner
function click(node, button = 0) {
  if (button == 0) {
    executeSoon(() => EventUtils.synthesizeMouseAtCenter(node, {},
                                                         doc.defaultView));
  } else {
    executeSoon(() => EventUtils.synthesizeMouseAtCenter(node, {
      button: button,
      type: "contextmenu"
    }, doc.defaultView));
  }
}

function getNodeByValue(value) {
  return table.tbody.querySelector("[value=" + value + "]");
}

/**
 * Tests if pressing navigation keys on the table items does the expected
 * behavior.
 */
var testKeyboardInteraction = Task.async(function*() {
  info("Testing keyboard interaction with the table");
  info("clicking on the row containing id2");
  let node = getNodeByValue("id2");
  let event = table.once(TableWidget.EVENTS.ROW_SELECTED);
  click(node);
  yield event;

  yield testRow("id3", "DOWN", "next row");
  yield testRow("id4", "DOWN", "next row");
  yield testRow("id3", "UP", "previous row");
  yield testRow("id4", "DOWN", "next row");
  yield testRow("id5", "DOWN", "next row");
  yield testRow("id6", "DOWN", "next row");
  yield testRow("id5", "UP", "previous row");
  yield testRow("id4", "UP", "previous row");
  yield testRow("id3", "UP", "previous row");

  // selecting last item node to test edge navigation cycling case
  table.selectedRow = "id9";

  // pressing down on last row should move to first row.
  yield testRow("id1", "DOWN", "first row");

  // pressing up now should move to last row.
  yield testRow("id9", "UP", "last row");
});

function* testRow(id, key, destination) {
  let node = getNodeByValue(id);
  // node should not have selected class
  ok(!node.classList.contains("theme-selected"),
     "Row should not have selected class");
  info(`Pressing ${key} to select ${destination}`);

  let event = table.once(TableWidget.EVENTS.ROW_SELECTED);
  EventUtils.sendKey(key, doc.defaultView);

  let uniqueId = yield event;
  is(id, uniqueId, `Correct row was selected after pressing ${key}`);

  ok(node.classList.contains("theme-selected"), "row has selected class");

  let nodes = doc.querySelectorAll(".theme-selected");
  for (let i = 0; i < nodes.length; i++) {
    is(nodes[i].getAttribute("data-id"), id,
       "Correct cell selected in all columns");
  }
}
