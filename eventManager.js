// EventManagerV3 glued together by mhawksey http://www.google.com/profiles/m.hawksey
// Related blog post http://mashe.hawksey.info/eventmanagerv3/ 

// With some code (settings, importIntoCalendar, sendEmails) from  
// Romain Vialard's http://www.google.com/profiles/romain.vialard 
// Manage your events: Calendar Importer and Registration Form
// https://spreadsheets.google.com/ccc?key=tCHuQkkKh_r69bQGt4yJmNQ

var ss = SpreadsheetApp.getActiveSpreadsheet();
var BOOKING_ACTION_COL = 10;
if (ss.getSheetByName("Templates").getRange("E1").getValue()!=""){
  var TZ = CalendarApp.openByName(ss.getSheetByName("Templates").getRange("E1").getValue()).getTimeZone();
} 

function onOpen() {
  var conf = ss.getSheetByName("Templates").getRange("B3").getValue();
  if (conf == "") {
    ss.toast("Click on setup to start", "Welcome", 10);
  }
  var menuEntries = [ {name: "Process Events", functionName: "importIntoCalendar"}, {name: "Process Bookings", functionName: "sendBookingConf"}, {name: "Email joining instructions", functionName: "sendJoinEmails"} ];
  ss.addMenu("Event Manager", menuEntries);
}
 

function settings(){
  var calendarName = Browser.inputBox("First create a calendar in Google Calendar and enter its name here:");
  if (calendarName != "cancel" && calendarName != ""){
    var templateSheet = ss.getSheetByName("Templates");
    templateSheet.getRange("E1").setValue(calendarName);
    var formURL = ss.getFormUrl();
    templateSheet.getRange("B3").setValue(formURL);
    var calTimeZone =  CalendarApp.getCalendarsByName(calendarName)[0].getTimeZone();
    ss.setSpreadsheetTimeZone(calTimeZone);
    var timeZone = ss.getSpreadsheetTimeZone();
    var siteUrl = Browser.inputBox("If you would like to update events to a Sites page enter your announcement page url (otherwise just leave blank and click OK)");  
    if (siteUrl != "cancel" && siteUrl != ""){
      templateSheet.getRange("E2").setValue(siteUrl);
    }
    var adminEmail = Browser.inputBox("Please enter your administrator email address"); 
    if (adminEmail != "cancel" && adminEmail != ""){
      templateSheet.getRange("B4").setValue(adminEmail);
    } 
    ss.toast("You can now import events in your calendar. Time Zone is currently set to: "+timeZone+".", "Set up completed!", -1);
    SpreadsheetApp.flush();
  }
}
// http://code.google.com/p/google-apps-script-issues/issues/detail?id=264#c35
function getEvent(events,eventID){
  for( var i in events )
    {
      if( events[i].getId() == eventID )
      {
        var event = events[i];
        return event;
      }// end if
    }// end for var i in events
  Browser.msgBox("Unexpected Error - function getEvents");
  return event;
}

