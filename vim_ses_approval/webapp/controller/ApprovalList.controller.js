sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("com.sesapproval.vimsesapproval.controller.ApprovalList", {
        onInit() {
            this.byId("smartFilterBar").setEntitySet("PENDING_TAB");
            // let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            // oRouter.getRoute("RouteApprovalList").attachPatternMatched(this._onObjectMatchedList, this);
        },

        // _onObjectMatchedList: function(){
        //     this.byId("smartFilterBar").setEntitySet("PENDING_TAB");
        // },

        onTabSelect: function (oEvent) {
            const sSelectedKey = oEvent.getParameter("key");
            let oSmartTable;
            switch (sSelectedKey) {
                case "pending":
                    oSmartTable = this.byId("idSmartTablePend");
                    break;
                case "invoices":
                    oSmartTable = this.byId("idSmartTableInv");
                    this.byId("smartFilterBar").setEntitySet("APPROVED_TAB");
                    break;
                case "rejected":
                    oSmartTable = this.byId("idSmartTableREJ");
                    this.byId("smartFilterBar").setEntitySet("REJECTED_TAB");

                    break;
            }

            if (oSmartTable) {
                try {
                    oSmartTable.setBusy(true);
                    const oTable = oSmartTable.getTable();
                    if (oTable) {
                        const oBinding = oTable.getBinding("items");
                        if (oBinding) {
                            oBinding.refresh();
                        } else {
                            oSmartTable.rebindTable();
                        }
                    }
                } catch (error) {
                    MessageToast.show("Error refreshing data: " + error.message);
                } finally {
                    oSmartTable.setBusy(false);
                }
            }
        },

        statusStateFormat: function (Status) {
            switch (Status) {
                case "Invoice Completed":
                    return "Indication14"; // Green
                case "Invoice-Partially Created":
                    return "Indication13"; //  Blue
                case "Invoice-Pending":
                    return "Indication15"; // Yellow
                case "Invoice In-Approval":
                    return "Indication15";
                case "Invoice Created":
                    return "Indication14";
                case "Invoice Rejected":
                    return "Indication12";
                case "REJECTED":
                    return "Indication13";
                default:
                    return "None"; // Default fallback
            }
        },
        // for pending tab status colour
        aStatusStateFormat: function (Status) {
            switch (Status) {
                default:
                    return "Indication15"
            }
        },

        formatODataDate: function (dateValue) {
            if (!dateValue || !(dateValue instanceof Date)) return "";
            const day = String(dateValue.getDate()).padStart(2, '0');
            const month = String(dateValue.getMonth() + 1).padStart(2, '0');
            const year = dateValue.getFullYear();
            return `${day}-${month}-${year}`;
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
        },

        onClickofPONumber: function (oEvent) {
            let poNum = oEvent.getSource().getBindingContext().getObject().REQUEST_NO;
            this.getOwnerComponent().getRouter().navTo("RouteApprovalObj", {
                reqId: poNum
            });
        },
    });
});