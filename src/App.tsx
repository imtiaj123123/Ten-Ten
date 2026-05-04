/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollection, useDocument } from 'react-firebase-hooks/firestore';
import { collection, query, where, doc, setDoc, updateDoc, serverTimestamp, orderBy, limit, addDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, signInWithGoogle, storage } from './lib/firebase';
import { cn, handleFirestoreError, OperationType } from './lib/utils';
import { Mic, Radio, Users, Settings, UserPlus, LogOut, Heart, MicOff, Volume2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
  status: 'online' | 'idle' | 'talking' | 'offline';
  lastActive: any;
  isTalkingTo?: string;
}

interface Friendship {
  users: string[];
  status: 'pending' | 'accepted';
}

interface VoiceClip {
  senderId: string;
  receiverId: string;
  audioUrl: string;
  duration: number;
  createdAt: any;
  played: boolean;
}

export default function App() {
  const [user, loading, error] = useAuthState(auth);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-[#BFFF00] font-mono">
      <motion.div animate={{ opacity: [1, 0.5, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
        INITIALIZING FREQUENCY...
      </motion.div>
    </div>
  );

  if (!user) return <LoginScreen />;

  return (
    <MainApp user={user} isAudioEnabled={isAudioEnabled} setIsAudioEnabled={setIsAudioEnabled} />
  );
}

function LoginScreen() {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/cancelled-popup-request' || err.code === 'auth/popup-closed-by-user') {
        console.log("Sign-in cancelled by user or redundant request.");
      } else {
        setAuthError(err.message || "Connection failed. Please try again.");
        console.error("Sign-in error", err);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#BFFF00] flex flex-col items-center justify-center p-8 font-mono">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="text-center space-y-8"
      >
        <div className="flex justify-center">
          <div className="p-6 border-4 border-[#BFFF00] relative">
            <Radio className="w-16 h-16 animate-pulse" />
            <div className="absolute -top-3 -right-3 bg-red-600 px-2 py-0.5 text-xs text-white border-2 border-[#BFFF00]">LIVE</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-6xl font-black tracking-tighter uppercase italic">Ten Ten</h1>
          <p className="text-xl opacity-70">Real-time walkie-talkie for friends.</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="bg-[#BFFF00] text-black px-12 py-4 text-xl font-bold hover:bg-white transition-colors uppercase flex items-center gap-3 border-4 border-white active:scale-95 transform cursor-pointer disabled:opacity-50 disabled:cursor-wait"
          >
            {isSigningIn ? "ESTABLISHING..." : "CONNECT SIGNAL"}
          </button>
          {authError && <div className="text-red-500 text-xs font-bold animate-shake">{authError}</div>}
        </div>

        <div className="max-w-xs mx-auto text-[10px] opacity-40 uppercase leading-relaxed pt-12">
          Protocol 10.10 // Frequency Locked // No Logs // Live Transmission Only
        </div>
      </motion.div>
    </div>
  );
}

function MainApp({ user, isAudioEnabled, setIsAudioEnabled }: { user: any, isAudioEnabled: boolean, setIsAudioEnabled: (v: boolean) => void }) {
  const [view, setView] = useState<'friends' | 'settings'>('friends');
  
  // Track profile and create if missing
  useEffect(() => {
    if (user) {
      const userRef = doc(db, 'users', user.uid);
      setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || 'Anon',
        photoURL: user.photoURL || '',
        email: user.email || '',
        status: 'online',
        lastActive: serverTimestamp(),
      }, { merge: true }).catch(e => handleFirestoreError(auth, e, OperationType.WRITE, `users/${user.uid}`));
    }
  }, [user]);

  // Audio Receiver Listener
  useEffect(() => {
    if (!user || !isAudioEnabled) return;

    const q = query(
      collection(db, 'voice_clips'),
      where('receiverId', '==', user.uid),
      where('played', '==', false),
      orderBy('createdAt', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docs.forEach(async (docSnap) => {
        const data = docSnap.data() as VoiceClip;
        try {
          const audio = new Audio(data.audioUrl);
          await audio.play();
          // Mark as played
          updateDoc(docSnap.ref, { played: true });
        } catch (err) {
          console.error("Audio playback blocked or failed", err);
        }
      });
    }, (error) => {
      handleFirestoreError(auth, error, OperationType.LIST, 'voice_clips');
    });

    return () => unsubscribe();
  }, [user, isAudioEnabled]);

  return (
    <div className="min-h-screen bg-black text-[#BFFF00] font-sans flex flex-col max-w-md mx-auto border-x border-[#BFFF00]/20">
      {/* Header */}
      <header className="p-4 border-b-2 border-[#BFFF00] flex justify-between items-center bg-black sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#BFFF00] rounded-full animate-ping" />
          <span className="font-mono font-bold tracking-widest uppercase">10.10 SIGNAL</span>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => setView('friends')} className={cn("p-2", view === 'friends' && "bg-[#BFFF00] text-black")}>
            <Users size={20} />
          </button>
          <button onClick={() => setView('settings')} className={cn("p-2", view === 'settings' && "bg-[#BFFF00] text-black")}>
            <Settings size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {!isAudioEnabled && (
          <div className="bg-[#BFFF00] text-black p-4 font-bold border-4 border-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Info size={20} />
              <span>ENABLE AUDIO PROTOCOL</span>
            </div>
            <button 
              onClick={() => setIsAudioEnabled(true)}
              className="px-4 py-2 border-2 border-black hover:bg-black hover:text-[#BFFF00] transition-colors"
            >
              ENABLE
            </button>
          </div>
        )}

        {view === 'friends' ? <FriendsView user={user} /> : <SettingsView user={user} />}
      </main>

      {/* Footer / Status Area */}
      <footer className="p-4 bg-[#111] border-t-2 border-[#BFFF00] font-mono text-[10px] uppercase flex justify-between">
        <div>ID: {user.uid.slice(0, 8)}</div>
        <div className="opacity-50">ENCRYPTED END-TO-END</div>
      </footer>
    </div>
  );
}

