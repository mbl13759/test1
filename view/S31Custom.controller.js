
/*
* Copyright (C) 2009-2014 SAP SE or an SAP affiliate company. All rights reserved
*/
jQuery.sap.require("sap.ui.core.mvc.Controller");
jQuery.sap.require("sap.ui.model.odata.datajs");
jQuery.sap.require("hcm.emp.mytimesheet.utils.PerfUtils");
jQuery.sap.require("hcm.emp.mytimesheet.utils.ConnectionHelper");
jQuery.sap.require("sap.ca.ui.model.type.Number");
sap.ui.controller("hcm.emp.mytimesheet.test1.view.S31Custom", {
	extHookOnInit: null,
	extHookChangeFooterButtons: null,
	extHookOnSuggestedInputHelp: null,
	extHookOnInputHelp: null,
	extHookUpdateData: null,
	RESULTS_TOP: 30,
	MODEL_SIZE_LIMIT: 1000,
	gv_fieldRelated: "",
	searchField_begDa: "",
	searchField_endDa: "",
	validateLunchBreak: function() {
		if (this.isClockEntry()) {
			if (this.entry) {
				if (this.entry.startTime >= this.entry.selectedDate[0].lunchStart && this.entry.startTime <= this.entry.selectedDate[0].lunchEnd) {
					this.entry.startTime = this.entry.selectedDate[0].lunchEnd;
					this.byId("startTime").setValue(this.entry.startTime)
				}
				if (this.entry.endTime >= this.entry.selectedDate[0].lunchStart && this.entry.endTime <= this.entry.selectedDate[0].lunchEnd) {
					this.entry.endTime = this.entry.selectedDate[0].lunchStart;
					this.byId("endTime").setValue(this.entry.endTime)
				}
			}
			if (this.entry.startTime === this.entry.endTime) {
				this.setBtnEnabled('SUBMIT_BTN', false);
				return false
			}
		}
		return true
	},
	clone: function(o) {
		if (null === o || "object" !== typeof o) {
			return o
		}
		if (o instanceof Object) {
			var c = {};
			var a = null;
			for (a in o) {
				if (o.hasOwnProperty(a)) {
					c[a] = this.clone(o[a])
				}
			}
			return c
		}
		throw new Error("Unable to copy obj! Its type isn't supported.")
	},
	onInit: function() {
		jQuery.sap.measure.start(hcm.emp.mytimesheet.utils.PerfUtils.getStartId(hcm.emp.mytimesheet.utils.PerfUtils.COST_ASSIGNMENT_SEARCH_LOAD));
		this._initialize();
		this.oModel = new sap.ui.model.json.JSONModel();
		this.oModel.setSizeLimit(this.MODEL_SIZE_LIMIT);
		this.top = this.RESULTS_TOP;
		this.localSkip = 0;
		this.remoteSkip = 0;
		this.pagingEnabled = false;
		this.localTypeList = [];
		this.remoteTypeList = [];
		this.resultsTotalCount = 0;
		this.remoteSearchPhrase = "";
		this.continueSearchOnServerActive = false;
		this.noneText = "(" + this.oBundle.getText("None") + ")";
		this.typeListControl = this.byId("COST_ASSIGNMENT_TYPE_LIST");
		var s = this;
		this.scrollContainer = this.byId("COST_ASSIGNMENT_TYPE_SCROLL_CONTAINER");
		this.recentlyUsedCostAssignmentList = [];
		var I = s.oApplication.getModel("timesheet_initialInfo");
		var c = I.getData().clockEntry;
		this.oModel.setProperty("/clockEntry", false);
		this.oModel.setProperty("/decimalTimeEntryVisible", false);
		this.oModel.setProperty("/durationVisible", false);
		if (c) {
			this.oModel.setProperty("/clockEntry", true)
		} else {
			var d = I.getData().decimalTimeEntry;
			if (d) {
				this.oModel.setProperty("/decimalTimeEntryVisible", true)
			} else {
				this.oModel.setProperty("/durationVisible", true)
			}
		}
		this.getView().addEventDelegate({
			onBeforeShow: function(e) {
				s.firstRemoteSearch = true;
				s.overrideNavController = s.oService;
				s.insidePopover = false;
				if (e.data.overrideNavController) {
					s.overrideNavController = e.data.overrideNavController
				}
				if (e.data.insidePopover) {
					s.insidePopover = e.data.insidePopover
				}
				s.oModel.setProperty("pageTitle", e.data.costAssignmentType);
				s.fieldName = e.data.costAssignmentFieldName;
				if (e.data.costAssignmentFieldValue) {
					s.fieldValue = e.data.costAssignmentFieldValue;
					s.fieldValueText = e.data.costAssignmentFieldValueText
				} else {
					s.fieldValue = "";
					s.fieldValueText = ""
				}
				s.localTypeList = [];
				s.remoteTypeList = [];
				s.gv_fieldRelated = e.data.costAssignmentFieldRelated;
				s.getWorkListCollection();
				s.initialiseView()
			}
		});
		$(window).resize(function() {
			s.scrollerResize()
		});
		
		//  15-12-2014 - M. Blaak Toevoeging filtering voor Inputveld Recent Gebruikt
		this.byId("COST_ASSIGNMENT_RECENTLY_USED_LIST").setFilterFunction(function(sTerm, oItem) {
        // A case-insensitive 'string contains' style filter
        return oItem.getText().match(new RegExp(sTerm, "i"));
        });
        
		s.recentlyUsedList = s.byId("COST_ASSIGNMENT_RECENTLY_USED_LIST");
		s.oModel.setProperty("/sel_sugg_txt", s.oBundle.getText('SELECT_PLACEHOLDER') + " " + s.oBundle.getText('RECENTLY_USED'));
		s.getView().setModel(s.oModel);
		var a = new sap.ui.model.json.JSONModel();
		s.getView().setModel(a, 'fordynamictypes');
		this.viewDatafromS3 = this.oApplication.getModel('S31modelexch').getData().viewDataS3;
		s.entry = (this.viewDatafromS3 && this.viewDatafromS3.entry) || {};
		this.getView().setModel(new sap.ui.model.json.JSONModel(s.entry), "entry");
		this.workListTypeNew = [];
		if ("mainItem" in s.entry) {
			s.selectedMainItem = s.entry.mainItem;
			s.selectedMainName = s.entry.mainName;
			s.selectedMainCode = s.entry.mainCode;
			if ("childItems" in s.entry) {
				s.selectedChildItems = s.entry.childItems;
				s.selectedChildNames = s.entry.childNames;
				s.selectedChildCodes = s.entry.childCodes
			}
			if (s.selectedMainItem) {
				s.editCostAssignment = true
			} else {
				s.editCostAssignment = false
			}
		}
		s.childItemsInitialized = false;
		this.entry = this.prepareModelData(jQuery.extend(new hcm.emp.mytimesheet.model.TimeEntry(), {
			newEntry: true
		}));
		this.editdatafroms3 = this.oApplication.getModel('S31modelexch').getData().editeddata;
		if (this.extHookOnInit) {
			this.extHookOnInit()
		}
	},
	_initialize: function() {
		if (!this.oApplication) {
			this.oApplication = this.oApplicationFacade.oApplicationImplementation;
			this.oConfiguration = this.oApplication.oConfiguration;
			this.oConfiguration = new hcm.emp.mytimesheet.utils.InitialConfigHelper();
			this.oConfiguration.setInitialInfoModel(this.oApplication.getModel("timesheet_initialInfo"));
			this.oConnectionManager = this.oApplication.oConnectionManager;
			this.oBundle = this.oApplicationFacade.oApplicationImplementation.getResourceBundle();
			this.oConfiguration.setResourceBundle(this.oBundle);
			this.oService = new hcm.emp.mytimesheet.Service()
		}
	},
	initialiseView: function() {
		var H = this.getHeaderFooterOptions();
		this.dateTimeModified = false;
		if (this.oApplication.getModel('S31modelexch').getData().recentlyUsedSelected) {
			H.sI18NFullscreenTitle = this.oApplicationFacade.getResourceBundle().getText("TIMESHEET_CREATE_ENTRY_TITLE")
		} else {
			H.sI18NFullscreenTitle = this.oApplicationFacade.getResourceBundle().getText("TIMESHEET_EDIT_ENTRY_TITLE_SCREEN")
		}
		this.setHeaderFooterOptions(H);
		this.byId('COST_ASSIGNMENT_RECENTLY_USED_LIST').setValue("");
		var w = this.byId("weeklyCalendar");
		w.setEnableMultiselection(true);
		w.unselectAllDates();
		w.toggleDatesSelection(this.oApplication.getModel('S31modelexch').getData().selectedDates, true);
		w.setFirstDayOffset(this.oApplication.getModel('TSM_WEEKLY').getProperty("/firstDayOffset"));
		if (w.getSelectedDates().length > 1) {
			this.byId('createformtitle').setTitle(this.oBundle.getText('SUBMIT_HEADER_TEXT', [this.getDateinCurrentLanguage(w.getSelectedDates()[0]),
				w.getSelectedDates().length - 1]))
		} else if (w.getSelectedDates().length === 1) {
			this.byId('createformtitle').setTitle(this.oBundle.getText('SUBMIT_HEADER_TEXT_SINGLE', [this.getDateinCurrentLanguage(w.getSelectedDates()[
				0])]))
		} else if (w.getSelectedDates().length === 0) {
			this.byId('createformtitle').setTitle(this.oBundle.getText('ENTRY_DETAILS'));
			this.setBtnEnabled('SUBMIT_BTN', false)
		}
		var l = this.viewDatafromS3.pageData.legendforS31;
		w.toggleDatesType(l['yellow'], sap.me.CalendarEventType.Type04, true);
		w.toggleDatesType(l['green'], sap.me.CalendarEventType.Type01, true);
		w.toggleDatesType(l['grey'], sap.me.CalendarEventType.Type00, true);
		w.toggleDatesType(l['red'], sap.me.CalendarEventType.Type07, true);
		w.toggleDatesType(l['rejected'], sap.me.CalendarEventType.Type06, true);
		var d = this.viewDatafromS3.pageData.start;
		var a = sap.ui.core.format.DateFormat.getDateInstance({
			pattern: "YYYYMMdd"
		});
		var s = a.parse(d);
		w.setCurrentDate(s);
		this.viewDatafromS3 = this.oApplication.getModel('S31modelexch').getData().viewDataS3;
		this.entry = this.viewDatafromS3 && this.viewDatafromS3.entry || {};
		this.entry.time = sap.ca.ui.model.format.NumberFormat.getInstance({
			style: 'standard'
		}).format(this.entry.time);
		this.getView().setModel(new sap.ui.model.json.JSONModel(this.entry), "entry");
		var r = this.oApplication.getModel('S31modelexch').getData().recentlyUsedSelected;
		if (r) {
			this.onRecentUsedSelect()
		}
		var m = this.oApplication.getModel('S31modelexch').getData().manualEntrySelected;
		if (m) {
			this.onManualEntrySelect();
			var e = this.oApplication.getModel('S31modelexch').getData().editeddata;
			var b = this.getView().getModel('fordynamictypes').getData().types;
			if (b) {
				var k;
				for (k = 0; k < b.length; k++) {
					b[k].value = '';
					b[k].valueStateText = ''
				}
				if (e.entry.childItems) {
					var i;
					for (i = 0; i < b.length; i++) {
						if (b[i].fieldName === e.entry.mainName) {
							b[i].value = e.entry.mainItem + ' (' + e.entry.mainCode + ')';
							b[i].valueStateText = e.entry.mainCode;
							continue
						}
						var c = e.entry.childCodes[e.entry.childNames.indexOf(b[i].fieldName)];
						var f = e.entry.childItems[e.entry.childNames.indexOf(b[i].fieldName)];
						if (c) {
							b[i].value = f + ' (' + c + ')'
						}
						if (f) {
							b[i].valueStateText = c
						}
					}
				} else {
					for (i = 0; i < b.length; i++) {
						if (b[i].fieldName === e.entry.mainName) {
							b[i].value = e.entry.mainItem + ' (' + e.entry.mainCode + ')';
							b[i].valueStateText = e.entry.mainCode;
							break
						}
					}
				}
				this.getView().getModel('fordynamictypes').setProperty('/types', b);
				this.getView().setModel(this.getView().getModel('fordynamictypes'), 'fordynamictypes');
				w.setEnableMultiselection(false)
			}
			var g = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
			var h = w.getSelectedDates().toString().substr(0, 3);
			var j = [];
			for (var n in g) {
				if (!(h === g[n])) j.push(n)
			}
			var o = h ? j : null;
			w.setDisabledWeekDays(o)
		} else {
			w.setDisabledWeekDays(null)
		}
		this.getView().getModel('fordynamictypes').setProperty("/recentlyUsedSelected", r);
		this.getView().getModel('fordynamictypes').setProperty("/manualEntrySelected", m);
		this.manualEntrySelected = this.oApplication.getModel('S31modelexch').getData().manualEntrySelected;
		if (this.manualEntrySelected) {
			e = this.oApplication.getModel('S31modelexch').getData().editeddata;
			if (!this.workListTypeNew) {
				this.workListTypeNew = []
			}
			if (e && e.entry && e.entry.childItems) {
				for (i = 0; i < e.entry.childItems.length; i++) {
					this.workListTypeNew.push({
						name: e.entry.childItems[i],
						fieldName: e.entry.childNames[i],
						fieldValue: e.entry.childCodes[i]
					})
				}
			}
		} else {
			this.onRecentUsedSelect()
		}
		this.validateSaveBtnVisibility();
		if (e) {
			this.edit_entry = true;
			this.edit_entry_data = this.clone(e)
		} else {
			this.edit_entry = false
		}
	},
	validate: function() {
		this.dateTimeModified = true;
		this.validateSaveBtnVisibility()
	},
	check_for_changed_data: function() {
		var c = this.byId("weeklyCalendar");
		var s = c.getSelectedDates();
		var d = null;
		if (this.isClockEntry()) {
			var a = this.byId('startTime').getValue();
			var e = this.byId('endTime').getValue()
		} else {
			d = this.byId('decimalTimeEntryValue').getValue()
		}
		var n = this.byId('S31TextArea').getValue();
		var b = this.byId('COST_ASSIGNMENT_RECENTLY_USED_LIST').getValue();
		if (this.edit_entry) {
			var f = this.edit_entry_data;
			var g = this.getDateStr(new Date(s[0]));
			var o = f.pageData.days[f.dayIndex].dateStr;
			var h = f.entry.notes;
			var j = f.entry.mainName;
			var k = f.entry.mainCode;
			var l = this.getView().getModel('fordynamictypes').getData().types;
			var m;
			var p;
			var q;
			var r, t;
			var u, v;
			if (this.isClockEntry()) {
				var w = f.entry.startTime;
				var x = f.entry.endTime;
				if (w !== a || x !== e) return true
			} else {
				var y = f.entry.time;
				if (y !== d) return true
			}
			for (u = 0; u < l.length; u++) {
				m = l[u].fieldName;
				if (m === j) {
					q = l[u].value;
					r = l[u].value.indexOf('(');
					t = l[u].value.indexOf(')');
					p = l[u].value.substring(r + 1, t);
					if (p !== k) {
						return true
					}
				}
				for (v = 0; f.entry.childItems && f.entry.childItems[v]; v++) {
					if (f.entry.childNames[v] === m) {
						q = l[u].value;
						r = l[u].value.indexOf('(');
						t = l[u].value.indexOf(')');
						p = l[u].value.substring(r + 1, t);
						if (f.entry.childCodes[v] !== p) {
							return true
						}
					}
				}
			}
			if (s.length > 1 || o !== g || h !== n) {
				return true
			}
			return false
		} else {
			var z = false;
			var A = this.getView().getModel('fordynamictypes').getData().types;
			if (A) {
				for (var i = 0; i < A.length; i++)
					if (A[i].value.trim()) z = true
			}
			if (this.isClockEntry()) {
				if (s.length !== 0 || a !== "" || e !== "" || b !== "" || z) return true
			} else {
				if (s.length !== 0 || (d !== "0" && d !== "") || b !== "" || z) return true
			}
			return false
		}
	},
	onBeforeRendering: function() {
		this.initialiseView()
	},
	prepareModelData: function(d) {
		var h, m;
		if (!d.mainItem) {
			d.subItems = ""
		}
		if (d.hours === undefined || d.hours === "") {
			h = parseInt(this.getTargetHours(), 10);
			d.hours = h
		}
		if (d.minutes === undefined || d.minutes === "") {
			m = parseInt((this.getTargetHours() % 1) * 60, 10);
			d.minutes = m
		}
		return d
	},
	getDateinCurrentLanguage: function(d) {
		var t = new sap.ui.model.json.JSONModel();
		var o = {
			dateValue: new Date(d)
		};
		t.setData(o);
		var a = new sap.m.Text({
			text: {
				path: "/dateValue",
				type: new sap.ui.model.type.Date({
					style: "full"
				})
			}
		}).setModel(t);
		return a.getText()
	},
	onTapOnDate: function(e) {
		this.validateSaveBtnVisibility(e);
		var d = e.getSource().getSelectedDates();
		var n = d.length;
		if (n > 1) {
			this.byId('createformtitle').setTitle(this.oBundle.getText('SUBMIT_HEADER_TEXT', [this.getDateinCurrentLanguage(d[0]), n - 1]))
		} else if (n === 1) {
			this.byId('createformtitle').setTitle(this.oBundle.getText('SUBMIT_HEADER_TEXT_SINGLE', [this.getDateinCurrentLanguage(d[0])]))
		} else if (n === 0) {
			this.byId('createformtitle').setTitle(this.oBundle.getText('ENTRY_DETAILS'))
		}
	},
	validateSaveBtnVisibility: function(e) {
		var t = false;
		if (this.isClockEntry()) {
			var s = this.byId('startTime').getValue();
			var a = this.byId('endTime').getValue();
			if (((s && a) && s !== a)) {
				t = true
			} else {
				t = false
			}
		} else {
			var d = this.byId('decimalTimeEntryValue').getValue();
			if ((d !== "0") && d !== '') {
				if (this._isValidDecimalNumber(d)) {
					t = true
				} else {
					t = false
				}
			} else {
				t = false
			}
		}
		var b = this.byId('weeklyCalendar').getSelectedDates().length;
		var f = false;
		if (this.recentlyUsedButtonSelected) {
			f = this.byId('COST_ASSIGNMENT_RECENTLY_USED_LIST').getValue() ? true : false
		} else {
			f = false;
			var c = this.getView().getModel('fordynamictypes').getData().types;
			if (c) {
				for (var i = 0; i < c.length; i++) {
					if (c[i].value.trim() || c[i].valueStateText.trim()) {
						f = true;
						break
					}
				}
			}
		} if (f && b && t) {
			this.setBtnEnabled('SUBMIT_BTN', true)
		} else {
			this.setBtnEnabled('SUBMIT_BTN', false)
		}
	},
	suggestionHelpChange: function(e) {
		e.getSource().setValue("");
		this.validateSaveBtnVisibility(e)
	},
	onSuggestedItemSelection: function(e) {
	    // 15-12-2014 - M. Blaak - Wijziging Inputveld Recent gebruikt
	    // Als uit autocomplete lijst wordt gekozen de index voor het gekozen item
	    // vastleggen in het model tbv van functie OnDone()
	    var s = this;
	    var oSelectedItem = e.getParameter("selectedItem");
	    if (oSelectedItem) {
	        s.selectedIndex = oSelectedItem.getParent().indexOfSuggestionItem(oSelectedItem);
		    this.validateSaveBtnVisibility(e);
	    }
	},
	onManualItemSelection: function(e) {
		this.validateSaveBtnVisibility(e)
	},
	manualHelpChange: function(e) {
		e.getSource().setValueStateText(e.getSource().getValue());
		this.validateSaveBtnVisibility(e)
	},
	onDurationValueChange: function(e) {
		this.validateSaveBtnVisibility(e)
	},
	onDecimalTimeValueChange: function(e) {
		this.dateTimeModified = true;
		var d = this.byId('decimalTimeEntryValue').getValue();
		if (this._isValidDecimalNumber(d)) this.validateSaveBtnVisibility(e);
		else this.setBtnEnabled('SUBMIT_BTN', false)
	},
	_isValidDecimalNumber: function(n) {
		var a = n.toString();
		var d = a.indexOf(".");
		var c = a.indexOf(",");
		if (d > 0 && c > 0) return false;
		var s = d;
		if (s < 0) {
			s = a.indexOf(",")
		}
		var b = "0123456789";
		var i;
		var f;
		var e = 0;
		var h = false;
		if (s === -1) {
			i = a;
			f = ""
		} else {
			i = a.slice(0, s);
			f = a.slice(s + 1, a.length)
		} if (i.length > 5) return false;
		for (e = 0; e < i.length; e++) {
			if (i[e] === "0") {} else if (b.indexOf(i[e]) === -1) return false;
			else h = true
		}
		if (f.length > 2) return false;
		for (e = 0; e < f.length; e++) {
			if (f[e] === "0") {} else if (b.indexOf(f[e]) === -1) return false;
			else h = true
		}
		if (h === false) return false;
		return true
	},
	scrollerResize: function() {
		try {
			var c = this.byId("COST_ASSIGNMENT_TYPE_SEARCH_PAGE");
			var C = c.$();
			var $ = this.byId("COST_ASSIGNMENT_TYPE_SEARCH_FIELD").$();
			var a = this.byId("COST_ASSIGNMENT_TYPE_SCROLL_CONTAINER").$();
			var b = C.parent().height();
			var d = c.mAggregations.internalHeader.$().height();
			var f = $.height();
			if (b > 0) {
				a.height(b - d - f)
			}
		} catch (e) {}
	},
	onNavButton: function() {
		var c = this.byId("weeklyCalendar");
		var s = c.getSelectedDates();
		var a;
		if (s.length > 0) {
			var d = s[0];
			a = d + 'offset' + c.getFirstDayOffset()
		} else {
			var b = this.oApplication.getModel("S31modelexch").getData().viewDataS3.pageData.start;
			a = sap.ui.core.format.DateFormat.getDateInstance({
				style: "short"
			}).parse(b);
			a = a.toDateString() + 'offset' + c.getFirstDayOffset()
		} if (this.check_for_changed_data()) {
			var S = {
				question: this.oBundle.getText("CONFIRM_LEAVE_PAGE"),
				showNote: false,
				title: this.oBundle.getText("UNSAVED_CHANGES"),
				confirmButtonLabel: this.oBundle.getText("OK")
			};
			var e = this;
			sap.ca.ui.dialog.factory.confirm(S, function(r) {
				if (r.isConfirmed === true) {
					e.oRouter.navTo("S3", {
						context: a
					}, true)
				}
			})
		} else {
			this.oRouter.navTo("S3", {
				context: a
			}, true)
		}
	},
	getTypeListCollection: function(o) {
		var s = this;
		var c = 0;
		var d = (o && o.fieldName);
		if (this.remoteSearchPhrase) {
			c = this.remoteSkip
		} else {
			c = this.localSkip
		}
		var l = ";;";
		var e = "";
		var f = this.getView().getModel('fordynamictypes').getData().types.length;
		for (var i = 0; i < f; i++) {
			var g = this.getView().getModel('fordynamictypes').getData().types[i].valueStateText;
			var h = this.getView().getModel('fordynamictypes').getData().types[i].fieldName;
			if (g.length !== 0 && h !== d) {
				var k = h + "=" + g;
				if (e) e += l + k;
				else e += k
			}
		}
		this.gv_fieldRelated = e;
		var m = this.byId('weeklyCalendar');
		var n = m.getSelectedDates();
		if (n[0]) {
			var p = n.length;
			this.searchField_begDa = this.parseDateYYYYMMdd(n[0]);
			this.searchField_endDa = this.parseDateYYYYMMdd(n[p - 1])
		} else {
			var M = this.oApplication.getModel("TSM_WEEKLY");
			var w = M.getData().workingDayList;
			p = w.length;
			this.searchField_begDa = w[0].date;
			this.searchField_endDa = w[p - 1].date
		}
		this.oService.getCostAssignmentTypeListCollection((d || this.fieldName), this.top, c, this.remoteSearchPhrase, this.gv_fieldRelated,
			this.searchField_begDa, this.searchField_endDa, function(q) {
				s.remoteSearchActive = false;
				var t = [];
				if (s.remoteSearch()) {
					t = s.localTypeList;
					s.remoteSearchActive = true;
					s.lastRemoteSearchPhrase = s.remoteSearchPhrase
				} else {
					t = s.localTypeList
				} if (q.length > 0 && t.length === 0) {
					t.push({
						fieldValueId: s.noneText,
						fieldValue: s.noneText,
						fieldId: ""
					})
				}
				var r;
				for (var i = 0; i < q.length; i++) {
					r = 1;
					for (var j = 0; j < t.length; j++) {
						var C = "(" + q[i].FieldId + ")";
						if (t[j].fieldValue === q[i].FieldValue && t[j].fieldId === C) {
							r = 0;
							break
						}
					}
					if (r === 1) {
						t.push({
							fieldValue: q[i].FieldValue,
							fieldId: "(" + q[i].FieldId + ")",
							fieldValueId: q[i].FieldValue + " (" + q[i].FieldId + ")"
						})
					}
				}

				function u(v) {
					var x = 1;
					if (v[0] === "-") {
						x = -1;
						v = v.substr(1)
					}
					return function(a, b) {
						var y = (a[v] < b[v]) ? -1 : (a[v] > b[v]) ? 1 : 0;
						return y * x
					}
				}
				t.sort(u("fieldId"));
				s.oModel.setProperty("/" + (o && o.fieldName), t);
				s.selectCostObject();
				s.oModel.updateBindings();
				if (s.remoteSearch()) {
					s.remoteResultsLength = q.length;
					s.checkRemotePaging(s.remoteResultsLength)
				} else {
					s.localResultsLength = q.length;
					s.checkLocalPaging(s.localResultsLength, o && o.fieldName)
				}
				jQuery.sap.measure.end(hcm.emp.mytimesheet.utils.PerfUtils.getEndId(hcm.emp.mytimesheet.utils.PerfUtils.COST_ASSIGNMENT_SEARCH_LOAD))
			})
	},
	selectCostObject: function() {},
	remoteSearch: function() {
		if ("remoteSearchPhrase" in this) {
			if (this.remoteSearchPhrase) {
				return this.remoteSearchPhrase
			}
		}
		return false
	},
	checkLocalPaging: function(r, s) {
		var t = this.typeListControl.getItems();
		var a = t.length;
		if (a === 0 || a >= this.MODEL_SIZE_LIMIT) {
			return
		}
		if (t) {
			if (t[a - 1].getTitle() === this.oBundle.getText("TAP_TO_LOAD_MORE_LOADING")) {
				this.typeListControl.removeItem(t[a - 1])
			}
		}
		if (r < this.top) {
			if (t[a - 1].getTitle() === this.oBundle.getText("TAP_TO_LOAD_MORE") || t[a - 1].getTitle() === this.oBundle.getText(
				"CONTINUE_SEARCH_ON_SERVER")) {
				this.typeListControl.removeItem(t[a - 1])
			}
		} else if (r >= this.top) {
			if (t[a - 1].getTitle() === this.oBundle.getText("TAP_TO_LOAD_MORE")) {
				return
			} else {
				if (t[a - 1].getTitle() === this.oBundle.getText("CONTINUE_SEARCH_ON_SERVER")) {
					t[a - 1].setTitle(this.oBundle.getText("TAP_TO_LOAD_MORE"))
				} else {
					this.loadMoreItem = new sap.m.StandardListItem({
						title: this.oBundle.getText("TAP_TO_LOAD_MORE"),
						active: true
					});
					this.typeListControl.addItem(this.loadMoreItem)
				}
			}
		}
	},
	checkRemotePaging: function(r) {
		if (r >= this.top || !this.remoteSearchActive || this.lastRemoteSearchPhrase !== this.remoteSearchPhrase) {
			var t = this.typeListControl.getItems();
			var a = t.length;
			if (a === 0 || a >= this.MODEL_SIZE_LIMIT) {
				this.noneTextItem = new sap.m.StandardListItem({
					title: this.noneText,
					active: true
				});
				this.typeListControl.insertItem(this.noneTextItem, 0);
				this.addContinueSearchItem(this.oBundle.getText("CONTINUE_SEARCH_ON_SERVER"));
				return
			}
			if (t[a - 1].getTitle() === this.oBundle.getText("CONTINUE_SEARCH_ON_SERVER")) {
				return
			} else {
				if (t[a - 1].getTitle() === this.oBundle.getText("TAP_TO_LOAD_MORE")) {
					t[a - 1].setTitle(this.oBundle.getText("CONTINUE_SEARCH_ON_SERVER"))
				} else {
					this.addContinueSearchItem(this.oBundle.getText("CONTINUE_SEARCH_ON_SERVER"))
				}
			}
		} else {
			t = this.typeListControl.getItems();
			a = t.length;
			if (t[a - 1].getTitle() === this.oBundle.getText("CONTINUE_SEARCH_ON_SERVER") && r < this.top) {
				this.typeListControl.removeItem(t[a - 1])
			}
		}
	},
	addContinueSearchItem: function(t) {
		this.continueSearchItem = new sap.m.StandardListItem({
			title: this.oBundle.getText("CONTINUE_SEARCH_ON_SERVER"),
			active: true
		});
		this.typeListControl.addItem(this.continueSearchItem);
		this.continueSearchItem.addEventDelegate({
			onAfterRendering: function(e) {
				$(this.continueSearchItem.$().context.firstChild).attr("colspan", "2")
			}
		}, this)
	},
	tapToLoadMore: function(s) {
		this.localSkip += this.top;
		this.getTypeListCollection(s)
	},
	continueSearchOnServer: function(s) {
		this.remoteSearchPhrase = this.searchPhrase;
		if (this.firstRemoteSearch) {
			this.firstRemoteSearch = false;
			this.continueSearchOnServerActive = true
		} else {
			this.remoteSkip += this.top
		}
		this.getTypeListCollection(s);
		return this.remoteSearchPhrase
	},
	refineSearchResult: function() {
		this.typeBinding = this.typeListControl.getBinding("items");
		var f = [];
		if (this.searchPhrase) {
			f.push(new sap.ui.model.Filter("fieldValueId", sap.ui.model.FilterOperator.Contains, this.searchPhrase));
			f.push(new sap.ui.model.Filter("fieldValueId", sap.ui.model.FilterOperator.Contains, this.noneText))
		}
		this.typeBinding.filter(f)
	},
	onLiveChange: function(e) {
		var v = e.getParameter("value");
		var f = [];
		f.push(new sap.ui.model.Filter("fieldValueId", sap.ui.model.FilterOperator.Contains, v));
		e.getSource().getBinding("items").filter(f);
		if (e.getSource().getBinding("items").filter(f).getLength() < 1) {
			e.getSource().setNoDataText()
		}
		this.searchPhrase = e.getParameter("value");
		this.searchField = e.getSource();
		if (this.searchPhrase) {
			this.refineSearchResult();
			if (this.searchPhrase !== this.remoteSearchPhrase) {
				this.resetRemoteSearch()
			}
			this.remoteSearchPhrase = this.searchPhrase;
			this.checkRemotePaging(this.remoteResultsLength);
			this.selectCostObject()
		} else {
			this.refineSearchResult();
			this.remoteSearchPhrase = "";
			this.oModel.setProperty("typeList", this.localTypeList);
			this.remoteSearchActive = false;
			this.checkLocalPaging(this.localResultsLength);
			this.resetRemoteSearch()
		}
	},
	resetRemoteSearch: function() {
		this.firstRemoteSearch = true;
		this.remoteSkip = 0;
		this.remoteTypeList = [];
		this.continueSearchOnServerActive = false;
		this.remoteSearchPhrase = "";
		this.remoteSearchActive = false
	},
	onSelectType: function(e) {
		var i = e.mParameters.listItem.getTitle();
		var a = e.mParameters.listItem.getText();
		if (i === this.oBundle.getText("TAP_TO_LOAD_MORE")) {
			this.tapToLoadMore();
			return
		} else if (i === this.oBundle.getText("CONTINUE_SEARCH_ON_SERVER")) {
			this.continueSearchOnServer();
			return
		}
		var f = i;
		var b = a.substr(1, a.length - 2);
		this.cleanUpOnBack();
		if (f === this.noneText) {
			this.overrideNavController.navigateBack("CostAssignment", {
				costAssignmentReturnType: ""
			})
		} else {
			this.cleanUpOnBack();
			this.overrideNavController.navigateBack("CostAssignment", {
				costAssignmentReturnType: {
					fieldValueText: f,
					fieldValue: b
				}
			})
		}
		this.clearSearchField()
	},
	clearSearchField: function() {
		if ("searchField" in this) {
			this.searchField.setValue("");
			this.typeBinding.filter([])
		}
	},
	onSuggestedInputHelp: function(e) {
		var s = this;
		var a = {};
		a.fieldName = e.getSource().getModel().getProperty('fieldName', arguments[0].getSource().getBindingContext());
		a.name = e.getSource().getParent().getLabel().getText();
		var D = e.getSource().getPlaceholder();
		var S = new sap.m.SelectDialog({
			title: D,
			search: this.onLiveChange,
			liveChange: this.onLiveChange
		});
		var i = new sap.m.StandardListItem({
			title: "{name}",
			description: "{others}",
			active: true
		});
		S.setModel(s.oModel);
		S.bindAggregation("items", "/projects", i);
		S.open();
		var b = arguments[0].getSource();
		s = this;
		S.attachConfirm(function(c) {
			var d = c.getParameter("selectedItem");
			if (d) {
				s.selectedIndex = c.getParameter("selectedItem").getParent().indexOfItem(c.getParameter("selectedItem"));
				// 01-12-2014: M. Blaak Wijziging
				// Alleen de naam van het geselecteerde item overnemen in inputveld
				// if (d.getDescription()) {
				//     b.setValue(d.getTitle() + ", " + d.getDescription())
				// } else {
				// 	b.setValue(d.getTitle())
				// }
				b.setValue(d.getTitle())
				s.validateSaveBtnVisibility(c)
			}
			S.destroy();
			S = null
		});
		if (this.extHookOnSuggestedInputHelp) {
			this.extHookOnSuggestedInputHelp()
		}
	},
	onInputHelp: function() {
		var s = this;
		var a = {};
		a.fieldName = arguments[0].getSource().getModel().getProperty('fieldName', arguments[0].getSource().getBindingContext());
		a.name = arguments[0].getSource().getValueStateText();
		a.fieldName = arguments[0].getSource().getName();
		var S = arguments[0].getSource().getParent().getLabel().getText();
		var o = new sap.m.SelectDialog({
			title: S,
			search: [this.onLiveChange, this],
			liveChange: [this.onLiveChange, this]
		});
		var i = new sap.m.StandardListItem({
			title: "{fieldValue}",
			description: "{fieldId}",
			active: true
		});
		s.typeListControl = o;
		s.getTypeListCollection(a);
		o.setModel(s.oModel);
		if (a.fieldName.indexOf("/") >= 0) {
			a.fieldName = a.fieldName.split("/").join("-")
		}
		o.bindAggregation("items", "/" + a.fieldName, i);
		o.open();
		var b = arguments[0].getSource();
		o.attachConfirm(function(e) {
			var c = e.getParameter("selectedItem");
			if (c) {
				s.selectedIndex = e.getParameter("selectedItem").getParent().indexOfItem(e.getParameter("selectedItem"));
				if (c.getTitle() === s.oBundle.getText("TAP_TO_LOAD_MORE")) {
					s.tapToLoadMore(a);
					o.open();
					return
				} else if (c.getTitle() === s.oBundle.getText("CONTINUE_SEARCH_ON_SERVER")) {
					var d = s.continueSearchOnServer(a);
					o.open(d);
					return
				} else if (c.getTitle() === "(None)") {
					b.setValue("");
					b.setValueStateText("")
				} else {
					b.setValue(c.getTitle() + " " + c.getDescription());
					b.setValueStateText(c.getDescription().replace('(', "").replace(")", ""))
				}
				s.validateSaveBtnVisibility(e)
			}
			o.destroy();
			o = null;
			s.localTypeList = [];
			s.remoteTypeList = [];
			s.resetRemoteSearch();
			s.top = s.RESULTS_TOP;
			s.remoteSkip = 0;
			s.localSkip = 0
		});
		o.attachCancel(function(e) {
			o = null;
			s.localTypeList = [];
			s.remoteTypeList = [];
			s.resetRemoteSearch();
			s.top = s.RESULTS_TOP;
			s.remoteSkip = 0;
			s.localSkip = 0
		});
		if (this.extHookOnInputHelp) {
			this.extHookOnInputHelp()
		}
	},
	getWorkListCollection: function(o) {
		this.getWorkListTypeCollection();
		this.workList = [];
		this.workListType = [];
		var s = this;
		var m = this.oApplication.getModel("TSM_WEEKLY");
		var w = m.getData().workingDayList;
		var l = w.length;
		this.searchField_begDa = w[0].date;
		this.searchField_endDa = w[l - 1].date;
		this.oService.getCostAssignmentWorkListCollection(this, this.searchField_begDa, this.searchField_endDa, function(d) {
			var a = 0;
			for (var i = 0; i < d.length; i++) {
				if (d[i].Level.trim() === "0") {
					s.workList[a] = {
						name: d[i].FieldValueText,
						childs: [],
						fieldName: d[i].FieldName,
						fieldValue: d[i].FieldValue,
						recordNumber: d[i].RecordNumber
					};
					a++
				}
			}
			for (i = 0; i < d.length; i++) {
				if (d[i].Level.trim() !== "0") {
					for (var j = 0; j < s.workList.length; j++) {
						if (s.workList[j].recordNumber === d[i].RecordNumber) s.workList[j].childs.push({
							name: d[i].FieldValueText,
							fieldName: d[i].FieldName,
							fieldValue: d[i].FieldValue
						})
					}
				}
			}
			for (i = 0; i < s.recentlyUsedCostAssignmentList.length; i++) {
				s.workList.push(s.recentlyUsedCostAssignmentList[i])
			}
			var p = [];
			for (i = 0; i < s.workList.length; i++) {
				var c = [];
				var b = [];
				var e = [];
				for (j = 0; j < s.workList[i].childs.length; j++) {
					c.push(s.workList[i].childs[j].name);
					b.push(s.workList[i].childs[j].fieldName);
					e.push(s.workList[i].childs[j].fieldValue)
				}
				p.push({
					name: s.workList[i].name,
					others: c.join(", "),
					childs: s.workList[i].childs,
					fieldName: s.workList[i].fieldName,
					fieldValue: s.workList[i].fieldValue,
					fieldValueId: s.workList[i].name + c.join(", ")
				});
				if ("selectedMainItem" in s && s.selectedMainItem) {
					if (s.workList[i].name === s.selectedMainItem && s.workList[i].fieldName === s.selectedMainName && s.workList[i].fieldValue === s.selectedMainCode) {
						if ("selectedChildItems" in s) {
							var f = [];
							var g = [];
							var h = [];
							for (j = 0; j < s.selectedChildItems.length; j++) {
								f.push(s.selectedChildItems[j]);
								g.push(s.selectedChildNames[j]);
								h.push(s.selectedChildCodes[j])
							}
							if ($(c).not(f).length === 0 && $(f).not(c).length === 0) {
								if ($(b).not(g).length === 0 && $(g).not(b).length === 0) {
									if ($(e).not(h).length === 0 && $(h).not(e).length === 0) {
										s.previouslySelectedIndex = i
									}
								}
							}
						} else {
							if (c.length === 0) {
								s.previouslySelectedIndex = i
							}
						}
					}
				}
			}
			if (!("previouslySelectedIndex" in s) && "selectedMainItem" in s && s.selectedMainItem) {
				var n = s.createNewCostAssignmentType(s.selectedMainItem, s.selectedMainName, s.selectedMainCode, s.selectedChildItems, s.selectedChildNames,
					s.selectedChildCodes);
				p.push(n);
				s.recentlyUsedCostAssignmentList.push(n);
				s.previouslySelectedIndex = s.selectedIndex = p.length - 1
			}
			s.workList = p;
			var k = {
				projects: s.workList
			};
			s.oModel.setProperty("/projects", s.workList)
		})
	},
	valueHelpDataForamtter: function(f, a) {
		if (f) {
			return f + " (" + a + ")"
		}
	},
	durationDateForamtter: function(h, m) {
		return h + ":" + m
	},
	getWorkListTypeCollection: function() {
		this.workListType = [];
		var s = this;
		this.oService.getCostAssignmentWorkListTypeCollection(this, function(d) {
			var a = {};
			var m = s.oApplication.getModel('S31modelexch').getData().manualEntrySelected;
			if (m) {
				a = s.oApplication.getModel('S31modelexch').getData().editeddata;
				if (!s.workListTypeNew) {
					s.workListTypeNew = []
				}
				if (a) {
					if (a.entry.childItems) {
						for (var i = 0; i < a.entry.childItems.length; i++) {
							s.workListTypeNew.push({
								name: a.entry.childItems[i],
								fieldName: a.entry.childNames[i],
								fieldValue: a.entry.childCodes[i]
							})
						}
					}
				}
				s.validateSaveBtnVisibility()
			}
			for (i = 0; i < d.length; i++) {
				var n = d[i].FieldText;
				var f = d[i].FieldName;
				var b = s.NON_BREAKING_SPACE;
				var c = "";
				var r = d[i].READONLY;
				if (s.editCostAssignment) {
					if (s.selectedMainName === f) {
						c = s.selectedMainCode;
						b = s.selectedMainItem
					} else {
						if ("selectedChildItems" in s) {
							for (var j = 0; j < s.selectedChildNames.length; j++) {
								if (s.selectedChildNames[j] === f) {
									c = s.selectedChildCodes[j];
									b = s.selectedChildItems[j]
								}
							}
						}
					}
				}
				var v = "";
				var g = "";
				if (a && a.entry) {
					if (a.entry.childItems) {
						var h = a.entry.childCodes[a.entry.childNames.indexOf(f)];
						var k = a.entry.childItems[a.entry.childNames.indexOf(f)];
						if (h) {
							v = k + ' (' + h + ')'
						}
						if (k) {
							g = h
						}
						if (!v) {
							if (f === a.entry.mainName) {
								v = a.entry.mainItem + ' (' + a.entry.mainCode + ')';
								g = a.entry.mainCode
							}
						}
					} else {
						if (f === a.entry.mainName) {
							v = a.entry.mainItem + ' (' + a.entry.mainCode + ')';
							g = a.entry.mainCode
						}
					}
				}
				s.workListType.push({
					name: n,
					selectedName: b,
					fieldName: f,
					listType: "Active",
					labelVisible: true,
					typeVisible: true,
					fieldValue: c,
					value: v,
					valueStateText: g,
					READONLY: r.toLowerCase() === "true" ? false : true
				})
			}
			s.getView().getModel('fordynamictypes').setProperty("/types", s.workListType);
			if ("previouslySelectedIndex" in s) {
				try {
					s.recentlyUsedList.mAggregations.items[s.previouslySelectedIndex].setSelected(true)
				} catch (e) {}
				s.oModel.setProperty("/doneButtonEnabled", true);
				s.recentlyUsedButtonDoneEnabled = true
			}
			jQuery.sap.measure.end(hcm.emp.mytimesheet.utils.PerfUtils.getEndId(hcm.emp.mytimesheet.utils.PerfUtils.COST_ASSIGNMENT_LOAD))
		})
	},
	createNewCostAssignmentType: function(m, a, b, c, d, e) {
		var f = [];
		var t = [];
		if (typeof c !== 'undefined') {
			for (var i = 0; i < c.length; i++) {
				f.push({
					name: c[i],
					fieldName: d[i],
					fieldValue: e[i]
				});
				t.push(c[i])
			}
		}
		return {
			name: m,
			others: t.join(", "),
			childs: f,
			fieldName: a,
			fieldValue: b
		}
	},
	onRecentUsedSelect: function() {
		this.recentlyUsedButtonSelected = true;
		this.setBtnEnabled('SUBMIT_BTN', false);
		this.byId("COST_ASSIGNMENT_RECENTLY_USED_LIST_ELEMENT").setVisible(true);
		this.byId("COST_ASSIGNMENT_MANUAL_INPUT_LIST").setVisible(false);
		var t = this.getView().getModel('fordynamictypes').getData().types;
		if (t) {
			for (var i = 0; i < t.length; i++) {
				t[i].value = ""
			}
			this.getView().getModel('fordynamictypes').setProperty('/fordynamictypes', t)
		}
	},
	onManualEntrySelect: function() {
		this.recentlyUsedButtonSelected = false;
		this.byId("COST_ASSIGNMENT_MANUAL_INPUT_LIST").setVisible(true);
		this.byId("COST_ASSIGNMENT_RECENTLY_USED_LIST_ELEMENT").setVisible(false);
		this.byId('COST_ASSIGNMENT_RECENTLY_USED_LIST').setValue('')
	},
	onDone: function() {
		this.entry.showError = false;
		this.entry.error = "";
		this.cleanUpOnBack();
		this.resetMainAndChildItems();
		var m = true;
		this.entry.notes = this.byId('S31TextArea').getValue();
		if (this.recentlyUsedButtonSelected) {
			this.entry.mainItem = this.workList[this.selectedIndex].name;
			this.entry.mainName = this.workList[this.selectedIndex].fieldName;
			this.entry.mainCode = this.workList[this.selectedIndex].fieldValue;
			if (this.workList[this.selectedIndex].others) {
				this.initializeChildItems();
				this.entry.subItems = this.workList[this.selectedIndex].others;
				for (var i = 0; i < this.workList[this.selectedIndex].childs.length; i++) {
					this.entry.childItems.push(this.workList[this.selectedIndex].childs[i].name);
					this.entry.childNames.push(this.workList[this.selectedIndex].childs[i].fieldName);
					this.entry.childCodes.push(this.workList[this.selectedIndex].childs[i].fieldValue)
				}
			}
		} else {
			m = false;
			var a = this.byId('COST_ASSIGNMENT_MANUAL_INPUT_LIST').getFormElements();
			for (var j = 0; j < a.length; j++) {
				var k = a[j].getFields()[0].getName();
				var v = a[j].getFields()[0].getValue() && a[j].getFields()[0].getValueStateText();
				if (!v) {
					v = a[j].getFields()[0].getValue()
				}
				if (v) {
					if (!m) {
						this.entry.mainItem = k;
						this.entry.mainName = k;
						this.entry.mainCode = v;
						m = true
					} else {
						if (!this.entry.childItems) {
							this.initializeChildItems();
							this.childItemsInitialized = true
						}
						this.entry.childItems.push(k);
						this.entry.childNames.push(k);
						this.entry.childCodes.push(v)
					}
				}
			}
			if ("childItems" in this.entry) {
				if (this.entry.childItems.length > 1) {
					this.entry.subItems = this.entry.childItems.join(", ")
				} else if (this.entry.childItems.length === 1) {
					this.entry.subItems = this.entry.childItems[0]
				}
			}
		} if (m) {
			this.setEntryChanged();
			this.onSubmit()
		} else {
			this.initializeChildItems()
		}
	},
	onSubmit: function() {
		this.entry.showError = false;
		this.entry.error = "";
		this.entry.rejectionReason = undefined;
		this.updatePageData()
	},
	updatePageData: function(d) {
		if (d) {
			this.entry.deleted = true
		}
		this.entry.newEntry = false;
		this.entry.showTime = true;
		var a = this.byId('weeklyCalendar');
		var s = a.getSelectedDates();
		var m = this.oApplication.getModel("TSM_WEEKLY");
		var w = m.getData().workingDayList;
		var b = new Array(),
			c = 0;
		if ((this.isDecimalTimeEntry()) && (!this.isClockEntry())) {
			var l = this.byId("decimalTimeEntryValue").getValue();
			if (l.indexOf(",") > 0) l = l.replace(",", ".");
			this.entry.time = l
		} else {
			if (!this.isClockEntry()) {
				var e = this.byId("DateTimeInputValue").getValue();
				this.entry.hours = e.split(':')[0];
				this.entry.minutes = e.split(':')[1];
				this.entry.time = parseFloat(this.entry.hours) + parseFloat(this.entry.minutes) / 60;
				this.entry.time = this.entry.time.toFixed(2)
			} else {
				for (var i = 0; i < s.length; i++) {
					var f = this.parseDateYYYYMMdd(s[i]);
					$.each(w, function(k, v) {
						if (v.date === f) {
							b[c++] = v
						}
					})
				}
				this.entry.selectedDate = b;
				var g = this.byId("startTime").getDateValue(),
					h = this.byId("endTime").getDateValue();
				this.entry.startTime = this.convertTime(g);
				this.entry.endTime = this.convertTime(h);
				var j = (h.getTime() - g.getTime()) / (1000 * 60);
				this.entry.hours = parseInt((j / 60), 10);
				this.entry.minutes = j % 60;
				this.entry.time = "0.0"
			}
		}
		this.entry.hasNotes = (this.entry.notes && this.entry.notes.length > 0) ? true : false;
		this.submitToOdata();
		if (this.extHookUpdateData) {
			this.extHookUpdateData()
		}
	},
	convertTime: function(d) {
		var t = sap.ui.core.format.DateFormat.getTimeInstance({
			pattern: "HHmmss"
		});
		return t.format(d)
	},
	formatAMPM: function(d) {
		var h = d.getHours();
		var m = d.getMinutes();
		var a = h >= 12 ? 'PM' : 'AM';
		h = h % 12;
		h = h ? h : 12;
		m = m < 10 ? '0' + m : m;
		var s = h + ':' + m + ' ' + a;
		return s
	},
	submitToOdata: function() {
		this.validateLunchBreak();
		var s = this;
		var c = this.byId('weeklyCalendar');
		var a = c.getSelectedDates();
		this.errors = null;
		var b = new sap.m.Text({
			text: this.byId('createformtitle').getTitle()
		});
		s = this;
		var d = null;
		var i = 0;
		var h;
		var m;
		var n = a.length;
		if (!this.isClockEntry()) {
			var e = this.byId("DateTimeInputValue").getValue();
			h = e.split(':')[0];
			m = e.split(':')[1];
			h = h * n;
			m = m * n;
			if (m > 59) {
				m = m % 60;
				h += Math.round(m / 60)
			}
		} else {
			var f = this.byId("startTime").getDateValue(),
				g = this.byId("endTime").getDateValue();
			var j = (g.getTime() - f.getTime()) / (1000 * 60);
			j = j * n;
			var S = f.getHours() * 60 + f.getMinutes();
			var E = g.getHours() * 60 + g.getMinutes();
			for (i = 0; i < this.entry.selectedDate.length; i++) {
				var l = parseInt(this.entry.selectedDate[i].lunchStart.substring(0, 2), 10) * 60 + parseInt(this.entry.selectedDate[i].lunchStart.substring(
					2, 4), 10);
				var L = parseInt(this.entry.selectedDate[i].lunchEnd.substring(0, 2), 10) * 60 + parseInt(this.entry.selectedDate[i].lunchEnd.substring(
					2, 4), 10);
				if (S < l && E > L) {
					j -= (L - l)
				}
				if (j < 0) {
					j += (24 * 60)
				}
			}
			h = parseInt((j / 60), 10);
			m = j % 60;
			if (m > 59) {
				m = m % 60;
				h += Math.round(m / 60)
			}
		}
		var k;
		if (this.isDecimalTimeEntry() && !this.isClockEntry()) {
			var o = this.getView().byId('decimalTimeEntryValue').getValue();
			if (o.indexOf(",") > -1) o = o.replace(",", ".");
			o = parseFloat(o);
			o = o.toFixed(2);
			var p = sap.ca.ui.model.format.NumberFormat.getInstance({
				style: 'standard'
			}).format(o);
			k = p
		} else {
			k = this.oBundle.getText('FULL_CONCATENATE_HOURSMIN', [h, m])
		}
		var I = this.oApplication.getModel("timesheet_initialInfo");
		var r = I.getData().releaseAllowed;
		var q;
		var t;
		if (r) {
			q = this.oBundle.getText('DRAFT_CONFIRMATION_SUMMARY');
			t = this.oConfiguration.getText("DRAFT_CONFIRMATION")
		} else {
			q = this.oBundle.getText('SUBMISSION_CONFIRMATION_SUMMARY');
			t = this.oConfiguration.getText("SUBMISSION_CONFIRMATION")
		}
		var u = "";
		var v = null;
		var w = null;
		var x = sap.ca.ui.model.format.DateFormat.getTimeInstance({
			style: "short"
		});
		if (this.isClockEntry()) {
			if (this.byId("startTime").getDisplayFormat() === "hh:mm a" || this.byId("startTime").getDisplayFormat() === "h:mm a") {
				v = this.formatAMPM(f);
				w = this.formatAMPM(g)
			} else {
				v = x.format(f);
				w = x.format(g)
			}
			var y = {
				question: q,
				additionalInformation: [{
					label: this.oBundle.getText('DELETE_CONFIRMATION_SUMMARY_ENTRIES'),
					text: a.length.toString()
				}, {
					label: this.oBundle.getText('START_TIME'),
					text: v
				}, {
					label: this.oBundle.getText('END_TIME'),
					text: w
				}],
				showNote: false,
				title: t,
				confirmButtonLabel: this.oBundle.getText("OK")
			}
		} else {
			y = {
				question: q,
				additionalInformation: [{
					label: this.oBundle.getText('DELETE_CONFIRMATION_SUMMARY_ENTRIES'),
					text: a.length.toString()
				}, {
					label: this.oBundle.getText('DURATION'),
					text: k
				}],
				showNote: false,
				title: t,
				confirmButtonLabel: this.oBundle.getText("OK")
			}
		}
		jQuery.sap.measure.start(hcm.emp.mytimesheet.utils.PerfUtils.getStartId(hcm.emp.mytimesheet.utils.PerfUtils.WEEK_ENTRY_SUBMIT));
		var z = [];
		var A = (s.oApplication.getModel('S31modelexch').getData().manualEntrySelected) ? "U" : "C";
		if (a.length !== 0) {
			for (i = 0; i < a.length; i++) {
				s.entry = this.replaceSpecialChar(s.entry);
				z.push(s.setPostObjectForCheck(s.entry.counter, A, s.parseDateYYYYMMdd(a[i]), s.entry.time, s.entry.mainName, s.entry.mainCode, s.entry
					.notes, s.entry.startTime, s.entry.endTime, s.entry.subItems, s.entry.childCodes, s.entry.childNames))
			}
		}
		if (z.length === 0) {
			sap.ui.getCore().lock();
			d.close()
		} else {
			s.oService.checkSubmittedTime(s, z, [], [], function() {
				jQuery.sap.measure.end(hcm.emp.mytimesheet.utils.PerfUtils.getEndId(hcm.emp.mytimesheet.utils.PerfUtils.WEEK_ENTRY_SUBMIT));
				sap.ca.ui.dialog.factory.confirm(y, function(B) {
					if (B.isConfirmed === true) {
						jQuery.sap.measure.start(hcm.emp.mytimesheet.utils.PerfUtils.getStartId(hcm.emp.mytimesheet.utils.PerfUtils.WEEK_ENTRY_SUBMIT));
						var z = [];
						var A = (s.oApplication.getModel('S31modelexch').getData().manualEntrySelected) ? "U" : "C";
						if (a.length !== 0) {
							for (i = 0; i < a.length; i++) {
								z.push(s.setPostObject(s.entry.counter, A, s.parseDateYYYYMMdd(a[i]), s.entry.time, s.entry.mainName, s.entry.mainCode, s.entry.notes,
									s.entry.startTime, s.entry.endTime, s.entry.subItems, s.entry.childCodes, s.entry.childNames))
							}
						}
						if (z.length === 0) {
							sap.ui.getCore().lock();
							d.close()
						} else {
							s.oService.submitTimeEntry(s, z, [], [], function() {
								jQuery.sap.measure.end(hcm.emp.mytimesheet.utils.PerfUtils.getEndId(hcm.emp.mytimesheet.utils.PerfUtils.WEEK_ENTRY_SUBMIT));
								var I = s.oApplication.getModel("timesheet_initialInfo");
								var r = I.getData().releaseAllowed;
								var C;
								if (r) {
									C = s.oBundle.getText('DRAFT_SUCCESS')
								} else {
									C = s.oBundle.getText('SUBMIT_SUCCESS')
								}
								var D = s.byId("weeklyCalendar");
								var a = D.getSelectedDates();
								var F;
								F = a[0];
								var G = F + 'offset' + D.getFirstDayOffset();
								s.oRouter.navTo("S3", {
									context: G
								});
								sap.m.MessageToast.show(C, {
									duration: 1000
								})
							}, function(C, B) {
								jQuery.sap.measure.end(hcm.emp.mytimesheet.utils.PerfUtils.getEndId(hcm.emp.mytimesheet.utils.PerfUtils.WEEK_ENTRY_SUBMIT));
								s.errors = C
							})
						}
					}
				})
			}, function(B, C) {
				jQuery.sap.measure.end(hcm.emp.mytimesheet.utils.PerfUtils.getEndId(hcm.emp.mytimesheet.utils.PerfUtils.WEEK_ENTRY_SUBMIT));
				s.errors = B
			})
		}
	},
	replaceAllOccurances: function(s) {
		if (typeof s === "undefined") {
			return
		}
		var S = '/';
		var r = '-';
		while (s.indexOf(S) > -1) {
			s = s.replace(S, r)
		}
		return s
	},
	replaceSpecialChar: function(e) {
		if (typeof e.mainName !== "undefined") {
			e.mainName = this.replaceAllOccurances(e.mainName)
		}
		if (typeof e.subItems !== "undefined") {
			e.subItems = this.replaceAllOccurances(e.subItems)
		}
		if (typeof e.childNames !== "undefined") {
			for (var i = 0; i < e.childNames.length; i++) {
				e.childNames[i] = this.replaceAllOccurances(e.childNames[i])
			}
		}
		return e
	},
	getDateStr: function(d) {
		return "" + d.getFullYear() + ("" + (d.getMonth() + 101)).substring(1) + ("" + (d.getDate() + 100)).substring(1)
	},
	getPostData: function(d, e) {
		var p = {};
		p.day = d;
		p.entry = e;
		return p
	},
	setPostObject: function(C, T, W, a, N, b, n, s, e, c, d, f) {
		var t = {
			Counter: C,
			TimeEntryOperation: T,
			TimeEntryDataFields: {
				WORKDATE: W,
				CATSAMOUNT: "" + a,
				BEGUZ: s,
				ENDUZ: e
			}
		};
		t.TimeEntryRelease = " ";
		if (this.checkFieldName(N) === true) {
			t.TimeEntryDataFields[N] = b
		}
		if (c && c !== "") {
			for (var i = 0; i < f.length; i++) {
				if (this.checkFieldName(f[i]) === true) {
					t.TimeEntryDataFields[f[i]] = d[i]
				}
			}
		}
		if (n && n !== "") {
			t.TimeEntryDataFields.LONGTEXT_DATA = n;
			t.TimeEntryDataFields.LONGTEXT = "X"
		}
		return t
	},
	setPostObjectForCheck: function(C, T, W, a, N, b, n, s, e, c, d, f) {
		var t = {
			Counter: C,
			TimeEntryOperation: T,
			TimeEntryDataFields: {
				WORKDATE: W,
				CATSAMOUNT: "" + a,
				BEGUZ: s,
				ENDUZ: e
			}
		};
		t.TimeEntryRelease = " ";
		if (N.indexOf("-") >= 0) {
			N = N.split("-").join("/")
		}
		if (this.checkFieldName(N) === true) {
			t.TimeEntryDataFields[N] = b
		}
		if (c && c !== "") {
			for (var i = 0; i < f.length; i++) {
				if (f[i].indexOf("-") >= 0) {
					f[i] = f[i].split("-").join("/")
				}
				if (this.checkFieldName(f[i]) === true) {
					t.TimeEntryDataFields[f[i]] = d[i]
				}
			}
		}
		if (n && n !== "") {
			t.TimeEntryDataFields.LONGTEXT_DATA = n;
			t.TimeEntryDataFields.LONGTEXT = "X"
		}
		return t
	},
	checkFieldName: function(f) {
		var c = new String(f);
		if (c.match("DISPTEXT")) {
			return false
		}
		if (c.match("CPR_OBJTEXT")) {
			return false
		}
		if (c.match("CPR_TEXT")) {
			return false
		}
		return true
	},
	parseDateYYYYMMdd: function(d) {
		var a = sap.ui.core.format.DateFormat.getDateInstance({
			pattern: "YYYYMMdd"
		});
		var s = new Date(d);
		return a.format(s)
	},
	onReset: function(e) {
		var c = this.byId('weeklyCalendar');
		var s = c.getSelectedDates();
		c.toggleDatesSelection(s);
		this.byId('createformtitle').setTitle(this.oBundle.getText('ENTRY_DETAILS'));
		this.byId('DateTimeInputValue').setValue('now');
		if (this.isDecimalTimeEntry()) {
			this.byId('decimalTimeEntryValue').setValue('')
		}
		if (this.isClockEntry()) {
			this.byId('startTime').setValue('');
			this.byId('endTime').setValue('')
		}
		this.byId('S31TextArea').setValue('');
		this.byId('COST_ASSIGNMENT_RECENTLY_USED_LIST').setValue('');
		var t = this.getView().getModel('fordynamictypes').getData().types;
		if (t) {
			for (var i = 0; i < t.length; i++) {
				t[i].value = ""
			}
			this.getView().getModel('fordynamictypes').setProperty('/fordynamictypes', t)
		}
		this.validateSaveBtnVisibility(e)
	},
	isClockEntry: function() {
		return this.oConfiguration.getClockEntry()
	},
	isDecimalTimeEntry: function() {
		return this.oConfiguration.getDecimalTimeEntry()
	},
	setEntryChanged: function() {
		this.entry.suggestion = false;
		this.entry.showTime = true
	},
	resetMainAndChildItems: function() {
		if ("mainItem" in this.entry) {
			this.deleteMainItem()
		}
		if ("subItems" in this.entry) {
			this.deleteSubItems()
		}
	},
	deleteMainItem: function() {
		delete this.entry.mainItem;
		delete this.entry.mainName;
		delete this.entry.mainCode
	},
	deleteSubItems: function() {
		delete this.entry.subItems;
		delete this.entry.childItems;
		delete this.entry.childNames;
		delete this.entry.childCodes
	},
	initializeChildItems: function() {
		this.entry.childItems = [];
		this.entry.childNames = [];
		this.entry.childCodes = []
	},
	cleanUpOnBack: function() {
		if ("previouslySelectedIndex" in this) {
			delete this.previouslySelectedIndex
		}
		if ("selectedMainItem" in this) {
			delete this.selectedMainItem;
			delete this.selectedMainName;
			delete this.selectedMainCode
		}
		if ("selectedChildItems" in this) {
			delete this.selectedChildItems;
			delete this.selectedChildNames;
			delete this.selectedChildCodes
		}
		this.recentlyUsedButtonDoneEnabled = false
	},
	getHeaderFooterOptions: function() {
		this._initialize();
		var I = this.oApplication.getModel("timesheet_initialInfo");
		var r = I.getData().releaseAllowed;
		var s;
		if (r) {
			s = this.oApplicationFacade.getResourceBundle().getText("SAVE_DRAFT")
		} else {
			s = this.oApplicationFacade.getResourceBundle().getText("SUBMIT")
		}
		var a;
		if (this.oApplicationFacade.oApplicationImplementation.getModel('S31modelexch').getData().recentlyUsedSelected) {
			a = this.oApplicationFacade.getResourceBundle().getText("TIMESHEET_CREATE_ENTRY_TITLE")
		} else {
			a = this.oApplicationFacade.getResourceBundle().getText("TIMESHEET_EDIT_ENTRY_TITLE_SCREEN")
		}
		var v = {
			sId: "SUBMIT_BTN",
			sI18nBtnTxt: s,
			onBtnPressed: function(e) {
				t.onDone(e)
			}
		};
		var t = this;
		var o = {
			sI18NFullscreenTitle: a,
			oEditBtn: v,
			buttonList: [{
				sId: "cancelBtn",
				sI18nBtnTxt: "RESET",
				onBtnPressed: function(e) {
					t.onReset(e)
				}
			}],
			onBack: jQuery.proxy(function() {
				this.onNavButton()
			}, this)
		};
		if (this.extHookChangeFooterButtons) {
			o = this.extHookChangeFooterButtons(o)
		};
		return o
	},
	onExit: function() {
		this.workListTypeNew = []
	}
});