function importIntoCalendar(){
  var dataSheet = ss.getSheetByName("Put your events here");
  var dataRange = dataSheet.getRange(2, 1, dataSheet.getMaxRows(), dataSheet.getMaxColumns());

  var templateSheet = ss.getSheetByName("Templates");
  var calendarName = templateSheet.getRange("E1").getValue();
  var siteUrl = templateSheet.getRange("E2").getValue();
  
  if (calendarName !=""){
    var cal =  CalendarApp.getCalendarsByName(calendarName)[0];
    var eventTitleTemplate = templateSheet.getRange("E3").getValue();
    var descriptionTemplate = templateSheet.getRange("E4").getValue();  
    var siteTemplate = templateSheet.getRange("E5").getValue(); 

    // Create one JavaScript object per row of data.
    objects = getRowsData(dataSheet, dataRange);

    // For every row object, create a personalized email from a template and send
    // it to the appropriate person.
    for (var i = 0; i < objects.length; ++i) {
      // Get a row object
      var rowData = objects[i];
      if (rowData.eventId && rowData.eventTitle && rowData.action == "Y" ){
        var eventTitle = fillInTemplateFromObject(eventTitleTemplate, rowData);
        var description = fillInTemplateFromObject(descriptionTemplate, rowData);
        var siteText = fillInTemplateFromObject(siteTemplate, rowData);
        // add to calendar bit
        if(rowData.endDate == "All-day"){
           var eventid = cal.createAllDayEvent(eventTitle, rowData.startDate, rowData.endDate, {location:rowData.location, description: description}).getId();
        }
        else{
          var eventid = cal.createEvent(eventTitle, rowData.startDate, rowData.endDate, {location:rowData.location, description: description}).getId();
        }
        var events = cal.getEvents(rowData.startDate, rowData.endDate);
        var event = getEvent(events, eventid);
        event.addEmailReminder(15).setTag("Event ID", rowData.eventId);

        // add to site bit
        if (siteUrl != ""){
          var page = SitesApp.getPageByUrl(siteUrl);
          var announcement = page.createAnnouncement(rowData.eventTitle, siteText);
        }
        // create event sheet
        var temp = ss.getSheetByName("EventTMP");
        //var eventSheet = ss.insertSheet("Event "+rowData.eventId, {template:temp});
        
        // copy format due to issue http://code.google.com/p/google-apps-script-issues/issues/detail?id=1050
        var sh = ss.getSheetByName("EventTMP");
        sh.getRange(1, 2, 1, 1).setValue(rowData.numberOfPlaces);
        sh.getRange(1, 3, 1, 1).setValue(rowData.eventTitle);
        sh.getRange(2, 3, 1, 1).setValue(rowData.location);
        sh.getRange(3, 6, 1, 1).setValue(rowData.startDate);
        sh.getRange(3, 8, 1, 1).setValue(rowData.endDate);
        
        ss.insertSheet("Event "+rowData.eventId);
        sh.getDataRange().copyTo(ss.getRange("Event "+rowData.eventId+"!A1"));
        var nusheet = ss.getSheetByName("Event "+rowData.eventId);
        nusheet.setFrozenRows(4);
        nusheet.setFrozenColumns(2);
        nusheet.setColumnWidth(1, 30)
        nusheet.setColumnWidth(2, 50);
        sh.getRange(1, 2, 1, 1).setValue("0");
        sh.getRange(1, 3, 1, 1).setValue("Event Title");
        sh.getRange(2, 3, 1, 1).setValue("Location");
        sh.getRange(3, 6, 1, 1).setValue("start time");
        sh.getRange(3, 8, 1, 1).setValue("end time");
        
/*
        eventSheet.getRange(1, 2, 1, 1).setValue(rowData.numberOfPlaces);
        eventSheet.getRange(1, 3, 1, 1).setValue(rowData.eventTitle);
        eventSheet.getRange(2, 3, 1, 1).setValue(rowData.location);
        eventSheet.getRange(3, 6, 1, 1).setValue(rowData.startDate);
        eventSheet.getRange(3, 8, 1, 1).setValue(rowData.endDate);
*/
        dataSheet.getRange(i+2, 1, 1, 1).setValue("");
        dataSheet.getRange(i+2, 2, 1, 1).setValue("Added "+ Utilities.formatDate(new Date(), TZ, "dd MMM yy HH:mm")).setBackgroundRGB(221, 221, 221);
        dataSheet.getRange(i+2,1,1,dataSheet.getMaxColumns()).setBackgroundRGB(221, 221, 221);
        // Make sure the cell is updated right away in case  the script is interrupted
        SpreadsheetApp.flush();
      }
    }  
    ss.toast("People can now register to those events", "Events imported");
  }
}
function onFormSubmit() {
  var dataSheet = ss.getSheetByName("Bookings");
  var dataRange = dataSheet.getRange(2, 1, dataSheet.getMaxRows(), dataSheet.getMaxColumns());
  var templateSheet = ss.getSheetByName("Templates");
  var emailTemplate = templateSheet.getRange("E6").getValue();
  var adminEmail = templateSheet.getRange("B4").getValue()
  
  // Create one JavaScript object per row of data.
  data = getRowsData(dataSheet, dataRange);

  for (var i = 0; i < data.length; ++i) {
    // Get a row object
    var row = data[i];
    row.rowNumber = i + 2;
    if (!row.action) { // if no state notify admin of booking
      var emailText = fillInTemplateFromObject(emailTemplate, row);
      var emailSubject = "Booking Approval Request ID: "+ row.rowNumber;
      MailApp.sendEmail(adminEmail, emailSubject, emailText);
      dataSheet.getRange(row.rowNumber,BOOKING_ACTION_COL).setValue("TBC"); //9 is the column number for 'Action'
    }
  }
}

