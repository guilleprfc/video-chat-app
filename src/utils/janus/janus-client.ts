import { BehaviorSubject } from 'rxjs'
import {
  JoinAudioOptions,
  JoinVideoOptions,
  MessageAudioJoin,
  MessageAudioSuccess,
  MessageAudioParticipants,
  MessageVideoJoin,
  MessageVideoSuccess,
  MessageVideoParticipants,
  Participant,
  AudioParticipant,
  VideoParticipant,
  Publisher,
  PluginHandle,
  Janus as JanusClass,
  MessagesType,
  MessageTalkEvent,
  VideoRoom,
  AudioRoom,
  Room,
} from './janus.types'

import Janus from '../../janus/janus' // new import

/* eslint-disable @typescript-eslint/no-var-requires */

const AUDOBRIDGE_PLUGIN_NAME = 'janus.plugin.audiobridge'
const VIDEOROOM_PLUGIN_NAME = 'janus.plugin.videoroom'
const opaqueId = 'audiobridgetest-' + Janus.randomString(12)
class JanusClient {
  url: string // Janus URL
  audioOptions: JoinAudioOptions = {} // Audio options
  videoOptions: JoinVideoOptions = {} // Video options
  initJanus = false // Specify if the Janus library was initialized or not
  webrtcUp = false // Specify if the audio stream was sent to Janus or not
  client: JanusClass | undefined // Instance of Janus
  audioBridgePlugin: PluginHandle | undefined // Audio Bridge plugin instance
  videoRoomPlugin: PluginHandle | undefined // Video Room plugin instance
  videoRoomSubscriberPlugin: PluginHandle | undefined // Video Room plugin instance for subscribing to publishers (Guides)

  AUDIO_ROOM_DEFAULT = 1000000 // Default audio room
  VIDEO_ROOM_DEFAULT = 1000000 // Default video room

  id = 0 // Id that identifies the user in Janus

  rooms: Room[] = [] // Existing rooms
  participants: Participant[] = [] // Users connected in the audio chat
  publishers: Publisher[] = [] // Users publishing media via videoRoom

  userIsGuide: boolean = false
  subscriberPluginattached: boolean = false
  guideIsSubscriber: boolean = false
  guideSubscribedTo: string = ''
  user: Participant | undefined
  audioElement: unknown
  videoElement: unknown

  onParticipants = new BehaviorSubject<Participant[]>([]) // Participants Subject
  onPublishers = new BehaviorSubject<Publisher[]>([]) // Participants Subject
  onUser = new BehaviorSubject<Participant | unknown>({})
  onTalking = new BehaviorSubject<MessageTalkEvent | unknown>({})
  onStopTalking = new BehaviorSubject<MessageTalkEvent | unknown>({})

  constructor(url: string) {
    this.url = url
  }

  init(debug = false): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        Janus.init({
          debug,
          callback: () => {
            this.initJanus = true
            resolve(true)
          },
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * With the Janus instance initialized, this for creating a session and
   * attaching the required plugins.
   */
  connectToJanus(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.createSession()
        .then(async () => {
          await this.attachPlugins()
        })
        .then(() => {
          console.log('All plugins attached, connected to Janus.')
          resolve(true)
        })
        .catch(() => {
          console.log('There has been an error during the plugin attachment.')
          reject(false)
        })
    })
  }

