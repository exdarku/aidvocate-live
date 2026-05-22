// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AidVocateAudit
 * @dev Immutable audit trail for off-chain PHP donations
 * @notice This contract records donation metadata AFTER traditional payment completion
 * @author AidVocate Team
 */
contract AidVocateAudit is Ownable, ReentrancyGuard, Pausable {

    // ═══════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════

    // Mapping of authorized oracles (can submit transactions)
    mapping(address => bool) public authorizedOracles;

    // Donation status enum
    enum DonationStatus {
        PENDING,        // Payment initiated but not confirmed
        CONFIRMED,      // Payment verified by oracle(s)
        DISBURSED,      // NGO confirmed receipt
        COMPLETED,      // Funds used (with proof uploaded)
        DISPUTED        // Issue reported
    }

    // Donation structure
    struct Donation {
        bytes32 donorHash;         // Keccak256 hash of donor identifier (privacy)
        address ngoAddress;        // NGO's blockchain identifier
        uint256 amountCentavos;    // Amount in PHP centavos (100 = PHP 1)
        string bankReference;      // Unique reference (e.g., REF-20260121-...)
        string bankTxId;           // GCash/Bank transaction ID
        uint256 timestamp;         // When donation was made
        DonationStatus status;     // Current status
        string purpose;            // Donation category/purpose
        address verifyingOracle;   // Oracle that verified payment
        bytes32 receiptHash;       // Hash of payment receipt
        bool ngoConfirmed;         // NGO confirmed receipt
    }

    // Mappings
    mapping(string => Donation) public donations;              // bankReference => Donation
    mapping(address => string[]) public ngoDonationRefs;       // NGO => list of references
    mapping(address => uint256) public ngoTotalReceived;       // NGO => total amount in centavos
    mapping(address => uint256) public ngoDonationCount;       // NGO => donation count

    // List of all donation references (for iteration)
    string[] public allDonationRefs;

    // Statistics
    uint256 public totalDonationsCount;
    uint256 public totalAmountRecorded;  // In centavos

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event DonationCreated(
        string indexed bankReference,
        address indexed ngoAddress,
        uint256 amountCentavos,
        string purpose,
        uint256 timestamp
    );

    event PaymentVerified(
        string indexed bankReference,
        string bankTxId,
        address indexed verifyingOracle,
        uint256 timestamp
    );

    event NGOConfirmedReceipt(
        string indexed bankReference,
        address indexed ngoAddress,
        uint256 timestamp
    );

    event DonationCompleted(
        string indexed bankReference,
        bytes32 proofHash,
        uint256 timestamp
    );

    event DonationDisputed(
        string indexed bankReference,
        string reason,
        uint256 timestamp
    );

    event OracleAuthorized(address indexed oracle);
    event OracleRevoked(address indexed oracle);

    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier onlyOracle() {
        require(authorizedOracles[msg.sender], "Not authorized oracle");
        _;
    }

    modifier donationExists(string memory bankReference) {
        require(donations[bankReference].timestamp != 0, "Donation not found");
        _;
    }

    modifier validReference(string memory bankReference) {
        require(bytes(bankReference).length > 0, "Empty reference");
        require(bytes(bankReference).length <= 64, "Reference too long");
        _;
    }

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    constructor() Ownable(msg.sender) {
        // Contract deployer is initial oracle
        authorizedOracles[msg.sender] = true;
        emit OracleAuthorized(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════
    // ORACLE MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Authorize a new oracle address
     * @param oracle Address to authorize
     */
    function authorizeOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "Invalid address");
        require(!authorizedOracles[oracle], "Already authorized");
        authorizedOracles[oracle] = true;
        emit OracleAuthorized(oracle);
    }

    /**
     * @dev Revoke oracle authorization
     * @param oracle Address to revoke
     */
    function revokeOracle(address oracle) external onlyOwner {
        require(authorizedOracles[oracle], "Not authorized");
        authorizedOracles[oracle] = false;
        emit OracleRevoked(oracle);
    }

    // ═══════════════════════════════════════════════════════════
    // CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Create donation record (called after payment initiated)
     * @param bankReference Unique reference from payment system
     * @param donorHash Keccak256 hash of donor identifier
     * @param ngoAddress NGO's blockchain address
     * @param amountCentavos Amount in PHP centavos
     * @param purpose Donation purpose/category
     */
    function createDonation(
        string memory bankReference,
        bytes32 donorHash,
        address ngoAddress,
        uint256 amountCentavos,
        string memory purpose
    ) external onlyOracle whenNotPaused validReference(bankReference) returns (bool) {
        require(donations[bankReference].timestamp == 0, "Reference exists");
        require(ngoAddress != address(0), "Invalid NGO address");
        require(amountCentavos > 0, "Amount must be > 0");

        donations[bankReference] = Donation({
            donorHash: donorHash,
            ngoAddress: ngoAddress,
            amountCentavos: amountCentavos,
            bankReference: bankReference,
            bankTxId: "",
            timestamp: block.timestamp,
            status: DonationStatus.PENDING,
            purpose: purpose,
            verifyingOracle: address(0),
            receiptHash: bytes32(0),
            ngoConfirmed: false
        });

        allDonationRefs.push(bankReference);
        ngoDonationRefs[ngoAddress].push(bankReference);
        totalDonationsCount++;

        emit DonationCreated(
            bankReference,
            ngoAddress,
            amountCentavos,
            purpose,
            block.timestamp
        );

        return true;
    }

    /**
     * @dev Verify payment (called after bank confirmation)
     * @param bankReference Unique reference
     * @param bankTxId Bank/GCash transaction ID
     * @param receiptHash Hash of payment receipt
     */
    function verifyPayment(
        string memory bankReference,
        string memory bankTxId,
        bytes32 receiptHash
    ) external onlyOracle whenNotPaused donationExists(bankReference) returns (bool) {
        Donation storage donation = donations[bankReference];

        require(donation.status == DonationStatus.PENDING, "Already verified");
        require(bytes(bankTxId).length > 0, "Empty bank TX ID");

        donation.bankTxId = bankTxId;
        donation.status = DonationStatus.CONFIRMED;
        donation.verifyingOracle = msg.sender;
        donation.receiptHash = receiptHash;

        // Update NGO totals
        ngoTotalReceived[donation.ngoAddress] += donation.amountCentavos;
        ngoDonationCount[donation.ngoAddress]++;
        totalAmountRecorded += donation.amountCentavos;

        emit PaymentVerified(
            bankReference,
            bankTxId,
            msg.sender,
            block.timestamp
        );

        return true;
    }

    /**
     * @dev NGO confirms receipt of funds
     * @param bankReference Unique reference
     */
    function confirmReceipt(
        string memory bankReference
    ) external whenNotPaused donationExists(bankReference) returns (bool) {
        Donation storage donation = donations[bankReference];

        require(msg.sender == donation.ngoAddress, "Only NGO can confirm");
        require(donation.status == DonationStatus.CONFIRMED, "Not confirmed yet");
        require(!donation.ngoConfirmed, "Already confirmed");

        donation.ngoConfirmed = true;
        donation.status = DonationStatus.DISBURSED;

        emit NGOConfirmedReceipt(
            bankReference,
            msg.sender,
            block.timestamp
        );

        return true;
    }

    /**
     * @dev Mark donation as completed with proof
     * @param bankReference Unique reference
     * @param proofHash Hash of spending proof (IPFS hash)
     */
    function markCompleted(
        string memory bankReference,
        bytes32 proofHash
    ) external whenNotPaused donationExists(bankReference) returns (bool) {
        Donation storage donation = donations[bankReference];

        require(msg.sender == donation.ngoAddress, "Only NGO can mark complete");
        require(donation.status == DonationStatus.DISBURSED, "Not disbursed yet");

        donation.status = DonationStatus.COMPLETED;
        donation.receiptHash = proofHash;

        emit DonationCompleted(
            bankReference,
            proofHash,
            block.timestamp
        );

        return true;
    }

    /**
     * @dev Dispute a donation
     * @param bankReference Unique reference
     * @param reason Dispute reason
     */
    function disputeDonation(
        string memory bankReference,
        string memory reason
    ) external whenNotPaused donationExists(bankReference) returns (bool) {
        Donation storage donation = donations[bankReference];

        donation.status = DonationStatus.DISPUTED;

        emit DonationDisputed(
            bankReference,
            reason,
            block.timestamp
        );

        return true;
    }

    // ═══════════════════════════════════════════════════════════
    // VIEW FUNCTIONS (Public Transparency)
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Get donation details
     * @param bankReference Unique reference
     */
    function getDonation(string memory bankReference)
        external
        view
        returns (
            bytes32 donorHash,
            address ngoAddress,
            uint256 amountCentavos,
            string memory bankTxId,
            uint256 timestamp,
            DonationStatus status,
            string memory purpose,
            address verifyingOracle,
            bool ngoConfirmed
        )
    {
        Donation storage d = donations[bankReference];
        return (
            d.donorHash,
            d.ngoAddress,
            d.amountCentavos,
            d.bankTxId,
            d.timestamp,
            d.status,
            d.purpose,
            d.verifyingOracle,
            d.ngoConfirmed
        );
    }

    /**
     * @dev Check if donation exists and is verified
     * @param bankReference Unique reference
     */
    function isDonationVerified(string memory bankReference) external view returns (bool) {
        Donation storage d = donations[bankReference];
        return d.timestamp != 0 && d.status != DonationStatus.PENDING;
    }

    /**
     * @dev Get all donations for an NGO
     * @param ngoAddress NGO's address
     */
    function getNGODonations(address ngoAddress)
        external
        view
        returns (string[] memory)
    {
        return ngoDonationRefs[ngoAddress];
    }

    /**
     * @dev Get NGO statistics
     * @param ngoAddress NGO's address
     */
    function getNGOStats(address ngoAddress)
        external
        view
        returns (uint256 totalReceived, uint256 donationCount)
    {
        return (ngoTotalReceived[ngoAddress], ngoDonationCount[ngoAddress]);
    }

    /**
     * @dev Get total number of donations in system
     */
    function getTotalDonations() external view returns (uint256) {
        return totalDonationsCount;
    }

    /**
     * @dev Get total amount recorded (in centavos)
     */
    function getTotalAmountRecorded() external view returns (uint256) {
        return totalAmountRecorded;
    }

    /**
     * @dev Get donation reference by index
     * @param index Index in the array
     */
    function getDonationRefByIndex(uint256 index)
        external
        view
        returns (string memory)
    {
        require(index < allDonationRefs.length, "Index out of bounds");
        return allDonationRefs[index];
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Pause contract in case of emergency
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
