import React, { useEffect, useReducer, useRef, useState } from 'react'
import { getParamFromUrl, isHttps } from '../../utils'
import { JanusClient } from '../../utils/janus/janus-client'
import { Participant } from '../../utils/janus/janus.types'
import {
  AiOutlineAudio,
  AiOutlineAudioMuted,
  AiTwotoneEye,
  AiOutlineEyeInvisible,
} from 'react-icons/ai'
import { Grid, GridItem } from '../../layout/Grid'

import './chat-room.scss'
import '../../scss/button.scss'

const ACTION_SET_JANUS_CLIENT = 'setJanusClient'
const REMOVE_JANUS_CLIENT = 'removeJanusClient'

const audioChatReducer = (state, action) => {
  switch (action.type) {
    case ACTION_SET_JANUS_CLIENT: {
      return { janusClient: action.payload }
    }
    case REMOVE_JANUS_CLIENT: {
      return { janusClient: null }
    }
  }
}

const ChatRoom: React.FC = () => {
  const [state, dispatch] = useReducer(audioChatReducer, { janusClient: null })
  const [name, setName] = useState<string>('')
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const [isGuide, setIsGuide] = useState<boolean>(false)
  const [guideIsSubscribed, setGuideIsSubscribed] = useState<boolean>(false)
  const [isSelected, setIsSelected] = useState<boolean>(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [publishers, setPublishers] = useState<Participant[]>([])
  const [isJanusEnabled, setIsJanusEnabled] = useState<boolean>(false)
  const [user, setUser] = useState<Participant>()
  const audioRef = useRef(null)
  const localVideoRef = useRef(null)

  const destroyJanusSession = () => {
    if (state && state.janusClient) {
      state.janusClient.audioBridgePlugin.hangup()
      state.janusClient.client.destroy()
    }
    setUser(undefined)
    setIsMuted(false)
    setIsGuide(false)
    setIsSelected(false)
    setIsJanusEnabled(false)
    dispatch({ type: REMOVE_JANUS_CLIENT })
  }

  useEffect(() => {
    return () => {
      destroyJanusSession()
    }
  }, [])

  const onTalkingEvent = (message) => {
    const { id } = message
    const userElement = document.querySelector(`#rp${id}`)

    if (userElement) {
      const isTalking = userElement.classList.contains('bg-primary')

      if (!isTalking) {
        userElement.classList.add('bg-primary', 'text-light')
      }
    }
  }

  const onStopTalkingEvent = (message) => {
    const { id } = message
    const userElement = document.querySelector(`#rp${id}`)

    if (userElement) {
      const isTalking = userElement.classList.contains('bg-primary')

      if (isTalking) {
        userElement.classList.remove('bg-primary', 'text-light')
      }
    }
  }

  const connectAudioRoom = (userName, janusClient) => {
    if (janusClient) {
      janusClient.joinAudioRoom({ display: userName, muted: false }, 1234)
      janusClient.onUser.subscribe(setUser)
    }
  }

  const connectVideoRoom = (userName, janusClient) => {
    if (janusClient) {
      janusClient.joinVideoRoom({ display: userName, ptype: 'publisher' }, 1234)
      janusClient.onUser.subscribe(setUser)
    }
  }

  const onClickJoin = async () => {
    //const protocol = isHttps() ? 'wss' : 'ws'
    //const port = isHttps() ? 8989 : 8188
    const port = isHttps() ? 8188 : 8088
    //const janusUrl = `${protocol}://${window.location.hostname}:${port}`
    //const janusUrl = `${protocol}://172.27.160.1:${port}`

    const janusUrl = `http://${window.location.hostname}:${port}/janus` // TODO using http because ws is causing problems

    // Instantiate the JanusClient
    console.log(janusUrl)
    const janusClient = new JanusClient(janusUrl)
    janusClient.setAudio(audioRef.current)
    janusClient.setVideo(localVideoRef.current)

    // Execute the Janus.init, connect the JanusClient to the Janus server
    try {
      await janusClient.init(true) // The parameter toggles the Janus logs on/off
      janusClient.onTalking.subscribe(onTalkingEvent)
      janusClient.onStopTalking.subscribe(onStopTalkingEvent)
      janusClient.onParticipants.subscribe((participants) => {
        const newParticipants = participants.map((user) => {
          return {
            ...user,
            ref: React.createRef(),
          }
        })
        setParticipants(newParticipants)
      })
      janusClient.onPublishers.subscribe((publishers) => {
        const newPublishers = publishers.map((user) => {
          return {
            ...user,
            ref: React.createRef(),
          }
        })
        setPublishers(newPublishers)
      })
      // Create a session and attach plugin handlers.
      await janusClient.connectToJanus()
      // If the username is already in the url, connect to audio and video rooms
      const userName = getParamFromUrl('user')
      if (userName) {
        connectAudioRoom(userName, janusClient)
        connectVideoRoom(userName, janusClient)
        if (userName === 'Guide') {
          setIsGuide(true)
          janusClient.setUserIsGuide(true)
        }
      }
      dispatch({ type: ACTION_SET_JANUS_CLIENT, payload: janusClient })
      setIsJanusEnabled(true)
    } catch (error) {
      console.error(error)
    }
  }

  const onChangeInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    setName(value)
  }

  const onSumbitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (name === 'Guide') {
      setIsGuide(true)
      state?.janusClient.setUserIsGuide(true)
    }
    connectAudioRoom(name, state?.janusClient)
    connectVideoRoom(name, state?.janusClient)
  }

  const onClickMute = () => {
    const value = !isMuted
    setIsMuted(value)
    if (state && state.janusClient) {
      state.janusClient.mute(value)
    }
  }

  const onClickSelectVideo = (event: React.MouseEvent<SVGElement>, participant: Participant) => {
    event.preventDefault()
    console.log('------------------------------------------------------------------------------------------------------------------')
    console.log('------------------------------------------------------------------------------------------------------------------')
    console.log('------------------------------------------------------------------------------------------------------------------')
    setIsSelected(!isSelected)
    const relatedPublisher = publishers.find((publisher) => participant.display === publisher.display)
    console.log(relatedPublisher)
    if (relatedPublisher) {
      console.log('Selected participant\'s publisher id: ' + relatedPublisher.id)
      if (state && state.janusClient)
        state.janusClient.selectVideo(relatedPublisher)
    } else {
      console.log('Error: Participant is not a publisher.')
    }
  }

  return (
    <Grid>
      <GridItem classItem="Graph" title="Camera">
        <>
          <div id="myvideo" className="video-container">
            <video
              ref={localVideoRef}
              id="localvideo"
              className="rounded centered"
              width="100%"
              height="100%"
              autoPlay
              playsInline
              muted={true}
            ></video>
          </div>
        </>
      </GridItem>
      <GridItem classItem="Chat" title="Tour room">
        <div className="chat">
          {isJanusEnabled && (
            <>
              {!user && (
                <>
                  <form className="chat__form" onSubmit={onSumbitForm}>
                    <div className="mb-4">
                      <label
                        htmlFor="inputName"
                        className="form-label text-tertiary mb-2"
                      >
                        Username
                      </label>
                      <input
                        id="inputName"
                        className="form-control"
                        type="text"
                        onChange={onChangeInput}
                      />
                    </div>
                    <button
                      className="btn button-primary w-100 mb-3"
                      disabled={name === ''}
                    >
                      Join Tour Room
                    </button>
                  </form>
                </>
              )}
              {user && (
                <>
                  <p className="mt-3 mb-2 text-tertiary">Participants</p>
                  <hr />
                  <div className="chat__participants">
                    <span
                      id={`rp${user.id}`}
                      className="chat__participants-item d-flex justify-content-between align-items-center"
                    >
                      Me: {user.display}
                      {isMuted ? <AiOutlineAudioMuted /> : <AiOutlineAudio />}
                    </span>
                    {participants && participants.length > 0 && (
                      <ul className="list-group">
                        {participants.map(
                          (participant: Participant, index: number) => {
                            return (
                              <li
                                id={`rp${participant.id}`}
                                key={index}
                                ref={participant.ref}
                                className="chat__participants-item d-flex justify-content-between align-items-center"
                              >
                                {participant.display}
                                {participant.muted ? (
                                  <AiOutlineAudioMuted />
                                ) : (
                                  <AiOutlineAudio />
                                )}
                                  {participant.selected ? (
                                    isGuide && <AiOutlineEyeInvisible
                                      onClick={((e) => onClickSelectVideo(e, participant))}
                                    />
                                  ) : (
                                    isGuide &&  <AiTwotoneEye
                                      onClick={((e) => onClickSelectVideo(e, participant))}
                                    />
                                  )}
                              </li>
                            )
                          }
                        )}
                      </ul>
                    )}
                  </div>
                  <div className="chat__buttons">
                    {isMuted ? (
                      <button
                        className="btn button-secondary"
                        onClick={onClickMute}
                      >
                        Unmute
                      </button>
                    ) : (
                      <button
                        className="btn button-primary"
                        onClick={onClickMute}
                      >
                        Mute
                      </button>
                    )}
                    <button
                      className="btn btn-danger"
                      onClick={destroyJanusSession}
                    >
                      Leave Tour
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          {!isJanusEnabled && (
            <button
              type="button"
              className="btn button-primary btn-join"
              onClick={onClickJoin}
            >
              Join
            </button>
          )}
          <audio ref={audioRef} className="rounded centered" autoPlay />
          <button
            type="button"
            className="btn button-primary"
            onClick={() => {console.log('List of publishers:');console.log(publishers)}}
          >
            Print Participants
          </button>
          <button
            type="button"
            className="btn button-primary"
            onClick={() => {console.log('List of publishers:');console.log(publishers)}}
          >
            Print Publishers
          </button>
        </div>
      </GridItem>
    </Grid>
  )
}

export default ChatRoom
