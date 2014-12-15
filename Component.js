jQuery.sap.declare("hcm.emp.mytimesheet.HCM_TS_CREExtension.Component");

// use the load function for getting the optimized preload file if present
sap.ui.component.load({
	name: "hcm.emp.mytimesheet",


	// Use the below URL to run the extended application when SAP-delivered application is deployed on SAPUI5 ABAP Repository
	url: "/sap/bc/ui5_ui5/sap/HCM_TS_CRE"


	// we use a URL relative to our own component
	// extension application is deployed with customer namespace
});


hcm.emp.mytimesheet.Component.extend("hcm.emp.mytimesheet.test1.Component", {
	metadata: {
		version : "1.0",
		
		config: {
    "sap.ca.i18Nconfigs": {
        "bundleName": "hcm.emp.mytimesheet.test1.i18n.i18n"
    }
},
			
		customizing: {
    "sap.ui.controllerExtensions": {
        "hcm.emp.mytimesheet.view.S2": {
            controllerName: "hcm.emp.mytimesheet.test1.view.S2Custom"
        },
        "hcm.emp.mytimesheet.view.S31": {
            controllerName: "hcm.emp.mytimesheet.test1.view.S31Custom"
        }
    },
    "sap.ui.viewReplacements": {
        "hcm.emp.mytimesheet.view.S31": {
            viewName: "hcm.emp.mytimesheet.test1.view.S31Custom",
            type: "XML"
        }
    }
}			
	}
});
