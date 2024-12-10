if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
        .then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
            console.log('Service Worker registration failed:', error);
        });
    });
}
let contacts = []; 

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.17.2/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc,onSnapshot  } from 'https://www.gstatic.com/firebasejs/9.17.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.17.2/firebase-auth.js";

let app;
let db;
let firebaseDb;
let firestoreDB;
let auth;
fetch('./firebaseConfig.json')
    .then((response) => {
        if (!response.ok) {
            throw new Error("Failed to fetch Firebase configuration");
        }
        return response.json();
    })
    .then((firebaseConfig) => {
       
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);          
        firebaseDb = getFirestore(app);  
        firestoreDB = getFirestore(app); 
        auth = getAuth(app);     

        console.log("Firebase initialized successfully.");
        setupRealTimeListener();
        // console.log("Firestore DB:", db);
        // console.log("Auth:", auth);
          // Set up the authentication state listener
          onAuthStateChanged(auth, (user) => {
            if (user) {
                const previousUid = userUid;
                userUid = user.uid; 
                localStorage.setItem("userUid", user.uid);
                // console.log('Logged-in user UID:', userUid);
                setupRealTimeListener();
                // Load user-specific contacts
                if (previousUid !== userUid) {
                    console.log('User UID changed. Reloading contacts...');
                    loadContacts();
                }

                // Extract username
                const username = getUsernameFromEmail(user.email);

                // Display username in the UI
                const usernameDisplay = document.getElementById('username-display');
                if (usernameDisplay) {
                    usernameDisplay.textContent = `Welcome, ${username}!`;
                }

                console.log('Logged-in user:', user.email);
            } else {
                // Handle logged-out state
                localStorage.removeItem('userUid');
                console.log("User not logged in. Redirecting to login page.");
                window.location.href = 'login.html';
            }
        });
    })
    .catch((error) => {
        console.error("Error loading Firebase config:", error.message);
    });

// Function to extract username from email
function getUsernameFromEmail(email) {
    return email.split('@')[0];
  }

  let userUid = null;

  
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

let dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('contactsDB', 1);

    request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create 'offlineContacts' object store if it doesn't exist
        if (!db.objectStoreNames.contains('offlineContacts')) {
            db.createObjectStore('offlineContacts', { autoIncrement: true });
        }

        // Create 'contacts' object store if it doesn't exist
        if (!db.objectStoreNames.contains('contacts')) {
            db.createObjectStore('contacts', { keyPath: 'id', autoIncrement: true });
        }
    };

    request.onsuccess = (event) => {
        console.log("Database initialized successfully.");
        resolve(event.target.result); // Resolve with the database instance
    };

    request.onerror = (event) => {
        console.error("Database initialization failed:", event.target.error);
        reject(event.target.error);
    };
});


async function loadContacts() {
    console.log("Loading contacts...");
    const contactListDiv = document.getElementById('contact-list');
    contactListDiv.innerHTML = ''; // Clear previous list

    if (navigator.onLine) {
        console.log("Online: Fetching contacts from Firebase...");
        try {
            await clearIndexedDBContacts();
            const userUid = localStorage.getItem("userUid");
            console.log(userUid);
            const userContactsCollection = collection(db, `users/${userUid}/contacts`);
            const snapshot = await getDocs(userContactsCollection);
            console.log("Snapshot size:", snapshot.size);
           
            const firebaseContacts = [];
           
            snapshot.forEach(doc => {
                // console.log("Document data:", doc.data());
                const contact = { idx: doc.id, ...doc.data() };
                // console.log("Fetched contact from Firebase:", contact);
               
                firebaseContacts.push(contact);
                saveContactToIndexedDB(contact);
            });
            displayContacts(firebaseContacts);
            
        } catch (error) {
            // console.error("Error fetching contacts from Firebase:", error);
        }
    } else {
        console.log("Offline: Fetching contacts from IndexedDB...");
        try {
            const offlineContacts = await getContactsFromIndexedDB();
            console.log("Offline contacts retrieved:", offlineContacts);
            if (offlineContacts.length > 0) {
                displayContacts(offlineContacts);
            } else {
                console.warn("No contacts found in IndexedDB.");
                contactListDiv.innerHTML = '<p>No contacts available offline.</p>';
            }
        } catch (error) {
            console.error("Error fetching contacts from IndexedDB:", error);
        }
    }
}


