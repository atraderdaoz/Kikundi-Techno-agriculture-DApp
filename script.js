// --- Contract ABIs and Addresses ---
// IMPORTANT: Replace with the actual ABIs from your compiled contracts.
// The KKT_TOKEN_ADDRESS is taken from your provided JSON data.
const KKT_TOKEN_ADDRESS = "0x65513d9DBE2B9eBEC832E02745ea46f4f880Ce7A";
// You MUST replace this with your deployed KKTStaking contract address.
const KKT_STAKING_ADDRESS = "YOUR_KKT_STAKING_CONTRACT_ADDRESS_HERE";

// KKTToken ABI (Minimal for interaction)
const KKT_TOKEN_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "event Transfer(address indexed from, address indexed to, uint256 value)",
    "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

// KKTStaking ABI (Minimal for interaction)
const KKT_STAKING_ABI = [
    "function stakingToken() view returns (address)",
    "function rewardRate() view returns (uint256)",
    "function stake(uint256 _amount) external",
    "function unstake() external",
    "function claimReward() external",
    "function stakedAmount(address _user) external view returns (uint256)",
    "function rewardOf(address _user) external view returns (uint256)",
    "function fundRewards(uint256 _amount) external", // onlyOwner
    "function setRewardRate(uint256 _rate) external", // onlyOwner
    "function owner() view returns (address)" // Required for owner check
];

// --- Global Web3 Variables ---
let provider;
let signer;
let kktTokenContract;
let kktStakingContract;
let userAddress;
let kktDecimals = 18; // Default to 18, will try to fetch dynamically

// --- DOM Elements ---
const connectWalletBtn = document.getElementById('connectWalletBtn');
const walletAddressSpan = document.getElementById('walletAddress');
const kktBalanceSpan = document.getElementById('kktBalance');
const stakedAmountSpan = document.getElementById('stakedAmount');
const pendingRewardsSpan = document.getElementById('pendingRewards');
const connectionStatus = document.getElementById('connectionStatus');

const stakeAmountInput = document.getElementById('stakeAmount');
const approveBtn = document.getElementById('approveBtn');
const stakeBtn = document.getElementById('stakeBtn');
const unstakeBtn = document.getElementById('unstakeBtn');
const claimRewardBtn = document.getElementById('claimRewardBtn');
const stakingStatus = document.getElementById('stakingStatus');

const rfpNameInput = document.getElementById('rfpName');
const rfpEmailInput = document.getElementById('rfpEmail');
const rfpProposalTextarea = document.getElementById('rfpProposal');
const submitRFPBtn = document.getElementById('submitRFPBtn');
const rfpStatus = document.getElementById('rfpStatus');

const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const chatMessagesDiv = document.getElementById('chat-messages');

const ownerSection = document.querySelector('.owner-section');
const fundAmountInput = document.getElementById('fundAmount');
const fundRewardsBtn = document.getElementById('fundRewardsBtn');
const fundStatus = document.getElementById('fundStatus');
const rewardRateInput = document.getElementById('rewardRate');
const setRewardRateBtn = document.getElementById('setRewardRateBtn');
const rateStatus = document.getElementById('rateStatus');

// --- Helper Functions for UI Status ---
function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.className = isError ? 'status-message error' : 'status-message success';
    setTimeout(() => { element.textContent = ''; element.className = 'status-message'; }, 5000); // Clear after 5 seconds
}

