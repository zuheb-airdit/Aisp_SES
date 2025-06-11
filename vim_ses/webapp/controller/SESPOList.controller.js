sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("com.vimses.vimses.controller.SESPOList", {
        onInit() {
        },

        formatODataDate: function (dateValue) {
            if (!dateValue || !(dateValue instanceof Date)) return "";
            const day = String(dateValue.getDate()).padStart(2, '0');
            const month = String(dateValue.getMonth() + 1).padStart(2, '0');
            const year = dateValue.getFullYear();
            return `${day}-${month}-${year}`;
        },

        onClickofPONumber: function (oEvent) {
            debugger;
            let poNum = oEvent.getSource().getBindingContext().getObject().Ebeln;
            this.getOwnerComponent().getRouter().navTo("RouteItems", {
                poId: poNum
            });
        },

        onClickofReqNum: function (oEvent) {
            debugger;
            let reqNum = oEvent.getSource().getBindingContext().getObject().REQUEST_NO;
            this.getOwnerComponent().getRouter().navTo("RouteItemsReqId", {
                reqId: reqNum
            });
        },

        onTabSelect: function (oEvent) {
            const selectedKey = oEvent.getParameter("key");
            if (selectedKey === "pending") {
                const oSmartTable = this.byId("idSmartTablePend");
                if (oSmartTable) {
                    oSmartTable.rebindTable();
                }
            } else if (selectedKey === "invoices") {
                const oSmartTable = this.byId("idSmartTableInv");
                if (oSmartTable) {
                    oSmartTable.rebindTable();
                }
            }
        },


        statusStateFormat: function (Status) {
            switch (Status) {
                case "Invoice Completed":
                    return "Indication14"; // Green
                case "Invoice-Partially Created":
                    return "Indication15"; // Yellow
                case "Invoice-Pending":
                    return "Indication13"; // Blue
                case "Invoice In-Approval":
                    return "Indication15";
                case "Invoice Created":
                    return "Indication14";
                case "Invoice Rejected":
                    return "Indication12";
                default:
                    return "None"; // Default fallback
            }
        },


        statusTextFormat: function (Status) {
            switch (Status) {
                case "Invoice Completed":
                    return "Completed";
                case "Invoice-Partially Created":
                    return "Partially Created";
                case "Invoice-Pending":
                    return "Pending";
                case "Invoice In-Approval":
                    return "InApproval";
                case "Invoice Created":
                    return "Created";
                case "Invoice Rejected":
                    return "Rejected";
                default:
                    return Status;
            }
        }



    });
});