// Function to clear all contacts from IndexedDB
async function clearIndexedDBContacts() {
    try {
        const db = await dbPromise;
        const tx = db.transaction('contacts', 'readwrite');
        const store = tx.objectStore('contacts');
        await store.clear(); // Clear all records in the object store
        await tx.complete;
        console.log('IndexedDB contacts cleared successfully.');
    } catch (error) {
        console.error('Error clearing IndexedDB contacts:', error);
    }
}


// Save a contact to IndexedDB with a valid ID (idx or auto-generated)
async function saveContactToIndexedDB(contact) {
    const db = await dbPromise;  // Wait for IndexedDB to be ready
    const transaction = db.transaction('contacts', 'readwrite');
    const store = transaction.objectStore('contacts');
      // Ensure that the contact has an `id` field
      if (!contact.id) {
        contact.id = generateUniqueId();  // Generate an ID if not available
    }
    
    // If `id` exists (Firebase ID) use it; otherwise, let IndexedDB handle it
    if (contact.id) {
        store.put(contact);  // Update or insert the contact with Firebase ID
    } else {
        store.add(contact);  // Add a new contact (IndexedDB will auto-generate the ID)
    }
    
    await transaction.done;  // Wait for the transaction to complete
}

async function getContactsFromIndexedDB() {
    try {
        const db = await dbPromise;

        if (!db) {
            throw new Error("IndexedDB is not initialized.");
        }

        const transaction = db.transaction('contacts', 'readonly');
        const store = transaction.objectStore('contacts');
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                console.log('Contacts retrieved from IndexedDB:', request.result);
                resolve(request.result); // Resolve with the result array
            };
            request.onerror = () => {
                console.error('Error retrieving contacts from IndexedDB:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error("Error accessing IndexedDB:", error);
        return [];
    }
}


// Remove contact from Firebase Firestore
async function removeContactFromFirebase(contactId) {
    try {
        if (!contactId) {
            console.error('No valid contact ID provided for deletion.');
            return;
        }
        const userUid = localStorage.getItem("userUid");
        const userContactsCollection = collection(db, `users/${userUid}/contacts`);
        const contactRef = doc(userContactsCollection, contactId);
        // const contactRef = doc(db, 'contacts', contactId);  // Get the document reference by its Firebase ID
        await deleteDoc(contactRef);  // Delete the document from Firestore
        console.log(`Contact with ID ${contactId} deleted from Firebase.`);
    } catch (error) {
        console.error('Error deleting contact from Firebase:', error);
    }
}

// Removing contact from IndexedDB
async function removeContactFromIndexedDB(contactId) {
    const db = await dbPromise;
    const transaction = db.transaction("offlineContacts", "readwrite");
    const store = transaction.objectStore("offlineContacts");

    const deleteRequest = store.delete(contactId);
    deleteRequest.onsuccess = () => {
        console.log(`Contact with ID ${contactId} removed from IndexedDB.`);
    };
    deleteRequest.onerror = (event) => {
        console.error("Error deleting contact from IndexedDB:", event.target.error);
    };
}
// Removing contact from Firebase and IndexedDB
async function removeContact(contactId) {
    try {
        // Attempt to delete from Firebase if online
        if (navigator.onLine) {
            await removeContactFromFirebase(contactId);
        }

        // Delete from IndexedDB using contactId
        await removeContactFromIndexedDB(contactId);

        // Reload the contact list after deletion
        loadContacts();

        console.log(`Contact with ID ${contactId} deleted from both Firebase and IndexedDB.`);
    } catch (error) {
        alert("Error during contact deletion:", error);
    }
}


async function getContactByIdFromIndexedDB(contactId) {
    const db = await dbPromise;
    const transaction = db.transaction('contacts', 'readonly');
    const store = transaction.objectStore('contacts');
    
    return new Promise((resolve, reject) => {
        const request = store.get(contactId); // Get the contact by its ID
        request.onsuccess = (event) => {
            const contact = event.target.result;
            if (contact) {
                resolve(contact); // Return the contact if found
            } else {
                reject(new Error('Contact not found'));
            }
        };
        request.onerror = (event) => {
            reject(new Error('Error retrieving contact: ' + event.target.error));
        };
    });
}


window.editContact = editContact;
// Function to edit a contact
async function editContact(contactId) {
    try {
        console.log("Attempting to edit contact with ID:", contactId); // Log the contactId being passed
        const contact = await getContactByIdFromIndexedDB(contactId);  // Retrieve the contact

        console.log("Contact retrieved:", contact);  // Log the retrieved contact

        if (!contact) {
            console.error("Contact not found in IndexedDB:", contactId);
            return;
        }

        // Populate form fields with contact info
        document.getElementById('category').value = contact.category || '';
        document.getElementById('first-name').value = contact.firstName || '';
        document.getElementById('last-name').value = contact.lastName || '';
        document.getElementById('email').value = contact.email || '';
        document.getElementById('phone').value = contact.phone || '';
        document.getElementById('notes').value = contact.notes || '';

        // Re-initialize Materialize select dropdown (if required)
        const categorySelect = document.getElementById('category');
        if (categorySelect) {
            M.FormSelect.init(categorySelect);
        }
        isEditing = true;
        currentEditId = contactId;
        currentFirebaseDocId = contact.idx;
        // Open the modal to edit the contact
        M.Modal.getInstance(document.getElementById('add-contact-modal')).open();
    } catch (error) {
        console.error("Error editing contact:", error);
    }
}
     

// Editing and deleting contact functionality
let isEditing = false;
let currentEditId = null;
let currentFirebaseDocId = null;
let newid = null;
async function addOrUpdateContact() {
    if (!userUid) {
        console.error("User not authenticated. Cannot add or update contact.");
        return;
    }
    // Get the contact ID (either from the editing state or generate a new one if adding)
    const contactId = currentEditId; // The contact ID when editing, or a new ID if adding
    const firebaseDocId = currentFirebaseDocId; // Use the `idx` as the Firebase document ID (if editing)

    // Prepare the contact object
    const contact = {
        id: contactId,
        category: document.getElementById('category').value,
        firstName: document.getElementById('first-name').value,
        lastName: document.getElementById('last-name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        notes: document.getElementById('notes').value,
    };

    try {
        const userContactsCollection = collection(db, `users/${userUid}/contacts`);
        if (navigator.onLine) {
            // Online: Either update an existing contact or add a new one
            if (isEditing && firebaseDocId) {
                // Editing: Update the existing contact in Firebase
                await updateDoc(doc(userContactsCollection, firebaseDocId), contact);

                // Also sync the updated contact to IndexedDB
                await saveContactToIndexedDB(contact); // This keeps IndexedDB in sync with Firebase
            } else {
                // Adding a new contact to Firebase
                const docRef = await addDoc(userContactsCollection, contact);
                contact.id = docRef.id; // Use Firebase generated ID
                
                // Generate a unique ID for offline IndexedDB storage
                const newContact = {
                    id:docRef.id,
                    idx: generateUniqueId(), // Generate a new unique ID for IndexedDB
                    category: document.getElementById('category').value,
                    firstName: document.getElementById('first-name').value,
                    lastName: document.getElementById('last-name').value,
                    email: document.getElementById('email').value,
                    phone: document.getElementById('phone').value,
                    notes: document.getElementById('notes').value
                };

                // Save the newly added contact to IndexedDB
                await saveContactToIndexedDB(newContact);
            }
        } else {
            if (!contact.id) {
                contact.id = generateUniqueId(); // Generate a unique ID for offline storage
            }
              // Generate a unique ID for offline IndexedDB storage
              const offContact = {
                idx: generateUniqueId(), // Generate a new unique ID for IndexedDB
                category: document.getElementById('category').value,
                firstName: document.getElementById('first-name').value,
                lastName: document.getElementById('last-name').value,
                email: document.getElementById('email').value,
                phone: document.getElementById('phone').value,
                notes: document.getElementById('notes').value
            };
            // Offline: Save to IndexedDB if offline (for future sync)
            await saveContactToOfflineIndexedDB(contact);
        }

        // Reset the editing state and IDs
        isEditing = false;
        currentEditId = null;
        currentFirebaseDocId = null;

        // Reload contacts to refresh the contact list UI
        loadContacts();

        // Reset the form and close the modal
        document.getElementById('contact-form').reset();
        M.Modal.getInstance(document.getElementById('add-contact-modal')).close();
        
    } catch (error) {
        console.error("Error adding/updating contact:", error);
    }
}


function generateUniqueId() {
    return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
}

async function saveContactToOfflineIndexedDB(contact) {
    const db = await dbPromise; // Ensure IndexedDB is initialized
    const tx = db.transaction('offlineContacts', 'readwrite'); // Open a transaction on 'offlineContacts'
    const store = tx.objectStore('offlineContacts'); // Get the store

    // Check if the contact already exists in IndexedDB by its ID
    const existingContact = await store.get(contact.id);

    if (existingContact) {
        // If it exists, update the existing contact
        await store.put(contact);
        console.log(`Updated contact with ID ${contact.id} in IndexedDB.`);
    } else {
        // If it doesn't exist, add the new contact
        await store.add(contact);
        console.log(`Added new contact with ID ${contact.id} to IndexedDB.`);
    }

    await tx.complete; // Wait for the transaction to complete
}


async function syncOfflineChangesToFirebase() {
    try {
        const indexedDB = await dbPromise;
        const transaction = indexedDB.transaction('offlineContacts', 'readonly');
        const store = transaction.objectStore('offlineContacts');
        const getAllRequest = store.getAll();

        // Check if the user is logged in and retrieve their UID
        const userUid = localStorage.getItem('userUid'); // Assuming you store UID in localStorage
        if (!userUid) {
            console.error("User not authenticated. Cannot sync offline changes.");
            return;
        }

        getAllRequest.onsuccess = async (event) => {
            const offlineContacts = event.target.result;

            if (offlineContacts.length > 0) {
                for (let contact of offlineContacts) {
                    const userContactsPath = `users/${userUid}/contacts`;
                    const contactRef = doc(firestoreDB, userContactsPath, contact.id);

                    await updateDoc(contactRef, contact) // Update if document exists
                        .catch(async (error) => {
                            console.warn(`Contact with ID ${contact.id} does not exist. Adding new contact.`);
                            // Add a new document if the update fails
                            await addDoc(collection(firestoreDB, userContactsPath), contact);
                        });
                    console.log(`Synced contact with ID ${contact.id} to Firebase under ${userContactsPath}.`);
                }

                // Clear offlineContacts store after successful sync
                const clearTransaction = indexedDB.transaction('offlineContacts', 'readwrite');
                const clearStore = clearTransaction.objectStore('offlineContacts');
                clearStore.clear();
                alert("All offline contacts synced and cleared.");
                loadContacts();
            } else {
                console.log("No offline contacts to sync.");
            }
        };

        getAllRequest.onerror = (event) => {
            console.error("Error reading offline contacts:", event.target.error);
        };
    } catch (error) {
        alert("Error syncing offline contacts to Firebase:", error.message);
    }
}


function displayContacts(contacts) {
    console.log(contacts);
    const contactListDiv = document.getElementById('contact-list');
    contactListDiv.innerHTML = ''; // Clear existing contacts
 // Sort contacts by last name
 contacts.sort((a, b) => a.lastName.localeCompare(b.lastName));

    // Loop through each contact and display it
    contacts.forEach(contact => {
        // Create the main contact card
        const card = document.createElement('div');
        card.className = 'card mb-3';

        const cardContent = `
            <div class="card-content row">
                <div class="col s10">
                    <span class="new badge ${contact.category === 'Business' ? 'blue' : 'green'}"
                          data-badge-caption="">
                        ${contact.category}
                    </span>
                    <span class="card-title">${contact.firstName} ${contact.lastName}</span>
                    <div class="valign-wrapper mb-2">
                        <i class="material-icons blue-text text-lighten-2">phone</i>
                        <span class="mx-3">${contact.phone}</span>
                    </div>
                    <div class="valign-wrapper mb-3">
                        <i class="material-icons blue-text text-lighten-2">email</i>
                        <span class="mx-3">${contact.email}</span>
                    </div>
                    <div class="valign-wrapper mb-2">
                        <i class="material-icons blue-text text-lighten-2">note</i>
                        <span class="mx-3">${contact.notes}</span>
                    </div>
                </div>
            </div>
        `;

        card.innerHTML = cardContent;

        // Conditionally add buttons for non-default contacts
        if (!contact.isDefault) {
            const actionButtons = document.createElement('div');
            actionButtons.className = 'col s2 right-align';

            actionButtons.innerHTML = `
                <i class="material-icons blue-text edit-icon" onclick="editContact('${contact.idx}')">edit</i><br><br>
                <i class="material-icons red-text delete-icon" onclick="removeContact('${contact.idx}')">delete</i>
            `;

            card.querySelector('.row').appendChild(actionButtons);
        }

        contactListDiv.appendChild(card);

        // Attach event listeners for Edit and Delete buttons
        const editIcon = card.querySelector('.edit-icon');
        const deleteIcon = card.querySelector('.delete-icon');

        if (editIcon) {
            editIcon.addEventListener('click', () => editContact(contact.idx));
        }
        if (deleteIcon) {
            deleteIcon.addEventListener('click', () => removeContact(contact.idx));
        }
    });
}



// Call loadContacts on DOM load
document.addEventListener('DOMContentLoaded', () => {
    loadContacts();
    document.getElementById('contact-form').addEventListener('submit', (e) => {
        e.preventDefault();
        addOrUpdateContact();
    });
});


// This will track the current online/offline status
let isOnline = navigator.onLine;

// Listen for changes in network status
window.addEventListener('online', () => {
    isOnline = true;
    console.log("Back online!");
    // You can trigger sync when back online
    syncOfflineChangesToFirebase();
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log("Went offline!");
});



// Search functionality

document.getElementById('search-input').addEventListener('input', () => searchContacts(contacts));
// Fetch contacts from IndexedDB if offline
async function getContactsFromIndexedDBse() {
        return new Promise((resolve, reject) => {
            const openRequest = indexedDB.open("contactsDB", 1);
    
            openRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('contacts')) {
                    db.createObjectStore('contacts', { keyPath: 'id' });
                }
            };
    
            openRequest.onsuccess = (event) => {
                const db = event.target.result;
                const tx = db.transaction('contacts', 'readonly');
                const store = tx.objectStore('contacts');
                const getAllRequest = store.getAll();
    
                getAllRequest.onsuccess = () => {
                    console.log("Contacts retrieved from IndexedDB:", getAllRequest.result);
                    resolve(getAllRequest.result || []);
                };
    
                getAllRequest.onerror = () => {
                    console.error("Error retrieving contacts from IndexedDB.");
                    reject("Failed to retrieve contacts from IndexedDB.");
                };
            };
    
            openRequest.onerror = (event) => {
                console.error("Failed to open IndexedDB:", event.target.error);
                reject("Failed to open IndexedDB.");
            };
        });
    }
    
