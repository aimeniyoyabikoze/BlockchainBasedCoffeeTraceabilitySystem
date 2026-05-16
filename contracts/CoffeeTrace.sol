// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title CoffeeTrace
 * @dev A smart contract for immutable coffee batch traceability across the supply chain with RBAC.
 */
contract CoffeeTrace is AccessControl {
    using Strings for uint256;

    bytes32 public constant INTAKE_ROLE = keccak256("INTAKE_ROLE");
    bytes32 public constant PROCESSING_ROLE = keccak256("PROCESSING_ROLE");
    bytes32 public constant EXPORT_ROLE = keccak256("EXPORT_ROLE");

    uint256 private _batchCounter;

    struct Batch {
        string batchId;
        string farmer;
        string cooperative;
        string origin;
        string collectionDate;
        string weight;
        uint256 boughtPricePerKgRWF;
        uint256 boughtTotalRWF;
        // Processing details
        string station;
        string washMethod;
        string moisture;
        string grade;
        string cuppingScore;
        // Export details
        string buyer;
        string destination;
        string shipDate;
        string container;
        uint256 soldPricePerKgRWF;
        uint256 soldTotalRWF;
        // Off-chain storage
        string ipfsHash;
        bool isRegistered;
        uint256 lastUpdated;
    }

    mapping(string => Batch) public batches;
    string[] public batchIds;

    event BatchRegistered(string batchId, string farmer, string origin, uint256 timestamp);
    event ProcessingLogged(string batchId, string station, string grade, uint256 timestamp);
    event ExportLogged(string batchId, string buyer, string destination, uint256 timestamp);
    event DocumentAttached(string batchId, string ipfsHash, uint256 timestamp);
    event PricingRecorded(string batchId, string stage, uint256 pricePerKgRWF, uint256 totalAmountRWF, uint256 timestamp);

    modifier batchExists(string memory _batchId) {
        require(batches[_batchId].isRegistered, "Batch does not exist");
        _;
    }

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(INTAKE_ROLE, msg.sender);
        _grantRole(PROCESSING_ROLE, msg.sender);
        _grantRole(EXPORT_ROLE, msg.sender);
        _batchCounter = 1000; // Start at 1001
    }

    /**
     * @dev Register a new coffee batch at the intake stage.
     * IDs are auto-generated as CT-{counter}.
     */
    function registerBatch(
        string memory _farmer,
        string memory _cooperative,
        string memory _origin,
        string memory _collectionDate,
        string memory _weight,
        uint256 _boughtPricePerKgRWF,
        uint256 _boughtTotalRWF
    ) public onlyRole(INTAKE_ROLE) returns (string memory) {
        _batchCounter++;
        string memory _batchId = string(abi.encodePacked("CT-", _batchCounter.toString()));
        
        require(!batches[_batchId].isRegistered, "Batch ID collision");

        batches[_batchId].batchId = _batchId;
        batches[_batchId].farmer = _farmer;
        batches[_batchId].cooperative = _cooperative;
        batches[_batchId].origin = _origin;
        batches[_batchId].collectionDate = _collectionDate;
        batches[_batchId].weight = _weight;
        batches[_batchId].boughtPricePerKgRWF = _boughtPricePerKgRWF;
        batches[_batchId].boughtTotalRWF = _boughtTotalRWF;
        batches[_batchId].isRegistered = true;
        batches[_batchId].lastUpdated = block.timestamp;

        batchIds.push(_batchId);

        emit BatchRegistered(_batchId, _farmer, _origin, block.timestamp);
        emit PricingRecorded(_batchId, "intake", _boughtPricePerKgRWF, _boughtTotalRWF, block.timestamp);
        return _batchId;
    }

    /**
     * @dev Log processing and quality details for an existing batch.
     */
    function logProcessing(
        string memory _batchId,
        string memory _station,
        string memory _washMethod,
        string memory _moisture,
        string memory _grade,
        string memory _cuppingScore
    ) public onlyRole(PROCESSING_ROLE) batchExists(_batchId) {
        Batch storage b = batches[_batchId];
        b.station = _station;
        b.washMethod = _washMethod;
        b.moisture = _moisture;
        b.grade = _grade;
        b.cuppingScore = _cuppingScore;
        b.lastUpdated = block.timestamp;

        emit ProcessingLogged(_batchId, _station, _grade, block.timestamp);
    }

    /**
     * @dev Log export and shipping details for an existing batch.
     */
    function logExport(
        string memory _batchId,
        string memory _buyer,
        string memory _destination,
        string memory _shipDate,
        string memory _container
    ) public onlyRole(EXPORT_ROLE) batchExists(_batchId) {
        Batch storage b = batches[_batchId];
        b.buyer = _buyer;
        b.destination = _destination;
        b.shipDate = _shipDate;
        b.container = _container;
        b.lastUpdated = block.timestamp;

        emit ExportLogged(_batchId, _buyer, _destination, block.timestamp);
    }

    /**
     * @dev Log export and shipping details and record price on-chain in the same tx.
     */
    function logExportWithPrice(
        string memory _batchId,
        string memory _buyer,
        string memory _destination,
        string memory _shipDate,
        string memory _container,
        uint256 _soldPricePerKgRWF,
        uint256 _soldTotalRWF
    ) public onlyRole(EXPORT_ROLE) batchExists(_batchId) {
        Batch storage b = batches[_batchId];
        b.buyer = _buyer;
        b.destination = _destination;
        b.shipDate = _shipDate;
        b.container = _container;
        b.soldPricePerKgRWF = _soldPricePerKgRWF;
        b.soldTotalRWF = _soldTotalRWF;
        b.lastUpdated = block.timestamp;

        emit ExportLogged(_batchId, _buyer, _destination, block.timestamp);
        emit PricingRecorded(_batchId, "export", _soldPricePerKgRWF, _soldTotalRWF, block.timestamp);
    }

    /**
     * @dev Attach an IPFS document hash to a batch.
     */
    function attachDocument(string memory _batchId, string memory _ipfsHash) public batchExists(_batchId) {
        // Anyone can suggest a document if authorized, or restrict to specific roles
        // Here we restrict to anyone with at least one role for now, or just Processing/Export
        require(
            hasRole(INTAKE_ROLE, msg.sender) || hasRole(PROCESSING_ROLE, msg.sender) || hasRole(EXPORT_ROLE, msg.sender),
            "Not authorized to attach docs"
        );
        
        batches[_batchId].ipfsHash = _ipfsHash;
        batches[_batchId].lastUpdated = block.timestamp;

        emit DocumentAttached(_batchId, _ipfsHash, block.timestamp);
    }

    /**
     * @dev Retrieve full batch details.
     */
    function getBatch(string memory _batchId) public view returns (Batch memory) {
        return batches[_batchId];
    }

    /**
     * @dev Get total count of registered batches.
     */
    function getBatchCount() public view returns (uint256) {
        return batchIds.length;
    }

    /**
     * @dev Helper to check if a user has any operational role.
     */
    function getUserRoles(address user) public view returns (bool, bool, bool, bool) {
        return (
            hasRole(DEFAULT_ADMIN_ROLE, user),
            hasRole(INTAKE_ROLE, user),
            hasRole(PROCESSING_ROLE, user),
            hasRole(EXPORT_ROLE, user)
        );
    }
}