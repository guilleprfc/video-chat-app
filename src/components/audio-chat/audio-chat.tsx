import React, { useEffect, useReducer, useRef, useState } from 'react';
import { getParamFromUrl, isHttps } from '../../utils';
import { JanusClient } from '../../utils/janus/janus';
import { Participant } from '../../utils/janus/janus.types';
import { AiOutlineAudio, AiOutlineAudioMuted } from 'react-icons/ai';

import './audio-chat.scss';
import '../../scss/button.scss';

const ACTION_SET_JANUS_CLIENT = 'setJanusClient';
const REMOVE_JANUS_CLIENT = 'removeJanusClient';

const audioChatReducer = (state, action) => {
  switch (action.type) {
    case ACTION_SET_JANUS_CLIENT: {
      return { janusClient: action.payload };
    }
    case REMOVE_JANUS_CLIENT: {
      return { janusClient: null };
    }
  }
};

const AudioChat: React.FC = () => {
  const [ state, dispatch ] = useReducer(audioChatReducer, { janusClient: null });
  const [ name, setName ] = useState<string>('');
  const [ isMuted, setIsMuted ] = useState<boolean>(false);
  const [ participants, setParticipants ] = useState<Participant[]>([]);
  const [ isJanusEnabled, setIsJanusEnabled ] = useState<boolean>(false);
  const [ user, setUser ] = useState<Participant>();
  const audioRef = useRef(null);

  const destroyJanusSession = () => {
    if (state && state.janusClient) {
      state.janusClient.audioBridgePlugin.hangup();
      state.janusClient.client.destroy();
    }
    setUser(undefined);
    setIsMuted(false);
    setIsJanusEnabled(false);
    dispatch({ type: REMOVE_JANUS_CLIENT });
  };

  useEffect(() => {
    return () => {
      destroyJanusSession();
    };
  }, []);

  const onTalkingEvent = (message) => {
    const { id } = message; 
    const userElement = document.querySelector(`#rp${id}`);

    if (userElement) {
      const isTalking = userElement.classList.contains('bg-primary');

      if (!isTalking) {
        userElement.classList.add('bg-primary', 'text-light');
      }
    }
  };
  const onStopTalkingEvent = (message) => {
    const { id } = message; 
    const userElement = document.querySelector(`#rp${id}`);

    if (userElement) {
      const isTalking = userElement.classList.contains('bg-primary');

      if (isTalking) {
        userElement.classList.remove('bg-primary', 'text-light');
      }
    }
  };

  const connectAudioChat = async (userName, janusClient) => {
    if (janusClient) {
      try {
        await janusClient.joinChat({ display: userName, muted: false }, 6969);
        janusClient.onUser.subscribe(setUser);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const onClickJoin = async () => {
    const protocol = isHttps() ? 'wss' : 'ws';
    const port = isHttps() ? 8989 : 8188;
    const janusUrl = `${protocol}://${window.location.hostname}:${port}`;
    const janusClient = new JanusClient(janusUrl);
    janusClient.setAudio(audioRef.current);
    
    try {
      await janusClient.init(false);
      janusClient.onTalking.subscribe(onTalkingEvent);
      janusClient.onStopTalking.subscribe(onStopTalkingEvent);
      janusClient.onParticipants.subscribe((participants) => {
        const newParticipants = participants.map((user) => {
          return {
            ...user,
            ref: React.createRef()
          };
        });
        setParticipants(newParticipants);
      });
      await janusClient.connectToAudioJanus();
      const userName = getParamFromUrl('user');
      if (userName) {
        connectAudioChat(userName, janusClient);
      }
      dispatch({ type: ACTION_SET_JANUS_CLIENT, payload: janusClient });
      setIsJanusEnabled(true);
    } catch (error) {
      console.error(error);
    }
  };

  const onChangeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setName(value);
  };

  const onSumbitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    connectAudioChat(name, state?.janusClient);
  };

  const onClickMute = () => {
    const value = !isMuted;
    setIsMuted(value);
    if (state && state.janusClient) {
      state.janusClient.mute(value);
    }
  };

  return (
    <div className='chat'>
      {isJanusEnabled &&
        <>
          {!user &&
            <>
              <form className='chat__form' onSubmit={onSumbitForm}>
                <div className='mb-4'>
                  <label htmlFor='inputName' className='form-label text-tertiary mb-2'>Username</label>
                  <input id='inputName' className='form-control' type='text' onChange={onChangeInput} />
                </div>
                <button className='btn button-primary w-100 mb-3' disabled={name === ''}>Join Audio Chat</button>
              </form>
            </>}
          {user &&
            <>
              <p className='mt-3 mb-2 text-tertiary'>Participants</p>
              <hr />
              <div className='chat__participants'>
                <span 
                  id={`rp${user.id}`} 
                  className='chat__participants-item d-flex justify-content-between align-items-center'
                >
                  Me: {user.display}
                  {isMuted ?
                    <AiOutlineAudioMuted /> :
                    <AiOutlineAudio />}
                </span>
                {participants && participants.length > 0 &&
                  <ul className='list-group'>
                    {participants.map((participant: Participant, index: number) => {
                      return (
                        <li 
                          id={`rp${participant.id}`} 
                          key={index} 
                          ref={participant.ref}
                          className='chat__participants-item d-flex justify-content-between align-items-center'
                        >
                          {participant.display}
                          {participant.muted ?
                            <AiOutlineAudioMuted /> :
                            <AiOutlineAudio />}
                        </li>
                      );
                    })}
                  </ul>}
              </div>
              <div className='chat__buttons'>
                {isMuted ?
                  <button className='btn button-secondary' onClick={onClickMute}>Unmute</button> :
                  <button className='btn button-primary' onClick={onClickMute}>Mute</button>}
                <button className='btn btn-danger' onClick={destroyJanusSession}>Leave Chat</button>
              </div>
            </>}
        </>}
      {!isJanusEnabled &&
        <button type='button' className='btn button-primary btn-join' onClick={onClickJoin}>Join</button>}
      <audio ref={audioRef} className='rounded centered' autoPlay />
    </div>
  );
};

export default AudioChat;
