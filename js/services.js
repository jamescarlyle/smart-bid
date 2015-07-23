'use strict';

var services = angular.module('services', [])
.constant('ETH', {
	'GAS_CREATE': '0x2ba62', // 30400
	'GAS_BID': '0x3ba62', // 30400
	'GAS_PRICE': '0x9184e72a000', // 10000000000000
})
;

var web3 = require('web3');
web3.setProvider(new web3.providers.HttpProvider("http://localhost:8545"));

var DBayContract = web3.eth.contract([{"constant":false,"inputs":[{"name":"_auctionID","type":"uint256"},{"name":"_releaseSecret","type":"bytes32"}],"name":"releaseFunds","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"_seller","type":"address"},{"name":"_sellerAuctionID","type":"uint256"}],"name":"sellerAuctions","outputs":[{"name":"auctionID","type":"uint256"}],"type":"function"},{"constant":false,"inputs":[{"name":"_auctionID","type":"uint256"}],"name":"notDelivered","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"","type":"uint256"}],"name":"auctions","outputs":[{"name":"itemName","type":"bytes32"},{"name":"releaseHash","type":"bytes32"},{"name":"seller","type":"address"},{"name":"deliveryDeadline","type":"uint256"},{"name":"auctionEndTime","type":"uint256"},{"name":"category","type":"uint256"},{"name":"status","type":"enumAuctionStates"},{"name":"numBids","type":"uint256"},{"name":"highestBid","type":"uint256"}],"type":"function"},{"constant":true,"inputs":[],"name":"numAuctions","outputs":[{"name":"","type":"uint256"}],"type":"function"},{"constant":false,"inputs":[{"name":"_itemName","type":"bytes32"},{"name":"_auctionEndTime","type":"uint256"},{"name":"_category","type":"uint256"}],"name":"createAuction","outputs":[{"name":"auctionID","type":"uint256"}],"type":"function"},{"constant":false,"inputs":[{"name":"_auctionID","type":"uint256"},{"name":"_releaseSecret","type":"bytes32"}],"name":"placeBid","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"sellers","outputs":[{"name":"numAuctions","type":"uint256"}],"type":"function"},{"constant":false,"inputs":[],"name":"remove","outputs":[],"type":"function"},{"constant":false,"inputs":[],"name":"DistributedBay","outputs":[],"type":"function"},{"constant":false,"inputs":[{"name":"_auctionID","type":"uint256"}],"name":"endAuction","outputs":[],"type":"function"},{"constant":true,"inputs":[{"name":"_auctionID","type":"uint256"}],"name":"reportAuction","outputs":[{"name":"itemName","type":"bytes32"},{"name":"auctionEndTime","type":"uint256"},{"name":"timeRemaining","type":"uint256"},{"name":"status","type":"uint8"},{"name":"numBids","type":"uint256"},{"name":"highestBidAmount","type":"uint256"},{"name":"highestBidder","type":"address"}],"type":"function"},{"constant":false,"inputs":[],"name":"shutdown","outputs":[],"type":"function"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_seller","type":"address"},{"indexed":true,"name":"_auctionID","type":"uint256"}],"name":"onAuctionNew","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_seller","type":"address"},{"indexed":true,"name":"_bidder","type":"address"},{"indexed":true,"name":"_auctionID","type":"uint256"},{"indexed":false,"name":"_numBids","type":"uint256"},{"indexed":false,"name":"_value","type":"uint256"}],"name":"onBidSuccess","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_seller","type":"address"},{"indexed":true,"name":"_bidder","type":"address"},{"indexed":true,"name":"_auctionID","type":"uint256"},{"indexed":false,"name":"_reason","type":"bytes32"}],"name":"onBidFailure","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_seller","type":"address"},{"indexed":true,"name":"_buyer","type":"address"},{"indexed":true,"name":"_auctionID","type":"uint256"},{"indexed":false,"name":"_value","type":"uint256"}],"name":"onAuctionEnd","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"_seller","type":"address"},{"indexed":true,"name":"_buyer","type":"address"},{"indexed":true,"name":"_auctionID","type":"uint256"},{"indexed":false,"name":"_value","type":"uint256"}],"name":"onFundsReleased","type":"event"}]);

services.service('BlockChainSvc', ['$http', 'ETH', function($http, ETH) {
	var bidSuccessFilter, bidFailureFilter, auctionCreateFilter, auctionEndFilter, fundsReleasedFilter;

	// set up accounts
	var accounts =[];
	accounts.push('0xb4fb16ee2c46f19513a49ebb538f435f9aa83196');
	accounts.push('0x00be7132248c8eb199cf22b0e5d893b6452fd669e');
	var boundAccount;

	this.getAccounts = function() {
		return accounts;
	}

	this.bindAccount = function(accountAddress) {
		boundAccount = accountAddress;
	}
	this.bindAccount(accounts[0]);

	this.getAccountAddress = function() {
		return boundAccount;
	}

	var contracts = [];
	contracts.push('0x5d6098299e558190dbe5ff906f89827af271af77');
	contracts.push('0xdecafbad');
	var boundContract;

	this.getContracts = function() {
		return contracts;
	}

	this.bindContract = function(contractAddress) {
		boundContract = new DBayContract(contractAddress);
	}
	this.bindContract(contracts[0]);

	this.getContractAddress = function() {
		return boundContract.address;
	}

	this.watchMiscMessage = function(callback) {
		fundsReleasedFilter = boundContract.onFundsReleased({}, {fromBlock:'latest', toBlock:'latest'});
		fundsReleasedFilter.watch(callback)
		auctionCreateFilter = boundContract.onAuctionNew({}, {fromBlock:'latest', toBlock:'latest'});
		auctionCreateFilter.watch(callback)
		auctionEndFilter = boundContract.onAuctionEnd({}, {fromBlock:'latest', toBlock:'latest'});
		auctionEndFilter.watch(callback)
	}
	
	this.watchBidSuccess = function(callback) {
		bidSuccessFilter = boundContract.onBidSuccess({}, {fromBlock:'latest', toBlock:'latest'});
		bidSuccessFilter.watch(callback)
	}
	
	this.watchBidFailure = function(callback) {
		bidFailureFilter = boundContract.onBidFailure({}, {fromBlock:'latest', toBlock:'latest'});
		bidFailureFilter.watch(callback);
	}
	
	this.stopWatching = function() {
		bidSuccessFilter.stopWatching();
		bidFailureFilter.stopWatching();
		auctionCreateFilter.stopWatching();
		auctionEndFilter.stopWatching();
		fundsReleasedFilter.stopWatching();
	}

	this.createAuction = function(itemName, auctionEndTime, category) {
		boundContract.createAuction(itemName, auctionEndTime, category, {from: boundAccount, gas: ETH.GAS_CREATE});
	};

	this.placeBid = function(auctionID, releaseSecret, bidAmount) {
		boundContract.placeBid(auctionID, releaseSecret, {from: boundAccount, value: bidAmount, gas: ETH.GAS_BID});
	};

	this.reportAuction = function(auctionID) {
		return boundContract.reportAuction(auctionID);
	};
}])
;