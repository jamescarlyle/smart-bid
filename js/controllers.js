'use strict';
angular.module('controllers', ['services'])
.controller('AuctionManagerCtrl', ['BlockChainSvc', '$scope' , '$document', '$window', function (BlockChainSvc, $scope, $document, $window) {
	var auctionManager = this;
	auctionManager.tab = 'create';
	auctionManager.logging = false;
	auctionManager.bidSuccessLog = [];
	auctionManager.bidFailureLog = [];
	auctionManager.miscMessageLog = [];
	auctionManager.contracts = BlockChainSvc.getContracts();
	auctionManager.contract = BlockChainSvc.getContractAddress();
	auctionManager.accounts = BlockChainSvc.getAccounts();
	auctionManager.account = BlockChainSvc.getAccountAddress();
	// map to hold status values
	var statuses = new Map();
	statuses.set(0, "In progress");
	statuses.set(1, "Ended");
	statuses.set(2, "Paid out");
	statuses.set(3, "Not delivered");
	// set up a watch on the contract dropdown, bind to the correct contract
	$scope.$watch('auctionManager.contract', function(oldContract, newContract) {
		if (auctionManager.contract) BlockChainSvc.bindContract(auctionManager.contract);
	});
	$scope.$watch('auctionManager.account', function(oldAccount, newAccount) {
		if (auctionManager.contract) BlockChainSvc.bindAccount(auctionManager.account);
	});
	auctionManager.scrollSmooth = function(target) {
		// var body = $document.find('body')[0];
		var body = $document[0].getElementById('view-area');

		var targetOffset = $document[0].getElementById(target.substr(1)).offsetTop; //event.target.hash.substr(1)
		var currentPosition = body.scrollTop;

		body.classList.add('in-transition');
		body.style.transform = "translate(0, -" + (targetOffset - currentPosition) + "px)";

		$window.setTimeout(function () {
			body.classList.remove('in-transition');
			body.style.cssText = "";
			$window.scrollTo(0, targetOffset);
		}, 1000);
		event.preventDefault();
	}
	auctionManager.switchLogging = function() {
		if (auctionManager.logging) {
			BlockChainSvc.stopWatching();
		} else {
			BlockChainSvc.watchBidSuccess(function(err, data) {
				auctionManager.bidSuccessLog.push({auctionID:data.args._auctionID, sellerAddress:data.args._seller, bidderAddress:data.args._bidder, numBids:data.args._numBids, bidAmount:data.args._value});
				$scope.$apply();
			});
			BlockChainSvc.watchBidFailure(function(err, data) {
				auctionManager.bidFailureLog.push({auctionID:data.args._auctionID, sellerAddress:data.args._seller, bidderAddress:data.args._bidder, failureReason:data.args._reason});
				$scope.$apply();
			});
			BlockChainSvc.watchMiscMessage(function(err, data) {
				auctionManager.miscMessageLog.push({auctionID:data.args._auctionID, sellerAddress:data.args._seller, buyerAddress:data.args._buyer});
				$scope.$apply();
			});
		};
		auctionManager.logging = !auctionManager.logging;
	};
	auctionManager.createAuction = function() {
		var secs = (Date.now() / 1000 | 0) + (auctionManager.durationDays * 24 * 3600);
		BlockChainSvc.createAuction(auctionManager.itemName, secs, auctionManager.category);
		auctionManager.itemName = '';
	};
	auctionManager.placeBid = function() {
		BlockChainSvc.placeBid(auctionManager.auctionID, auctionManager.releaseSecret, auctionManager.bidAmount);
		auctionManager.auctionID = '';
		auctionManager.bidAmount = '';
	};
	auctionManager.reportAuction = function() {
		var result = BlockChainSvc.reportAuction(auctionManager.auctionID);
		auctionManager.itemName = result[0];
		auctionManager.auctionEndTime = new Date(result[1] * 1000).toLocaleString();
		auctionManager.timeRemaining = result[2];
		auctionManager.status = statuses.get(result[3]);
		auctionManager.numBids = parseInt(result[4]);
		auctionManager.highestBidAmount = parseInt(result[5]);
		auctionManager.highestBidder = result[6];
	};
}]);