// Search contacts function, working for both online and offline modes
async function searchContacts() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    let contactsToSearch = [];

    if (navigator.onLine) {
        // Online: Fetch contacts from Firebase
        const userUid = localStorage.getItem("userUid");
        const userContactsCollection = collection(db, `users/${userUid}/contacts`);
        const snapshot = await getDocs(userContactsCollection);
        // const snapshot = await getDocs(collection(db, 'contacts'));
        contactsToSearch = snapshot.docs.map(doc => doc.data());
    } else {
        // Offline: Fetch contacts from IndexedDB
        contactsToSearch = await getContactsFromIndexedDBse();
    }

    // Ensure contactsToSearch is an array
    contactsToSearch = Array.isArray(contactsToSearch) ? contactsToSearch : [];

    // Filter contacts based on search term
    const filteredContacts = contactsToSearch.filter(contact => {
        return (
            (contact.firstName && contact.firstName.toLowerCase().includes(searchTerm)) ||
            (contact.lastName && contact.lastName.toLowerCase().includes(searchTerm)) ||
            (contact.email && contact.email.toLowerCase().includes(searchTerm)) ||
            (contact.notes && contact.notes.toLowerCase().includes(searchTerm))
        );
    });
    
    displayContactsSearch(filteredContacts);
}

// Function to display contacts for search results
function displayContactsSearch(contactsToDisplay) {
        console.log(contacts);
        const contactListDiv = document.getElementById('contact-list');
        contactListDiv.innerHTML = ''; // Clear existing contacts
     // Sort contacts by last name
     contactsToDisplay.sort((a, b) => a.lastName.localeCompare(b.lastName));
    
        // Loop through each contact and display it
        contactsToDisplay.forEach(contact => {
            // Create the main contact card
            const card = document.createElement('div');
            card.className = 'card mb-3';
    
            const cardContent = `
                <div class="card-content row">
                    <div class="col s10">
                        <span class="new badge ${contact.category === 'Business' ? 'blue' : 'green'}"
                              data-badge-caption="">
                            ${contact.category}
                        </span>
                        <span class="card-title">${contact.firstName} ${contact.lastName}</span>
                        <div class="valign-wrapper mb-2">
                            <i class="material-icons blue-text text-lighten-2">phone</i>
                            <span class="mx-3">${contact.phone}</span>
                        </div>
                        <div class="valign-wrapper mb-3">
                            <i class="material-icons blue-text text-lighten-2">email</i>
                            <span class="mx-3">${contact.email}</span>
                        </div>
                        <div class="valign-wrapper mb-2">
                            <i class="material-icons blue-text text-lighten-2">note</i>
                            <span class="mx-3">${contact.notes}</span>
                        </div>
                    </div>
                </div>
            `;
    
            card.innerHTML = cardContent;
    
            // Conditionally add buttons for non-default contacts
            if (!contact.isDefault) {
                const actionButtons = document.createElement('div');
                actionButtons.className = 'col s2 right-align';
    
                actionButtons.innerHTML = `
                    <i class="material-icons blue-text edit-icon" onclick="editContact('${contact.idx}')">edit</i><br><br>
                    <i class="material-icons red-text delete-icon" onclick="removeContact('${contact.idx}')">delete</i>
                `;
    
                card.querySelector('.row').appendChild(actionButtons);
            }
    
            contactListDiv.appendChild(card);
    
            // Attach event listeners for Edit and Delete buttons
            const editIcon = card.querySelector('.edit-icon');
            const deleteIcon = card.querySelector('.delete-icon');
    
            if (editIcon) {
                editIcon.addEventListener('click', () => editContact(contact.idx));
            }
            if (deleteIcon) {
                deleteIcon.addEventListener('click', () => removeContact(contact.idx));
            }
        });
    }