function sendBookingConf(){
  var dataSheet = ss.getSheetByName("Bookings");
  var dataRange = dataSheet.getRange(2, 1, dataSheet.getMaxRows(), dataSheet.getMaxColumns());

  var templateSheet = ss.getSheetByName("Templates");
  var emailSubjectTemplate = templateSheet.getRange("B1").getValue();
  var emailTemplate = templateSheet.getRange("B2").getValue();
  var emailSentColumn = BOOKING_ACTION_COL;
  
  // To add guests into Calendar
  var calendarDataSheet = ss.getSheetByName("Put your events here");
  var calendarDataRange = calendarDataSheet.getRange(2, 1, calendarDataSheet.getMaxRows(), calendarDataSheet.getMaxColumns());
  var calendarName = templateSheet.getRange("E1").getValue();
  // Create one JavaScript object per row of data.
  calendarObjects = getRowsData(calendarDataSheet, calendarDataRange);

  // Create one JavaScript object per row of data.
  objects = getRowsData(dataSheet, dataRange);

  // For every row object, create a personalized email from a template and send
  // it to the appropriate person.
  for (var i = 0; i < objects.length; ++i) {
    // Get a row object
    var rowData = objects[i];
    if (rowData.action == "Y") {  // Prevents  sending duplicates
      
       // add guest in calendar
      for (var j = 0; j < calendarObjects.length; ++j) {
        // Get a row object
        var calendarRowData = calendarObjects[j];
        if (calendarRowData.eventId == rowData.eventId){   
          var cal =  CalendarApp.getCalendarsByName(calendarName)[0];
          if(calendarRowData.endDate == "All-day"){
            var getDate = new Date(calendarRowData.startDate).getTime();
            var endDate = new Date().setTime(getDate + 86400000);
            var events = cal.getEvents(new Date(calendarRowData.startDate), new Date(endDate));
          }
          else{
            var events = cal.getEvents(new Date(calendarRowData.startDate), new Date(calendarRowData.endDate));
          }
          for (var k in events){
            if (events[k].getTag("Event ID") == rowData.eventId){
                events[k].addGuest(rowData.email); 
              
              j = calendarObjects.length;
            }
          }
        }
      }
      
      // Generate a personalized email.
      // Given a template string, replace markers (for instance ${"First Name"}) with
      // the corresponding value in a row object (for instance rowData.firstName).
      calendarRowData.bookingId = rowData.eventId+"-B"+(i + 2);
      calendarRowData.firstName = rowData.firstName;
      var emailSubject = fillInTemplateFromObject(emailSubjectTemplate, calendarRowData);
      var emailText = fillInTemplateFromObject(emailTemplate, calendarRowData);
      var emailAddress = rowData.email;
      MailApp.sendEmail(emailAddress, emailSubject, emailText,{htmlBody: emailText});
      // add booking to right event sheet
     
      dataSheet.getRange(i + 2,emailSentColumn).setValue(calendarRowData.bookingId).setBackgroundRGB(221, 221, 221);
      var eventSheet = ss.getSheetByName("Event " + rowData.eventId);
      var rowNum = eventSheet.getLastRow()+1;
      
      eventSheet.getRange(rowNum, 3, 1, 1).setValue(calendarRowData.bookingId);
      eventSheet.getRange(rowNum, 4, 1, 1).setValue(rowData.timestamp);
      eventSheet.getRange(rowNum, 5, 1, 1).setValue(rowData.firstName);
      eventSheet.getRange(rowNum, 6, 1, 1).setValue(rowData.lastName);
      eventSheet.getRange(rowNum, 7, 1, 1).setValue(rowData.email);
      eventSheet.getRange(rowNum, 8, 1, 1).setValue(rowData.organisationName);
      eventSheet.getRange(rowNum, 9, 1, 1).setValue(rowData.startPostcode);
      eventSheet.getRange(rowNum, 10, 1, 1).setValue(rowData.preferredMode);
      eventSheet.getRange(rowNum, 11, 1, 1).setValue(rowData.otherInfo);
      eventSheet.getRange(rowNum, 12, 1, 1).setValue(rowData.comments);
      // Make sure the cell is updated right away in case  the script is interrupted
      
      // Add delegate to Contacts
      var curDate = Utilities.formatDate(new Date(), TZ, "dd MMM yy HH:mm");
      // var c = ContactsApp.findByEmailAddress(rowData.email);
      var c = ContactsApp.getContact(rowData.email);
      if (!c){
        var c = ContactsApp.createContact(rowData.firstName, rowData.lastName, rowData.email);
        var prop = {};
        prop.Organisation = rowData.organisationName;
        prop.Added = curDate;
        c.setUserDefinedFields(prop); 
        //var group = ContactsApp.findContactGroup(rowData.organisationName);
        var group = ContactsApp.getContactGroup(rowData.organisationName);
        if (!group){
          var group = ContactsApp.createContactGroup(rowData.organisationName);
        }
        c.addToGroup(group); 
      } else {
        c.setUserDefinedField("Last activity", curDate);
      }
      SpreadsheetApp.flush();       
    } 
  }
  ss.toast("", "Emails sent", -1);
}