// --- Web3 Connection & Data Fetching ---
async function connectWallet() {
    // Check if ethers is defined first
    if (typeof ethers === 'undefined') {
        showStatus(connectionStatus, "Ethers.js library not loaded. Please check your internet connection or browser extensions.", true);
        console.error("Ethers.js is not defined. Cannot proceed with Web3 operations.");
        return; // Exit if ethers is not found
    }

    if (typeof window.ethereum === 'undefined') {
        showStatus(connectionStatus, "MetaMask is not installed. Please install it to use this DApp.", true);
        connectWalletBtn.textContent = 'Install MetaMask';
        connectWalletBtn.onclick = () => window.open("https://metamask.io/download.html", "_blank");
        return; // Exit if MetaMask is not found
    }

    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []); // Request account access
        signer = provider.getSigner();
        userAddress = await signer.getAddress();

        kktTokenContract = new ethers.Contract(KKT_TOKEN_ADDRESS, KKT_TOKEN_ABI, signer);
        kktStakingContract = new ethers.Contract(KKT_STAKING_ADDRESS, KKT_STAKING_ABI, signer);

        // Dynamically get KKT decimals
        try {
            kktDecimals = await kktTokenContract.decimals();
        } catch (e) {
            console.warn("Could not fetch KKT decimals from contract, defaulting to 18.", e);
        }

        showStatus(connectionStatus, "Wallet Connected!", false);
        connectWalletBtn.textContent = 'Wallet Connected';
        connectWalletBtn.disabled = true;

        await updateWalletInfo(); // Initial info update

        // Listen for account and chain changes
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                showStatus(connectionStatus, "Wallet disconnected.", true);
                resetWalletInfo();
            } else {
                updateWalletInfo();
            }
        });

        window.ethereum.on('chainChanged', (chainId) => {
            showStatus(connectionStatus, "Network changed. Please refresh page.", true);
            // For a more robust DApp, you'd handle network switching here
            setTimeout(() => window.location.reload(), 2000);
        });

    } catch (error) {
        console.error("Error connecting wallet:", error);
        showStatus(connectionStatus, `Failed to connect wallet: ${error.message}`, true);
    }
}

async function updateWalletInfo() {
    if (!signer) return;

    try {
        userAddress = await signer.getAddress();
        walletAddressSpan.textContent = `${userAddress.substring(0, 6)}...${userAddress.slice(-4)}`;

        // Fetch KKT Balance
        const kktBalanceWei = await kktTokenContract.balanceOf(userAddress);
        kktBalanceSpan.textContent = ethers.utils.formatUnits(kktBalanceWei, kktDecimals);

        // Fetch Staked Amount (now "Invested in Kikundi")
        const stakedWei = await kktStakingContract.stakedAmount(userAddress);
        stakedAmountSpan.textContent = ethers.utils.formatUnits(stakedWei, kktDecimals);

        // Fetch Pending Rewards (now "Projected Harvest Share")
        const pendingRewardsWei = await kktStakingContract.rewardOf(userAddress);
        pendingRewardsSpan.textContent = ethers.utils.formatUnits(pendingRewardsWei, kktDecimals);

        // Check and display owner section
        const ownerAddress = await kktStakingContract.owner();
        if (userAddress.toLowerCase() === ownerAddress.toLowerCase()) {
            ownerSection.style.display = 'block';
        } else {
            ownerSection.style.display = 'none';
        }

    } catch (error) {
        console.error("Error updating wallet info:", error);
        showStatus(connectionStatus, "Error updating wallet info. Check console.", true);
    }
}

function resetWalletInfo() {
    walletAddressSpan.textContent = 'Not Connected';
    kktBalanceSpan.textContent = '0';
    stakedAmountSpan.textContent = '0';
    pendingRewardsSpan.textContent = '0';
    connectWalletBtn.textContent = 'Connect Wallet';
    connectWalletBtn.disabled = false;
    ownerSection.style.display = 'none';
    provider = null;
    signer = null;
    kktTokenContract = null;
    kktStakingContract = null;
    userAddress = null;
}