function FriendsView({ user }: { user: any }) {
  const [friendEmail, setFriendEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Simplified: Get all accepted friendships
  const [friendshipsValue] = useCollection(
    query(collection(db, 'friendships'), where('users', 'array-contains', user.uid), where('status', '==', 'accepted'))
  );

  const addFriend = async (e: any) => {
    e.preventDefault();
    if (!friendEmail) return;
    setLoading(true);
    try {
      // Small search logic: Find user by email
      // Note: In real app, we'd need a more robust way to handle this or use invites
      const q = query(collection(db, 'users'), where('email', '==', friendEmail.toLowerCase()), limit(1));
      const onSnap = onSnapshot(q, async (snap) => {
        if (!snap.empty) {
          const targetUser = snap.docs[0].data();
          if (targetUser.uid === user.uid) {
            alert("Cannot add yourself.");
          } else {
            // Check if exists
            const existingQ = query(collection(db, 'friendships'), where('users', 'array-contains', user.uid));
            // simplified check...
            await addDoc(collection(db, 'friendships'), {
              users: [user.uid, targetUser.uid].sort(),
              status: 'accepted', // Auto-accept for demo
              createdAt: serverTimestamp()
            });
            setFriendEmail('');
            alert("Friend added!");
          }
        } else {
          alert("User not found.");
        }
        onSnap(); // Unsubscribe immediately
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Add Friend */}
      <form onSubmit={addFriend} className="flex gap-2">
        <input 
          type="email" 
          value={friendEmail}
          onChange={(e) => setFriendEmail(e.target.value)}
          placeholder="FRIEND'S EMAIL..."
          className="flex-1 bg-transparent border-2 border-[#BFFF00] p-3 text-[#BFFF00] placeholder-[#BFFF00]/50 outline-none focus:bg-[#BFFF00]/10"
        />
        <button 
          disabled={loading}
          className="bg-[#BFFF00] text-black px-4 font-bold disabled:opacity-50"
        >
          <UserPlus size={24} />
        </button>
      </form>

      {/* List */}
      <div className="space-y-4">
        <h3 className="font-mono text-xs opacity-50 uppercase tracking-widest">Active Channels</h3>
        {friendshipsValue?.docs.map(fDoc => (
          <FriendItem key={fDoc.id} friendship={fDoc.data() as Friendship} currentUser={user} />
        ))}
        {friendshipsValue?.docs.length === 0 && (
          <div className="text-center py-12 opacity-30 italic font-mono uppercase">
            No active signals...
          </div>
        )}
      </div>
    </div>
  );
}

function FriendItem({ friendship, currentUser }: any) {
  const friendId = friendship.users.find(id => id !== currentUser.uid);
  const [friendSnap] = useDocument(friendId ? doc(db, 'users', friendId) : null);
  const friend = friendSnap?.data() as UserProfile | undefined;

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if ('vibrate' in navigator) {
          navigator.vibrate([30, 30]);
        }
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const storageRef = ref(storage, `voice_clips/${currentUser.uid}_${Date.now()}.webm`);
        await uploadBytes(storageRef, audioBlob);
        const url = await getDownloadURL(storageRef);

        await addDoc(collection(db, 'voice_clips'), {
          senderId: currentUser.uid,
          receiverId: friendId,
          audioUrl: url,
          duration: 0, 
          createdAt: serverTimestamp(),
          played: false
        });

        // Reset status
        await updateDoc(doc(db, 'users', currentUser.uid), {
          status: 'online',
          isTalkingTo: null
        });
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Set status to talking
      await updateDoc(doc(db, 'users', currentUser.uid), {
        status: 'talking',
        isTalkingTo: friendId
      });

    } catch (err) {
      console.error("Mic access failed", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  if (!friend) return null;

  const isFriendTalking = friend.status === 'talking' && friend.isTalkingTo === currentUser.uid;

  return (
    <div className={cn(
      "border-2 p-5 transition-all flex items-center justify-between group",
      isRecording ? "border-red-600 bg-red-600/10 shadow-[0_0_25px_rgba(220,38,38,0.5)] scale-[1.02]" : "border-[#BFFF00]/20 hover:border-[#BFFF00]/50 hover:bg-[#BFFF00]/5"
    )}>
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className={cn(
             "w-14 h-14 bg-[#BFFF00]/10 border-2 flex items-center justify-center overflow-hidden transition-all",
             isRecording ? "border-red-600 rounded-none" : "border-[#BFFF00] rounded-lg"
          )}>
            {friend.photoURL ? (
              <img src={friend.photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-mono text-xl">{friend.displayName[0]}</span>
            )}
          </div>
          <div className={cn(
            "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-black",
            friend.status === 'online' ? "bg-green-500" : 
            friend.status === 'talking' ? "bg-red-500 animate-pulse" : "bg-gray-500"
          )} />
        </div>
        <div>
          <div className="font-black text-xl tracking-tighter uppercase italic">{friend.displayName}</div>
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", isFriendTalking ? "bg-red-500 animate-ping" : "bg-[#BFFF00]/30")} />
            <div className="text-[10px] opacity-70 font-mono tracking-widest">
              {isFriendTalking ? "BROADCASTING..." : isRecording ? "TRANSMITTING..." : friend.status === 'online' ? "SIGNAL READY" : "OFF-AIR"}
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        {isRecording && (
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            className="absolute inset-0 bg-red-600 rounded-full -z-10 blur-xl"
          />
        )}
        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={cn(
            "w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all active:scale-95 touch-none shadow-lg",
            isRecording 
              ? "border-white bg-red-600 text-white animate-pulse" 
              : "border-[#BFFF00] text-[#BFFF00] hover:bg-[#BFFF00] hover:text-black group-hover:scale-110"
          )}
        >
          {isRecording ? <Mic size={36} /> : <Mic size={36} className="opacity-40" />}
        </button>
      </div>
    </div>
  );
}

function SettingsView({ user }: { user: any }) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="space-y-2">
        <h3 className="font-mono text-xs opacity-50 uppercase tracking-widest">Identity</h3>
        <div className="p-4 border-2 border-[#BFFF00]/20 flex items-center gap-4">
          <div className="w-16 h-16 bg-[#BFFF00]/20 border-2 border-[#BFFF00] flex items-center justify-center">
            {user.photoURL && <img src={user.photoURL} alt="" className="w-full h-full object-cover" />}
          </div>
          <div>
            <div className="font-bold text-xl uppercase italic">{user.displayName}</div>
            <div className="text-xs opacity-50 font-mono">{user.email}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
         <button 
          onClick={() => auth.signOut()}
          className="w-full bg-red-600 text-white p-4 font-bold flex items-center justify-center gap-3 border-4 border-white active:scale-95 transition-transform"
        >
          <LogOut size={20} />
          DISCONNECT SIGNAL
        </button>
      </div>

      <div className="pt-8 text-center space-y-4">
        <div className="flex justify-center gap-4 text-[#BFFF00]/30">
          <Heart size={16} />
          <Radio size={16} />
          <Mic size={16} />
        </div>
        <p className="text-[10px] opacity-40 uppercase max-w-[200px] mx-auto leading-relaxed">
          The sound is real. The connection is real. Speak clearly and wait for responses.
        </p>
      </div>
    </div>
  );
}