// Code to send joining instructions - based on simple mail merge code from
// Tutorial: Simple Mail Merge
// Hugo Fierro, Google Spreadsheet Scripts Team 
// March 2009
function sendJoinEmails() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = ss.getActiveSheet();
  var eventName = ss.getRange("C1").getValue();// pull event name from sheet
  var location = ss.getRange("C2").getValue();// pull event location
  var emailCount = 0;
  var dataRange = dataSheet.getRange(5, 2, dataSheet.getMaxRows(), dataSheet.getMaxColumns());

  var templateSheet = ss.getSheetByName("Templates");
  var emailTemplate = templateSheet.getRange("B6").getValue();
  var emailSubject = templateSheet.getRange("B5").getValue();
  emailSubject = emailSubject.replace('${"Event Name"}', eventName);

  // Create one JavaScript object per row of data.
  objects = getRowsData(dataSheet,dataRange,4);

  // For every row object, create a personalized email from a template and send
  // it to the appropriate person.
  for (var i = 0; i < objects.length; ++i) {
    // Get a row object
    var rowData = objects[i];
    rowData.eventName = eventName;
    rowData.rowNumber = i + 5;
    // Generate a personalized email.
    if (!rowData.emailed) {
      if (rowData.startPostcode && (location != "Online" || location)){
        rowData.directions = getMapDirections_(rowData.startPostcode, location, rowData.mode);
      }
      var emailText = fillInTemplateFromObject(emailTemplate, rowData);
      try {
        MailApp.sendEmail(rowData.emailAddress, emailSubject, 'Please view in HTML capable email client.', {htmlBody: emailText}); 
        emailCount++;
        dataSheet.getRange(rowData.rowNumber, 2).setValue(Utilities.formatDate(new Date(), TZ, "dd MMM yy HH:mm"));
      } catch(e) {
        Browser.msgBox("There was a problem sending to "+rowData.emailAddress);
      }
    }
  } 
  ss.toast("Joining instructions have been sent to "+emailCount+" delegates", "Joining instructions sent", 5);
}