// --- Staking Functions (Re-contextualized) ---
async function approveStaking() {
    if (!signer) {
        showStatus(stakingStatus, "Please connect wallet first.", true);
        return;
    }

    const amount = stakeAmountInput.value;
    if (!amount || parseFloat(amount) <= 0) {
        showStatus(stakingStatus, "Please enter a valid amount to approve.", true);
        return;
    }

    try {
        showStatus(stakingStatus, "Approving KKT for Kikundi contribution...", false);
        const amountWei = ethers.utils.parseUnits(amount, kktDecimals);
        const tx = await kktTokenContract.approve(KKT_STAKING_ADDRESS, amountWei);
        await tx.wait(); // Wait for the transaction to be mined
        showStatus(stakingStatus, "Approval successful! You can now commit KKT.", false);
        await updateWalletInfo(); // Update balance/allowance
    } catch (error) {
        console.error("Error approving:", error);
        showStatus(stakingStatus, `Approval failed: ${error.message}`, true);
    }
}

async function stakeTokens() {
    if (!signer) {
        showStatus(stakingStatus, "Please connect wallet first.", true);
        return;
    }

    const amount = stakeAmountInput.value;
    if (!amount || parseFloat(amount) <= 0) {
        showStatus(stakingStatus, "Please enter a valid amount to commit.", true);
        return;
    }

    try {
        showStatus(stakingStatus, "Committing KKT to Kikundi Growth Fund...", false);
        const amountWei = ethers.utils.parseUnits(amount, kktDecimals);

        // Check allowance before staking
        const allowance = await kktTokenContract.allowance(userAddress, KKT_STAKING_ADDRESS);
        if (allowance.lt(amountWei)) { // .lt means less than
            showStatus(stakingStatus, "Insufficient approval. Please approve your KKT contribution first.", true);
            return;
        }

        const tx = await kktStakingContract.stake(amountWei);
        await tx.wait();
        showStatus(stakingStatus, "KKT committed successfully to Kikundi Growth Fund!", false);
        stakeAmountInput.value = ''; // Clear input
        await updateWalletInfo();
    } catch (error) {
        console.error("Error committing KKT:", error);
        showStatus(stakingStatus, `KKT commitment failed: ${error.message}`, true);
    }
}

async function unstakeTokens() {
    if (!signer) {
        showStatus(stakingStatus, "Please connect wallet first.", true);
        return;
    }

    try {
        showStatus(stakingStatus, "Withdrawing KKT contribution...", false);
        const tx = await kktStakingContract.unstake();
        await tx.wait();
        showStatus(stakingStatus, "KKT contribution withdrawn successfully!", false);
        await updateWalletInfo();
    } catch (error) {
        console.error("Error withdrawing contribution:", error);
        showStatus(stakingStatus, `Withdrawal failed: ${error.message}`, true);
    }
}

async function claimRewards() {
    if (!signer) {
        showStatus(stakingStatus, "Please connect wallet first.", true);
        return;
    }

    try {
        showStatus(stakingStatus, "Claiming your harvest share...", false);
        const tx = await kktStakingContract.claimReward();
        await tx.wait();
        showStatus(stakingStatus, "Harvest share claimed successfully!", false);
        await updateWalletInfo();
    } catch (error) {
        console.error("Error claiming harvest share:", error);
        showStatus(stakingStatus, `Harvest share claim failed: ${error.message}`, true);
    }
}

// --- Owner Functions (Re-contextualized) ---
async function fundRewards() {
    if (!signer) {
        showStatus(fundStatus, "Please connect wallet first.", true);
        return;
    }

    const amount = fundAmountInput.value;
    if (!amount || parseFloat(amount) <= 0) {
        showStatus(fundStatus, "Please enter a valid amount to fund.", true);
        return;
    }

    try {
        showStatus(fundStatus, "Funding Kikundi Growth Pool...", false);
        const amountWei = ethers.utils.parseUnits(amount, kktDecimals);

        // Owner must first approve the KKTStaking contract to pull funds from their wallet
        const allowance = await kktTokenContract.allowance(userAddress, KKT_STAKING_ADDRESS);
        if (allowance.lt(amountWei)) {
            showStatus(fundStatus, "Insufficient approval. Approving now...", false);
            const approveTx = await kktTokenContract.approve(KKT_STAKING_ADDRESS, amountWei);
            await approveTx.wait();
            showStatus(fundStatus, "Approval granted. Now funding Kikundi Growth Pool...", false);
        }

        const tx = await kktStakingContract.fundRewards(amountWei);
        await tx.wait();
        showStatus(fundStatus, "Kikundi Growth Pool funded successfully!", false);
        fundAmountInput.value = '';
        await updateWalletInfo();
    } catch (error) {
        console.error("Error funding Kikundi Growth Pool:", error);
        showStatus(fundStatus, `Funding failed: ${error.message}`, true);
    }
}

