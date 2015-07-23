'use strict';
angular.module('app', ['ngRoute', 'ngAnimate', 'controllers'])
// configure routes
.config(['$routeProvider', '$locationProvider', function($routeProvider, $locationProvider) {
	$routeProvider.
	when('/home', {
		templateUrl: 'home-template',
		controller: 'AuctionManagerCtrl',
		controllerAs: 'auctionManager'
	}).
	when('/list', {
		templateUrl: 'list-template',
		controller: 'AuctionManagerCtrl',
		controllerAs: 'auctionManager'
	}).
	when('/bid', {
		templateUrl: 'bid-template',
		controller: 'AuctionManagerCtrl',
		controllerAs: 'auctionManager'
	}).
	otherwise({
		redirectTo: '/home'
	});
	// $locationProvider.html5Mode({enabled:true, requireBase:true});
}]);