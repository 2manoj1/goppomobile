/* eslint-disable react-native/no-inline-styles */
import React, {useRef, useState, useEffect} from 'react';
import {View, Button, Text, StyleSheet, TextInput} from 'react-native';

import {db} from '../../firebase';

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  MediaStream,
  MediaStreamTrack,
  mediaDevices,
  registerGlobals,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';

const configuration = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

const Room = () => {
  const [userVideoStrem, setUserVideoStrem] = useState(null);
  const [partnerVideoStrem, setPartnerVideoStrem] = useState(null);
  const [roomId, setRoomID] = useState('');

  async function createRoomID() {
    try {
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnection.addStream(userVideoStrem);
      const roomRef = await db.collection('rooms').doc();

      //console.log(peerConnection);
      //peerConnection.addStream(localStream.current);

      // Code for collecting ICE candidates below
      const callerCandidatesCollection = roomRef.collection('callerCandidates');

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate) {
          console.log('Got final candidate!');
          return;
        }
        console.log('Got candidate: ', event.candidate);
        callerCandidatesCollection.add(event.candidate.toJSON());
      };
      peerConnection.onaddstream = (event) => {
        console.log('Got remote track:');
        if (event.stream && partnerVideoStrem !== event.stream) {
          console.log('RemotePC received the stream call', event.stream);
          setPartnerVideoStrem(event.stream);
        }
      };

      console.log('------------>>>> running');

      // Code for creating a room below
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      console.log('Created offer:');

      const roomWithOffer = {
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
      };
      try {
        await roomRef.set(roomWithOffer);
        console.log('error>>>>>>>>>>>>');
      } catch (err) {
        console.error(err);
      }

      setRoomID(roomRef.id);
      console.log(`New room created with SDP offer. Room ID: ${roomRef.id}`);

      // Code for creating a room above

      // Listening for remote session description below
      roomRef.onSnapshot(async (snapshot) => {
        const data = snapshot.data();
        if (!peerConnection.currentRemoteDescription && data && data.answer) {
          console.log('Got remote description: ', data.answer);
          const rtcSessionDescription = new RTCSessionDescription(data.answer);
          await peerConnection.setRemoteDescription(rtcSessionDescription);
        }
      });
      // Listening for remote session description above

      // Listen for remote ICE candidates below
      roomRef.collection('calleeCandidates').onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            let data = change.doc.data();
            console.log(
              `Got new remote ICE candidate: ${JSON.stringify(data)}`,
            );
            await peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
      // Listen for remote ICE candidates above
    } catch (err) {
      console.error(err);
    }
  }

  async function joinRoomById(rId) {
    const roomRef = db.collection('rooms').doc(`${rId}`);
    const roomSnapshot = await roomRef.get();
    console.log('Got room:', roomSnapshot.exists);

    if (roomSnapshot.exists) {
      console.log('Create PeerConnection with configuration: ', configuration);
      const peerConnection = new RTCPeerConnection(configuration);
      peerConnection.addStream(userVideoStrem);

      // Code for collecting ICE candidates below
      const calleeCandidatesCollection = roomRef.collection('calleeCandidates');
      peerConnection.onicecandidate = (event) => {
        if (!event.candidate) {
          console.log('Got final candidate!');
          return;
        }
        console.log('Got candidate: ', event.candidate);
        calleeCandidatesCollection.add(event.candidate.toJSON());
      };
      // Code for collecting ICE candidates above

      peerConnection.onaddstream = (event) => {
        if (event.stream && partnerVideoStrem !== event.stream) {
          setPartnerVideoStrem(event.stream);
        }
      };

      // Code for creating SDP answer below
      const offer = roomSnapshot.data().offer;
      console.log('Got offer:', offer);
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer),
      );
      const answer = await peerConnection.createAnswer();
      console.log('Created answer:', answer);
      await peerConnection.setLocalDescription(answer);
      // On Call Established:
      // InCallManager.start({media: 'audio'}); // audio/video, default: audio

      const roomWithAnswer = {
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
      };
      await roomRef.update(roomWithAnswer);
      // Code for creating SDP answer above

      // Listening for remote ICE candidates below
      roomRef.collection('callerCandidates').onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            let data = change.doc.data();
            console.log(
              `Got new remote ICE candidate: ${JSON.stringify(data)}`,
            );
            await peerConnection.addIceCandidate(new RTCIceCandidate(data));
          }
        });
      });
      // Listening for remote ICE candidates above
    }
  }

  useEffect(() => {
    openUserMedia();
  }, []);

  async function openUserMedia() {
    const availableDevices = await mediaDevices.enumerateDevices();
    const videoSourceId = availableDevices.find(
      // once we get the stream we can just call .switchCamera() on the track to switch without re-negotiating
      // ref: https://github.com/react-native-webrtc/react-native-webrtc#mediastreamtrackprototype_switchcamera
      (device) => device.kind === 'videoinput' && device.facing === 'front',
    );
    const stream = await mediaDevices.getUserMedia({
      video: {
        mandatory: {
          // Provide your own width, height and frame rate here
          minWidth: 500,
          minHeight: 300,
          minFrameRate: 30,
        },
        facingMode: 'user',
        optional: videoSourceId ? [{sourceId: videoSourceId}] : [],
      },
      audio: true,
    });
    const r = await InCallManager.requestRecordPermission();
    const v = await InCallManager.checkRecordPermission();
    if(v === "granted") {
    //InCallManager.setKeepScreenOn(true);
      InCallManager.setSpeakerphoneOn(true);
      InCallManager.start({media: 'audio'});
      //InCallManager.start();
    }
    setUserVideoStrem(stream);
  }

  return (
    <View style={{flex: 1}}>
      <View style={styles.callButtons}>
        <View styles={styles.ButtonContainer}>
          <Button title={'Click to stop call'} />
        </View>
        <View styles={styles.ButtonContainer}>
          <Button onPress={() => createRoomID()} title={'Create Room'} />
          <TextInput
            style={{height: 40, borderColor: 'gray', borderWidth: 1}}
            value={roomId}
            onChangeText={(text) => setRoomID(text)}
          />
          <Button onPress={() => joinRoomById(roomId)} title={'join Room'} />
        </View>
      </View>
      <RTCView
        zOrder={1}
        streamURL={userVideoStrem?.toURL()}
        style={styles.rtcview}
      />
      <RTCView
        zOrder={0}
        streamURL={partnerVideoStrem?.toURL()}
        style={styles.remoteRtcview}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    display: 'flex',
    flex: 1,
    backgroundColor: 'red',
  },
  heading: {
    alignSelf: 'center',
    fontSize: 30,
  },
  rtcview: {
    flex: 1,
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: '50%',
    height: '30%',
    margin: 0,
    padding: 0,
  },
  remoteRtcview: {
    flex: 1,
  },
  toggleButtons: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  callButtons: {
    padding: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  ButtonContainer: {
    margin: 5,
  },
});

export default Room;