async function setRewardRate() {
    if (!signer) {
        showStatus(rateStatus, "Please connect wallet first.", true);
        return;
    }

    const rate = rewardRateInput.value;
    if (rate === "" || parseInt(rate) < 0) {
        showStatus(rateStatus, "Please enter a valid yield rate (non-negative integer).", true);
        return;
    }

    try {
        showStatus(rateStatus, "Setting projected yield rate...", false);
        const tx = await kktStakingContract.setRewardRate(rate);
        await tx.wait();
        showStatus(rateStatus, `Projected Yield Rate set successfully to ${rate}!`, false);
        rewardRateInput.value = '';
    } catch (error) {
        console.error("Error setting yield rate:", error);
        showStatus(rateStatus, `Setting yield rate failed: ${error.message}`, true);
    }
}

// --- Partnership & Innovation Proposal Submission (Frontend Only) ---
async function submitRFP() {
    const name = rfpNameInput.value.trim();
    const email = rfpEmailInput.value.trim();
    const proposal = rfpProposalTextarea.value.trim();

    if (!name || !email || !proposal) {
        showStatus(rfpStatus, "Please fill in all fields for your proposal.", true);
        return;
    }

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
        showStatus(rfpStatus, "Please enter a valid email address.", true);
        return;
    }

    showStatus(rfpStatus, "Submitting proposal...", false);

    // In a real DApp, this would send data to a backend server or a decentralized storage solution.
    // For this example, we'll just simulate success.
    console.log("Techno-Agri Proposal Data:", { name, email, proposal });
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

    showStatus(rfpStatus, "Proposal submitted successfully! We will review your innovative ideas.", false);
    rfpNameInput.value = '';
    rfpEmailInput.value = '';
    rfpProposalTextarea.value = '';
}

// --- Kikundi Community Forum (Frontend Simulation) ---
function sendChatMessage() {
    const message = chatInput.value.trim();
    if (message) {
        const newMessageDiv = document.createElement('div');
        newMessageDiv.classList.add('chat-message');
        newMessageDiv.innerHTML = `<strong>You:</strong> ${message}`;
        chatMessagesDiv.appendChild(newMessageDiv);
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Scroll to bottom
        chatInput.value = ''; // Clear input

        // In a real application, this message would be sent to a WebSocket server
        // or a decentralized chat protocol.
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if ethers is defined before proceeding
    if (typeof ethers === 'undefined') {
        showStatus(connectionStatus, "Ethers.js library not loaded. Please check your internet connection or browser extensions.", true);
        console.error("Ethers.js is not defined. Cannot initialize DApp functionality.");
        return; // Stop execution if ethers is not available
    }

    connectWalletBtn.addEventListener('click', connectWallet);
    approveBtn.addEventListener('click', approveStaking);
    stakeBtn.addEventListener('click', stakeTokens);
    unstakeBtn.addEventListener('click', unstakeTokens);
    claimRewardBtn.addEventListener('click', claimRewards);
    submitRFPBtn.addEventListener('click', submitRFP);
    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // Owner functions
    fundRewardsBtn.addEventListener('click', fundRewards);
    setRewardRateBtn.addEventListener('click', setRewardRate);

    // Initial check if wallet is already connected (e.g., after refresh)
    if (typeof window.ethereum !== 'undefined' && window.ethereum.selectedAddress) {
        connectWallet();
    }
});