// Call fetchContacts on page load
fetchContacts();


// filter 
document.getElementById('filter-btn').addEventListener('click', () => applyFilter(contacts));

// Display contacts in HTML
function displayContactsfilter(contactList) {
        console.log(contacts);
        const contactListDiv = document.getElementById('contact-list');
        contactListDiv.innerHTML = ''; // Clear existing contacts
     // Sort contacts by last name
     contactList.sort((a, b) => a.lastName.localeCompare(b.lastName));
    
        // Loop through each contact and display it
        contactList.forEach(contact => {
            // Create the main contact card
            const card = document.createElement('div');
            card.className = 'card mb-3';
    
            const cardContent = `
                <div class="card-content row">
                    <div class="col s10">
                        <span class="new badge ${contact.category === 'Business' ? 'blue' : 'green'}"
                              data-badge-caption="">
                            ${contact.category}
                        </span>
                        <span class="card-title">${contact.firstName} ${contact.lastName}</span>
                        <div class="valign-wrapper mb-2">
                            <i class="material-icons blue-text text-lighten-2">phone</i>
                            <span class="mx-3">${contact.phone}</span>
                        </div>
                        <div class="valign-wrapper mb-3">
                            <i class="material-icons blue-text text-lighten-2">email</i>
                            <span class="mx-3">${contact.email}</span>
                        </div>
                        <div class="valign-wrapper mb-2">
                            <i class="material-icons blue-text text-lighten-2">note</i>
                            <span class="mx-3">${contact.notes}</span>
                        </div>
                    </div>
                </div>
            `;
    
            card.innerHTML = cardContent;
    
            // Conditionally add buttons for non-default contacts
            if (!contact.isDefault) {
                const actionButtons = document.createElement('div');
                actionButtons.className = 'col s2 right-align';
    
                actionButtons.innerHTML = `
                    <i class="material-icons blue-text edit-icon" onclick="editContact('${contact.idx}')">edit</i><br><br>
                    <i class="material-icons red-text delete-icon" onclick="removeContact('${contact.idx}')">delete</i>
                `;
    
                card.querySelector('.row').appendChild(actionButtons);
            }
    
            contactListDiv.appendChild(card);
    
            // Attach event listeners for Edit and Delete buttons
            const editIcon = card.querySelector('.edit-icon');
            const deleteIcon = card.querySelector('.delete-icon');
    
            if (editIcon) {
                editIcon.addEventListener('click', () => editContact(contact.idx));
            }
            if (deleteIcon) {
                deleteIcon.addEventListener('click', () => removeContact(contact.idx));
            }
        });
    }

