import firebase from 'firebase';
import '@firebase/auth';
import '@firebase/firestore';
const firebaseConfig = {
  apiKey: 'AIzaSyCCXDYrcMpSu2gouiKwG8pvG9H-t7ASbYg',
  authDomain: 'goppo-de42b.firebaseapp.com',
  databaseURL: 'https://goppo-de42b.firebaseio.com',
  projectId: 'goppo-de42b',
  storageBucket: 'goppo-de42b.appspot.com',
  messagingSenderId: '235552348570',
  appId: '1:235552348570:web:1eaeb5b8bb40e621900223',
  measurementId: 'G-EDPF6H194B',
};
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
db.settings({experimentalForceLongPolling: true});

export {db};

export default firebase;
