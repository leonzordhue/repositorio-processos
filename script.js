<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
  import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
  import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-storage.js";

  const firebaseConfig = {
    apiKey: "AIzaSyBInRmnvzxTj7eKsknpdPPjXADUBpqkeB0",
    authDomain: "repositorio-processos.firebaseapp.com",
    projectId: "repositorio-processos",
    storageBucket: "repositorio-processos.firebasestorage.app",
    messagingSenderId: "82002630747",
    appId: "1:82002630747:web:82cc032272c67cc0e5877e"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  
  // Exportar para uso global
  window.firebaseApp = app;
  window.getFirestore = getFirestore;
  window.getStorage = getStorage;
  window.firestoreFunctions = { collection, getDocs, addDoc, updateDoc, deleteDoc, doc };
  window.storageFunctions = { ref, uploadBytes, getDownloadURL };
</script>
