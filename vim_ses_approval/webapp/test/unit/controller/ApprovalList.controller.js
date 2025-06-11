/*global QUnit*/

sap.ui.define([
	"com/sesapproval/vimsesapproval/controller/ApprovalList.controller"
], function (Controller) {
	"use strict";

	QUnit.module("ApprovalList Controller");

	QUnit.test("I should test the ApprovalList controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
