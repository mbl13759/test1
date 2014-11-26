/*
 * Copyright (C) 2009-2014 SAP SE or an SAP affiliate company. All rights reserved
 */
jQuery.sap.declare("hcm.emp.mytimesheet.model.TimeEntry");

hcm.emp.mytimesheet.model.TimeEntry = function(time, childName, suggestion, bExisting) {
	this.time = time;
	this.hours = Math.floor(time);
	this.minutes = Math.round((time - Math.floor(time)) * 60);
	this.suggestion = suggestion===undefined ? false : suggestion;
	this.newEntry = !bExisting;
	this.mainItem = null;
	this.subItems = childName;
	this.notes = null;
	this.startTime = "";
	this.endTime = "";
	this.counter = "";
	this.hasNotes = false;
	this.showTime = bExisting;
	this.showError = false;
	this.error = "";
	this.status = "";
	//Introducing statusId for Status color in WeekEntry View
	this.statusId = "";
};

hcm.emp.mytimesheet.model.TimeEntry.prototype.setStartEndTimes = function(
		date, entries, missingTime, workingDay) {
	var lastUndeletedIndex = entries.length-1;
	while(lastUndeletedIndex>=0 && entries[entries.length-1].deleted) {
		lastUndeletedIndex--;
	}
	var startTime = this.createTime(date, lastUndeletedIndex>=0 ?
			entries[lastUndeletedIndex].endTime :
			workingDay.startTime);
	var lunchStart = this.createTime(date, workingDay ? workingDay.lunchStart : "000000");
	var lunchEnd = this.createTime(date, workingDay ? workingDay.lunchEnd : "000000");
	if(startTime.getTime()===lunchStart.getTime()) {
		// the lunch break is before the start time
		startTime.setTime(startTime.getTime() + lunchEnd.getTime()-lunchStart.getTime());
	}
	var endTime = new Date(startTime.getTime() + missingTime*3600000);
	if(startTime.getTime() < lunchStart.getTime()) {
		endTime.setTime(endTime.getTime() + lunchEnd.getTime()-lunchStart.getTime());
	}
	this.startTime = (startTime.getHours()+100).toString().substring(1, 3) + (startTime.getMinutes()+100).toString().substring(1, 3) + "00";
	this.endTime = (endTime.getHours()+100).toString().substring(1, 3) + (endTime.getMinutes()+100).toString().substring(1, 3) + "00";
};

hcm.emp.mytimesheet.model.TimeEntry.prototype.createTime = function(
		date, timeStr) {
	var time = new Date(date.getTime());
	time.setHours(parseInt(timeStr.substring(0, 2), 10), parseInt(timeStr.substring(2, 4), 10));
	return time;
};

hcm.emp.mytimesheet.model.TimeEntry.prototype.setData = function(
		data) {
	if (data.FieldName === "TIME") {
		this.recordNumber = data.RecordNumber;
		this.time = parseFloat(data.FieldValue.trim());
		this.hours = Math.floor(this.time);
		this.minutes = Math
				.round((this.time - this.hours) * 60);
		this.startTime = data.StartTime;
		this.endTime = data.EndTime;
	} else if (data.FieldName === "NOTES") {
		this.notes = data.FieldValueText;
		if (this.notes && this.notes.length > 0) {
			this.hasNotes = true;
		}
	} else if (data.FieldName === "STARTTIME") {
		this.startTime = data.FieldValueText;
	} else if (data.FieldName === "ENDTIME") {
		this.endTime = data.FieldValueText;
	} else if (data.FieldName === "COUNTER") {
		this.counter = data.FieldValueText;
	} else if (data.FieldName === "REASON") {
		this.rejectionReason = data.FieldValueText;
	} else if (data.FieldName === "STATUS") {
		this.status = data.FieldValueText;
		this.statusId = data.FieldValue;
	} else if (data.Level === "0") {// this is the Bold item
		this.mainItem = data.FieldValueText;
		this.mainCode = data.FieldValue;
		this.mainName = data.FieldName;
	} else {
		if (this.subItems) {
			this.subItems += ", " + data.FieldValueText;
			this.childItems.push(data.FieldValueText);
			this.childCodes.push(data.FieldValue);
			this.childNames.push(data.FieldName);
		} else {
			this.subItems = data.FieldValueText;
			this.childItems = [ data.FieldValueText ];
			this.childCodes = [ data.FieldValue ];
			this.childNames = [ data.FieldName ];
		}
	}
};

