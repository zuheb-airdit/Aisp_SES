sap.ui.define([
    "sap/ui/core/UIComponent",
    "com/sesapproval/vimsesapproval/model/models"
], (UIComponent, models) => {
    "use strict";

    return UIComponent.extend("com.sesapproval.vimsesapproval.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");
            const oInvoiceContext = new sap.ui.model.json.JSONModel({});
            this.setModel(oInvoiceContext, "invoiceContext");

            // enable routing
            this.getRouter().initialize();
        }
    });
});