import React, { useState, useEffect, useRef } from 'react';
import styles from './Home.module.css';
import CardFormModal from '../Cards/CardFormModal';
import Modal from '../../components/Modal/Modal';
import SendMoneyModal from '../../components/SendMoneyModal/SendMoneyModal';
import PaymentGame from '../../components/PaymentGame/PaymentGame';
import { getCurrentUser } from '../../userStore';
import QrScanner from 'react-qr-scanner';
import jsQR from 'jsqr';
import QrScanModal from '../../components/QrScanModal';
import UserIcon from '../../components/UserIcon/UserIcon';
import BalanceDetailsModal from '../../components/BalanceDetailsModal/BalanceDetailsModal';
import TransactionsModal from '../../components/TransactionsModal/TransactionsModal';
import netsLogo from '../../assets/nets-40.png';
import Jack from '../../assets/Jack.jpg';
import Nurul from '../../assets/Nurul.jpg';
import Michelle from '../../assets/Michelle.jpg';
import Michael from '../../assets/Michael.jpg';
import Miko from '../../assets/Miko.jpg';
import Sherlyn from '../../assets/Sherlyn.jpg';
import Kartik from '../../assets/Kartik.jpg';
import netscard1 from '../../assets/netscard1.png';
import netscard2 from '../../assets/netscard2.png';
import netscard3 from '../../assets/netscard3.png';
import netscard4 from '../../assets/netscard4.png';
import candyIcon from '../../assets/candy.png';
import bubbleIcon from '../../assets/bubble.png';
import minesweeperIcon from '../../assets/minesweeper.png';
import snakeIcon from '../../assets/snake.png';
import GameContainer from '../Games/GameContainer';
import AvatarPaymentGame from '../../components/AvatarPaymentGame/AvatarPaymentGame';

const FRIENDS_LIST = [
  { name: 'Leow Seng Heang', phone: '+6591850816', email: 'leowseng@gmail.com' },
  { name: 'Evan', phone: '+6582284718', email: 'en.jjlee@gmail.com' },
  { name: 'Alice Tan', phone: '+6581234567', email: 'alice.tan@example.com' },
  { name: 'Ben Lim', phone: '+6582345678', email: 'ben.lim@example.com' },
  { name: 'Cheryl Ng', phone: '+6583456789', email: 'cheryl.ng@example.com' },
];

function getAllTransactions(cards) {
  // Flatten all transactions from all cards, add card info, and sort by date (assume time is parseable)
  return cards
    .flatMap(card =>
      (card.transactions || []).map(txn => ({ ...txn, cardNumber: card.number, cardId: card.id }))
    )
    .sort((a, b) => new Date(b.time) - new Date(a.time));
}

