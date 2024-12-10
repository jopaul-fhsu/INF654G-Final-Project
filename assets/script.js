// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-auth.js";
// Import Firestore
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-firestore.js";

let app;
let auth;
let db;

fetch('./firebaseConfig.json')
    .then((response) => {
        if (!response.ok) {
            throw new Error("Failed to fetch Firebase configuration");
        }
        return response.json();
    })
    .then((firebaseConfig) => {
        // Initialize Firebase with the config from JSON file
        const  app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        console.log("Firebase initialized successfully.");
    })
    .catch((error) => {
        console.error("Error loading Firebase config:", error.message);
    });

// DOM Elements
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const forgotPasswordBtn = document.getElementById('forgot-password');



// Toggle Forms
document.getElementById('show-register').addEventListener('click', () => {
  loginForm.classList.add('hide');
  registerForm.classList.remove('hide');
});

document.getElementById('show-login').addEventListener('click', () => {
  registerForm.classList.add('hide');
  loginForm.classList.remove('hide');
});

// Login
loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  if (!email || !password) {
    showBanner('Please fill all inputs', 'red');
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    showBanner('Login successful!', 'green');
    setTimeout(() => window.location.href = 'index.html', 1000);
  } catch (error) {
    showBanner('Invalid Email or Password', 'red');
  }
});

const defaultContacts = [
    {
        idx: '1',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+123456789',
        email: 'john.doe@example.com',
        notes: 'Default contact',
        category: 'Personal',
    },
    {
        idx: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '+987654321',
        email: 'jane.smith@example.com',
        notes: 'Default contact',
        category: 'Personal',
    },
    {
        idx: '3',
        firstName: 'Alice',
        lastName: 'Johnson',
        phone: '+112233445',
        email: 'alice.johnson@example.com',
        notes: 'Default contact',
        category: 'Personal',
    },
];

// Registration
registerBtn.addEventListener('click', async () => {
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (!email || !password || !confirmPassword) {
    showBanner('Please fill all inputs', 'red');
    return;
  }

  if (password.length < 4) {
    showBanner('Login failed. Please check your credentials.', 'red');
    return;
  }

  if (password !== confirmPassword) {
    showBanner('Password Incorrect', 'red');
    return;
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const userUid = userCredential.user.uid;

    showBanner('Registration successful!', 'green');

    // Add default contacts to Firestore
    await addDefaultContacts(userUid);

    setTimeout(() => window.location.href = 'index.html', 1000);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      showBanner('This email is already registered. Please login.', 'red');
    } else {
      showBanner('Registration failed. Please try again.', 'red');
    }
  }
});

// Function to Add Default Contacts to Firestore
async function addDefaultContacts(userUid) {
  const userContactsCollection = collection(db, `users/${userUid}/contacts`);

  for (const contact of defaultContacts) {
    try {
      await addDoc(userContactsCollection, { ...contact, isDefault: true });
    } catch (error) {
      console.error("Error adding default contact:", error.message);
    }
  }

  console.log('Default contacts added successfully.');
}

 // Ensure the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Materialize Modal
    const elems = document.querySelectorAll('.modal');
    M.Modal.init(elems);
  
    // Get references to elements
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const sendResetEmailBtn = document.getElementById('send-reset-email');
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  
    if (forgotPasswordBtn) {
      // Forgot Password Button Event Listener
      forgotPasswordBtn.addEventListener('click', () => {
        const modalInstance = M.Modal.getInstance(forgotPasswordModal);
        modalInstance.open();
      });
    }
  
    if (sendResetEmailBtn) {
      // Send Reset Email Event Listener
      sendResetEmailBtn.addEventListener('click', async () => {
        const emailInput = document.getElementById('forgot-email');
        const email = emailInput.value.trim();
  
        if (!email) {
          showBanner('Email is required.', 'red');
          return;
        }
  
        try {
          // Send password reset email
          await sendPasswordResetEmail(auth, email);
          showBanner('Password reset email sent!', 'green');
        } catch (error) {
          showBanner(error.message, 'red');
        }
      });
    }
  });


// Function to show the banner with specified message and color
function showBanner(message, colorClass) {
    const banner = document.getElementById('status-banner');
    banner.innerText = message;
    banner.className = `status-banner ${colorClass}`; // Add color class (green or red)
    banner.style.display = 'block';
  
    // Hide banner after 2 seconds
    setTimeout(() => {
      banner.style.display = 'none';
    }, 3000);
  }