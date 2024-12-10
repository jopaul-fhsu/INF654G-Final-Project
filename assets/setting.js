import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-app.js";
import { getAuth, updateEmail, sendEmailVerification,reauthenticateWithCredential, EmailAuthProvider, updatePassword, onAuthStateChanged, signOut  } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-auth.js";

let auth;

fetch('./firebaseConfig.json')
  .then(response => response.json())
  .then(config => {
    const app = initializeApp(config);
    auth = getAuth(app);
    console.log("Firebase initialized.");

    // Check Authentication State after auth is initialized
    onAuthStateChanged(auth, (user) => {
      if (user) {
        // Extract username
        const username = getUsernameFromEmail(user.email);
        // Display username in the UI
        const usernameDisplay = document.getElementById('username-display');
        if (usernameDisplay) {
          usernameDisplay.textContent = `Welcome, ${username}!`;
        }
        // User is logged in
        console.log('Logged-in user:', user.email);
      } else {
        // User is not logged in, redirect to login page
        window.location.href = 'login.html';
      }
    });
  })
  .catch(error => {
    console.error("Error loading Firebase config:", error);
  });
// Function to extract username from email
function getUsernameFromEmail(email) {
    return email.split('@')[0];
  }
// Initialize Materialize Modal
document.addEventListener('DOMContentLoaded', () => {
  const modals = document.querySelectorAll('.modal');
  M.Modal.init(modals);
});

  // Logout Functionality
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await signOut(auth);
      console.log('User logged out');
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Error logging out:', error.message);
    }
  });


// Show Tabs
document.getElementById('change-email-btn').addEventListener('click', () => {
  document.getElementById('email-tab').style.display = 'block';
  document.getElementById('password-tab').style.display = 'none';
});

document.getElementById('change-password-btn').addEventListener('click', () => {
  document.getElementById('email-tab').style.display = 'none';
  document.getElementById('password-tab').style.display = 'block';
});

// Show Success Modal
function showModal(message) {
  const modalMessage = document.getElementById('modal-message');
  modalMessage.innerText = message;
  const modal = M.Modal.getInstance(document.getElementById('success-modal'));
  modal.open();
}
//password
function showModalPass(content, isSuccess = true) {
    const modal = document.getElementById('success-modalPass');
    const modalContent = modal.querySelector('.modal-content');
    const title = isSuccess ? 'Success' : 'Error';
  
    modalContent.innerHTML = `
      <h5 class="center-align">${title}</h5>
      ${content}
    `;
  
    const instance = M.Modal.getInstance(modal);
    instance.open();
  }
  

// Function to open the password reauthentication modal
function openReauthModal() {
    return new Promise((resolve, reject) => {
      const modalInstance = M.Modal.getInstance(document.getElementById('password-modal'));
      const passwordInput = document.getElementById('reauth-password');
      const confirmBtn = document.getElementById('reauth-confirm-btn');
      const cancelBtn = document.getElementById('reauth-cancel-btn');
  
      // Clear any existing password input
      passwordInput.value = '';
  
      // Open the modal
      modalInstance.open();
  
      // Handle confirm button click
      confirmBtn.onclick = () => {
        const password = passwordInput.value.trim();
        if (!password) {
          M.toast({ html: 'Password is required!', classes: 'red' });
          return;
        }
        modalInstance.close();
        resolve(password);
      };
  
      // Handle cancel button click
      cancelBtn.onclick = () => {
        modalInstance.close();
        reject(new Error('Reauthentication canceled by the user.'));
      };
    });
  }
  
  // Function to handle email change process
  async function handleEmailChange() {
    const newEmail = document.getElementById('new-email').value.trim();
    if (!newEmail) {
      showModal('Please enter a new email address.');
      return;
    }
  
    const user = auth.currentUser;
  
    try {
      // Open the reauthentication modal and get the password
      const password = await openReauthModal();
      const credential = EmailAuthProvider.credential(user.email, password);
  
      // Reauthenticate the user
      await reauthenticateWithCredential(user, credential);
  
      // Update the email
      await updateEmail(user, newEmail);
  
      // Send verification email to the new email
      await sendEmailVerification(user);
  
      showModal('Email has been changed successfully. Please verify your new email.');
  
      // Sign the user out and redirect to the login page
      setTimeout(() => {
        showModal('Please verify your new email before logging in again.');
        // signOut(auth);
        window.location.href = 'login.html';
      }, 3000);
  
    } catch (error) {
      // Handle errors such as incorrect password, email already in use, etc.
      showModal(`Error: ${error.message}`);
    }
  }
  
  // Event listener for the save email button
  document.getElementById('save-email-btn').addEventListener('click', handleEmailChange);

  
  document.addEventListener('DOMContentLoaded', () => {
    const savePasswordBtn = document.getElementById('save-password-btn');
  
    if (savePasswordBtn) {
      savePasswordBtn.addEventListener('click', async () => {
        const oldPasswordInput = document.getElementById('old-password');
        const newPasswordInput = document.getElementById('new-password');
        const confirmPasswordInput = document.getElementById('confirm-password');
  
        const oldPassword = oldPasswordInput.value.trim();
        const newPassword = newPasswordInput.value.trim();
        const confirmPassword = confirmPasswordInput.value.trim();
  
        if (!oldPassword || !newPassword || !confirmPassword) {
            showModalPass('<p>All fields are required.</p>', false);
          return;
        }
  
        if (newPassword !== confirmPassword) {
            showModalPass('<p>New passwords do not match.</p>', false);
          return;
        }
  
        try {
          const credential = EmailAuthProvider.credential(auth.currentUser.email, oldPassword);
          await reauthenticateWithCredential(auth.currentUser, credential);
          await updatePassword(auth.currentUser, newPassword);
  
          // Clear input fields
          oldPasswordInput.value = '';
          newPasswordInput.value = '';
          confirmPasswordInput.value = '';
  
          // Show success modal with the new password
          const modalContent = `
            <p>Your password has been updated successfully!</p>
            <p><strong>New Password:</strong> <span id="new-password-value" class="blue-text">${newPassword}</span></p>
            <div class="center-align">
              <button id="copy-password-btn" class="btn-small blue lighten-1 white-text">Copy Password</button>
            </div>
          `;
          showModalPass(modalContent);
  
          // Add functionality to copy the new password
          const copyPasswordBtn = document.getElementById('copy-password-btn');
          if (copyPasswordBtn) {
            copyPasswordBtn.addEventListener('click', () => {
              navigator.clipboard.writeText(newPassword).then(() => {
                M.toast({ html: 'New password copied to clipboard!', classes: 'green' });
              }).catch((err) => {
                M.toast({ html: 'Failed to copy password: ' + err.message, classes: 'red' });
              });
            });
          }
        } catch (error) {
            showModalPass(`<p>Error: ${error.message}</p>`, false);
        }
      });
    }
  });
  