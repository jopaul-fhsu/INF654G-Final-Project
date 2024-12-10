### Contact List Progressive Web Application (PWA)

The Contact List App is a Progressive Web Application for managing and synchronizing contact lists across multiple accounts. It uses Firebase for secure user authentication and real-time data synchronization, and Progressive Web App (PWA) technology for offline capabilities and cross-platform compatibility. The app provides a seamless, native-like experience on both desktop and mobile devices.

## Features

### User Authentication
- **Login and Registration**:
  - Create accounts using an email and password.
  - Enforces password validation, including re-entry for confirmation.
  - Notifies users if an account already exists or if login credentials are incorrect.
- **Restore Password**:
  - Sends a secure email for password reset.
  - Includes a button to copy the temporary password for ease of use.

### Contact Management
- **User-Specific Contacts**:
  - Each account has a unique contact list displayed upon login.
  - Displays the logged-in user's username on the main page.
- **Real-Time Syncing**:
  - Synchronizes contacts across devices using Firebase Firestore.

### Offline Functionality
- **IndexedDB Integration**:
  - Contacts are cached locally per account, enabling offline access.
  - Changes made offline automatically sync when connectivity is restored.

### Progressive Web App Features
- **Service Worker**:
  - Caches static assets for fast loading and offline capabilities.
- **manifest.json**:
  - Allows users to add the app to their home screen for a native-like experience.

### Security and Configuration
- **Firebase Credentials**:
  - Credentials are stored in a separate JSON file for modularity, easier testing, and enhanced security.

---

## Setting Up Firebase Configuration

To configure the application with Firebase, follow these steps:

### Step 1: Create the JSON File
- In the root directory of your project, create a file named `firebaseConfig.json`.

### Step 2: Add Firebase Credentials
- Retrieve your Firebase configuration object from your Firebase project settings.
- Copy and paste a similar configuration into `firebaseConfig.json`:
    ```json
    {
        "apiKey": "API_KEY",
        "authDomain": "app.firebaseapp.com",
        "databaseURL": "https://app-default-rtdb.firebaseio.com",
        "projectId": "app",
        "storageBucket": "app.firebasestorage.app",
        "messagingSenderId": "ID",
        "appId": "APP_ID",
        "measurementId": "ID"
    }
