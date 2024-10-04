import React, { useEffect, useState } from 'react';
import Web3 from 'web3';
import contractABI from './contractABI.json'; // Import your contract ABI

const App = () => {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [userBalance, setUserBalance] = useState(0); // User's balance including interest
  const [contractBalance, setContractBalance] = useState(0); // Contract's balance
  const [errorMessage, setErrorMessage] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [recipient, setRecipient] = useState(""); // Recipient address
  const [transferAmount, setTransferAmount] = useState(""); // Amount to transfer
  const [userFD, setUserFD] = useState(0); // User's Fixed Deposit
  const [fdAmount, setFDAmount] = useState(""); // Input for Fixed Deposit amount
  const [fdInterestRate] = useState(4); // Assuming interest rate is 4%

  const contractAddress = "0x253ebf9969be362efcef73b3e6202ac789dc41c5"; // Replace with your contract address

  // Load Web3, MetaMask account, and contract
  useEffect(() => {
    const loadWeb3 = async () => {
      if (window.ethereum) {
        try {
          // Request account access
          await window.ethereum.request({ method: "eth_requestAccounts" });
          const web3Instance = new Web3(window.ethereum);
          setWeb3(web3Instance);

          const accounts = await web3Instance.eth.getAccounts();
          setAccount(accounts[0]);
          console.log("Connected account:", accounts[0]);  // Debugging: Check connected account

          // Create contract instance
          const contractInstance = new web3Instance.eth.Contract(contractABI, contractAddress);
          setContract(contractInstance);

          // Fetch and display balances
          updateBalances(accounts[0], contractInstance);
        } catch (error) {
          console.error("Failed to load Web3 or contract", error);
        }
      } else {
        alert("Please install MetaMask!");
      }
    };

    loadWeb3();
  }, []);

  // Handle MetaMask account change
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', async (accounts) => {
        setAccount(accounts[0]);
        console.log("Switched to account:", accounts[0]);

        // Update balances for the new account
        if (contract) {
          updateBalances(accounts[0], contract);
        }
      });
    }
  }, [contract]);


  // Fetch user and contract balances
  const updateBalances = async (account, contractInstance) => {
    if (!contractInstance) {
      console.error("Web3 or contract is not initialized yet.");
      return;
    }

    try {
      const web3Instance = new Web3(window.ethereum);
      // Fetch user's balance (including interest from the smart contract)
      const userBalanceInWei = await contractInstance.methods.getBalance().call({ from: account });
      console.log(userBalanceInWei);
      const userBalanceInEther = web3Instance.utils.fromWei(userBalanceInWei, 'ether');
      setUserBalance(userBalanceInEther);


      // Fetch user's Fixed Deposit (FD) balance
      const userFDInWei = await contractInstance.methods.getFixedDepositBalance().call({ from: account });
      const userFDInEther = web3Instance.utils.fromWei(userFDInWei, 'ether');
      setUserFD(userFDInEther);




      // Fetch contract's balance
      const contractBalanceInWei = await web3Instance.eth.getBalance("YOUR CONTRACT ADDRESS");
      const contractBalanceInEther = web3Instance.utils.fromWei(contractBalanceInWei, 'ether');
      setContractBalance(contractBalanceInEther);

      console.log("Contract's balance in Ether:", contractBalanceInEther);
      console.log("User's balance (including interest) in Ether:", userBalanceInEther);
      console.log("User's Fixed Deposit (including interest) in Ether:", userFDInEther);
    } catch (error) {
      console.error("Error fetching balances:", error);
      setErrorMessage("Error fetching balances. Check console for more details.");
    }
  }


  // Deposit function
  const deposit = async () => {
    if (!web3 || !contract || !account) {
      alert("Please connect your wallet.");
      return;
    }

    try {
      const gasEstimate = await contract.methods.deposit().estimateGas({
        from: account,
        value: web3.utils.toWei(depositAmount, 'ether'),
      });

      await contract.methods.deposit().send({
        from: account,
        value: web3.utils.toWei(depositAmount, 'ether'),
        gas: gasEstimate,
      });

      console.log("Deposit successful");
      updateBalances(account, contract);  // Update both balances after deposit
    } catch (error) {
      console.error("Deposit failed:", error);
    }
  };

  //  Withdraw function
  const withdraw = async () => {
    if (!web3 || !contract || !account) {
      alert("Please connect your wallet.");
      return;
    }

    try {
      const withdrawValue = web3.utils.toWei(withdrawAmount, 'ether');
      const gasEstimate = await contract.methods.withdraw(withdrawValue).estimateGas({
        from: account,
      });

      await contract.methods.withdraw(withdrawValue).send({
        from: account,
        gas: gasEstimate,
      });

      console.log("Withdraw successful");
      updateBalances(account, contract);  // Update both balances after withdraw
    } catch (error) {
      console.error("Withdraw failed:", error.message);
      alert("Error during withdraw. Check console for more details.");
    }
  };


  // Transfer function to interact with the smart contract
  const transfer = async () => {
    if (!web3 || !contract || !account) {
      alert("Please connect your wallet.");
      return;
    }

    try {
      const amountInWei = web3.utils.toWei(transferAmount, 'ether');
      const gasEstimate = await contract.methods.transfer(recipient, amountInWei).estimateGas({
        from: account,
      });

      await contract.methods.transfer(recipient, amountInWei).send({
        from: account,
        gas: gasEstimate,
      });

      console.log("Transfer successful");
      updateBalances(account, contract);  // Update balances after transfer
    } catch (error) {
      console.error("Transfer failed:", error.message);
      alert("Error during transfer. Check console for more details.");
    }
  };



  // Create Fixed Deposit
  const createFixedDeposit = async () => {
    if (!web3 || !contract || !account) {
      alert("Please connect your wallet.");
      return;
    }

    try {
      const amountInWei = web3.utils.toWei(fdAmount, 'ether');
      const gasEstimate = await contract.methods.createFixedDeposit().estimateGas({
        from: account,
        value: amountInWei
      });

      await contract.methods.createFixedDeposit().send({
        from: account,
        value: amountInWei,
        gas: gasEstimate
      });

      updateBalances(account, contract);
    } catch (error) {
      console.error("Fixed Deposit creation failed:", error);
    }
  };

  // Withdraw Fixed Deposit
  const withdrawFixedDeposit = async () => {
    if (!web3 || !contract || !account) {
      alert("Please connect your wallet.");
      return;
    }

    try {
      const gasEstimate = await contract.methods.withdrawFD().estimateGas({
        from: account
      });

      await contract.methods.withdrawFD().send({
        from: account,
        gas: gasEstimate
      });
      console.log('FD Successfully Withdraw')
      updateBalances(account, contract);
    } catch (error) {
      console.error("Fixed Deposit withdrawal failed:", error);
      alert("Error during FD withdrawal. Check console for more details.");
    }
  };

  return (
    <div>
      <div className="App">
        <h1>Banking Dapp</h1>
        {account ? (
          <p>Connected account: {account}</p>
        ) : (
          <button onClick={() => window.ethereum.request({ method: "eth_requestAccounts" })}>
            Connect MetaMask
          </button>
        )}

        <div>
          <h2>Your Balance (with interest): {userBalance} ETH</h2> {/* User's balance */}
        </div>

        <div>
          <h2>Your Fixed Deposit: {userFD} ETH</h2> {/* User's fixed deposit */}
        </div>

        <div>
          <h2>Contract Balance: {contractBalance} ETH</h2> {/* Contract's balance */}
        </div>

        {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
      </div>

      <div>
        <h3>Deposit Ether</h3>
        <input
          type="number"
          placeholder="Amount to deposit"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
        />
        <button onClick={deposit}>Deposit</button>
      </div>

      <div>
        <h3>Withdraw Ether</h3>
        <input
          type="number"
          placeholder="Amount to withdraw"
          value={withdrawAmount}
          onChange={(e) => setWithdrawAmount(e.target.value)}
        />
        <button onClick={withdraw}>Withdraw</button>
      </div>


      <div>
        <h3>Transfer Ether</h3>
        <input
          type="text"
          placeholder="Recipient Address"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
        />
        <input
          type="number"
          placeholder="Amount to transfer"
          value={transferAmount}
          onChange={(e) => setTransferAmount(e.target.value)}
        />
        <button onClick={transfer}>Transfer</button>
      </div>



      <div>
        <h3>Create Fixed Deposit</h3>
        <input
          type="number"
          placeholder="Amount for Fixed Deposit (ETH)"
          value={fdAmount}
          onChange={(e) => setFDAmount(e.target.value)}
        />
        <button onClick={createFixedDeposit}>Create Fixed Deposit</button>
      </div>

      <div>
        <h3>Withdraw Fixed Deposit</h3>
        <button onClick={withdrawFixedDeposit}>Withdraw Fixed Deposit</button>
      </div>




    </div>
  )
}
export default App;