// Function to filter contacts based on selected categories
function applyFilter() {
    const isBusinessChecked = document.getElementById('filter-business').checked;
    const isPersonalChecked = document.getElementById('filter-personal').checked;

    // Filter contacts based on the selected categories
    const filteredContacts = contacts.filter(contact => {
        if (isBusinessChecked && contact.category === 'Business') return true;
        if (isPersonalChecked && contact.category === 'Personal') return true;
        return false;
    });

    // If no filter is selected, show all contacts
    if (!isBusinessChecked && !isPersonalChecked) {
        displayContactsfilter(contacts);
    } else {
        displayContactsfilter(filteredContacts);
    }

    // Close the modal after applying filter
    const filterPopupInstance = M.Modal.getInstance(document.getElementById('filter-popup'));
    filterPopupInstance.close();
}

// Initial fetch and display of contacts
fetchContacts();



document.getElementById('sort-btn').addEventListener('click', () => applySort(contacts));

// Function to retrieve contacts from Firebase (or IndexedDB if offline)
async function fetchContacts() {
    // Assume 'contacts' is loaded from Firebase or IndexedDB based on network status
    if (navigator.onLine) {
        await setupRealTimeListener();
    } else {
        await fetchContactsFromIndexedDB();
    }
}


async function setupRealTimeListener() {
    try {
        const userUid = localStorage.getItem("userUid");
        const userContactsCollection = collection(db, `users/${userUid}/contacts`);
        // const contactsCollection = collection(db, 'contacts'); // Access Firestore collection
        
        // Set up a real-time listener
        onSnapshot(userContactsCollection, (snapshot) => {
            contacts = []; // Clear previous contacts to avoid duplication
            snapshot.forEach(doc => {
                const contact = { idx: doc.id, ...doc.data() }; // Save Firebase ID
                contacts.push(contact);
                saveContactToIndexedDB(contact); // Save to IndexedDB for offline use
            });

            // Display contacts after fetching
            displayContactsSort(contacts); // Use the updated contacts array
        });
    } catch (error) {
        // console.error("Error setting up real-time listener:", error);
    }
}


