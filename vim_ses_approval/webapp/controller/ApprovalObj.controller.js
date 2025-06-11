sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], (Controller, JSONModel, Filter, FilterOperator, MessageBox, Fragment) => {
    "use strict";

    return Controller.extend("com.sesapproval.vimsesapproval.controller.ApprovalObj", {
        onInit() {
            let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteApprovalObj").attachPatternMatched(this._onObjectMatched, this);
            var oAttachmentsModel = new JSONModel({
                attachments: []
            });
            this.getView().setModel(oAttachmentsModel, "attachmentsModel");
            const oCommentModel = new sap.ui.model.json.JSONModel({ comment: "" });
            this.getView().setModel(oCommentModel, "commentModel");
        },


        _onObjectMatched: function (oEvent) {
            debugger;
            this.getOwnerComponent().getModel("appView").setProperty("/layout", "OneColumn");
            this.editResub = true;
            const reqId = oEvent.getParameter("arguments").reqId;
            const oView = this.getView();
            const oGlobalModel = this.getOwnerComponent().getModel("invoiceContext");
            const oAttachmentsModel = oView.getModel("attachmentsModel");
            const oModel = oView.getModel(); // External model for SESVimHead

            oView.setBusy(true);

            // Build filter for REQUEST_NO
            const aFilters = [
                new sap.ui.model.Filter("REQUEST_NO", sap.ui.model.FilterOperator.EQ, reqId)
            ];

            oModel.read("/SESVimHead", {
                filters: aFilters,
                success: function (oData) {
                    const result = oData?.results?.[0];
                    if (!result) {
                        sap.m.MessageBox.error("No data found for REQUEST_NO: " + reqId);
                        oView.setBusy(false);
                        return;
                    }
                    oView.byId("fileUploader").setVisible(false)
                    // oView.byId("idInvoiceDate").setEnabled(false)
                    // oView.byId("idInvoiceNum").setEnabled(false)
                    if (result.STATUS === 3 || result.STATUS === 5) {
                        oView.byId("idApprvBtn").setVisible(false)
                        oView.byId("idRejectBtn").setVisible(false)
                    } else {
                        oView.byId("idApprvBtn").setVisible(true)
                        oView.byId("idRejectBtn").setVisible(true)
                    }

                    // ✅ Set header to global model
                    const header = {
                        Ebeln: result.PO_NUMBER,
                        InvoiceNo: result.INVOICE_NUMBER,
                        InvoiceDate: result.INVOICE_DATE,
                        Bukrs: result.COMPANY_CODE,
                        Ernam: result.CREATED_BY,
                        Bedat: result.ORDER_DATE,
                        Waers: "INR",
                        Ekorg: result.PURCHASE_ORG,
                        Amount: result.TOTAL_AMOUNT,
                        Dpamt: result.DOWNPAYMENT_AMOUNT,
                        Dppct: result.DOWNPAYMENT_PERCENTAGE,
                        Bankacc: result.BANK_ACCOUNT,
                        Bankname: result.BANK_NAME,
                        Lifnr: result.VENDOR_CODE,
                        Vendoraddress: result.VENDOR_ADDRESS,
                        REQUEST_NO: result.REQUEST_NO,
                        Status: result.VENDOR_STATUS,
                        STATUS_DESC: result.STATUS_DESC,
                        REJECTED_COMMENT: result.REJECTED_COMMENT,
                        APPROVED_COMMENT: result.APPROVED_COMMENT,
                        SAP_INVOICE_NUMBER: result.SAP_INVOICE_NUMBER,
                        name1: result.SUPPLIER_ORG_NAME
                    };
                    oGlobalModel.setProperty("/header", header);

                    // ✅ Set SES items
                    const sesItems = (result.TO_SES_VIM_ITEMS?.results || []).map(item => ({
                        Lblni: item.SES_NO,
                        Budat: item.SES_DATE,
                        Lzvon: item.SES_PERIOD_FROM_DATE,
                        Lzbis: item.SES_PERIOD_TO_DATE,
                        Netwr: item.SES_AMOUNT,
                        SubPackno: item.SUBPACK_NO,
                        Status: item.STATUS,
                        REQUEST_NO: item.REQUEST_NO,
                        Ebeln: item.PO_NUMBER
                    }));
                    oGlobalModel.setProperty("/selectedSESItems", sesItems);

                    // After setting SES items
                    const sesItemsRaw = result.TO_SES_VIM_ITEMS?.results || [];

                    // Build request array for SES details
                    const aDetailFilters = sesItemsRaw.map(item => {
                        return new sap.ui.model.Filter({
                            filters: [
                                new sap.ui.model.Filter("REQUEST_NO", sap.ui.model.FilterOperator.EQ, item.REQUEST_NO),
                                new sap.ui.model.Filter("SUBPACK_NO", sap.ui.model.FilterOperator.EQ, item.SUBPACK_NO)
                            ],
                            and: true
                        });
                    });

                    // Create a new binding OR loop to make parallel requests
                    const aDetailPromises = aDetailFilters.map(filter => {
                        return new Promise((resolve, reject) => {
                            oModel.read("/SESDetails", {
                                filters: [filter],
                                success: function (oData) {
                                    resolve(oData.results);
                                },
                                error: function (err) {
                                    // console.error("Failed to fetch SES detail:", err);
                                    let errorMessage = "Failed to fetch SES details.";

                                    try {
                                        const response = JSON.parse(err.responseText);
                                        if (Array.isArray(response) && response[0]?.message) {
                                            errorMessage = response[0].message;
                                        } else if (response.error?.message?.value) {
                                            errorMessage = response.error.message.value;
                                        }
                                    } catch (e) {
                                        // Fallback error message remains
                                    }

                                    sap.m.MessageToast.show(errorMessage);
                                    resolve([]); // Resolve empty to continue others
                                }
                            });
                        });
                    });

                    // Aggregate and set in model
                    Promise.all(aDetailPromises).then(allDetails => {
                        const flattenedDetails = allDetails.flat();
                        oGlobalModel.setProperty("/selectedSESDetails", flattenedDetails);
                    });


                    // ✅ Set attachments
                    const attachments = result.TO_SES_VIM_ATTACHMENTS?.results || [];
                    oAttachmentsModel.setProperty("/attachments", attachments);

                    oView.setBusy(false);
                },
                error: function (err) {
                    // console.error("❌ Failed to fetch SESVimHead:", err);
                    // sap.m.MessageBox.error("Failed to load invoice data.", err);
                    let errorMessage = "Failed to load invoice data";

                    try {
                        const response = JSON.parse(err.responseText);
                        if (Array.isArray(response) && response[0]?.message) {
                            errorMessage = response[0].message;
                        } else if (response.error?.message?.value) {
                            errorMessage = response.error.message.value;
                        }
                    } catch (e) {
                        // Fallback error message remains
                    }

                    sap.m.MessageToast.show(errorMessage);
                    oView.setBusy(false);
                }
            });


        },

        onLogsPress: function (oEvent) {
            debugger;
            const requestNo = this.getOwnerComponent().getModel("invoiceContext").getProperty("/header/REQUEST_NO");

            if (!requestNo) {
                sap.m.MessageToast.show("No request number found.");
                return;
            }

            this.getOwnerComponent().getModel("appView").setProperty("/layout", "TwoColumnsBeginExpanded");
            this.getOwnerComponent().getRouter().navTo("InvoiceLogs", {
                requestNo: requestNo
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
                const amount = parseFloat(item.Itemtotalprice ?? item.TOTAL_PRICE ?? 0);
                return sum + amount;
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
            return `${fromDate} - ${toDate}`;
        },

        onClickServiceNum: async function (oEvent) {
            const packno = oEvent.getSource().getBindingContext("invoiceContext").getProperty("SubPackno");
            const reqNum = oEvent.getSource().getBindingContext("invoiceContext").getProperty("REQUEST_NO");
            const serNo = oEvent.getSource().getBindingContext("invoiceContext").getProperty("Lblni");
            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();
            let sPath;
            let aFilters;
            let fragName;
            if (reqNum) {
                sPath = "/SESDetails";
                fragName = "com.sesapproval.vimsesapproval.fragments.SESItemsReq";
                aFilters = [
                    new sap.ui.model.Filter("SUBPACK_NO", sap.ui.model.FilterOperator.EQ, packno),
                    new sap.ui.model.Filter("REQUEST_NO", sap.ui.model.FilterOperator.EQ, reqNum),
                ];

            } else {
                sPath = "/SES_VIM_DETAILS_API";
                fragName = "com.sesapproval.vimsesapproval.fragments.SESItemDetails";
                aFilters = [
                    new sap.ui.model.Filter("Packno", sap.ui.model.FilterOperator.EQ, packno)
                ];
            }
            oModel.read(sPath, {
                filters: aFilters,
                success: async function (oData) {
                    if (oData.results && oData.results.length) {
                        // Store both list and packno in model
                        const detailPayload = {
                            Packno: serNo,
                            items: oData.results
                        };
                        const detailModel = new sap.ui.model.json.JSONModel(detailPayload);
                        oView.setModel(detailModel, "serviceDetails");

                        if (!this._oSesDetailsDialog) {
                            this._oSesDetailsDialog = await Fragment.load({
                                id: oView.getId(),
                                name: fragName,
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
                    // console.error("OData Read Error:", oError);
                    // sap.m.MessageBox.error("Failed to fetch service item data:", oError);
                    let errorMessage = "Failed to fetch service item data.";

                    try {
                        const response = JSON.parse(oError.responseText);
                        if (Array.isArray(response) && response[0]?.message) {
                            errorMessage = response[0].message;
                        } else if (response.error?.message?.value) {
                            errorMessage = response.error.message.value;
                        }
                    } catch (e) {
                        // Fallback error message remains
                    }

                    sap.m.MessageToast.show(errorMessage);
                }
            });
        },

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
                let errorMessage = "Error fetching SES details.";
                if (e && e.message) {
                    errorMessage += ` ${e.message}`;
                }
                sap.m.MessageBox.error(errorMessage);
            }
        },


        // onPreviewAttachment: function (oEvent) {
        //     const oCtx = oEvent.getSource().getBindingContext("attachmentsModel");
        //     const oData = oCtx.getObject();

        //     // If already a blob URL from backend, open directly
        //     if (oData.IMAGEURL && oData.IMAGEURL.startsWith("https://")) {
        //         window.open(oData.IMAGEURL, "_blank");
        //         return;
        //     }

        //     // If base64 (uploaded during current session)
        //     if (oData.IMAGEURL && /^[A-Za-z0-9+/]+={0,2}$/.test(oData.IMAGEURL)) {
        //         this.previewAttachment(oData);
        //     } else {
        //         sap.m.MessageBox.error("No valid file found to preview.");
        //     }
        // },
        // onPreviewPdf: function (oEvent) {
        //     debugger;
        //     const imageUrl = oEvent.getSource().getBindingContext("attachmentsModel").getObject();
        //     if (!imageUrl) {
        //         sap.m.MessageToast.show("No file URL available.");
        //         return;
        //     }
        //     if (imageUrl && imageUrl.startsWith("https://")) {
        //         //         window.open(oData.IMAGEURL, "_blank");
        //         //         return;
        //          }

        //         //     // If base64 (uploaded during current session)
        //           if (oData.IMAGEURL && /^[A-Za-z0-9+/]+={0,2}$/.test(oData.IMAGEURL)) {
        //         //         this.previewAttachment(oData);
        //         //     } else {
        //         //         sap.m.MessageBox.error("No valid file found to preview.");
        //       }

        //     const encodedUrl = encodeURIComponent(imageUrl);
        //     this.getOwnerComponent().getModel("appView").setProperty("/layout", "TwoColumnsBeginExpanded");
        //     this.getOwnerComponent().getRouter().navTo("Invoicepdf", {
        //         imageUrl: encodedUrl
        //     });
        // },
        onPreviewPdf: function (oEvent) {
            debugger;
            const oData = oEvent.getSource().getBindingContext("attachmentsModel").getObject();
            const imageUrl = oData?.IMAGEURL;

            if (!imageUrl) {
                sap.m.MessageToast.show("No file URL available.");
                return;
            }

            // Check if it's an HTTPS URL
            const isUrl = imageUrl.startsWith("http://") || imageUrl.startsWith("https://");

            // Check if it's Base64 (rough pattern)
            const isBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(imageUrl);

            if (!isUrl && !isBase64) {
                sap.m.MessageBox.error("Invalid file format. Supported formats: URL or Base64.");
                return;
            }

            const encodedUrl = encodeURIComponent(imageUrl);
            const fileType = isBase64 ? "base64" : "url"; // optional: pass this to the next page

            // Set layout and route
            this.getOwnerComponent().getModel("appView").setProperty("/layout", "TwoColumnsBeginExpanded");
            this.getOwnerComponent().getRouter().navTo("Invoicepdf", {
                imageUrl: encodedUrl,
                fileType: fileType  // optional param
            });
        },

        previewAttachment: function (res) {
            const fileName = res.IMAGE_FILE_NAME || "Preview";
            const fileType = fileName.split(".").pop().toLowerCase();

            try {
                const byteCharacters = atob(res.IMAGEURL); // base64 decode
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);

                let mimeType;
                switch (fileType) {
                    case "pdf":
                        mimeType = "application/pdf";
                        break;
                    case "png":
                    case "jpg":
                    case "jpeg":
                        mimeType = `image/${fileType === "jpg" ? "jpeg" : fileType}`;
                        break;
                    case "xlsx":
                        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                        break;
                    case "msg":
                        mimeType = "application/vnd.ms-outlook";
                        break;
                    default:
                        MessageBox.error("Unsupported file type.");
                        return;
                }

                const blob = new Blob([byteArray], { type: mimeType });
                const objectURL = URL.createObjectURL(blob);

                // Show in new tab for previewable types
                if (["pdf", "png", "jpg", "jpeg"].includes(fileType)) {
                    window.open(objectURL);
                } else {
                    // For other types like xlsx, msg, force download
                    const link = document.createElement("a");
                    link.href = objectURL;
                    link.download = fileName;
                    link.click();
                }

            } catch (err) {
               
                let errorMessage = "Error fetching SES details.";
                if (err && err.message) {
                    errorMessage += ` ${err.message}`;
                }
                console.error(errorMessage);
                sap.m.MessageBox.error(errorMessage);
            }
        },

        onCloseSesDetailsDialog: function () {
            this._oSesDetailsDialog.close();
        },

        handleClose: function () {
            this.getOwnerComponent().getRouter().navTo("RouteApprovalList");
        },

        onApproveInv: function () {
            this._openCommentDialog("APPROVE");
        },

        onRejectInv: function () {
            
            this._openCommentDialog("REJECT");
        },

        _openCommentDialog: async function (actionType) {
            const oView = this.getView();

            if (!this._oCommentDialog) {
                this._oCommentDialog = await sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "com.sesapproval.vimsesapproval.fragments.CommentDialog", // You will create this fragment
                    controller: this
                });
                debugger;
                oView.addDependent(this._oCommentDialog);
            }

            // Store action type so onDialogOk knows whether APPROVE or REJECT
            debugger;
            this._currentActionType = actionType;

            // Reset comment field
            this._oCommentDialog.getModel("commentModel").setProperty("/comment", "");

            this._oCommentDialog.open();
        },

        onCommentDialogOk: function () {
            debugger;
            const oCommentModel = this._oCommentDialog.getModel("commentModel");
            const comment = oCommentModel.getProperty("/comment");

            if (!comment.trim()) {
                sap.m.MessageToast.show("Comment is required.");
                return;
            }

            this._oCommentDialog.close();

            // Now call onSubmitPoSES with action + comment
            this.onSubmitPoSES(this._currentActionType, comment);
            // window.history.go(-1);
        },

        onCommentDialogCancel: function () {
            this._oCommentDialog.close();
            // window.history.go(-1);
        },

        onSubmitPoSES: function (actionType, comment) {
            debugger;
            const oView = this.getView();
            const oGlobalModel = this.getOwnerComponent().getModel("invoiceContext");
            const oAttachmentsModel = oView.getModel("attachmentsModel");
            const oDataModel = oView.getModel();
            const oRouter = this.getOwnerComponent().getRouter();

            const header = oGlobalModel.getProperty("/header") || {};
            const sesItems = oGlobalModel.getProperty("/selectedSESItems") || [];
            const selectedSESDetails = oGlobalModel.getProperty("/selectedSESDetails") || [];
            const attachments = oAttachmentsModel.getProperty("/attachments") || [];




            // ✅ Construct payload
            const SESHead = [
                {
                    PO_NUMBER: header.Ebeln,
                    INVOICE_NUMBER: header.InvoiceNo,
                    INVOICE_DATE: header.InvoiceDate,
                    COMPANY_CODE: header.Bukrs || "1000",
                    VENDOR_CODE: header.COMPANY_CODE || "100000",
                    CREATED_BY: header.Ernam || "",
                    ORDER_DATE: header.Bedat || "",
                    PURCHASE_ORG: header.Ekorg || "",
                    TOTAL_AMOUNT: header.Amount,
                    DOWNPAYMENT_AMOUNT: header.Dpamt || "0",
                    DOWNPAYMENT_PERCENTAGE: header.Dppct || "0",
                    BANK_ACCOUNT: header.Bankacc || "",
                    BANK_NAME: header.Bankname || "",
                    VENDOR_ADDRESS: header.Vendoraddress || "",
                    SUPPLIER_ORG_NAME:header.name1 ||"",
                    ...(actionType === "REJECT" ? { REJECTED_COMMENT: comment } : {}),
                    ...(actionType === "APPROVE" ? { APPROVED_COMMENT: comment } : {})
                }
            ];



            const SESItems = sesItems.map(item => ({
                PO_NUMBER: item.Ebeln,
                SES_NO: item.Lblni,
                SES_DATE: item.Budat || "",
                SES_PERIOD_FROM_DATE: item.Lzvon || "",
                SES_PERIOD_TO_DATE: item.Lzbis || "",
                SES_AMOUNT: item.Netwr || "0",
                SUBPACK_NO: item.SubPackno || "",
                STATUS: item.Status
            }));

            let SESDetails = [];

            if (this.editResub === true) {
                // Directly use selectedSESDetails as-is
                SESDetails = selectedSESDetails;
            } else {
                // Loop and transform each detail
                SESDetails = selectedSESDetails.map(detail => ({
                    SUBPACK_NO: detail.Packno,
                    ITEM_NO: detail.Extrow,
                    SERVICE_NO: detail.Srvpos,
                    SERVICE_DESCRIPTION: detail.Ktext1,
                    UNIT_OF_MEASURE: detail.Meins,
                    UNIT_PRICE: detail.Unitprice,
                    SERVICED_QUANTITY: detail.Menge,
                    TOTAL_PRICE: detail.Itemtotalprice || detail.TOTAL_PRICE
                }));
            }


            const SESAttachments = attachments.map(att => ({
                VendorCode: "100000",
                DESCRIPTION: att.DESCRIPTION || "Attachment",
                IMAGEURL: att.IMAGEURL,
                IMAGE_FILE_NAME: att.IMAGE_FILE_NAME
            }));

            const payload = {
                action: actionType,
                REQUEST_NO: header.REQUEST_NO,
                SESHead,
                SESItems,
                SESDetails,
                SESAttachments
            };

            console.log(payload)

            // ✅ Step 4: Ask for confirmation
            sap.m.MessageBox.confirm("Are you sure you want to proceed?", {
                title: "Confirm Submission",
                actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                onClose: function (oAction) {
                    if (oAction === sap.m.MessageBox.Action.YES) {
                        oView.setBusy(true);

                        oDataModel.create("/PostSESData", payload, {
                            success: function (res) {
                                oView.setBusy(false);
                                sap.m.MessageBox.success(res.PostSESData, {
                                    onClose: function () {
                                        oRouter.navTo("RouteApprovalList");
                                    }
                                   
                                });
                            },
                            error: function (err) {
                                oView.setBusy(false);
                                let errorMessage = "Failed to submit invoice. Please try again.";
                                try {
                                    const response = JSON.parse(err.responseText);
                                    if (Array.isArray(response) && response[0].message) {
                                        errorMessage = response[0].message;
                                    } else if (response.error && response.error.message && response.error.message.value) {
                                        errorMessage = response.error.message.value;
                                    }
                                } catch (e) {
                                }
                                sap.m.MessageBox.error(errorMessage, {
                                    onClose: function() {
                                        oRouter.navTo("RouteApprovalList");
                                    }
                                });
                            }
                        });
                    }
                }
               
            });
        },

    });
});