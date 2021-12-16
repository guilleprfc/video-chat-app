import React, { useEffect, useReducer, useRef, useState } from 'react'
import { isHttps } from '../../utils'
import { JanusClient } from '../../utils/janus/janus-client'
import { Participant, Room } from '../../utils/janus/janus.types'
import Loader from 'react-loader-spinner'
// import {
//   AiOutlineAudio,
//   AiOutlineAudioMuted,
//   AiTwotoneEye,
//   AiOutlineEyeInvisible,
// } from 'react-icons/ai'
import { Grid, GridItem } from '../../layout/Grid'
import MultiTableDrag from './multi-table-drag/multi-table-drag'

import './chat-room.scss'
import '../../scss/button.scss'
// import RoomContainer from './dnd/room-container'

const ACTION_SET_JANUS_CLIENT = 'setJanusClient'
const REMOVE_JANUS_CLIENT = 'removeJanusClient'

const janusClientReducer = (state, action) => {
  switch (action.type) {
    case ACTION_SET_JANUS_CLIENT: {
      return { janusClient: action.payload }
    }
    case REMOVE_JANUS_CLIENT: {
      return { janusClient: null }
    }
  }
}

interface ChatRoomProps {
  username?: string
}

interface MultiTableProps {
  items: any[]
  roomIds: string[]
  rooms: any[]
}