// Modified from Send customized driving directions in a mail merge template 
// http://code.google.com/googleapps/appsscript/templates.html
function getMapDirections_(start, end, mode) {
  // Generate personalized static map with directions.
   switch(mode)
  {
    case "Cycling":
       var directions = Maps.newDirectionFinder()
           .setOrigin(start)
           .setDestination(end)
           .setMode(Maps.DirectionFinder.Mode.BICYCLING)
           .getDirections();
      break;
    case "Walking":
        var directions = Maps.newDirectionFinder()
           .setOrigin(start)
           .setDestination(end)
           .setMode(Maps.DirectionFinder.Mode.WALKING)
           .getDirections();
      break;
    default:
        var directions = Maps.newDirectionFinder()
           .setOrigin(start)
           .setDestination(end)
           .setMode(Maps.DirectionFinder.Mode.DRIVING)
           .getDirections();
  }

  var currentLabel = 0;
  var directionsHtml = "";
  var map = Maps.newStaticMap().setSize(500, 350);

  map.setMarkerStyle(Maps.StaticMap.MarkerSize.SMALL, "red", null);
  map.addMarker(start);
  map.addMarker(end);
  
  var r1 = new RegExp('<div style="font-size:0.9em">', 'g');
  var r2 = new RegExp('</div>', 'g');
  var points = [];
  var distance = 0;
  var time = 0;
  for (var i in directions.routes) {
    for (var j in directions.routes[i].legs) {
      for (var k in directions.routes[i].legs[j].steps) {
        var step = directions.routes[i].legs[j].steps[k];
        distance += directions.routes[i].legs[j].steps[k].distance.value;
        time += directions.routes[i].legs[j].steps[k].duration.value;
        var path = Maps.decodePolyline(step.polyline.points); 
        points = points.concat(path);
        var text = step.html_instructions;
        text = text.replace(r1, '<br>');
        text = text.replace(r2, '<br>');
        directionsHtml += "<br>" + (++currentLabel) + " - " + text;
      }
    }
  }

  // be conservative, and only sample 100 times...
  var lpoints=[];
  if (points.length < 200)
    lpoints = points;
  else {
    var pCount = (points.length/2);
    var step = parseInt(pCount/100);
    for (var i=0; i<100; ++i) {
      lpoints.push(points[i*step*2]);
      lpoints.push(points[(i*step*2)+1]);
    }
  }      

  // make the polyline
  if (lpoints.length>0) {
    var pline = Maps.encodePolyline(lpoints);
    map.addPath(pline);
  }
  
  var mapLink = "<a href='http://maps.google.com/maps?saddr="+encodeURIComponent(start)+"&daddr="+encodeURIComponent(end)+"'>Click here for complete map and directions</a>";
  var dir = "<p><strong>Travel Directions</strong></p><p align=center><img src=\"" + map.getMapUrl() + "\" /><br>"+mapLink+"</p><p><strong>Summary of Route</strong>"+
      "<br><strong>Distance: </strong>" +Math.round(0.00621371192*distance)/10+" miles"+ 
      "<br><strong>Time: </strong>"+Math.floor(time/60)+" minutes</p>" + directionsHtml;
  return dir;
}