function SplitBillModal(props) {
  const { open, onClose, payer, payerEmail, cards, setCards, setTransactions, amount } = props;
  const [localAmount, setLocalAmount] = useState(amount || '');
  useEffect(() => { setLocalAmount(amount || ''); }, [amount]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedCardId, setSelectedCardId] = useState(cards && cards.length > 0 ? cards[0].id : '');

  useEffect(() => {
    if (cards && cards.length > 0) setSelectedCardId(cards[0].id);
  }, [cards]);

  const handleFriendToggle = (friend) => {
    setSelectedFriends(prev =>
      prev.some(f => f.email === friend.email)
        ? prev.filter(f => f.email !== friend.email)
        : [...prev, friend]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!localAmount || selectedFriends.length === 0 || !selectedCardId) return;
    setSending(true);
    setResult(null);
    try {
              const res = await fetch('http://localhost:3002/api/split-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payer,
          payerEmail,
          amount: parseFloat(localAmount),
          friends: selectedFriends,
          message,
          cardId: selectedCardId
        })
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, msg: 'Split bill QR codes sent to friends via email!' });
        setLocalAmount('');
        setSelectedFriends([]);
        setMessage('');
        // Refresh cards and transactions
                  const userId = getCurrentUser();
          if (userId) {
            fetch(`http://localhost:3002/api/cards?user_id=${userId}`)
            .then(res => res.json())
            .then(data => {
              const cardData = Array.isArray(data)
                ? data.map(card => ({ ...card, balance: Number(card.balance) }))
                : [];
              setCards(cardData);
            });
          fetch(`http://localhost:3002/api/transactions?user_id=${userId}`)
            .then(res => res.json())
            .then(data => setTransactions(data));
        }
      } else {
        setResult({ success: false, msg: data.error || 'Failed to send split bill.' });
      }
    } catch (err) {
      setResult({ success: false, msg: err.message });
    }
    setSending(false);
  };

  if (!open) return null;
  return (
    <div className="modal-overlay" style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.18)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 18, padding: 32, minWidth: 340, maxWidth: 420, width: '100%', boxShadow: '0 2px 24px rgba(123,92,255,0.14)', position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 18, background: 'none', border: 'none', fontSize: 26, cursor: 'pointer', color: '#888' }}>&times;</button>
        <h2 style={{ marginBottom: 16, fontSize: '1.3rem', color: '#7b5cff', fontWeight: 700, textAlign: 'center' }}>Split Bill</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontWeight: 600 }}>Total Bill Amount ($):</label>
            <input type="number" min="0.01" step="0.01" value={localAmount} onChange={e => setLocalAmount(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #e0e0f0', marginTop: 6, fontSize: 16 }} required />
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>Pay with Card:</label>
            <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #e0e0f0', marginTop: 6, fontSize: 16 }} required>
              {cards && cards.map(card => (
                <option key={card.id} value={card.id}>
                  **** **** **** {String(card.number).slice(-4)} (Bal: ${Number(card.balance).toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>Friends to Split With:</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, maxHeight: 120, overflowY: 'auto' }}>
              {FRIENDS_LIST.map(friend => (
                <label key={friend.email} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                  <input type="checkbox" checked={selectedFriends.some(f => f.email === friend.email)} onChange={() => handleFriendToggle(friend)} />
                  <span style={{ fontWeight: 500 }}>{friend.name}</span> <span style={{ color: '#888', fontSize: 13 }}>({friend.email})</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>Message (optional):</label>
            <input type="text" value={message} onChange={e => setMessage(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1.5px solid #e0e0f0', marginTop: 6, fontSize: 15 }} />
          </div>
          <div style={{ marginBottom: 6, color: '#7b5cff', fontWeight: 600, textAlign: 'center', fontSize: 16 }}>
            {selectedFriends.length > 0 && localAmount && (
              <>Each pays: ${(parseFloat(localAmount) / (selectedFriends.length + 1)).toFixed(2)}</>
            )}
          </div>
          <button type="submit" disabled={sending || !localAmount || selectedFriends.length === 0 || !selectedCardId} style={{ background: '#7b5cff', color: '#fff', border: 'none', borderRadius: 10, padding: '0.9rem 1.5rem', fontWeight: 700, fontSize: '1.1rem', cursor: sending ? 'not-allowed' : 'pointer', width: '100%', marginTop: 4, boxShadow: '0 2px 8px rgba(123,92,255,0.08)' }}>
            {sending ? 'Sending...' : 'Send Split Bill'}
          </button>
        </form>
        {result && (
          <div style={{ marginTop: 16, color: result.success ? '#2ecc40' : '#e14a4a', fontWeight: 600, textAlign: 'center', fontSize: 15 }}>{result.msg}</div>
        )}
      </div>
    </div>
  );
}

// Split Bill Choice Modal
const SplitBillChoiceModal = ({ open, onClose, setShowSplitBillQR, setShowSplitBill, setSplitBillAmount }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.18)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, minWidth: 320, maxWidth: 380, width: '100%', boxShadow: '0 2px 24px rgba(123,92,255,0.12)', position: 'relative', textAlign: 'center' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }}>&times;</button>
        <h2 style={{ marginBottom: 18, fontSize: '1.2rem', color: '#7b5cff', fontWeight: 700 }}>Split Bill</h2>
        <button onClick={() => { onClose(); setShowSplitBillQR(true); }} style={{ width: '100%', background: '#7b5cff', color: '#fff', border: 'none', borderRadius: 10, padding: '1rem', fontWeight: 700, fontSize: '1.1rem', marginBottom: 16, cursor: 'pointer' }}>Scan QR to Split Bill</button>
        <button onClick={() => { onClose(); setSplitBillAmount(''); setShowSplitBill(true); }} style={{ width: '100%', background: '#fff', color: '#7b5cff', border: '2px solid #7b5cff', borderRadius: 10, padding: '1rem', fontWeight: 700, fontSize: '1.1rem', cursor: 'pointer' }}>Manual Split Bill</button>
      </div>
    </div>
  );
};

export default function Home({ isSignedIn, user, cards, setCards, onProfileClick, onTabChange }) {
  const [transactions, setTransactions] = useState([]);
  const [showAddCard, setShowAddCard] = useState(false);
  const [topUpCardId, setTopUpCardId] = useState(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [showCardSelectionModal, setShowCardSelectionModal] = useState(false);
  const [showSendMoney, setShowSendMoney] = useState(false);
  const [showPaymentGame, setShowPaymentGame] = useState(false);
  const [showQuickSendModal, setShowQuickSendModal] = useState(false);
  const [showAvatarPaymentGame, setShowAvatarPaymentGame] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState(null);
  const [quickSendAmount, setQuickSendAmount] = useState('');
  const [quickSendCardId, setQuickSendCardId] = useState('');
  const [paymentData, setPaymentData] = useState(null);
  const paymentHandledRef = useRef(false);
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [splitBillAmount, setSplitBillAmount] = useState('');
  const [showSplitBillChoice, setShowSplitBillChoice] = useState(false);
  const [showSplitBillQR, setShowSplitBillQR] = useState(false);
  const [splitBillScanError, setSplitBillScanError] = useState('');
  const [splitBillUploadedImage, setSplitBillUploadedImage] = useState(null);
  const splitBillFileInputRef = useRef();
  const [showBalanceDetailsModal, setShowBalanceDetailsModal] = useState(false);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showGame, setShowGame] = useState(false);
  const [currentGame, setCurrentGame] = useState(null);

  useEffect(() => {
    const userId = getCurrentUser();
          if (userId) {
        fetch(`http://localhost:3002/api/transactions?user_id=${userId}`)
          .then(res => res.json())
          .then(data => setTransactions(data));
        fetch(`http://localhost:3002/api/cards?user_id=${userId}`)
        .then(res => res.json())
        .then(data => {
          const cardData = Array.isArray(data)
            ? data.map(card => ({ ...card, balance: Number(card.balance) }))
            : [];
          setCards(cardData);
        });
    } else {
      setCards([]);
      setTransactions([]);
    }
  }, [isSignedIn]);

  // Calculate total balance
  const totalBalance = cards.reduce((sum, card) => sum + (Number(card.balance) || 0), 0);

  // Gather all transactions from all cards
  const allTransactions = transactions.length > 0 ? transactions : getAllTransactions(cards);

  // Sort transactions by time descending (latest first)
  const sortedTransactions = [...allTransactions].sort(
    (a, b) => new Date(b.time) - new Date(a.time)
  );
  console.log('Rendering sortedTransactions:', sortedTransactions);

  // Before rendering, sort cards by id to preserve original order
  const sortedCards = [...cards].sort((a, b) => a.id - b.id);

  // Add new card handler
  const handleAddCard = async (card) => {
    const userId = getCurrentUser();
    console.log('Adding card for user ID:', userId);
    console.log('Card data:', card);
    
    if (!userId) {
      alert('You must be signed in to add a card.');
      return;
    }
    try {
      const res = await fetch('http://localhost:3002/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          number: card.number,
          holder: card.holder,
          expiry: card.expiry,
          design: card.design || 'netscard1'
        })
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('Failed to add card:', err);
        alert('Failed to add card: ' + (err.error || 'Unknown error'));
        return;
      }
      
      const result = await res.json();
      console.log('Card added successfully:', result);
      
      // Refresh cards
      console.log('Refreshing cards for user:', userId);
      fetch(`http://localhost:3002/api/cards?user_id=${userId}`)
        .then(res => res.json())
        .then(data => {
          console.log('Cards data received:', data);
          const cardData = Array.isArray(data)
            ? data.map(card => ({ ...card, balance: Number(card.balance) }))
            : [];
          console.log('Setting cards:', cardData);
          setCards(cardData);
        })
        .catch(err => {
          console.error('Error refreshing cards:', err);
        });
      setShowAddCard(false);
    } catch (e) {
      alert('Network error: ' + e.message);
    }
  };

  // Top up handlers
  const openTopUp = (cardId) => {
    setTopUpCardId(cardId);
    setTopUpAmount('');
  };
  
  // Smart Shortcut Top Up - show card selection first
  const openSmartShortcutTopUp = () => {
    if (cards.length === 0) {
      alert('No cards available. Please add a card first.');
      return;
    }
    if (cards.length === 1) {
      // If only one card, go directly to amount input
      openTopUp(cards[0].id);
    } else {
      // If multiple cards, show card selection modal
      setShowCardSelectionModal(true);
    }
  };
  
  const closeCardSelectionModal = () => {
    setShowCardSelectionModal(false);
  };
  
  const selectCardForTopUp = (cardId) => {
    setShowCardSelectionModal(false);
    openTopUp(cardId);
  };
  
  // Quick Send handlers
  const openQuickSend = (recipient) => {
    console.log('Quick Send clicked for:', recipient);
    setSelectedRecipient(recipient);
    setQuickSendAmount('');
    // Don't reset quickSendCardId - let user keep their selection
    if (!quickSendCardId && cards.length > 0) {
      setQuickSendCardId(cards[0].id); // Set to first card if none selected
    }
    setShowQuickSendModal(true);
  };
  
  const closeQuickSendModal = () => {
    setShowQuickSendModal(false);
    setSelectedRecipient(null);
    setQuickSendAmount('');
    setQuickSendCardId('');
  };
  
  const handleQuickSendSubmit = (e) => {
    e.preventDefault();
    if (!quickSendAmount || !quickSendCardId) {
      alert('Please enter amount and select a card');
      return;
    }
    
    const amount = parseFloat(quickSendAmount);
    if (amount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }
    
    const selectedCard = cards.find(card => card.id === quickSendCardId);
    if (!selectedCard) {
      alert('Selected card not found');
      return;
    }
    
    // Close modal and start Avatar Payment Game
    setShowQuickSendModal(false);
    setShowAvatarPaymentGame(true);
  };
  
  const handleAvatarPaymentComplete = async (paymentData) => {
    const userId = getCurrentUser();
    if (!userId) {
      alert('You must be signed in to make payments.');
      return;
    }

    try {
      // Deduct amount from card
      const deductRes = await fetch('http://localhost:3002/api/cards/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: paymentData.card.id, amount: paymentData.amount })
      });
      
      if (!deductRes.ok) {
        throw new Error('Failed to deduct from card');
      }

      // Create transaction record
      const txnRes = await fetch('http://localhost:3002/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          card_id: paymentData.card.id,
          name: `Quick Send to ${paymentData.recipient.name}`,
          amount: -paymentData.amount,
          type: 'expense'
        })
      });

      if (!txnRes.ok) {
        throw new Error('Failed to create transaction');
      }

      // Update card balance in place
      setCards(prevCards => prevCards.map(c =>
        c.id === paymentData.card.id 
          ? { ...c, balance: Number(c.balance) - Number(paymentData.amount) } 
          : c
      ));

      // Close modal and reset state
      setShowAvatarPaymentGame(false);
      setSelectedRecipient(null);
      setQuickSendAmount('');
      setQuickSendCardId('');
      
      // Refresh transactions
      refreshTransactions(userId);
      
      alert(`Payment sent successfully to ${paymentData.recipient.name}!`);
    } catch (error) {
      console.error('Payment failed:', error);
      alert('Payment failed: ' + error.message);
    }
  };
  const closeTopUp = () => {
    setTopUpCardId(null);
    setTopUpAmount('');
  };
  const handleTopUp = async (e) => {
    e.preventDefault();
    const amount = parseFloat(topUpAmount);
    if (!amount || amount <= 0) {
      alert('Please enter a valid amount greater than 0');
      return;
    }
    
    try {
      console.log('Sending top-up request:', { card_id: topUpCardId, amount });
      
      const response = await fetch('http://localhost:3002/api/cards/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: topUpCardId, amount })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Top-up successful:', result);
      
      // Refresh cards and transactions
      const userId = getCurrentUser();
              fetch(`http://localhost:3002/api/cards?user_id=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setCards(prevCards =>
              prevCards.map(card => {
                const updated = data.find(c => c.id === card.id);
                return updated
                  ? { ...card, balance: Number(updated.balance) }
                  : card;
              })
            );
          }
          refreshTransactions(userId);
        });
      closeTopUp();
      alert('Top-up successful!');
    } catch (e) {
      console.error('Top-up error:', e);
      alert('Top up failed: ' + e.message);
    }
  };

  // Send Money handlers
  const handleSendMoney = (recipient, card, amount) => {
    setPaymentData({ recipient, card, amount });
    setShowSendMoney(false);
    setShowPaymentGame(true);
  };

  // Delete card handler
  const handleDeleteCard = async (cardId) => {
    if (!confirm('Are you sure you want to delete this card?')) {
      return;
    }
    
    const userId = getCurrentUser();
    if (!userId) {
      alert('You must be signed in to delete a card.');
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:3002/api/cards/${cardId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) {
        const err = await res.json();
        alert('Failed to delete card: ' + (err.error || 'Unknown error'));
        return;
      }
      
      // Refresh cards
      fetch(`http://localhost:3002/api/cards?user_id=${userId}`)
        .then(res => res.json())
        .then(data => {
          const cardData = Array.isArray(data)
            ? data.map(card => ({ ...card, balance: Number(card.balance) }))
            : [];
          setCards(cardData);
        });
      
      alert('Card deleted successfully!');
    } catch (e) {
      alert('Network error: ' + e.message);
    }
  };

  const handlePaymentComplete = async (result) => {
    if (paymentHandledRef.current) return;
    paymentHandledRef.current = true;
    setShowPaymentGame(false);
    setPaymentData(null);

    if (result.success) {
      try {
        // Simulate sending money to recipient
        const userId = getCurrentUser();
        console.log('Processing payment for user:', userId);
        
        // Deduct from card
        console.log('Home: Sending deduct request with:', { card_id: result.card.id, amount: result.amount });
        const deductResponse = await fetch('https://localhost:3002/api/cards/deduct', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            card_id: result.card.id, 
            amount: result.amount 
          })
        });
        
        console.log('Deduct response:', deductResponse.status);
        
        if (!deductResponse.ok) {
          const errorData = await deductResponse.json();
          throw new Error(errorData.error || 'Failed to deduct from card');
        }
        
        // Add transaction record
        const transactionResponse = await fetch('https://localhost:3002/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: userId,
            card_id: result.card.id,
            name: `Sent to ${result.recipient.name}`,
            amount: -result.amount,
            type: 'expense'
          })
        });
        
        console.log('Transaction response:', transactionResponse.status);
        
        if (!transactionResponse.ok) {
          const errorData = await transactionResponse.json();
          throw new Error(errorData.error || 'Failed to create transaction');
        }
        
        // Update only the specific card's balance without fetching all cards
        setCards(prevCards =>
          prevCards.map(card =>
            card.id === result.card.id
              ? { ...card, balance: Number(card.balance) - Number(result.amount) }
              : card
          )
        );
        
        refreshTransactions(userId);
        
        fetch(`https://localhost:3002/api/transactions?user_id=${userId}`)
          .then(res => res.json())
          .then(data => setTransactions(data));
        
        alert(`Successfully sent $${result.amount.toFixed(2)} to ${result.recipient.name}! Score: ${result.score}`);
      } catch (e) {
        console.error('Payment error:', e);
        alert('Payment failed: ' + e.message);
      }
    } else {
      alert(`Game over! You scored ${result.score} goals. Payment cancelled.`);
    }
  };

  useEffect(() => {
    if (!showPaymentGame) paymentHandledRef.current = false;
  }, [showPaymentGame]);

  // Add a helper function to refresh transactions
  const refreshTransactions = (userId) => {
    fetch(`http://localhost:3002/api/transactions?user_id=${userId}`)
      .then(res => res.json())
      .then(data => setTransactions(data));
  };

  // Game handlers
  const handleGameClick = (gameType) => {
    setCurrentGame(gameType);
    setShowGame(true);
  };

  const handleGameClose = () => {
    setShowGame(false);
    setCurrentGame(null);
  };

  const handleGameComplete = () => {
    // Handle game completion - could add credits or other rewards
    console.log('Game completed!');
  };

  return (
    <div className={styles.container}>
      {/* White Logo Bar */}
      <div className={styles.logoBar}>
        <div className={styles.logoContainer}>
          <img src={netsLogo} alt="NETS" className={styles.netsLogo} />
        </div>
        </div>
        
      {/* Blue Header */}
      <div className={styles.blueHeader}>
        <div className={styles.headerTop}>
          <div className={styles.balanceDisplay}>
            <span className={styles.balanceAmount}>SGD ${totalBalance.toFixed(2)}</span>
          </div>
          <div className={styles.profileSection}>
            <UserIcon isSignedIn={isSignedIn} onProfileClick={onProfileClick} />
            {isSignedIn && (
              <div className={styles.welcomeText}>
                Welcome, {user?.username || user?.name || user?.email}!
              </div>
            )}
          </div>
        </div>
        
        <div className={styles.headerActions}>
          <button className={styles.viewBalanceLink} onClick={() => setShowBalanceDetailsModal(true)}>
            View balance details &gt;
          </button>
          <button className={styles.transactionsBtn} onClick={() => setShowTransactionsModal(true)}>
            <span className={styles.transactionsText}>Transactions &gt;</span>
          </button>
        </div>
      </div>
      
      <div className={styles.scrollableContent}>
        {/* Games Section */}
        <div className={styles.gamesSection}>
          <div className={styles.gamesTitle}>Games</div>
          <div className={styles.gamesGrid}>
            <button onClick={() => handleGameClick('candy-crush')} className={styles.gameBtn}>
              <img src={candyIcon} alt="Candy Crush" className={styles.gameIcon} />
              <span className={styles.gameName}>Candy Crush</span>
          </button>
            <button onClick={() => handleGameClick('pop-bubble')} className={styles.gameBtn}>
              <img src={bubbleIcon} alt="Pop Bubble" className={styles.gameIcon} />
              <span className={styles.gameName}>Pop Bubble</span>
          </button>
            <button onClick={() => handleGameClick('minesweeper')} className={styles.gameBtn}>
              <img src={minesweeperIcon} alt="Minesweeper" className={styles.gameIcon} />
              <span className={styles.gameName}>Minesweeper</span>
          </button>
            <button onClick={() => handleGameClick('google-snake')} className={styles.gameBtn}>
              <img src={snakeIcon} alt="Google Snake" className={styles.gameIcon} />
              <span className={styles.gameName}>Google Snake</span>
          </button>
          </div>
        </div>

        <div style={{ margin: '1.2rem 0 1.5rem 0' }}>
          <div className={styles.quickActionsTitle}>Smart Shortcut</div>
          <div className={styles.quickActionsGrid}>
            <button onClick={() => setShowSendMoney(true)} className={styles.quickActionBtn}>
              <img src="/src/assets/transfer.png" alt="Transfer" className={styles.quickActionIcon} />
              <span>Transfer</span>
          </button>
            <button onClick={() => setShowSplitBillChoice(true)} className={styles.quickActionBtn}>
              <img src="/src/assets/request.png" alt="Request" className={styles.quickActionIcon} />
              <span>Request</span>
          </button>
                            <button onClick={openSmartShortcutTopUp} className={styles.quickActionBtn}>
              <img src="/src/assets/topup.png" alt="Top-up" className={styles.quickActionIcon} />
              <span>Top-up</span>
            </button>
            <button onClick={() => setShowSplitBillChoice(true)} className={styles.quickActionBtn}>
              <img src="/src/assets/split.png" alt="Split Bill" className={styles.quickActionIcon} />
              <span>Split Bill</span>
          </button>
          </div>
        </div>

        {/* Quick Send Section */}
        <div className={styles.quickSendSection}>
          <div className={styles.quickSendTitle}>Quick Send</div>
          <div className={styles.quickSendContainer}>

            
            {/* Profile Pictures */}
            <div className={styles.profilePictures}>
              <div className={styles.profileItem} onClick={() => openQuickSend({ name: 'Kartik', photo: Kartik })}>
                <img src={Kartik} alt="Kartik" className={styles.profilePhoto} />
                <span className={styles.profileName}>Kartik</span>
                </div>
              <div className={styles.profileItem} onClick={() => {
                console.log('Michael clicked!');
                openQuickSend({ name: 'Michael', photo: Michael });
              }}>
                <img src={Michael} alt="Michael" className={styles.profilePhoto} />
                <span className={styles.profileName}>Michael</span>
            </div>
              <div className={styles.profileItem} onClick={() => openQuickSend({ name: 'Miko', photo: Miko })}>
                <img src={Miko} alt="Miko" className={styles.profilePhoto} />
                <span className={styles.profileName}>Miko</span>
          </div>
              <div className={styles.profileItem} onClick={() => openQuickSend({ name: 'Sherlyn', photo: Sherlyn })}>
                <img src={Sherlyn} alt="Sherlyn" className={styles.profilePhoto} />
                <span className={styles.profileName}>Sherlyn</span>
        </div>
              <div className={styles.profileItem} onClick={() => openQuickSend({ name: 'Jack', photo: Jack })}>
                <img src={Jack} alt="Jack" className={styles.profilePhoto} />
                <span className={styles.profileName}>Jack</span>
            </div>
          </div>
            

          </div>
        </div>

        {/* Your Cards */}
        <section className={styles.cardsSection}>
          <div className={styles.cardsTitle}>NETS FlashPay</div>
          <div className={styles.cardList}>
            {Array.isArray(sortedCards) && sortedCards.map(card => {
              const digits = (card.number || '').replace(/\D/g, '');
              const masked = digits.length >= 4
                ? '**** **** **** ' + digits.slice(-4)
                : card.number;
              
              // Get card design image
              const getCardDesignImage = (design) => {
                switch (design) {
                  case 'netscard1': return netscard1;
                  case 'netscard2': return netscard2;
                  case 'netscard3': return netscard3;
                  case 'netscard4': return netscard4;
                  default: return netscard1;
                }
              };
              
                              return (
                  <div className={styles.cardPrimary} key={card.id}>
                  <div style={{display: 'flex', flexDirection: 'column', padding: '1rem 1.3rem'}}>
                    <div className={styles.cardDesignBackground}>
                      <img 
                        src={getCardDesignImage(card.design || 'netscard1')} 
                        alt="Card Design" 
                        className={styles.cardDesignImage}
                      />
                      <div className={styles.cardOverlay}>
                        <div className={styles.cardNumberOverlay}>{masked}</div>
                      </div>
                    </div>
                      <div className={styles.cardContent}>
                        <div className={styles.cardBalanceLabel}>Current Balance</div>
                        <div className={styles.cardBalance}>${Number(card.balance ?? 0).toFixed(2)}</div>
                        </div>
                      </div>
                  <div className={styles.cardButtons}>
                    <button className={styles.cardTopUpBtn} onClick={() => openTopUp(card.id)}>Top Up</button>
                    <button className={styles.deleteCardBtn} onClick={() => handleDeleteCard(card.id)}>Delete</button>
                    </div>
                  </div>
                );
            })}
          </div>
          {isSignedIn && (
            <button className={styles.addCardBtn} onClick={() => setShowAddCard(true)}>＋ Add New Card</button>
          )}
        </section>

        {/* Recent Transactions */}
        <section className={styles.transactionsSection}>
          <div className={styles.transactionsTitle}>Recent Transactions</div>
          <ul className={styles.transactionsList}>
            {sortedTransactions.slice(0, 5).length === 0 && (
              <li className={styles.transaction} style={{justifyContent:'center',color:'#bbb'}}>No transactions yet.</li>
            )}
            {sortedTransactions.slice(0, 5).map(txn => {
              const card = cards.find(c => c.id === txn.card_id);
              const digits = card && card.number ? card.number.replace(/\D/g, '') : '';
              const masked = digits.length >= 4
                ? '**** **** **** ' + digits.slice(-4)
                : card && card.number ? card.number : 'Unknown';
              return (
                <li className={styles.transaction} key={txn.id + '-' + txn.card_id}>
                  <span className={styles.txnIcon + ' ' + (txn.type === 'income' ? styles.income : styles.expense)}>
                    {txn.type === 'income' ? '⬆️' : '⬇️'}
                  </span>
                  <div className={styles.txnDetails}>
                    <div className={styles.txnName}>{txn.name}</div>
                    <div className={styles.txnTime}>{new Date(txn.time).toLocaleString()}</div>
                    <div className={styles.cardNumber} style={{fontSize:'0.85rem',color:'#888'}}>Card: {masked}</div>
                  </div>
                  <div className={styles.txnAmount + ' ' + (txn.type === 'income' ? styles.income : styles.expense)}>
                    {txn.amount > 0 ? '+' : ''}${Math.abs(txn.amount).toFixed(2)}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {!isSignedIn && (
          <div style={{padding:'1rem',textAlign:'center',color:'#888',fontSize:'0.9rem',marginTop:'1rem'}}>
            Demo mode - <button style={{color:'var(--primary)',background:'none',border:'none',fontWeight:600,cursor:'pointer'}} onClick={onProfileClick}>sign in</button> for real data
          </div>
        )}
      </div>

      <CardFormModal
        open={showAddCard}
        onClose={() => setShowAddCard(false)}
        onSubmit={handleAddCard}
        isEdit={false}
      />

      <Modal open={!!topUpCardId} onClose={closeTopUp}>
        <form onSubmit={handleTopUp} style={{display:'flex',flexDirection:'column',gap:'1rem',padding:'1rem',minWidth:220}}>
          <div style={{fontWeight:600,fontSize:'1.1rem'}}>Top Up Card</div>
          <input
            type="number"
            min="1"
            step="0.01"
            value={topUpAmount}
            onChange={e => setTopUpAmount(e.target.value)}
            placeholder="Enter amount"
            style={{padding:'0.7rem 1rem',borderRadius:8,border:'1.5px solid #e0e0f0',fontSize:'1rem'}}
            required
          />
          <button type="submit" className={styles.modalTopUpBtn}>Top Up</button>
        </form>
      </Modal>

      {/* Card Selection Modal for Smart Shortcut Top Up */}
      <Modal open={showCardSelectionModal} onClose={closeCardSelectionModal}>
        <div style={{display:'flex',flexDirection:'column',gap:'1rem',padding:'1rem',minWidth:280}}>
          <div style={{fontWeight:600,fontSize:'1.1rem'}}>Select Card to Top Up</div>
          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem'}}>
            {cards.map(card => {
              const masked = card.number.replace(/\d(?=\d{4})/g, '*');
              return (
                <button
                  key={card.id}
                  onClick={() => selectCardForTopUp(card.id)}
                  style={{
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center',
                    padding:'0.8rem 1rem',
                    border:'1.5px solid #e0e0f0',
                    borderRadius:8,
                    background:'#fff',
                    cursor:'pointer',
                    fontSize:'0.9rem',
                    transition:'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.borderColor = '#7b5cff'}
                  onMouseLeave={(e) => e.target.style.borderColor = '#e0e0f0'}
                >
                  <span style={{fontWeight:500}}>Card ending in {card.number.slice(-4)}</span>
                  <span style={{color:'#666'}}>${Number(card.balance || 0).toFixed(2)}</span>
                </button>
              );
            })}
          </div>
          <button 
            onClick={closeCardSelectionModal}
            style={{
              background:'#f8f9fa',
              color:'#666',
              border:'1.5px solid #e0e0f0',
              borderRadius:8,
              padding:'0.7rem 1.5rem',
              fontWeight:600,
              fontSize:'1rem',
              cursor:'pointer',
              marginTop:'0.5rem'
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>

      <SendMoneyModal
        open={showSendMoney}
        onClose={() => setShowSendMoney(false)}
        cards={cards}
        onSend={handleSendMoney}
      />

      <PaymentGame
        open={showPaymentGame}
        onClose={() => setShowPaymentGame(false)}
        recipient={paymentData?.recipient}
        card={paymentData?.card}
        amount={paymentData?.amount}
        onPaymentComplete={handlePaymentComplete}
      />

      <SplitBillChoiceModal open={showSplitBillChoice} onClose={() => setShowSplitBillChoice(false)} setShowSplitBillQR={setShowSplitBillQR} setShowSplitBill={setShowSplitBill} setSplitBillAmount={setSplitBillAmount} />
      <QrScanModal
        open={showSplitBillQR}
        onClose={() => setShowSplitBillQR(false)}
        onScanSuccess={amount => {
          setSplitBillAmount(amount);
          setShowSplitBillQR(false);
          setShowSplitBill(true);
        }}
      />
      <SplitBillModal open={showSplitBill} onClose={() => setShowSplitBill(false)} payer={user?.username || 'User'} payerEmail={user?.email || 'noemail@example.com'} cards={cards} setCards={setCards} setTransactions={setTransactions} amount={splitBillAmount} />

      <BalanceDetailsModal 
        open={showBalanceDetailsModal} 
        onClose={() => setShowBalanceDetailsModal(false)} 
        cards={cards}
      />
      
      <TransactionsModal
        open={showTransactionsModal}
        onClose={() => setShowTransactionsModal(false)}
        transactions={sortedTransactions}
        cards={cards}
      />

        {/* Game Modal */}
        {showGame && (
          <Modal open={showGame} onClose={handleGameClose}>
            <GameContainer 
              onGameComplete={handleGameComplete}
              userCredits={0}
              onGameScoreUpdate={() => {}}
              initialGame={currentGame}
            />
          </Modal>
        )}

                  {/* Quick Send Modal */}
          <Modal open={showQuickSendModal} onClose={closeQuickSendModal}>
            <div 
              onClick={e => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 50%, #fff5f5 100%)',
                borderRadius: '20px',
                padding: '2rem',
                minWidth: '350px',
                maxWidth: '400px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                border: '2px solid #e5e7eb',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Background Pattern */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(239, 68, 68, 0.1) 0%, transparent 50%)',
                pointerEvents: 'none'
              }} />
              
              {/* Close Button */}
              <button 
                onClick={closeQuickSendModal}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  color: '#6b7280',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#ef4444';
                  e.target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#f3f4f6';
                  e.target.style.color = '#6b7280';
                }}
              >
                ✕
              </button>
            
            <form onSubmit={handleQuickSendSubmit} style={{position: 'relative', zIndex: 5}}>
                             {/* Title */}
               <div style={{
                 textAlign: 'center',
                 marginBottom: '1.5rem'
               }}>
                 <div style={{
                   fontSize: '1.5rem',
                   fontWeight: '700',
                   color: '#1f2937',
                   marginBottom: '0.5rem'
                 }}>
                   🚀 Quick Send
                 </div>
                 <div style={{
                   fontSize: '1.1rem',
                   color: '#6b7280',
                   fontWeight: '500'
                 }}>
                   to {selectedRecipient?.name}
                 </div>
               </div>
              
                             {/* Recipient Card */}
               <div style={{
                 background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                 borderRadius: '16px',
                 padding: '1.2rem',
                 marginBottom: '1.5rem',
                 border: '1px solid #e5e7eb',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '1rem',
                 boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
               }}>
                <div style={{
                  position: 'relative'
                }}>
                  <img 
                    src={selectedRecipient?.photo} 
                    alt={selectedRecipient?.name} 
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }} 
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    background: '#4CAF50',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    color: 'white',
                    border: '2px solid white'
                  }}>
                    ✓
                  </div>
                </div>
                <div>
                  <div style={{
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: 'white',
                    marginBottom: '0.2rem'
                  }}>
                    {selectedRecipient?.name}
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    color: 'rgba(255,255,255,0.8)'
                  }}>
                    Ready to receive payment
                  </div>
                </div>
              </div>
              
                             {/* Amount Input */}
               <div style={{marginBottom: '1.5rem'}}>
                 <label style={{
                   display: 'block',
                   fontSize: '0.9rem',
                   fontWeight: '600',
                   color: '#374151',
                   marginBottom: '0.5rem'
                 }}>
                   💰 Amount to Send
                 </label>
                 <input
                   type="number"
                   min="1"
                   step="0.01"
                   value={quickSendAmount}
                   onChange={e => setQuickSendAmount(e.target.value)}
                   placeholder="Enter amount"
                   style={{
                     width: '100%',
                     padding: '1rem',
                     borderRadius: '12px',
                     border: '2px solid #e5e7eb',
                     fontSize: '1.1rem',
                     background: 'white',
                     color: '#1f2937',
                     outline: 'none',
                     transition: 'all 0.3s ease'
                   }}
                   onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                   onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                   required
                 />
               </div>
              
                              {/* Card Selection */}
                <div style={{marginBottom: '1.5rem'}}>
                  {console.log('Current quickSendCardId:', quickSendCardId)}
                  <label style={{
                    display: 'block',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#374151',
                    marginBottom: '0.8rem'
                  }}>
                    💳 Select Payment Card (Current: {quickSendCardId})
                  </label>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.8rem'
                }}>
                  {cards.map(card => (
                                         <label 
                       key={card.id} 
                       style={{
                         display: 'flex',
                         alignItems: 'center',
                         gap: '0.8rem',
                         cursor: 'pointer',
                         padding: '0.8rem',
                         borderRadius: '12px',
                         background: quickSendCardId === card.id ? '#eff6ff' : '#f9fafb',
                         border: quickSendCardId === card.id ? '2px solid #3b82f6' : '2px solid #e5e7eb',
                         transition: 'all 0.3s ease'
                       }}
                       onMouseEnter={(e) => {
                         if (quickSendCardId !== card.id) {
                           e.target.style.background = '#f0f9ff';
                           e.target.style.borderColor = '#93c5fd';
                         }
                       }}
                       onMouseLeave={(e) => {
                         if (quickSendCardId !== card.id) {
                           e.target.style.background = '#f9fafb';
                           e.target.style.borderColor = '#e5e7eb';
                         }
                       }}
                     >
                                             <input
                         type="radio"
                         name="quickSendCard"
                         value={card.id}
                         checked={quickSendCardId === card.id}
                         onChange={e => {
                           console.log('Card selected:', e.target.value);
                           setQuickSendCardId(e.target.value);
                         }}
                         style={{
                           margin: 0,
                           width: '18px',
                           height: '18px',
                           accentColor: '#4CAF50'
                         }}
                       />
                                             <div style={{flex: 1}}>
                         <div style={{
                           fontSize: '1rem',
                           fontWeight: '600',
                           color: '#1f2937',
                           marginBottom: '0.2rem'
                         }}>
                           Card ending in {card.number.slice(-4)}
                         </div>
                         <div style={{
                           fontSize: '0.9rem',
                           color: '#6b7280'
                         }}>
                           Balance: ${Number(card.balance || 0).toFixed(2)}
                         </div>
                       </div>
                                             {quickSendCardId === card.id && (
                         <div style={{
                           color: '#3b82f6',
                           fontSize: '1.2rem',
                           fontWeight: 'bold'
                         }}>
                           ✓
                         </div>
                       )}
                    </label>
                  ))}
                </div>
              </div>
              
                             {/* Send Button */}
               <button 
                 type="submit" 
                 style={{
                   width: '100%',
                   padding: '1.2rem',
                   borderRadius: '16px',
                   border: 'none',
                   background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                   color: 'white',
                   fontSize: '1.2rem',
                   fontWeight: '700',
                   cursor: 'pointer',
                   transition: 'all 0.3s ease',
                   boxShadow: '0 8px 20px rgba(239, 68, 68, 0.3)',
                   textTransform: 'uppercase',
                   letterSpacing: '0.5px'
                 }}
                 onMouseEnter={(e) => {
                   e.target.style.transform = 'translateY(-2px)';
                   e.target.style.boxShadow = '0 12px 25px rgba(239, 68, 68, 0.4)';
                 }}
                 onMouseLeave={(e) => {
                   e.target.style.transform = 'translateY(0)';
                   e.target.style.boxShadow = '0 8px 20px rgba(239, 68, 68, 0.3)';
                 }}
               >
                 🚀 Send Payment
       </button>
            </form>
          </div>
        </Modal>

        {/* Avatar Payment Game Modal */}
        {showAvatarPaymentGame && (
          <AvatarPaymentGame
            open={showAvatarPaymentGame}
            onClose={() => setShowAvatarPaymentGame(false)}
            recipient={selectedRecipient}
            card={cards.find(card => card.id === quickSendCardId)}
            amount={parseFloat(quickSendAmount)}
            onPaymentComplete={handleAvatarPaymentComplete}
            isQuickSend={true}
            availableCards={cards}
            message=""
            availableRecipients={[]}
          />
        )}
    </div>
  );
} 