  /**
   * AUDIOBRIDGE plugin
   * Join a user in a room to allow audio chat
   * @param options User audio options
   * @param room (Optional) Number room to join. By default is 1234
   */
  joinAudioRoom(options: JoinAudioOptions, room?: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        this.audioOptions = options
        const roomToJoin = room || this.AUDIO_ROOM_DEFAULT
        const { display, muted } = options
        this.user = {
          audioId: 0,
          display,
          muted,
          setup: true,
        }
        const message = {
          request: 'join',
          room: roomToJoin,
          display,
          muted,
        }
        this.audioBridgePlugin &&
          this.audioBridgePlugin.send({
            message,
            success: () => {
              console.log('Joined audiobridge room', roomToJoin)
              resolve(true)
            },
          })
      } catch (error) {
        reject(false)
      }
    })
  }

  /**
   * VIDEOROOM plugin
   * Join a user in a video room
   * @param options User audio options
   * @param room (Optional) Number room to join. By default is 1234
   */
  joinVideoRoom(options: JoinVideoOptions, room?: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        this.videoOptions = options
        const roomToJoin = room || this.VIDEO_ROOM_DEFAULT
        const { display, ptype } = options
        this.user = {
          videoId: 0,
          display,
          setup: true,
        }
        const message = {
          request: 'join',
          display,
          ptype,
          room: roomToJoin,
        }
        this.videoRoomPlugin &&
          this.videoRoomPlugin.send({
            message,
            success: () => {
              console.log('Joined videoroom room', roomToJoin)
              resolve(true)
            },
          })
      } catch (error) {
        reject(false)
      }
    })
  }

  /**
   * AUDIOBRIDGE plugin
   * Change to another audioBridge room
   * @param room (Optional) Number room to join. By default is 1234
   */
  changeAudioRoom(room: number, display: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        const roomToJoin = room || this.AUDIO_ROOM_DEFAULT
        this.user = {
          audioId: 0,
          display,
          muted: true,
          setup: true,
        }
        const message = {
          request: 'changeroom',
          room: roomToJoin,
          display,
          muted: true,
        }
        this.audioBridgePlugin &&
          this.audioBridgePlugin.send({
            message,
            success: () => {
              console.log('Changed audiobridge room', roomToJoin)
              resolve(true)
            },
          })
      } catch (error) {
        reject(false)
      }
    })
  }

  /**
   * AUDIOBRIDGE plugin
   * Change to another audioBridge room
   * @param room (Optional) Number room to join. By default is 1234
   */
  changeVideoRoom(
    sourceRoom: number,
    destinationRoom: number,
    display: string
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        const roomToJoin = destinationRoom || this.VIDEO_ROOM_DEFAULT
        this.user = {
          videoId: 0,
          display,
          setup: true,
        }
        const message = {
          request: 'join',
          display,
          ptype: 'publisher',
          room: roomToJoin,
        }
        this.videoRoomPlugin &&
          this.videoRoomPlugin.send({
            message,
            success: () => {
              console.log('Joined videoroom room', roomToJoin)
              resolve(true)
            },
          })
      } catch (error) {
        reject(false)
      }
    }).then()
  }

  /**
   * Function that requests Janus to send or stop sending the video from videoRoom.
   */
  subscribeToPublisher(relatedPublisher): void {
    if (!this.subscriberPluginattached) {
      this.attachVideoSubscriberPlugin().then(() => {
        if (this.videoRoomSubscriberPlugin) {
          Janus.log(`Plugin attached! ( 
              ${this.videoRoomSubscriberPlugin.getPlugin()}, id=${this.videoRoomSubscriberPlugin.getId()})`)
          this.subscriberPluginattached = true
        } else {
          Janus.log(
            'Error, the videoroom plugin for subscriptions could not be attached'
          )
        }
        console.log('relatedPublisher', relatedPublisher)
        let message = {
          request: 'join',
          ptype: 'subscriber',
          room: this.VIDEO_ROOM_DEFAULT,
          feed: relatedPublisher,
        }
        this.videoRoomSubscriberPlugin &&
          this.videoRoomSubscriberPlugin.send({ message })
      })
    } else {
      let message = {
        request: 'switch',
        feed: relatedPublisher,
      }
      this.videoRoomSubscriberPlugin &&
        this.videoRoomSubscriberPlugin.send({ message })
    }
  }

  /**
   * Function that requests Janus to mute/unmute the audio coming from audioBridge.
   */
  mute(muted: boolean): void {
    if (this.webrtcUp) {
      const message = {
        request: 'configure',
        muted,
      }
      this.audioBridgePlugin &&
        this.audioBridgePlugin.send({
          message,
          success: (result) => {
            console.log('user muted', muted)
          },
        })
    }
  }

  setAudio(audioElement: unknown): void {
    this.audioElement = audioElement
  }

  setVideo(videoElement: unknown): void {
    this.videoElement = videoElement
  }

  setUserIsGuide(isGuide: boolean): void {
    this.userIsGuide = isGuide
  }

  loadUser(userName: string) {
    let user: Participant = {}
    if (this.rooms) {
      for (let i = 0; i < this.rooms.length; i++) {
        if (this.rooms[i].participants) {
          for (let j = 0; j < this.rooms[i].participants!.length; j++) {
            const participant = this.rooms[i].participants![j]
            if (participant.display === userName) {
              user = participant as Participant
              user.room = this.rooms[i].roomId
              this.user = user
              break
            }
          }
        }
      }
    }
  }

  async getChatInfo(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        // Rooms
        const audioRooms: Array<AudioRoom> = await this.getAudioRoomsList()
        const videoRooms: Array<VideoRoom> = await this.getVideoRoomsList()
        // Arrange results to group rooms by Id
        const rooms = new Array<Room>()
        let index = -1
        for (let i = 0; i < audioRooms.length; i++) {
          for (let j = 0; j < rooms.length; j++) {
            if (rooms[j].roomId === audioRooms[i].room) index = j
          }
          if (index >= 0) {
            rooms[index].audioRoom = audioRooms[i]
          } else {
            rooms.push({
              roomId: audioRooms[i].room,
              description: audioRooms[i].description,
              audioRoom: audioRooms[i],
              videoRoom: undefined,
            })
          }
          index = -1
        }
        for (let i = 0; i < videoRooms.length; i++) {
          for (let j = 0; j < rooms.length; j++) {
            if (rooms[j].roomId === videoRooms[i].room) index = j
          }
          if (index >= 0) {
            rooms[index].videoRoom = videoRooms[i]
          } else {
            rooms.push({
              roomId: videoRooms[i].room,
              description: videoRooms[i].description,
              audioRoom: undefined,
              videoRoom: videoRooms[i],
            })
          }
          index = -1
        }

        this.rooms = rooms

        // Participants
        await this.loadParticipants()

        // Create one participant list
        let participants = new Array<Participant>()
        let audioParticipants = new Array<AudioParticipant>()
        let videoParticipants = new Array<VideoParticipant>()
        for (let i = 0; i < rooms.length; i++) {
          participants = new Array<Participant>()
          // Audio participants
          if (rooms[i].audioRoom && rooms[i].audioRoom?.participants) {
            audioParticipants = rooms[i].audioRoom
              ?.participants as Array<AudioParticipant>
            index = -1
            for (let a = 0; a < audioParticipants.length; a++) {
              index = participants.findIndex(
                (p) => p.display === audioParticipants[a].display
              )
              if (index >= 0) {
                participants[index].audioId = audioParticipants[a].id
                participants[index].setup = audioParticipants[a].setup
                participants[index].muted = audioParticipants[a].muted
              } else {
                participants.push({
                  audioId: audioParticipants[a].id,
                  display: audioParticipants[a].display,
                  setup: audioParticipants[a].setup,
                  muted: audioParticipants[a].muted,
                } as Participant)
              }
            }
          }
          // Video participants
          if (rooms[i].videoRoom && rooms[i].videoRoom?.participants) {
            videoParticipants = rooms[i].videoRoom
              ?.participants as Array<VideoParticipant>
            index = -1
            for (let v = 0; v < videoParticipants.length; v++) {
              index = participants.findIndex(
                (p) => p.display === videoParticipants[v].display
              )
              if (index >= 0) {
                participants[index].videoId = videoParticipants[v].id
                participants[index].publisher = videoParticipants[v].publisher
              } else {
                participants.push({
                  videoId: videoParticipants[v].id,
                  display: videoParticipants[v].display,
                  publisher: videoParticipants[v].publisher,
                } as Participant)
              }
            }
          }
          rooms[i].participants = participants.sort(this.compare)
        }
        resolve()
      } catch (error) {
        reject('Could not get the chat status info: ' + error)
      }
    })
  }

  compare = (a, b) => {
    if (a.display < b.display) {
      return -1
    }
    if (a.display > b.display) {
      return 1
    }
    return 0
  }

  async createRoom(description, roomId): Promise<any[]> {
    return Promise.all([
      this.createAudioRoom(description, roomId),
      this.createVideoRoom(description, roomId),
    ])
  }

  async destroyRoom(roomId): Promise<any[]> {
    return Promise.all([
      this.destroyAudioRoom(roomId),
      this.destroyVideoRoom(roomId),
    ])
  }

  private async createAudioRoom(description, roomId): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        // Send the request to Janus
        if (this.audioBridgePlugin) {
          this.audioBridgePlugin.send({
            message: { request: 'create', room: roomId, description },
            success: (result) => {
              // console.log('audio room ' + roomId + ' created', result)
              resolve()
            },
          })
        }
      } catch (error) {
        reject('Error creating an audioBridge room: ' + error)
      }
    })
  }

  private async createVideoRoom(description, roomId): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        // Send the request to Janus
        if (this.videoRoomPlugin) {
          this.videoRoomPlugin.send({
            message: { request: 'create', room: roomId, description },
            success: (result) => {
              // console.log('video room ' + roomId + ' created', result)
              resolve()
            },
          })
        }
      } catch (error) {
        reject('Error creating a videoRoom room: ' + error)
      }
    })
  }

  private async destroyAudioRoom(roomId): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        // Send the request to Janus
        if (this.audioBridgePlugin) {
          this.audioBridgePlugin.send({
            message: { request: 'destroy', room: parseInt(roomId) },
            success: (result) => {
              console.log('audio room ' + roomId + ' destroyed', result)
              resolve()
            },
          })
        }
      } catch (error) {
        reject('Error destroying an audioBridge room: ' + error)
      }
    })
  }

  private async destroyVideoRoom(roomId): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        // Send the request to Janus
        if (this.videoRoomPlugin) {
          this.videoRoomPlugin.send({
            message: { request: 'destroy', room: parseInt(roomId) },
            success: (result) => {
              console.log('video room ' + roomId + ' destroyed', result)
              resolve()
            },
          })
        }
      } catch (error) {
        reject('Error destroying a videoRoom room: ' + error)
      }
    })
  }

  private getAudioRoomsList(): Promise<AudioRoom[]> {
    return new Promise<AudioRoom[]>((resolve, reject) => {
      try {
        // Send the request to Janus
        if (this.audioBridgePlugin) {
          this.audioBridgePlugin.send({
            message: { request: 'list' },
            success: (result) => {
              // console.log('Audio rooms fetched from Janus: ',result)
              let roomList = (result as MessageAudioSuccess).list as AudioRoom[]
              let rooms = new Array<AudioRoom>()
              for (let i = 0; i < roomList.length; i++) {
                if (roomList[i].room !== 1234 && roomList[i].room !== 5678)
                  rooms.push(roomList[i])
              }
              resolve(rooms)
            },
          })
        }
      } catch (error) {
        reject('Error getting audio rooms list: ' + error)
      }
    })
  }

  private getVideoRoomsList(): Promise<VideoRoom[]> {
    return new Promise<VideoRoom[]>((resolve, reject) => {
      try {
        // Send the request to Janus
        if (this.videoRoomPlugin) {
          this.videoRoomPlugin.send({
            message: { request: 'list' },
            success: (result) => {
              // console.log('Video rooms fetched from Janus:', result)
              let roomList = (result as MessageVideoSuccess).list as VideoRoom[]
              let rooms = new Array<VideoRoom>()
              for (let i = 0; i < roomList.length; i++) {
                if (roomList[i].room !== 1234 && roomList[i].room !== 5678)
                  rooms.push(roomList[i])
              }
              resolve(rooms)
            },
          })
        }
      } catch (error) {
        reject('Error getting video rooms list: ' + error)
      }
    })
  }

  private async loadParticipants(): Promise<void> {
    return new Promise<void>(async (resolve, reject) => {
      try {
        for (let i = 0; i < this.rooms.length; i++) {
          const audioParticipants: Array<AudioParticipant> =
            await this.getAudioParticipantsList(this.rooms[i].roomId)
          const videoParticipants: Array<VideoParticipant> =
            await this.getVideoParticipantsList(this.rooms[i].roomId)
          this.rooms[i].audioRoom!.participants = audioParticipants
          this.rooms[i].videoRoom!.participants = videoParticipants
        }
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  }

  private getVideoParticipantsList(roomId): Promise<Array<VideoParticipant>> {
    return new Promise<Array<VideoParticipant>>((resolve, reject) => {
      try {
        // Send the request to Janus
        if (this.videoRoomPlugin) {
          this.videoRoomPlugin.send({
            message: { request: 'listparticipants', room: roomId },
            success: (result) => {
              this.participants = (result as MessageVideoParticipants)
                .participants as Array<VideoParticipant>
              resolve(
                (result as MessageVideoParticipants)
                  .participants as Array<VideoParticipant>
              )
            },
          })
        }
      } catch (error) {
        reject('Error retrieving video participants: ' + error)
      }
    })
  }

  private getAudioParticipantsList(roomId): Promise<Array<AudioParticipant>> {
    return new Promise<Array<AudioParticipant>>((resolve, reject) => {
      try {
        // Send the request to Janus
        if (this.audioBridgePlugin) {
          this.audioBridgePlugin.send({
            message: { request: 'listparticipants', room: roomId },
            success: (result) => {
              this.participants = (result as MessageAudioParticipants)
                .participants as Array<AudioParticipant>
              resolve(
                (result as MessageAudioParticipants)
                  .participants as Array<AudioParticipant>
              )
            },
          })
        }
      } catch (error) {
        reject('Error retrieving audio participants: ' + error)
      }
    })
  }

  private createSession(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.initJanus) {
        try {
          this.client = new Janus({
            server: this.url,
            success: resolve,
            error: reject,
          })
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error('Could not initialize Janus'))
      }
    })
  }

  private attachPlugins(): Promise<any[]> {
    return Promise.all([
      this.attachAudioBridgePlugin(),
      this.attachVideoRoomPlugin(),
    ])
  }

  private attachAudioBridgePlugin(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        this.audioBridgePlugin = await this.attachToAudioBridge()
        Janus.log(`Plugin attached! ( 
        ${this.audioBridgePlugin.getPlugin()}, id=${this.audioBridgePlugin.getId()})`)
        resolve()
      } catch (error) {
        reject('Could not attach audioBridge plugin: ' + error)
      }
    })
  }

  private attachVideoRoomPlugin(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        this.videoRoomPlugin = await this.attachToVideoRoom()
        Janus.log(`Plugin attached! (
          ${this.videoRoomPlugin.getPlugin()}, id=${this.videoRoomPlugin.getId()})`)
        resolve()
      } catch (error) {
        reject('Could not attach videoRoom plugin: ' + error)
      }
    })
  }

  private async attachVideoSubscriberPlugin() {
    try {
      this.videoRoomSubscriberPlugin = await this.attachToVideoRoomSubscriber()
    } catch (e) {
      console.log('Error: ' + e)
    }
  }

  private attachToAudioBridge(): Promise<PluginHandle> {
    return new Promise<PluginHandle>((resolve, reject) => {
      this.client &&
        this.client.attach({
          plugin: AUDOBRIDGE_PLUGIN_NAME,
          opaqueId,
          success: resolve,
          error: reject,
          iceState: this.onIceState.bind(this),
          mediaState: this.onMediaState.bind(this),
          webrtcState: this.onWebrtcState.bind(this),
          onmessage: this.onMessageAudio.bind(this),
          onlocalstream: this.onLocalAudioStream.bind(this),
          onremotestream: this.onRemoteAudioStream.bind(this),
          oncleanup: this.onCleanUp.bind(this),
        })
    })
  }

  private attachToVideoRoom(): Promise<PluginHandle> {
    return new Promise<PluginHandle>((resolve, reject) => {
      this.client &&
        this.client.attach({
          plugin: VIDEOROOM_PLUGIN_NAME,
          opaqueId,
          success: resolve,
          error: reject,
          iceState: this.onIceState.bind(this),
          mediaState: this.onMediaState.bind(this),
          webrtcState: this.onWebrtcState.bind(this),
          onmessage: this.onMessageVideo.bind(this),
          onlocalstream: this.onLocalVideoStream.bind(this),
          onremotestream: this.onRemoteVideoStream.bind(this),
          oncleanup: this.onCleanUp.bind(this),
        })
    })
  }

  private attachToVideoRoomSubscriber(): Promise<PluginHandle> {
    return new Promise<PluginHandle>((resolve, reject) => {
      this.client &&
        this.client.attach({
          plugin: VIDEOROOM_PLUGIN_NAME,
          opaqueId,
          success: resolve,
          error: reject,
          iceState: this.onIceState.bind(this),
          mediaState: this.onMediaState.bind(this),
          webrtcState: this.onWebrtcState.bind(this),
          onmessage: this.onMessageVideoSubscriber.bind(this),
          onlocalstream: this.onLocalVideoStream.bind(this),
          onremotestream: this.onRemoteVideoStream.bind(this),
          oncleanup: this.onCleanUp.bind(this),
        })
    })
  }

  private onIceState(state: unknown): void {
    Janus.log(`ICE state changed to ${state}`)
  }

  private onMediaState(medium: 'audio' | 'video', receiving?: boolean): void {
    Janus.log(
      `Janus ${receiving ? 'started' : 'stopped'} receiving our ${medium}`
    )
  }

  private onWebrtcState(isConnected: boolean): void {
    Janus.log(
      `Janus says our WebRTC PeerConnection is ${
        isConnected ? 'up' : 'down'
      } now`
    )
  }

  private onMessageAudio(message, jsep): void {
    const { audiobridge: event } = message

    if (event) {
      switch (event) {
        case MessagesType.MESSAGE_JOINED: {
          this.onJoinAudio(message as MessageAudioJoin)
          break
        }
        case MessagesType.MESSAGE_DESTROYED: {
          this.onDestroy(message)
          break
        }
        case MessagesType.MESSAGE_EVENT: {
          this.onAudioEvent(message)
          break
        }
        case MessagesType.MESSAGE_STOP_TALKING:
        case MessagesType.MESSAGE_TALKING: {
          this.onTalkingEvent(message as MessageTalkEvent)
          break
        }
      }
    }
    if (jsep) {
      Janus.log('Handling SDP as well...', jsep)
      this.audioBridgePlugin &&
        this.audioBridgePlugin.handleRemoteJsep({ jsep })
    }
  }

  private onMessageVideo(message, jsep): void {
    const { videoroom: msgType } = message

    if (msgType) {
      switch (msgType) {
        case MessagesType.MESSAGE_JOINED: {
          this.onJoinVideo(message as MessageVideoJoin)
          break
        }
        case MessagesType.MESSAGE_DESTROYED: {
          this.onDestroy(message)
          break
        }
        case MessagesType.MESSAGE_EVENT: {
          this.onVideoEvent(message)
          break
        }
      }
    }
    if (jsep) {
      Janus.log('Handling SDP as well...', jsep)
      this.videoRoomPlugin && this.videoRoomPlugin.handleRemoteJsep({ jsep })
    }
  }

  private onMessageVideoSubscriber(message, jsep): void {
    const { videoroom: msgType } = message

    if (msgType) {
      switch (msgType) {
        case MessagesType.MESSAGE_JOINED: {
          this.onJoinVideo(message as MessageVideoJoin)
          break
        }
        case MessagesType.MESSAGE_DESTROYED: {
          this.onDestroy(message)
          break
        }
        case MessagesType.MESSAGE_EVENT: {
          this.onVideoEvent(message)
          break
        }
        case MessagesType.MESSAGE_UPDATE: {
          this.onVideoUpdate(message)
          break
        }
        case MessagesType.MESSAGE_ATTACHED: {
          this.onVideoAttached(message, jsep)
          break
        }
      }
    }
    if (jsep) {
      Janus.log('Handling SDP as well...', jsep)
      if (msgType === MessagesType.MESSAGE_ATTACHED) {
        this.videoRoomSubscriberPlugin &&
          this.videoRoomSubscriberPlugin.createAnswer({
            jsep: jsep,
            media: {
              audioSend: false,
              videoSend: false,
            }, // Publishers are sendonly
            success: this.onReceiveSDPVideoRoomSubscriber.bind(this),
            error: function (error) {
              Janus.log('WebRTC error:', error)
            },
          })
      } else {
        this.videoRoomSubscriberPlugin &&
          this.videoRoomSubscriberPlugin.handleRemoteJsep({ jsep })
      }
    }
  }

  private onLocalAudioStream(stream: MediaStream): void {
    Janus.log('::: Got a local audio stream :::')
    Janus.log(stream)
  }

  private onLocalVideoStream(stream: MediaStream): void {
    if (!this.userIsGuide) {
      Janus.log('::: Got a local video stream :::')
      Janus.log(stream)
      Janus.attachMediaStream(this.videoElement, stream)
    }
  }

  private onRemoteAudioStream(stream: unknown): void {
    Janus.log(' ::: Got a remote audio stream :::')
    Janus.log(stream)
    Janus.attachMediaStream(this.audioElement, stream)
  }

  private onRemoteVideoStream(stream: unknown): void {
    if (this.userIsGuide) {
      Janus.log(' ::: Got a remote video stream :::')
      Janus.log(stream)
      Janus.attachMediaStream(this.videoElement, stream)
    }
  }

  private onCleanUp(): void {
    Janus.log('Cleanup notification')
    this.webrtcUp = false
  }

  /**
   * AUDIOBRIDGE plugin
   * When it receives a message from Janus with event 'joined'.
   * The message is received when the user is joined and others user are joined.
   * @param message // Message received
   */
  private onJoinAudio(message: MessageAudioJoin): void {
    const { id, participants, room } = message
    Janus.log(`Successfully joined audio room ${room} with ID ${this.id}`)
    console.log(
      `User with ID ${this.id} successfully joined audio room ${room}`
    )
    if (!this.webrtcUp) {
      if (this.user) {
        this.user.audioId = id
        this.onUser.next(this.user)
      }
      this.webrtcUp = true
      this.createOfferAudioBridge()
    }

    if (participants && participants.length > 0) {
      this.addParticipants(room, participants as Array<AudioParticipant>)
    }
  }

  /**
   * VIDEOROOM plugin
   * When it receives a message from Janus with event 'joined'.
   * The message is received when the user is joined and others user are joined.
   * @param message // Message received
   */
  private onJoinVideo(message: MessageVideoJoin): void {
    const { id, publishers, room } = message
    Janus.log(`Successfully joined video room ${room} with ID ${this.id}`)
    console.log(
      `User with ID ${this.id} successfully joined video room ${room}`
    )
    if (!this.webrtcUp) {
      if (this.user) {
        this.user.audioId = id
        this.onUser.next(this.user)
      }
      this.webrtcUp = true
    }
    // After joining the room, we publish our own feed
    this.createOfferVideoRoom()

    // Add new publishers to the publisher list
    if (publishers && publishers.length > 0) {
      this.addPublishers(room, publishers as Array<Publisher>)
    }
  }

  /**
   * When it receives a message from Janus with event 'destroy'
   * The message is received when the room has been destroyed
   * @param message // Message received
   */
  private onDestroy(message: unknown): void {
    console.error('The room audio has been destroyed', message)
  }

  /**
   * AUDIOBRIDGE plugin
   * When it receives a message from Janus with an event from audioBridge
   * @param message // Message received
   */
  private onAudioEvent(message): void {
    const { participants, error, leaving, room } = message
    Janus.log(`Received an audio event ${message}`)

    if (participants && participants.length > 0) {
      this.addParticipants(room, participants as Array<AudioParticipant>)
    }

    if (error) {
      console.error(error)
    }

    if (leaving) {
      this.removeParticipant(leaving)
    }
  }

  /**
   * VIDEOROOM plugin
   * When it receives a message from Janus with an event from videoRoom
   * @param message // Message received
   */
  private onVideoEvent(message): void {
    const { publishers, error, leaving, room } = message
    Janus.log(`Received a video event ${message}`)

    if (message['publishers'] !== undefined && message['publishers'] !== null) {
      Janus.log('new publishers!')
      let list = message['publishers']
      for (let f in list) {
        let id = list[f]['id']
        let display = list[f]['display']
        let audio = list[f]['audio_codec']
        let video = list[f]['video_codec']
        Janus.log(
          '  >> [' +
            id +
            '] ' +
            display +
            ' (audio: ' +
            audio +
            ', video: ' +
            video +
            ')'
        )
      }
    }

    if (publishers && publishers.length > 0) {
      this.addPublishers(room, publishers as Array<Publisher>)
    }

    if (error) {
      console.error(error)
    }

    if (leaving) {
      this.removePublisher(leaving)
    }
  }

  /**
   * VIDEOROOM plugin
   * When it receives a message from Janus with event 'updated'
   * The message is received when a subscription to a publisher is made.
   * @param message // Message received
   */
  private onVideoAttached(message, jsep): void {
    Janus.log(`Received a media attachment ${message}`)
  }

  /**
   * VIDEOROOM plugin
   * When it receives a message from Janus with event 'updated'
   * The message is received when a subscription to a publisher is updated.
   * @param message // Message received
   */
  private onVideoUpdate(message): void {
    const { streams } = message
    Janus.log(`Received an update ${message}`)

    if (streams && streams.length > 0) {
      Janus.attachMediaStream(this.videoElement, streams[0])
    }
  }

  /**
   * When it receives a message from Janus with event 'talking' or 'stopped-talking'
   * The message is received when other user is talking or stops talking.
   * @param message // Message received
   */
  private onTalkingEvent(message: MessageTalkEvent): void {
    const { id, audiobridge: event } = message
    Janus.log(`User with id ${id} is ${event}`)
    switch (event) {
      case MessagesType.MESSAGE_TALKING: {
        this.onTalking.next(message)
        break
      }
      case MessagesType.MESSAGE_STOP_TALKING: {
        this.onStopTalking.next(message)
        break
      }
    }
  }

  private createOfferAudioBridge(): void {
    this.audioBridgePlugin &&
      this.audioBridgePlugin.createOffer({
        media: { video: false },
        success: this.onReceiveSDPAudioBridge.bind(this),
        error: console.error,
      })
  }

  private onReceiveSDPAudioBridge(jsep): void {
    const { muted } = this.audioOptions
    const message = {
      request: 'configure',
      muted,
    }
    this.audioBridgePlugin && this.audioBridgePlugin.send({ message, jsep })
  }

  private createOfferVideoRoom(): void {
    this.videoRoomPlugin &&
      this.videoRoomPlugin.createOffer({
        media: { videoSend: true }, // Publishers are sendonly
        success: this.onReceiveSDPVideoRoom.bind(this),
        error: console.error,
      })
  }

  private onReceiveSDPVideoRoom(jsep): void {
    const message = { request: 'configure', audio: false, video: true }
    this.videoRoomPlugin &&
      this.videoRoomPlugin.send({ message: message, jsep: jsep })
  }

  private onReceiveSDPVideoRoomSubscriber(jsep): void {
    Janus.log('Got publisher SDP!')
    Janus.log(jsep)
    const request = { request: 'start', room: 1234 }
    this.videoRoomSubscriberPlugin &&
      this.videoRoomSubscriberPlugin.send({ message: request, jsep: jsep })
  }

  private addParticipants(roomId: number, participants): void {
    participants.forEach((participant) => {
      let exist = this.participants.some(
        (user) => user.audioId === participant.id
      )

      if (!exist) {
        this.participants.push(participant)
      } else {
        this.participants = this.participants.map<Participant>(
          (user: Participant) => {
            if (user.audioId === participant.id) {
              return Object.assign(user, participant)
            }
            return user
          }
        )
      }
    })

    this.onParticipants.next(this.participants)
  }

  private addPublishers(roomId: number, publishers: Array<Publisher>): void {
    publishers.forEach((publisher) => {
      const exist = this.publishers.some((user) => user.id === publisher.id)

      if (!exist) {
        this.publishers.push(publisher)
      } else {
        this.publishers = this.publishers.map<Publisher>((user: Publisher) => {
          if (user.id === publisher.id) {
            return Object.assign(user, publisher)
          }
          return user
        })
      }
    })
    console.log('this.onPublishers.next', this.publishers)
    this.onPublishers.next(this.publishers)
  }

  private removeParticipant(leavingId: number): void {
    this.participants = this.participants.filter(
      (participant) => participant.audioId !== leavingId
    )
    this.onParticipants.next(this.participants)
  }

  private removePublisher(leavingId: number): void {
    this.publishers = this.publishers.filter(
      (publisher) => publisher.id !== leavingId
    )
    this.onPublishers.next(this.publishers)
  }
}

export { JanusClient }