// Replaces markers in a template string with values define in a JavaScript data object.
// Arguments:
//   - template: string containing markers, for instance ${"Column name"}
//   - data: JavaScript object with values to that will replace markers. For instance
//           data.columnName will replace marker ${"Column name"}
// Returns a string without markers. If no data is found to replace a marker, it is
// simply removed.
function fillInTemplateFromObject(template, data) {
  var email = template;
  // Search for all the variables to be replaced, for instance ${"Column name"}
  var templateVars = template.match(/\$\{\"[^\"]+\"\}/g);

  // Replace variables from the template with the actual values from the data object.
  // If no value is available, replace with the empty string.
  for (var i = 0; i < templateVars.length; ++i) {
    // normalizeHeader ignores ${"} so we can call it directly here.
    var variableData = isDate(data[normalizeHeader(templateVars[i])]);
    email = email.replace(templateVars[i], variableData || "");
  }

  return email;
}

// Test if value is a date and if so format 
function isDate(sDate) {
  var scratch = new Date(sDate);
  if (scratch.toString() == "NaN" || scratch.toString() == "Invalid Date") {
    return sDate;
  } 
  else {
    return Utilities.formatDate(new Date(), TZ, "dd MMM yy HH:mm");
  }
}

//////////////////////////////////////////////////////////////////////////////////////////
//
// The code below is reused from the 'Reading Spreadsheet data using JavaScript Objects'
// tutorial.
//
//////////////////////////////////////////////////////////////////////////////////////////

// getRowsData iterates row by row in the input range and returns an array of objects.
// Each object contains all the data for a given row, indexed by its normalized column name.
// Arguments:
//   - sheet: the sheet object that contains the data to be processed
//   - range: the exact range of cells where the data is stored
//   - columnHeadersRowIndex: specifies the row number where the column names are stored.
//       This argument is optional and it defaults to the row immediately above range;
// Returns an Array of objects.
function getRowsData(sheet, range, columnHeadersRowIndex) {
  columnHeadersRowIndex = columnHeadersRowIndex || range.getRowIndex() - 1;
  var numColumns = range.getEndColumn() - range.getColumn() + 1;
  var headersRange = sheet.getRange(columnHeadersRowIndex, range.getColumn(), 1, numColumns);
  var headers = headersRange.getValues()[0];
  return getObjects(range.getValues(), normalizeHeaders(headers));
}

// For every row of data in data, generates an object that contains the data. Names of
// object fields are defined in keys.
// Arguments:
//   - data: JavaScript 2d array
//   - keys: Array of Strings that define the property names for the objects to create
function getObjects(data, keys) {
  var objects = [];
  for (var i = 0; i < data.length; ++i) {
    var object = {};
    var hasData = false;
    for (var j = 0; j < data[i].length; ++j) {
      var cellData = data[i][j];
      if (isCellEmpty(cellData)) {
        continue;
      }
      object[keys[j]] = cellData;
      hasData = true;
    }
    if (hasData) {
      objects.push(object);
    }
  }
  return objects;
}

// Returns an Array of normalized Strings.
// Arguments:
//   - headers: Array of Strings to normalize
function normalizeHeaders(headers) {
  var keys = [];
  for (var i = 0; i < headers.length; ++i) {
    var key = normalizeHeader(headers[i]);
    if (key.length > 0) {
      keys.push(key);
    }
  }
  return keys;
}

// Normalizes a string, by removing all alphanumeric characters and using mixed case
// to separate words. The output will always start with a lower case letter.
// This function is designed to produce JavaScript object property names.
// Arguments:
//   - header: string to normalize
// Examples:
//   "First Name" -> "firstName"
//   "Market Cap (millions) -> "marketCapMillions
//   "1 number at the beginning is ignored" -> "numberAtTheBeginningIsIgnored"
function normalizeHeader(header) {
  var key = "";
  var upperCase = false;
  for (var i = 0; i < header.length; ++i) {
    var letter = header[i];
    if (letter == " " && key.length > 0) {
      upperCase = true;
      continue;
    }
    if (!isAlnum(letter)) {
      continue;
    }
    if (key.length == 0 && isDigit(letter)) {
      continue; // first character must be a letter
    }
    if (upperCase) {
      upperCase = false;
      key += letter.toUpperCase();
    } else {
      key += letter.toLowerCase();
    }
  }
  return key;
}

// Returns true if the cell where cellData was read from is empty.
// Arguments:
//   - cellData: string
function isCellEmpty(cellData) {
  return typeof(cellData) == "string" && cellData == "";
}

// Returns true if the character char is alphabetical, false otherwise.
function isAlnum(char) {
  return char >= 'A' && char <= 'Z' ||
    char >= 'a' && char <= 'z' ||
    isDigit(char);
}

// Returns true if the character char is a digit, false otherwise.
function isDigit(char) {
  return char >= '0' && char <= '9';
}
