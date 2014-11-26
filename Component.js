jQuery.sap.declare("hcm.emp.mytimesheet.HCM_TS_CREExtension.Component");

// use the load function for getting the optimized preload file if present
sap.ui.component.load({
	name: "hcm.emp.mytimesheet",


	// Use the below URL to run the extended application when SAP-delivered application is deployed on SAPUI5 ABAP Repository
	url: "/sap/bc/ui5_ui5/sap/HCM_TS_CRE"


	// we use a URL relative to our own component
	// extension application is deployed with customer namespace
});


hcm.emp.mytimesheet.Component.extend("hcm.emp.mytimesheet.HCM_TS_CREExtension.Component", {
	metadata: {
		version : "1.0",
		
		config: {
    "sap.ca.i18Nconfigs": {
        "bundleName": "hcm.emp.mytimesheet.HCM_TS_CREExtension.i18n.i18n"
    }
},
			
		customizing: {
		}			
	}
});
