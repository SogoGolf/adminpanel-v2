import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDvfxHglAehaICk_IveIAH1DCD1wHYmFm4",
  authDomain: "sogo-golf.firebaseapp.com",
  databaseURL: "https://sogo-golf.firebaseio.com",
  projectId: "sogo-golf",
  storageBucket: "sogo-golf.appspot.com",
  messagingSenderId: "719518718236",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
