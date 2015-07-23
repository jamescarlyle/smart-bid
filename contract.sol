contract DBayContract
{
	enum AuctionStates { InProgress, Ended, PaidOut, NotDelivered }

	struct Seller
	{
		uint numAuctions;
		mapping(uint => uint) auctions;
	}
	
	struct Bid 
	{
		address bidder;
		uint bidAmount;
	}
	
	struct Auction 
	{
		bytes32 itemName;
		bytes32 releaseHash;
		address seller;
		uint deliveryDeadline;
		uint auctionEndTime;
		uint category;
		AuctionStates status;
		uint numBids;
		uint highestBid;
		mapping (uint => Bid) bids;
		mapping (address => uint) bidders;
	}

	uint public numAuctions = 0;
	mapping (uint => Auction) public auctions;
	mapping (address => Seller) public sellers;
	address owner;
	// maximum duration in seconds - ensures that all auctions will end in a reasonable amount of time
	uint constant maximumDuration = 1000000;

	bool allowAuctions = true;
	
	event onAuctionNew(address indexed _seller, uint indexed _auctionID);
	event onBidSuccess(address indexed _seller, address indexed _bidder, uint indexed _auctionID, uint _numBids, uint _value);
	event onBidFailure(address indexed _seller, address indexed _bidder, uint indexed _auctionID, bytes32 _reason);
	event onAuctionEnd(address indexed _seller, address indexed _buyer, uint indexed _auctionID, uint _value);
	event onFundsReleased(address indexed _seller, address indexed _buyer, uint indexed _auctionID, uint _value);
	
	modifier hasValue { if(msg.value > 0) _ }

	// constructor - set the owner - allows closure later
	function DBayContract() {
		owner = msg.sender;
	}
	
	function createAuction(bytes32 _itemName, uint _auctionEndTime, uint _category) public returns (uint auctionID)
	{
		// check the end time is within the maximum duration - allows the contract to be closed down in a timely and orderly way
		// if ((allowAuctions == true && _auctionEndTime > now) && (_auctionEndTime <= (now + maximumDuration))) {		
		if (allowAuctions && _auctionEndTime > now) {
			// increment the auctionID - this is return variable
			auctionID = numAuctions++; 
			// create the new auction
			Auction a = auctions[auctionID];
			// initialise values
			a.itemName = _itemName;
			a.seller = msg.sender;
			a.auctionEndTime = _auctionEndTime;
			a.category = _category;
			a.status = AuctionStates.InProgress;
			a.highestBid = 0;
			a.numBids = 0;
			// lookup the seller, or create
			Seller s = sellers[msg.sender];
			// increment the seller's auctionID
			uint seller_auctionID = s.numAuctions++;
			s.auctions[seller_auctionID] = auctionID;
			// broadcast an event that the auction has been created
			onAuctionNew(msg.sender, auctionID);
		}
	}
	
	function placeBid(uint _auctionID, bytes32 _releaseSecret) public hasValue
	{
		// lookup the auction
		Auction a = auctions[_auctionID];
		// check auction exists
		if (a.seller != 0) {
			// check auction hasn't already ended
			if (a.status == AuctionStates.InProgress) {
				// check auction has not ended
				if (a.auctionEndTime >= block.timestamp) {
					// check seller isn't bidding up own auction
					if (a.seller != msg.sender) {
						Bid currentHighest = a.bids[a.highestBid];
						// check if bid is higher than current maximum 
						if (msg.value > currentHighest.bidAmount) {
							// we have a new highest bid
							uint bidID = a.numBids++;
							Bid b = a.bids[bidID];
							b.bidder = msg.sender;
							b.bidAmount = msg.value;
							a.highestBid = bidID;
							// return funds of previous highest bidder
							currentHighest.bidder.send(currentHighest.bidAmount);
							// releaseHash is stored to compare later with a secret that the buyer provides the seller when item received
							a.releaseHash = sha3(_releaseSecret);
							a.bidders[b.bidder] = bidID;
							onBidSuccess(a.seller, msg.sender, _auctionID, a.numBids, b.bidAmount);
							return;
						} else {
							onBidFailure(a.seller, msg.sender, _auctionID, 'bid is less than the highest');						
						}
					} else {
						onBidFailure(a.seller, msg.sender, _auctionID, 'seller can\'t bid');						
					}
				} else {
					onBidFailure(a.seller, msg.sender, _auctionID, 'auction has just ended');	
					endAuction(_auctionID);
				}
			} else {
				onBidFailure(a.seller, msg.sender, _auctionID, 'auction has previously ended');						
			}
		} else {
			onBidFailure(0, msg.sender, _auctionID, 'auction could not be found');
		}
		// return the bid if not accepted
		msg.sender.send(msg.value);
	}
	
	function endAuction(uint _auctionID) public 
	{
		Auction a = auctions[_auctionID];
		if (a.seller != 0) {
			// allow the auction to be ended if the time limit has passed
			if (a.status == AuctionStates.InProgress && block.timestamp >= a.auctionEndTime) {
				Bid highestBid = a.bids[a.highestBid];
				onAuctionEnd(a.seller, msg.sender, _auctionID, highestBid.bidAmount);
				a.status = AuctionStates.Ended;
			}
		} else {
			onBidFailure(0, msg.sender, _auctionID, 'Auction not found');
		}
	}
	
	function releaseFunds(uint _auctionID, bytes32 _releaseSecret) public 
	{
		Auction a = auctions[_auctionID];
		if (a.seller != 0) {
			// allow the funds to be released to the seller if they can prove that they have received a matching secret from the buyer in exchange for handing the item over
			if (a.status == AuctionStates.Ended && sha3(_releaseSecret) == a.releaseHash) {
				Bid highestBid = a.bids[a.highestBid];
				a.seller.send(highestBid.bidAmount);
				a.status = AuctionStates.PaidOut;
			}
		} else {
			onBidFailure(0, msg.sender, _auctionID, 'Auction not found');
		}
	}
	
	function notDelivered(uint _auctionID) public {
		Auction a = auctions[_auctionID];
		if (a.seller != 0) {
			// contract exists
			Bid highestBid = a.bids[a.highestBid];
			// allow the highest bidder to reclaim bid if seller has not yet delivered, and the delivery deadline has passed
			if (a.status == AuctionStates.Ended && block.timestamp >= a.auctionEndTime + a.deliveryDeadline && msg.sender == highestBid.bidder) {
				highestBid.bidder.send(highestBid.bidAmount);
				a.status = AuctionStates.NotDelivered;
			}
		} else {
			onBidFailure(0, msg.sender, _auctionID, 'Auction not found');
		}
	}

	function reportAuction(uint _auctionID) constant public returns (bytes32 itemName, uint auctionEndTime, 
		uint timeRemaining, uint8 status, uint numBids, uint highestBidAmount, address highestBidder) {
		// report the current status of the auction
		Auction a = auctions[_auctionID];
		itemName = a.itemName;
		auctionEndTime = a.auctionEndTime;
		timeRemaining = auctionEndTime - now;
		// need to cast to uint for now since bug with enum ABI impl in web3 js library
		status = uint8(a.status);
		numBids = a.numBids;
		Bid b = a.bids[a.highestBid];
		highestBidAmount = b.bidAmount;
		highestBidder = b.bidder;
	}
	
	// function listLiveAuctions() constant external returns (uint[] liveAuctions) {
	// 	liveAuctions.length = 0;
	// 	uint j = 0;
	// 	// iterate through auctions and return those not ended
	// 	for (uint i = 0; i < numAuctions; ++i) {
	// 		Auction a = auctions[i];
	// 		if (a.status == AuctionStates.InProgress) {
	// 			j++;
	// 			liveAuctions.length += 1;
	// 			liveAuctions[j] = i;
	// 		}
	// 	}
	// }

	function sellerAuctions(address _seller, uint _sellerAuctionID) public constant returns (uint auctionID)
	{
		Seller s = sellers[_seller];
		auctionID = s.auctions[_sellerAuctionID];
	}

	function clean(uint _auctionID) private {
		Auction a = auctions[_auctionID];
		a.itemName = 0;
		a.releaseHash = 0;
		a.seller = 0;
		a.deliveryDeadline = 0;
		a.auctionEndTime = 0;
		a.category = 0;
		a.status = AuctionStates.InProgress;
		a.numBids = 0;
		a.highestBid = 0;
	}

	function shutdown() public {
		// this function allows the owner to close the contract to new auctions, while allowing the existing ones to be ended gracefully
		if (msg.sender == owner) {
			allowAuctions = false;
		}
	}
	
	function remove() public {
		if (msg.sender == owner) {
			suicide(owner);
		}
	}
	
}