// Retrieve contacts from IndexedDB if offline
async function fetchContactsFromIndexedDB() {
    try {
        const db = await dbPromise;
        const tx = db.transaction('contacts', 'readonly');
        const store = tx.objectStore('contacts');
        contacts = await store.getAll(); // Populate contacts array
        displayContactsSort(contacts); // Display contacts initially
    } catch (error) {
        console.error("Error fetching contacts from IndexedDB:", error);
    }
}

// 1. Function to apply the selected sorting option
function applySort() {
    const sortOption = document.getElementById('sort-options').value;
    if (sortOption) {
        sortContacts(sortOption); // Pass the selected sort option to sortContacts
        const modalInstance = M.Modal.getInstance(document.getElementById('sort-popup'));
        modalInstance.close(); // Close the modal after applying sort
    } else {
        alert("Please select a sort option.");
    }
}

// 2. Sort contacts based on the selected option
function sortContacts(sortBy) {
    if (!Array.isArray(contacts) || contacts.length === 0) {
        console.warn("No contacts available to sort.");
        return;
    }

    contacts.sort((a, b) => {
        const valueA = a[sortBy] ? a[sortBy].toString().toLowerCase() : ''; // Safely handle missing fields
        const valueB = b[sortBy] ? b[sortBy].toString().toLowerCase() : '';
        
        if (valueA < valueB) return -1;
        if (valueA > valueB) return 1;
        return 0;
    });

    // Display the sorted contacts
    displayContactsSort(contacts);
}