const ChatRoom: React.FC<ChatRoomProps> = () => {
  // Janus client info
  const [state, dispatch] = useReducer(janusClientReducer, {
    janusClient: null,
  })
  const [isJanusEnabled, setIsJanusEnabled] = useState<boolean>(false)
  // User info
  const [user, setUser] = useState<Participant>()
  const queryParams = new URLSearchParams(window.location.search)
  const [name, setName] = useState<string>(queryParams.get('name') || 'GUEST')
  const [isGuide, setIsGuide] = useState<boolean>((): boolean => {
    return name.toLowerCase() === 'guide' ? true : false
  })
  // Rooms, participants, publishers
  const [currentRoom, setCurrentRoom] = useState<number>()
  const [rooms, setRooms] = useState<Room[]>([])

  const [participants, setParticipants] = useState<Participant[]>([])
  const [publishers, setPublishers] = useState<Participant[]>([])
  const [roomData, setRoomData] = useState<MultiTableProps>({
    items: [],
    roomIds: [],
    rooms: [],
  })

  // Media locations
  const audioRef = useRef(null)
  const localVideoRef = useRef(null)

  const destroyJanusSession = () => {
    if (state && state.janusClient) {
      state.janusClient.audioBridgePlugin.hangup()
      state.janusClient.videoRoomPlugin.hangup()
      if (state.janusClient.subscriberPluginattached) {
        state.janusClient.videoRoomSubscriberPlugin.hangup()
      }
      state.janusClient.textRoomPlugin.hangup()
      state.janusClient.client.destroy()
    }
    setUser(undefined)
    setIsGuide(false)
    setIsJanusEnabled(false)
    dispatch({ type: REMOVE_JANUS_CLIENT })
  }

  const createJanusSession = async () => {
    // const protocol = isHttps() ? 'wss' : 'ws'
    // const port = isHttps() ? 8989 : 8188


    const protocol = isHttps() ? 'https' : 'http'
    const port = isHttps() ? 8089 : 8088
    const janusUrl = `${protocol}://${window.location.hostname}:${port}/janus`

    // const janusUrl = `http://${window.location.hostname}:${port}/janus` // TODO using http because ws is causing problems

    // Instantiate the JanusClient
    console.log(janusUrl)
    const janusClient = new JanusClient(janusUrl)
    janusClient.setAudio(audioRef.current)
    janusClient.setVideo(localVideoRef.current)

    // Execute the Janus.init, connect the JanusClient to the Janus server
    try {
      await janusClient.init(false) // Toogle Janus logs on/off

      janusClient.onTalking.subscribe(onTalkingEvent)
      janusClient.onStopTalking.subscribe(onStopTalkingEvent)
      janusClient.onParticipants.subscribe(async (participants) => {
        const newParticipants = participants.map((user) => {
          return {
            ...user,
            ref: React.createRef(),
          }
        })
        setParticipants(newParticipants)
        await updateChatInfo(janusClient)
      })
      janusClient.onPublishers.subscribe(async (publishers) => {
        const newPublishers = publishers.map((user) => {
          return {
            ...user,
            ref: React.createRef(),
          }
        })
        setPublishers(newPublishers)
        await updateChatInfo(janusClient)
      })
      janusClient.setUserIsGuide(isGuide)

      // Create a session and attach plugin handlers.
      await janusClient.connectToJanus()

      // Get rooms and participants from the Janus client and update them
      await updateChatInfo(janusClient)

      // Check if the Hall room exists and if not, create and join it
      if (
        janusClient.rooms.length === 0 ||
        (janusClient.rooms.length > 0 &&
          janusClient.rooms.filter((r) => r.description === 'Hall').length ===
            0)
      ) {
        // Create the default waiting room
        await createRoom('Hall', 1000000, janusClient)
        await updateChatInfo(janusClient)
      }

      // Join the default waiting room if there is no current Room
      if (!currentRoom) {
        await joinRoom(
          name,
          janusClient.rooms.filter((r) => r.description === 'Hall')![0].roomId!,
          janusClient
        )
        setCurrentRoom(
          janusClient.rooms.filter((r) => r.description === 'Hall')[0].roomId
        )
        // Refresh the state of the chat from Janus
        await updateChatInfo(janusClient)
      }

      dispatch({ type: ACTION_SET_JANUS_CLIENT, payload: janusClient })
      setIsJanusEnabled(true)
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Janus session
   */
  useEffect(() => {
    createJanusSession()

    return () => {
      destroyJanusSession()
    }
  }, [])

  const buildMultiTableProps = (rooms: Array<Room>) => {
    const props: MultiTableProps = { items: [], roomIds: [], rooms: [] }
    // Get all participants and their rooms
    let allParticipants = new Array<any>()
    let roomParticipants = new Array<string>()
    for (let i = 0; i < rooms.length; i++) {
      allParticipants = allParticipants.concat(rooms[i].participants)
    }
    for (let i = 0; i < allParticipants.length; i++) {
      if (allParticipants[i]) {
        if (allParticipants[i].audioId) {
          allParticipants[i].id = allParticipants[i].audioId.toString()
          allParticipants[i].audioId = allParticipants[i].audioId.toString()
        }
        if (allParticipants[i].videoId) {
          allParticipants[i].videoId = allParticipants[i].videoId.toString()
        }
      }
    }
    // Add all participants to the props
    props.items = allParticipants
    // Get room info
    for (let i = 0; i < rooms.length; i++) {
      props.roomIds[i] = rooms[i].roomId!.toString()
      // Retrieve the list of participants that are in the room
      if (rooms[i].participants) {
        for (let j = 0; j < rooms[i].participants!.length; j++) {
          if (rooms[i].participants![j].audioId) {
            roomParticipants[j] = rooms[i].participants![j].audioId!.toString()
          }
        }
      }
      props.rooms[i] = {
        id: rooms[i].roomId!.toString(),
        title: rooms[i].description,
        itemIds: roomParticipants,
      }
      roomParticipants = new Array<any>()
    }
    return props
  }

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

  function joinRoom(
    display: string,
    roomId: number,
    janusClient
  ): Promise<any[]> {
    return Promise.all([
      janusClient.joinAudioRoom({ display, muted: true }, roomId),
      janusClient.joinVideoRoom({ display, ptype: 'publisher' }, roomId),
      janusClient.onUser.subscribe(setUser),
    ])
  }

  // const changeAudioRoom = (janusClient, destination) => {
  //   return new Promise<void>(async (resolve, reject) => {
  //     try {
  //       if (destination && janusClient) {
  //         await janusClient.changeAudioRoom(destination, user?.display)
  //         resolve()
  //       }
  //     } catch (error) {
  //       reject(error)
  //     }
  //   })
  // }

  // const changeVideoRoom = (janusClient, source, destination) => {
  //   return new Promise<void>(async (resolve, reject) => {
  //     try {
  //       if (destination && janusClient) {
  //         await janusClient.changeVideoRoom(source, destination, user?.display)
  //         resolve()
  //       }
  //     } catch (error) {
  //       reject(error)
  //     }
  //   })
  // }

  const orderSwitchRoom = (pUser, source, destination) => {
    console.log('orderSwitchRoom', [pUser, source, destination])
    const whoId = pUser
    if (whoId) {
      const whoUsername = getUserByAudioId(whoId).display
      console.log('whoUsername', whoUsername)
      const sourceId = source.droppableId
      const destinationId = destination.droppableId
      if (whoUsername && sourceId && destinationId) {
        state?.janusClient.sendWhisper(
          whoUsername,
          'switchRooms|' + sourceId + '|' + destinationId
        )
      }
    }
  }

  const onClickSwitchRoom = async (event) => {
    const roomDescription = event.target.innerHTML
    var destinationId = getRoomByDescription(roomDescription).roomId
    var originId = currentRoom
    await state?.janusClient.switchRoom(user, originId, destinationId)

    // Videoroom will require to make a leave-joinandconfigure-publish round to change rooms
    // await changeVideoRoom(
    //   state?.janusClient,
    //   source.droppableId,
    //   destination.droppableId
    // )

    // // Audiobridge has the changeroom request to easily change rooms
    // await changeAudioRoom(state?.janusClient, destination.droppableId)

    // if (pUser.Id === user?.audioId || pUser.Id === user?.audioId) {
    //   setCurrentRoom(
    //     state?.janusClient.rooms.filter(
    //       (r) => r.roomId === destination.droppableId
    //     )[0].roomId
    //   )
    // }

    // Refresh the state of the chat from Janus
    // await updateChatInfo(state?.janusClient)
  }

  const mute = async () => {
    console.log('mute')
    if (state && state.janusClient) {
      state.janusClient.mute(true)
      // Refresh the state of the chat from Janus
      await updateChatInfo(state.janusClient)
    }
  }

  const unmute = async () => {
    console.log('unmute')
    if (state && state.janusClient) {
      state.janusClient.mute(false)
      // Refresh the state of the chat from Janus
      await updateChatInfo(state.janusClient)
    }
  }

  const selectVideo = (event) => {
    // get the user from the chat info
    const userId = event.target.id.split('-')[1]
    const selectedParticipant = getUserByAudioId(userId)

    // check if the user is publishing
    const isPublisher = selectedParticipant.publisher
    if (isPublisher) {
      // call to subscribeToPublisher
      if (state && state.janusClient)
        state.janusClient.subscribeToPublisher(
          Number(selectedParticipant.videoId)
        )
    } else {
      console.log('Error: Participant is not a publisher.')
    }
  }

  const getUserByAudioId = (audioId: number): Participant => {
    let u: Participant = {}
    if (state?.janusClient.rooms) {
      for (let i = 0; i < state?.janusClient.rooms.length; i++) {
        for (
          let j = 0;
          j < state?.janusClient.rooms[i].participants!.length;
          j++
        ) {
          const participant = state?.janusClient.rooms[i].participants![j]
          if (participant.audioId === audioId) {
            u = participant as Participant
            u.room = state?.janusClient.rooms[i].roomId
            break
          }
        }
      }
    }
    return u
  }

  const getRoomByDescription = (description: string): Room => {
    let r: Room = {}
    if (state?.janusClient.rooms) {
      for (let i = 0; i < state?.janusClient.rooms.length; i++) {
        const room = state?.janusClient.rooms[i]
        if (room.description === description) {
          r = room
          break
        }
      }
    }
    return r
  }

  const onClickCreateRoom = async () => {
    var roomName = prompt(
      'Please enter the name of the room you want to create',
      ''
    )
    if (state?.janusClient) {
      // Call the room creation method in Janus
      await createRoom(roomName, getNextRoomId(), state?.janusClient)
      await updateChatInfo(state?.janusClient)
    }
  }

  const getNextRoomId = (): number => {
    return rooms.length + 1000000
  }

  const createRoom = async (roomName, roomId, janusClient) => {
    return new Promise<void>(async (resolve, reject) => {
      try {
        if (roomName != null && roomName !== '') {
          if (janusClient) {
            await janusClient.createRoom(roomName, roomId)
            resolve()
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  const updateChatInfo = async (janusClient) => {
    if (janusClient) {
      console.log('Refreshing chat info')
      // Get rooms and participants from the Janus client and update their state
      await janusClient.getChatInfo()
      setRooms(janusClient.rooms)
      setRoomData(buildMultiTableProps(janusClient.rooms))
      janusClient.loadUser(name)
      setUser(janusClient.user)
      console.log('Chat info refreshed', janusClient.rooms)
    }
  }

  const destroyRoom = async (roomId, janusClient) => {
    return new Promise<void>(async (resolve, reject) => {
      try {
        if (roomId != null && roomId !== '') {
          if (janusClient) {
            await janusClient.destroyRoom(roomId)
            resolve()
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  const onClickDestroyRoom = async (event) => {
    const roomId = event.target.id.split('-')[1]
    var result = window.confirm(
      'You are about to delete this room, are you sure?'
    )
    if (result) {
      console.log('room deletion confirmed')
      if (state?.janusClient) {
        // Call the room deletion method in Janus
        await destroyRoom(roomId, state?.janusClient)
        updateChatInfo(state?.janusClient)
      }
    }
  }

  return (
    <Grid>
      <GridItem classItem="Camera" title="Camera">
        <>
          <div id="myvideo" className="camera">
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
          <audio ref={audioRef} className="rounded centered" autoPlay />
        </>
      </GridItem>
      <GridItem classItem="Chat" title="Tour rooms">
        <div className="chat">
          {!isJanusEnabled && (
            <>
              <div className="loader-container">
                <Loader type="Grid" color="#049730" height={100} width={100} />
              </div>
            </>
          )}
          {isJanusEnabled && (
            <>
              {isGuide && (
                <button
                  className="btn button-primary create-room"
                  onClick={onClickCreateRoom}
                >
                  Create Room
                </button>
              )}
              <MultiTableDrag
                data={roomData}
                destroyRoom={onClickDestroyRoom}
                mute={mute}
                unmute={unmute}
                onClickSwitchRoom={onClickSwitchRoom}
                orderSwitchRoom={orderSwitchRoom}
                isGuide={isGuide}
                selectVideo={selectVideo}
                user={user}
              />
              {/* <button
                  className="btn button-primary create-room"
                  onClick={onClickUpdateChatInfo}
                >
                  Load Rooms
                </button> */}
            </>
          )}
        </div>
      </GridItem>
    </Grid>
  )
}

export default ChatRoom
