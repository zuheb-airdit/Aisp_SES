sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], (Controller, JSONModel, Filter, FilterOperator, MessageBox, Fragment) => {
    "use strict";

    return Controller.extend("com.vimses.vimses.controller.SESItems", {
        onInit() {
            let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteItems").attachPatternMatched(this._onObjectMatched, this);
        },

        _onObjectMatched: function (oEvent) {
            this.getView().setBusy(true);
            const poNum = oEvent.getParameter("arguments").poId;
            const oModel = this.getView().getModel();
            const oGlobalModel = this.getOwnerComponent().getModel("invoiceContext");

            const oFilters = [new Filter("Ebeln", FilterOperator.EQ, poNum)];

            // Step 1: Fetch Header First
            oModel.read("/SES_VIM_HEAD_API", {
                filters: oFilters,
                success: (headRes) => {
                    const headerData = headRes.results[0] || {};
                    headerData.InvoiceNo = "";
                    headerData.InvoiceDate = "";
                    oGlobalModel.setProperty("/header", headerData);

                    // Step 2: Fetch SES Items
                    oModel.read("/SES_VIM_ITEM_API", {
                        filters: oFilters,
                        success: (itemRes) => {
                            const sesItems = itemRes.results || [];
                            oGlobalModel.setProperty("/sesItems", sesItems);
                            this.getView().setBusy(false);
                        },
                        error: (err) => {
                            console.error("❌ SES Item fetch failed:");
                            this.getView().setBusy(false);
                        }
                    });
                },
                error: (err) => {
                    console.error("❌ SES Header fetch failed:");
                    this.getView().setBusy(false);
                }
            });
        },

        formatODataDate: function (dateValue) {
            if (!dateValue || !(dateValue instanceof Date)) return "";
            const day = String(dateValue.getDate()).padStart(2, '0');
            const month = String(dateValue.getMonth() + 1).padStart(2, '0');
            const year = dateValue.getFullYear();
            return `${day}-${month}-${year}`;
        },

        getTotalServiceAmount: function (aItems) {
            if (!Array.isArray(aItems)) return "0.00 INR";

            const total = aItems.reduce((sum, item) => {
                return sum + parseFloat(item.Itemtotalprice || 0);
            }, 0);

            return total.toLocaleString("en-IN", {
                minimumFractionDigits: 2
            }) + " INR";
        },

        onSesSelectionChange: function (oEvent) {
            debugger;
            const oTable = oEvent.getSource();
            const aSelectedItems = oTable.getSelectedItems();
            const bHasSelection = aSelectedItems.length > 0;

            this.byId("createInvoiceBtn").setEnabled(bHasSelection);
        },


        formatServicePeriod: function (fromDate, toDate) {
            const format = this.formatODataDate || this.formatODataDate; // depends where you define
            return `${format(fromDate)} - ${format(toDate)}`;
        },
        
        onClickServiceNum: async function (oEvent) {
            debugger;
            const packno = oEvent.getSource().getBindingContext("invoiceContext").getProperty("SubPackno");
            const serNo = oEvent.getSource().getBindingContext("invoiceContext").getProperty("Lblni");

            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel(); // OData model
            const oGlobalModel = this.getOwnerComponent().getModel("invoiceContext"); // ✅ global context model

            const aFilters = [
                new sap.ui.model.Filter("Packno", sap.ui.model.FilterOperator.EQ, packno)
            ];

            oModel.read("/SES_VIM_DETAILS_API", {
                filters: aFilters,
                success: async function (oData) {
                    if (oData.results && oData.results.length) {
                        // ✅ Store in global model under /serviceDetails
                        oGlobalModel.setProperty("/serviceDetails", {
                            Packno: serNo,
                            items: oData.results
                        });

                        if (!this._oSesDetailsDialog) {
                            this._oSesDetailsDialog = await Fragment.load({
                                id: oView.getId(),
                                name: "com.vimses.vimses.fragments.SESItemDetails",
                                controller: this
                            });
                            oView.addDependent(this._oSesDetailsDialog);
                        }

                        this._oSesDetailsDialog.open();
                    } else {
                        sap.m.MessageToast.show("No service details found.");
                    }
                }.bind(this),
                error: function (oError) {
                    console.error("OData Read Error:");
                    sap.m.MessageBox.error(oError.message);
                }
            });
        },

        // onCreateInvoice: async function () {
        //     debugger;
        //     const oTable = this.byId("sesTable");
        //     const aSelectedItems = oTable.getSelectedItems();

        //     if (!aSelectedItems.length) {
        //         sap.m.MessageToast.show("Please select at least one SES item.");
        //         return;
        //     }

        //     const oGlobalModel = this.getOwnerComponent().getModel("invoiceContext");
        //     const oModel = this.getOwnerComponent().getModel();

        //     // Step 1: Get selected SES item data
        //     const aSelectedData = aSelectedItems.map(item =>
        //         item.getBindingContext("invoiceContext").getObject()
        //     );

        //     // Step 2: Save selected SES items
        //     oGlobalModel.setProperty("/selectedSESItems", aSelectedData);

        //     // Step 3: Fetch SES details for each selected item by SubPackno
        //     const detailFetchPromises = aSelectedData.map(item => {
        //         const packno = item.SubPackno;

        //         return new Promise((resolve) => {
        //             oModel.read("/SES_VIM_DETAILS_API", {
        //                 filters: [new sap.ui.model.Filter("Packno", "EQ", packno)],
        //                 success: function (oData) {
        //                     resolve(oData.results || []);
        //                 },
        //                 error: function () {
        //                     resolve([]); // In case of error, return empty list
        //                 }
        //             });
        //         });
        //     });

        //     try {
        //         // Step 4: Wait for all detail fetches to complete
        //         const allDetailsNested = await Promise.all(detailFetchPromises);

        //         // Step 5: Merge all detail arrays into a single array of objects
        //         const mergedDetails = allDetailsNested.reduce((acc, curr) => acc.concat(curr), []);

        //         // Step 6: Set the merged array in the global model
        //         oGlobalModel.setProperty("/selectedSESDetails", mergedDetails);

        //         // Optional: Save to localStorage
        //         const allData = oGlobalModel.getData();
        //         localStorage.setItem("invoiceContextData", JSON.stringify(allData));
        //         console.log("✅ invoiceContextData stored in localStorage.");

        //         // Step 7: Navigate to invoice creation page
        //         this.getOwnerComponent().getRouter().navTo("RouteCreateInvoive");
        //     } catch (e) {
        //         console.error("❌ Failed to fetch SES details:", e);
        //         sap.m.MessageBox.error("Error fetching SES details.");
        //     }
        // },       
        onCreateInvoice: async function () {
            debugger;
            const oTable = this.byId("sesTable");
            const aSelectedItems = oTable.getSelectedItems();
        
            if (!aSelectedItems.length) {
                sap.m.MessageToast.show("Please select at least one SES item.");
                return;
            }
        
            const oGlobalModel = this.getOwnerComponent().getModel("invoiceContext");
            const oModel = this.getOwnerComponent().getModel();
        
            // Step 1: Get selected SES item data
            const aSelectedData = aSelectedItems.map(item =>
                item.getBindingContext("invoiceContext").getObject()
            );
        
            // ✅ Step 1.1: Check status and disable button if invalid
            const hasDisallowedStatus = aSelectedData.some(item =>
                item.Status === "Invoice Done" || item.Status === "Invoice In-Approval"
            );
        
            if (hasDisallowedStatus) {
                // Disable the button
                this.byId("createInvoiceBtn").setEnabled(false);
        
                // Show warning message
                sap.m.MessageBox.warning("Cannot create invoice for SES with status 'Invoice Done' or 'Invoice is in Approval'.");
                return;
            } else {
                // Ensure button stays enabled if status is okay
                this.byId("createInvoiceBtn").setEnabled(true);
            }
        
            // Step 2: Save selected SES items
            oGlobalModel.setProperty("/selectedSESItems", aSelectedData);
        
            // Step 3: Fetch SES details for each selected item by SubPackno
            const detailFetchPromises = aSelectedData.map(item => {
                const packno = item.SubPackno;
        
                return new Promise((resolve) => {
                    oModel.read("/SES_VIM_DETAILS_API", {
                        filters: [new sap.ui.model.Filter("Packno", "EQ", packno)],
                        success: function (oData) {
                            resolve(oData.results || []);
                        },
                        error: function () {
                            resolve([]); // In case of error, return empty list
                        }
                    });
                });
            });
        
            try {
                // Step 4: Wait for all detail fetches to complete
                const allDetailsNested = await Promise.all(detailFetchPromises);
        
                // Step 5: Merge all detail arrays into a single array of objects
                const mergedDetails = allDetailsNested.reduce((acc, curr) => acc.concat(curr), []);
        
                // Step 6: Set the merged array in the global model
                oGlobalModel.setProperty("/selectedSESDetails", mergedDetails);
        
                // Optional: Save to localStorage
                const allData = oGlobalModel.getData();
                localStorage.setItem("invoiceContextData", JSON.stringify(allData));
                console.log("✅ invoiceContextData stored in localStorage.");
        
                // Step 7: Navigate to invoice creation page
                this.getOwnerComponent().getRouter().navTo("RouteCreateInvoive");
            } catch (e) {
                console.error("❌ Failed to fetch SES details:", e);
                sap.m.MessageBox.error(e.message);
            }
        },
        onCloseSesDetailsDialog: function () {
            this._oSesDetailsDialog.close();
        },

        handleClose: function () {
            debugger;
            this.getOwnerComponent().getRouter().navTo("RouteSESPOList");
        },

        onSubmitPo: function () {
            let oView = this.getView();
            let oModel = oView.getModel();
            let oTableModel = oView.getModel("tableModel");

            if (!oTableModel) {
                MessageBox.error("No data available to submit.");
                return;
            }

            // Filter items with Action === "Confirm"
            let aFilteredItems = oTableModel.getProperty("/results").filter(item => item.Action === "Confirm");

            if (aFilteredItems.length === 0) {
                MessageBox.error("No items marked as 'Confirm' to process.");
                return;
            }

            // Prepare payload for action
            let oPayload = {
                poItems: aFilteredItems.map(item => ({
                    Ebeln: item.Ebeln,
                    Ebelp: item.Ebelp
                }))
            };

            oView.setBusy(true);

            // Call action via oModel.create()
            oModel.create("/confirmPOItem", oPayload, {
                success: function (oData) {
                    oView.setBusy(false);

                    // Build the success message with all items line by line
                    let successMessage = '';
                    if (oData.results && oData.results.length > 0) {
                        oData.results[0].forEach(item => {
                            successMessage += item.message + "\n";  // Append each message with a new line
                        });
                    }

                    // Display the success message
                    MessageBox.success(successMessage);

                    console.log("Response:", oData);
                },
                error: function (oError) {
                    oView.setBusy(false);
                    MessageBox.error(oError.message);
                    console.error("Error:");
                }
            });
        }







    });
});