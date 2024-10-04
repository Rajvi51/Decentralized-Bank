/ SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract Bank {
    uint256 private constant SCALE = 1e18;
    uint256 private constant SECONDS_IN_A_YEAR = 31536000; // Number of seconds in a year
    uint256 private constant DECIMALS = 1e4; // For displaying up to 4 decimal places
    uint256 private constant MIN_LOCK_PERIOD = 120; // Minimum lock period in seconds (2 minutes)

    struct Account {
        address accountAddress;
        uint256 balance;
        uint256 lastInterestCredited;
        uint256 fixedDeposit;
        uint256 fdLastInterestCredited;
        uint256 lastFDWithdrawal;
        uint256 accountId;
        bool exists;
    }

    // State variables
    mapping(address => Account) public accounts;
    uint256 public totalAmount;
    uint256 public savingsInterestRate = 6; // Annual interest rate for savings (in percent)
    uint256 public fdInterestRate = 10; // Annual interest rate for Fixed Deposit (in percent)
    uint256 public accountCounter;
    address private owner;

    // Event declarations
    event AccountCreated(address indexed account, uint256 accountId);
    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event Transferred(address indexed from, address indexed to, uint256 amount);
    event InterestCalculated(uint256 totalAmount);
    event FixedDepositCreated(address indexed account, uint256 amount);
    event FDWithdrawn(address indexed account, uint256 amount);
    event OwnerWithdrewAll(uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyExistingAccount() {
        require(accounts[msg.sender].exists, "Account does not exist");
        _;
    }

    modifier hasSufficientFunds(uint256 amount) {
        require(
            accounts[msg.sender].balance >= amount,
            "Insufficient savings balance"
        );
        _;
    }

    modifier hasSufficientFD(uint256 amount) {
        require(
            accounts[msg.sender].fixedDeposit >= amount,
            "Insufficient FD balance"
        );
        _;
    }

    modifier withdrawableFD() {
        require(
            block.timestamp >=
                accounts[msg.sender].lastFDWithdrawal + MIN_LOCK_PERIOD,
            "Cannot withdraw before the lock period"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // Create a new account (only for non-owner)
    function createAccount() public {
        require(msg.sender != owner, "Owner cannot create an account");
        require(!accounts[msg.sender].exists, "Account already exists");

        accountCounter++;
        accounts[msg.sender] = Account({
            accountAddress: msg.sender,
            balance: 0,
            lastInterestCredited: block.timestamp,
            fixedDeposit: 0,
            fdLastInterestCredited: block.timestamp,
            lastFDWithdrawal: block.timestamp, // Initialize withdrawal timestamp
            accountId: accountCounter,
            exists: true
        });

        emit AccountCreated(msg.sender, accountCounter);
    }

    // Deposit function for savings
    function deposit() public payable onlyExistingAccount {
        require(msg.value > 0, "Deposit amount must be greater than zero");

        // Update balance before calculating interest
        accounts[msg.sender].balance += msg.value;

        // Calculate and apply interest
        _applyInterest(msg.sender);

        emit Deposited(msg.sender, msg.value);
    }

    // Withdraw function for savings
    function withdraw(uint256 amount)
        public
        onlyExistingAccount
        hasSufficientFunds(amount)
    {
        // Calculate and apply interest
        _applyInterest(msg.sender);

        // Update balance
        accounts[msg.sender].balance -= amount;
        payable(msg.sender).transfer(amount);

        emit Withdrawn(msg.sender, amount);
    }

    // Transfer function
    function transfer(address to, uint256 amount)
        public
        onlyExistingAccount
        hasSufficientFunds(amount)
    {
        require(to != address(0), "Cannot transfer to the zero address");
        require(accounts[to].exists, "Recipient account does not exist");

        // Calculate and apply interest for both sender and receiver
        _applyInterest(msg.sender);
        _applyInterest(to);

        // Update balances
        accounts[msg.sender].balance -= amount;
        accounts[to].balance += amount;

        emit Transferred(msg.sender, to, amount);
    }

    // Create a fixed deposit
    function createFixedDeposit() public payable onlyExistingAccount {
        require(msg.value > 0, "FD amount must be greater than zero");

        // Credit any due interest for previous fixed deposit
        _applyFDInterest(msg.sender);

        // Add new fixed deposit
        accounts[msg.sender].fixedDeposit += msg.value;
        accounts[msg.sender].fdLastInterestCredited = block.timestamp; // Start tracking interest from now
        accounts[msg.sender].lastFDWithdrawal = block.timestamp; // Update last withdrawal timestamp

        emit FixedDepositCreated(msg.sender, msg.value);
    }

    // Withdraw from fixed deposit
    function withdrawFD() public onlyExistingAccount withdrawableFD {
        // Calculate and apply interest before withdrawal
        _applyFDInterest(msg.sender);

        // Update fixed deposit balance
        uint256 amount = accounts[msg.sender].fixedDeposit;
        accounts[msg.sender].fixedDeposit = 0;
        payable(msg.sender).transfer(amount);

        // Update last withdrawal timestamp
        accounts[msg.sender].lastFDWithdrawal = block.timestamp;

        emit FDWithdrawn(msg.sender, amount);
    }

    // Calculate savings interest
    function _applyInterest(address account) internal {
        uint256 timeElapsed = block.timestamp -
            accounts[account].lastInterestCredited;
        if (timeElapsed > 0) {
            uint256 interest = (accounts[account].balance *
                savingsInterestRate *
                timeElapsed) / (100 * SECONDS_IN_A_YEAR);
            accounts[account].balance += interest;
            accounts[account].lastInterestCredited = block.timestamp;
            totalAmount += interest;
            emit InterestCalculated(totalAmount);
        }
    }

    // Calculate fixed deposit interest
    function _applyFDInterest(address account) internal {
        uint256 timeElapsed = block.timestamp -
            accounts[account].fdLastInterestCredited;
        if (timeElapsed > 0) {
            uint256 interest = (accounts[account].fixedDeposit *
                fdInterestRate *
                timeElapsed) / (100 * SECONDS_IN_A_YEAR);
            accounts[account].fixedDeposit += interest;
            accounts[account].fdLastInterestCredited = block.timestamp;
            totalAmount += interest;
            emit InterestCalculated(totalAmount);
        }
    }

    // Function to get the balance of the sender, including accrued interest
    function getBalance() public view onlyExistingAccount returns (uint256) {
        return _calculateCurrentBalance(msg.sender);
    }

    // Function to get the fixed deposit balance of the sender, including accrued interest
    function getFixedDepositBalance()
        public
        view
        onlyExistingAccount
        returns (uint256)
    {
        return _calculateCurrentFD(msg.sender);
    }

    // Function to get the account ID of the sender
    function getAccountId() public view onlyExistingAccount returns (uint256) {
        return accounts[msg.sender].accountId;
    }

    // Owner-only function to withdraw all funds
    function withdrawAll() public onlyOwner {
        uint256 balance = address(this).balance;
        payable(owner).transfer(balance);
        emit OwnerWithdrewAll(balance);
    }

    // Function to get the total amount in Ether with proper conversion
    function getTotalAmountInEther()
        public
        view
        returns (uint256 whole, uint256 fraction)
    {
        whole = totalAmount / SCALE; // Whole number of Ether
        fraction = ((totalAmount % SCALE) * DECIMALS) / SCALE; // Fractional part of Ether, up to 4 decimal places
    }

    // Internal function to calculate the current balance including interest
    function _calculateCurrentBalance(address account)
        internal
        view
        returns (uint256)
    {
        uint256 timeElapsed = block.timestamp -
            accounts[account].lastInterestCredited;
        uint256 balance = accounts[account].balance;
        if (timeElapsed > 0) {
            uint256 interest = (balance * savingsInterestRate * timeElapsed) /
                (100 * SECONDS_IN_A_YEAR);
            balance += interest;
        }
        return balance;
    }

    // Internal function to calculate the current fixed deposit balance including interest
    function _calculateCurrentFD(address account)
        internal
        view
        returns (uint256)
    {
        uint256 timeElapsed = block.timestamp -
            accounts[account].fdLastInterestCredited;
        uint256 fixedDeposit = accounts[account].fixedDeposit;
        if (timeElapsed > 0) {
            uint256 interest = (fixedDeposit * fdInterestRate * timeElapsed) /
                (100 * SECONDS_IN_A_YEAR);
            fixedDeposit += interest;
        }
        return fixedDeposit;
    }
}