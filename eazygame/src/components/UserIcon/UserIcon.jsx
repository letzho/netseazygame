import React from 'react';
import styles from './UserIcon.module.css';

const UserIcon = ({ 
  isSignedIn = false, 
  user = null,
  onProfileClick,
  size = 'medium',
  className = '' 
}) => {
  const username = user?.name || user?.username || 'User';

  return (
    <div className={styles.userIconContainer}>
      <div 
        className={`${styles.userIcon} ${styles[size]} ${styles[isSignedIn ? 'signedIn' : 'signedOut']} ${className}`}
        onClick={onProfileClick}
        title={`User is ${isSignedIn ? 'signed in' : 'signed out'}`}
      >
        <span className={styles.userEmoji}>👤</span>
      </div>
    </div>
  );
};

export default UserIcon;
