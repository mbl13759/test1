
/*
* Copyright (C) 2009-2014 SAP SE or an SAP affiliate company. All rights reserved
*/
jQuery.sap.require("sap.ca.scfld.md.controller.BaseFullscreenController");
jQuery.sap.require("hcm.emp.mytimesheet.model.TimeEntry");
jQuery.sap.require("hcm.emp.mytimesheet.utils.ConnectionHelper");
jQuery.sap.require("hcm.emp.mytimesheet.utils.InitialConfigHelper");
sap.ui.controller("hcm.emp.mytimesheet.test1.view.S2Custom", {
	extHookOnInit: null,
	extHookChangeFooterButtons: null,
	extHookCalendarMonthChange: null,
	extHookGetUserInfo: null,
	extHookGetTimeSheetCalendar: null,
	extHookUpdateData: null,
	onInit: function() {
		sap.ca.scfld.md.controller.BaseFullscreenController.prototype.onInit.call(this);
		this.oApplication = this.oApplicationFacade.oApplicationImplementation;
		this.oConfiguration = new hcm.emp.mytimesheet.utils.InitialConfigHelper();
		this.oConnectionManager = this.oApplication.oConnectionManager;
		this.oBundle = this.oApplicationFacade.getResourceBundle();
		this.oConfiguration.setResourceBundle(this.oBundle);
		this.isRoot = true;
		var s = this;
		this.oRouter.attachRouteMatched(function(e) {
			if (e.getParameter("name") === "S2") {
				this.isRoot = false;
				s.refreshPage();
				var c = s.byId("calendar");
				c.unselectAllDates()
			}
		}, this);
		this.oModel = new sap.ui.model.json.JSONModel();
		var n = new Date();
		this.oModel.setData({
			quickEntryAllowed: true,
			year: n.getFullYear(),
			month: n.getMonth(),
			allAllowed: true,
			weekAllowed: true,
			monthAllowed: true
		});
		if (!this.oService) {
			this.oService = new hcm.emp.mytimesheet.Service()
		}
		if (this.extHookOnInit) {
			this.extHookOnInit()
		}
	},
	onCalendarMonthChange: function(e) {
		var d = new Date(e.getParameters().currentDate);
		this.oModel.setProperty("/month", d.getMonth());
		this.oModel.setProperty("/year", d.getFullYear());
		this.updateData(d.getMonth());
		if (this.extHookCalendarMonthChange) {
			this.extHookCalendarMonthChange()
		}
	},
	refreshPage: function() {
		this.updateData(this.oModel.getData().month);
		this.getUserInfo()
	},
	getUserInfo: function() {
		var m = this.oModel;
		var a = null;
		var s = null;
		var d = new Date();
		var b = this.oModel.getData().month;
		var y = this.oModel.getData().year;
		var c = new Date(y, b, 1);
		var e = this;
		var o = function(f) {
			var g = f[0];
			if (g) {
				if (f[0]) {
					m.setProperty("/quickEntryAllowed", f[0].Counter != null && f[0].Counter.length > 0)
				}
				for (var i = 0; i < f.length; i++) {
					if (f[i].FieldName == "TIME") {} else if (f[i].Level.trim() == "0") {
						a = f[i].FieldValueText
					} else {
						if (s) {
							s += ", " + f[i].FieldValueText
						} else {
							s = f[i].FieldValueText
						}
					}
				}
				m.setProperty("/mainItem", a);
				m.setProperty("/subItems", s);
				var I = e.oApplication.getModel("timesheet_initialInfo");
				e.oConfiguration.setInitialInfoModel(I);
				e.monitorPageRefreshEnded()
			}
		};
		if (!this.oService) {
			this.oService = new hcm.emp.mytimesheet.Service()
		}
		this.oService.getInitialInfos(this, this.getDateStr(c), this.getDateStr(d), o);
		if (this.extHookGetUserInfo) {
			this.extHookGetUserInfo()
		}
	},
	onWeeklyEntry: function(e) {
		if (sap.ui.getCore().isLocked()) {
			return
		}
		var d = e.getParameter("date");
		var a = new Date();
		a = a + "";
		var b = a.substring(0, 15);
		var c = this.byId("calendar");
		if (jQuery.sap.getUriParameters().get("old")) {
			this.oRouter.navTo("WeekEntry", {
				context: d + 'offset' + c.getFirstDayOffset()
			}, true)
		} else {
			this.oRouter.navTo("S3", {
				context: d + 'offset' + c.getFirstDayOffset()
			}, true)
		}
	},
	getTimeSheetCalendar: function(d) {
		var c = this.byId("calendar");
		c.removeTypesOfAllDates();
		var n = new Date();
		var g = [];
		var r = [];
		var a = [];
		var y = [];
		var b = [];
		var f = [];
		var e = -1;
		if (d.length > 0) {
			var h = d[0].FirstDayOfWeek;
			if (h == null) {
				e = -1
			} else if (h == "MONDAY") {
				e = 1
			} else if (h == "TUESDAY") {
				e = 2
			} else if (h == "WEDNESDAY") {
				e = 3
			} else if (h == "THURSDAY") {
				e = 4
			} else if (h == "FRIDAY") {
				e = 5
			} else if (h == "SATURDAY") {
				e = 6
			} else if (h == "SUNDAY") {
				e = 0
			}
		}
		if (e > 0) {
			c.setFirstDayOffset(e)
		}
		for (var i = 0; i < d.length; i++) {
			var j = d[i].Date;
			var w = d[i].WorkingDay == "TRUE";
			var s = d[i].Status;
			var k = new Date(parseInt(j.substring(0, 4), 10), parseInt(j.substring(4, 6), 10) - 1, parseInt(j.substring(6, 8), 10));
			if (!w) {
				g.push(k)
			}
			if (s == "NONE") {}
			if (s == "YACTION" && w) {
				if (n.getTime() > k.getTime()) {
					r.push(k)
				} else {
					f.push(k)
				}
			}
			if (s == "MACTION" && w) {
				y.push(k)
			}
			if (s == "DONE" && w) {
				a.push(k)
			}
			if (s == "REJECTED") {
				b.push(k)
			}
		}
		c.toggleDatesType(y, sap.me.CalendarEventType.Type04, true);
		c.toggleDatesType(a, sap.me.CalendarEventType.Type01, true);
		c.toggleDatesType(g, sap.me.CalendarEventType.Type00, true);
		c.toggleDatesType(r, sap.me.CalendarEventType.Type07, true);
		c.toggleDatesType(b, sap.me.CalendarEventType.Type06, true);
		c.toggleDatesType(f, sap.me.CalendarEventType.Type10, true);
		var l = this.byId("LEGEND");
		l.setLegendForType01(a.length > 0 ? this.oConfiguration.getText("FILLED_DAY") : null);
		l.setLegendForType04(y.length > 0 ? this.oConfiguration.getText("FILLED_MANAGER") : null);
		l.setLegendForType07(r.length > 0 ? this.oConfiguration.getText("MISSING_DAY") : null);
		l.setLegendForType06(b.length > 0 ? this.oConfiguration.getText("REJECTED") : null);
		l.setLegendForNormal(f.length > 0 ? this.oConfiguration.getText("WORKING_DAY") : null);
		l.setLegendForType00(g.length > 0 ? this.oConfiguration.getText("NON_WORKING_DAY") : null);
		this.oModel.setProperty("/filledDayVisible", a.length > 0);
		this.oModel.setProperty("/approvalVisible", y.length > 0);
		this.oModel.setProperty("/missingDayVisible", r.length > 0);
		this.oModel.setProperty("/rejectedVisible", b.length > 0);
		this.monitorPageRefreshEnded();
		if (this.extHookGetTimeSheetCalendar) {
			this.extHookGetTimeSheetCalendar()
		}
	},
	parseDateYYYYMMdd: function(d) {
		var a = sap.ui.core.format.DateFormat.getDateInstance({
			pattern: "YYYYMMdd"
		});
		var s = new Date(d);
		return a.format(s)
	},
	updateData: function(m) {
		var p = new Date();
		p.setDate(1);
		p.setYear(this.oModel.getData().year);
		p.setMonth(m);
		p.setDate(0);
		var l = p.getDate();
		var s = new Date();
		s.setYear(this.oModel.getData().year);
		s.setMonth(m);
		s.setDate(1);
		var f = s.getDay();
		var a = l - (f - 1);
		if (a != 1) {
			p.setDate(a);
			s = p
		}
		var e = new Date();
		e.setFullYear(s.getFullYear());
		e.setMonth(s.getMonth());
		e.setDate(s.getDate() + 34);
		var b = new Date();
		b.setFullYear(e.getFullYear());
		m++;
		b.setMonth(m);
		b.setDate(0);
		if (e.getTime() < b.getTime()) {
			e.setDate(e.getDate() + 7)
		}
		var c = this;
		if (!this.oService) {
			this.oService = new hcm.emp.mytimesheet.Service()
		}
		this.oService.getWorkDays(this, "" + this.getDateStr(s), "" + this.getDateStr(e), function(d) {
			c.getTimeSheetCalendar(d);
			c.getTimeSheetCalendar(d)
		});
		if (this.extHookUpdateData) {
			this.extHookUpdateData()
		}
	},
	monitorPageRefreshEnded: function() {
		var o = this;
		if ("pageRefreshPartOneEnded" in o) {
			delete o.pageRefreshPartOneEnded
		} else {
			o.pageRefreshPartOneEnded = true
		}
	},
	getDateStr: function(d) {
		return "" + d.getFullYear() + ("" + (d.getMonth() + 101)).substring(1) + ("" + (d.getDate() + 100)).substring(1)
	},
	setPostObject: function(C, T, W, a, N, b, n, s, e, c) {
		var i;
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
		if (this.checkFieldName(N) === true) {
			t.TimeEntryDataFields[N] = b
		}
		if (c && c !== "") {
			for (i = 0; i < c.length; i++) {
				t.TimeEntryDataFields[c[i].fieldName] = c[i].fieldValue
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
	applySearchPattern: function(f) {
		f = f.toLowerCase();
		if (this.getList()) {
			var l = this.getList().getItems();
			var v;
			var c = 0;
			for (var i = 0; i < l.length; i++) {
				v = this.applySearchPatternToListItem(l[i], f);
				l[i].setVisible(v);
				if (v) {
					c++
				}
			}
		}
	},
	onQuickEntryWithvalueHelp: function() {
		var s = this;
		s.getWorkListCollection();
		var m = s.oApplication.getModel("timesheet_initialInfo");
		if (m.getData().allHours) {
			this.oModel.setProperty("/allAllowed", true);
			this.oModel.setProperty("/all", this.oBundle.getText("ALL_MISSING", [m.getData().allHours]))
		} else {
			this.oModel.setProperty("/allAllowed", false)
		} if (m.getData().weekHours) {
			this.oModel.setProperty("/weekAllowed", true);
			this.oModel.setProperty("/week", this.oBundle.getText("THIS_WEEK", [m.getData().weekHours]))
		} else {
			this.oModel.setProperty("/weekAllowed", false)
		} if (m.getData().monthHours) {
			var a = this.oModel.getData().month;
			var y = this.oModel.getData().year;
			this.oModel.setProperty("/monthAllowed", true);
			this.oModel.setProperty("/month_year", this.oBundle.getText("MONTH_YEAR").replace("{0}", this.oBundle.getText("MONTH_FULL_" + a)).replace(
				"{1}", y).replace("{2}", m.getData().monthHours))
		} else {
			this.oModel.setProperty("/monthAllowed", false)
		}
		this.oHelp = new sap.m.Input({
			type: sap.m.InputType.Text,
			placeholder: s.oBundle.getText('SELECT_PLACEHOLDER') + " " + s.oBundle.getText('RECENTLY_USED'),
			showSuggestion: true,
			suggestionItems: {
				path: "/projects",
				template: new sap.ui.core.Item({
					text: "{name}"
				})
			},
			showValueHelp: true,
			suggestionItemSelected: function(e) {
				s.leftButton.setProperty('enabled', true)
			},
			liveChange: function(e) {
				var i = e.oSource._getInputValue();
				var f = false;
				if (i == "") s.leftButton.setProperty("enabled", false);
				var g = this.getModel().getData().projects;
				g.forEach(function(h) {
					if (h.name == i) f = true
				});
				if (f) s.leftButton.setProperty("enabled", true);
				else s.leftButton.setProperty("enabled", false)
			},
			valueHelpRequest: function(e) {
				var h;
				h = jQuery.proxy(function(e) {
					var o = e.getParameter("selectedItem");
					if (o) {
					   // 01-12-2014: M. Blaak Wijziging Quick Entry
					   // Alleen de naam van het geselecteerde item overnemen in inputveld
					   // s.oHelp.setValue(o.getTitle() + ", " + o.getDescription());
						s.oHelp.setValue(o.getTitle());
						s.leftButton.setProperty('enabled', true);
						for (var i = 0; i < s.workList.length; i++) {
							if (o.getTitle() == s.workList[i].name) {
								s.selectedWorklist = s.workList[i];
								break
							}
						}
					}
					e.getSource().getBinding("items").filter([])
				}, this);
				if (!this._valueHelpSelectDialog) {
					this._valueHelpSelectDialog = new sap.m.SelectDialog({
						title: s.oBundle.getText('COST_ASSIGNMENT'),
						items: {
							path: "/projects",
							template: new sap.m.StandardListItem({
								title: "{name}",
								description: "{others}",
								adaptTitleSize: false,
								active: true
							})
						},
						search: function(e) {
							var v = e.getParameter("value");
							var f = new sap.ui.model.Filter("name", sap.ui.model.FilterOperator.Contains, v);
							e.getSource().getBinding("items").filter([f])
						},
						confirm: h,
						cancel: h
					});
					this._valueHelpSelectDialog.setModel(this.getModel())
				}
				this._valueHelpSelectDialog.open()
			}
		});
		this.label1 = new sap.m.Label({
			text: s.oBundle.getText('COST_ASSIGNMENT'),
			required: true
		});
		this.label2 = new sap.m.Label({
			text: s.oBundle.getText('ENTRY_VIEW_APPLY_TO')
		});
		this.oSelect = new sap.m.Select({
			width: "100%"
		});
		var b = new sap.ui.core.Item({
			text: this.oModel.getProperty("/week"),
			key: "week"
		});
		var c = new sap.ui.core.Item({
			text: this.oModel.getProperty("/month_year"),
			key: "month"
		});
		var d = new sap.ui.core.Item({
			text: this.oModel.getProperty("/all"),
			key: "all"
		});
		if (this.oModel.getProperty("/week")) this.oSelect.addItem(b);
		if (this.oModel.getProperty("/month_year")) this.oSelect.addItem(c);
		if (this.oModel.getProperty("/all")) this.oSelect.addItem(d);
		this.leftButton = new sap.m.Button({
			text: s.oBundle.getText('SUBMIT'),
			enabled: false,
			press: jQuery.proxy(function() {
				var e = this.oSelect.getSelectedKey();
				var f = new Date();
				var o = null;
				if (e == "week") {
					o = "W"
				} else if (e == "month") {
					o = "M"
				} else if (e == "all") {
					o = "A"
				}
				jQuery.sap.measure.start(hcm.emp.mytimesheet.utils.PerfUtils.getStartId(hcm.emp.mytimesheet.utils.PerfUtils.WEEK_ENTRY_SUBMIT));
				var g = [];
				g.push(s.setPostObject("", o, s.parseDateYYYYMMdd(f.toDateString()), "0", s.selectedWorklist.fieldName, s.selectedWorklist.fieldValue,
					"", "", "", s.selectedWorklist.childs));
				if (g.length === 0) {} else {
					s.oService.submitTimeEntry(s, g, [], [], function() {
						jQuery.sap.measure.end(hcm.emp.mytimesheet.utils.PerfUtils.getEndId(hcm.emp.mytimesheet.utils.PerfUtils.WEEK_ENTRY_SUBMIT));
						var I = s.oApplication.getModel("timesheet_initialInfo");
						var h = I.getData().releaseAllowed;
						var t;
						if (h) {
							t = s.oBundle.getText('DRAFT_SUCCESS')
						} else {
							t = s.oBundle.getText('SUBMIT_SUCCESS')
						}
						sap.m.MessageToast.show(t);
						s.dialog.close();
						s.refreshPage()
					}, function(h, i) {
						jQuery.sap.measure.end(hcm.emp.mytimesheet.utils.PerfUtils.getEndId(hcm.emp.mytimesheet.utils.PerfUtils.WEEK_ENTRY_SUBMIT));
						s.dialog.close();
						s.errors = h
					})
				}
			}, this)
		});
		var r = new sap.m.Button({
			text: s.oBundle.getText('CANCEL'),
			tap: jQuery.proxy(function() {
				this.dialog.close()
			}, this)
		});
		var S = new sap.ui.layout.form.SimpleForm();
		S.addContent(this.label1);
		S.setModel(s.oModel);
		S.addContent(this.oHelp);
		S.addContent(this.label2);
		S.addContent(this.oSelect);
		this.dialog = new sap.m.Dialog({
			contentHeight: "470px",
			content: [S],
			title: s.oBundle.getText('QUICK_FILL'),
			afterOpen: function(e) {
				jQuery.sap.log.info("dialog is opened properly")
			},
			afterClose: function(e) {
				jQuery.sap.log.info("dialog is closed properly")
			},
			beginButton: this.leftButton,
			endButton: r
		});
		this.dialog.open()
	},
	getWorkListCollection: function(o) {
		this.workList = [];
		this.workListType = [];
		var s = this;
		var d = new Date();
		var a = ('0' + d.getDate()).slice(-2).toString();
		var m = ('0' + (d.getMonth() + 1)).slice(-2).toString();
		var y = d.getFullYear();
		s.searchField_begDa = s.searchField_endDa = y + m + a;
		this.oService.getCostAssignmentWorkListCollection(s, s.searchField_begDa, s.searchField_endDa, function(b) {
			var w = 0;
			for (var i = 0; i < b.length; i++) {
				if (b[i].Level.trim() === "0") {
					s.workList[w] = {
						name: b[i].FieldValueText,
						childs: [],
						fieldName: b[i].FieldName,
						fieldValue: b[i].FieldValue,
						recordNumber: b[i].RecordNumber
					};
					w++
				}
			}
			for (var i = 0; i < b.length; i++) {
				if (b[i].Level.trim() !== "0") {
					for (var j = 0; j < s.workList.length; j++) {
						if (s.workList[j].recordNumber === b[i].RecordNumber) s.workList[j].childs.push({
							name: b[i].FieldValueText,
							fieldName: b[i].FieldName,
							fieldValue: b[i].FieldValue
						})
					}
				}
			}
			var p = [];
			for (var i = 0; i < s.workList.length; i++) {
				var c = [];
				var e = [];
				var f = [];
				for (var j = 0; j < s.workList[i].childs.length; j++) {
					c.push(s.workList[i].childs[j].name);
					e.push(s.workList[i].childs[j].fieldName);
					f.push(s.workList[i].childs[j].fieldValue)
				}
				p.push({
					name: s.workList[i].name,
					others: c.join(", "),
					childs: s.workList[i].childs,
					fieldName: s.workList[i].fieldName,
					fieldValue: s.workList[i].fieldValue
				});
				if ("selectedMainItem" in s && s.selectedMainItem) {
					if (s.workList[i].name === s.selectedMainItem && s.workList[i].fieldName === s.selectedMainName && s.workList[i].fieldValue === s.selectedMainCode) {
						if ("selectedChildItems" in s) {
							var g = [];
							var h = [];
							var k = [];
							for (var j = 0; j < s.selectedChildItems.length; j++) {
								g.push(s.selectedChildItems[j]);
								h.push(s.selectedChildNames[j]);
								k.push(s.selectedChildCodes[j])
							}
							if ($(c).not(g).length == 0 && $(g).not(c).length == 0) {
								if ($(e).not(h).length == 0 && $(h).not(e).length == 0) {
									if ($(f).not(k).length == 0 && $(k).not(f).length == 0) {
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
			s.workList = p;
			s.oModel.setProperty("/projects", s.workList)
		})
	},
	getHeaderFooterOptions: function() {
		var t = this;
		var o = {
			sI18NFullscreenTitle: "TIMESHEET_TITLE",
			oEditBtn: {
				sId: "SMART_ENTRY",
				sI18nBtnTxt: "QUICK_FILL",
				onBtnPressed: function(e) {
					t.onQuickEntryWithvalueHelp(e)
				}
			}
		};
		if (this.extHookChangeFooterButtons) {
			o = this.extHookChangeFooterButtons(o)
		}
		return o
	}
});