// 3. Display the sorted contacts in HTML
function displayContactsSort(contactList) {
        console.log(contacts);
        const contactListDiv = document.getElementById('contact-list');
        contactListDiv.innerHTML = ''; // Clear existing contacts
     // Sort contacts by last name
     contactList.sort((a, b) => a.lastName.localeCompare(b.lastName));
    
        // Loop through each contact and display it
        contactList.forEach(contact => {
            // Create the main contact card
            const card = document.createElement('div');
            card.className = 'card mb-3';
    
            const cardContent = `
                <div class="card-content row">
                    <div class="col s10">
                        <span class="new badge ${contact.category === 'Business' ? 'blue' : 'green'}"
                              data-badge-caption="">
                            ${contact.category}
                        </span>
                        <span class="card-title">${contact.firstName} ${contact.lastName}</span>
                        <div class="valign-wrapper mb-2">
                            <i class="material-icons blue-text text-lighten-2">phone</i>
                            <span class="mx-3">${contact.phone}</span>
                        </div>
                        <div class="valign-wrapper mb-3">
                            <i class="material-icons blue-text text-lighten-2">email</i>
                            <span class="mx-3">${contact.email}</span>
                        </div>
                        <div class="valign-wrapper mb-2">
                            <i class="material-icons blue-text text-lighten-2">note</i>
                            <span class="mx-3">${contact.notes}</span>
                        </div>
                    </div>
                </div>
            `;
    
            card.innerHTML = cardContent;
    
            // Conditionally add buttons for non-default contacts
            if (!contact.isDefault) {
                const actionButtons = document.createElement('div');
                actionButtons.className = 'col s2 right-align';
    
                actionButtons.innerHTML = `
                    <i class="material-icons blue-text edit-icon" onclick="editContact('${contact.idx}')">edit</i><br><br>
                    <i class="material-icons red-text delete-icon" onclick="removeContact('${contact.idx}')">delete</i>
                `;
    
                card.querySelector('.row').appendChild(actionButtons);
            }
    
            contactListDiv.appendChild(card);
    
            // Attach event listeners for Edit and Delete buttons
            const editIcon = card.querySelector('.edit-icon');
            const deleteIcon = card.querySelector('.delete-icon');
    
            if (editIcon) {
                editIcon.addEventListener('click', () => editContact(contact.idx));
            }
            if (deleteIcon) {
                deleteIcon.addEventListener('click', () => removeContact(contact.idx));
            }
        });
    }

// Initial fetch and display of contacts
fetchContacts();
