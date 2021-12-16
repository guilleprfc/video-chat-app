import { BehaviorSubject } from 'rxjs'
import {
  JoinAudioOptions,
  JoinVideoOptions,
  JoinTextOptions,
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
  SwitchRequest,
} from './janus.types'

import Janus from '../../janus/janus' // new import

/* eslint-disable @typescript-eslint/no-var-requires */

const AUDOBRIDGE_PLUGIN_NAME = 'janus.plugin.audiobridge'
const VIDEOROOM_PLUGIN_NAME = 'janus.plugin.videoroom'
const TEXTROOM_PLUGIN_NAME = 'janus.plugin.textroom'
const opaqueId = Janus.randomString(12)
class JanusClient {
  url: string // Janus URL
  audioOptions: JoinAudioOptions = {} // Audio options
  videoOptions: JoinVideoOptions = {} // Video options
  textOptions: JoinTextOptions = {} // Text options
  initJanus = false // Specify if the Janus library was initialized or not
  webrtcUp = false // Specify if the audio stream was sent to Janus or not
  client: JanusClass | undefined // Instance of Janus
  audioBridgePlugin: PluginHandle | undefined // Audio Bridge plugin instance
  videoRoomPlugin: PluginHandle | undefined // Video Room plugin instance
  videoRoomSubscriberPlugin: PluginHandle | undefined // Video Room plugin instance for subscribing to publishers (Guides)
  textRoomPlugin: PluginHandle | undefined // Text Room plugin instance

  AUDIO_ROOM_DEFAULT = 1000000 // Default audio room
  VIDEO_ROOM_DEFAULT = 1000000 // Default video room
  TEXT_ROOM_DEFAULT = 1234 // Default text room

  id: number | undefined // Id that identifies the user in Janus

  rooms: Room[] = [] // Existing rooms
  participants: Participant[] = [] // Users connected in the audio chat
  publishers: Publisher[] = [] // Users publishing media via videoRoom
  textRoom: Room | undefined

  // Flag used to switch video rooms when needed
  pendingToSwitch: SwitchRequest | undefined

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
   * @param room (Optional) Number room to join.
   */
  joinAudioRoom(options: JoinAudioOptions, room?: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        this.audioOptions = options
        const roomToJoin = room || this.AUDIO_ROOM_DEFAULT
        const { display, muted } = options
        this.user = {
          display,
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
   * @param options User video options
   * @param room (Optional) Number room to join.
   */
  joinVideoRoom(options: JoinVideoOptions, room?: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        this.videoOptions = options
        const roomToJoin = room || this.VIDEO_ROOM_DEFAULT
        const { display, ptype } = options
        this.user = {
          display,
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
              console.log('Joining room ' + message.room)
              console.log('message', message)
              console.log('videoRoomPlugin', this.videoRoomPlugin)
              resolve(true)
            },
            error: (error) => {
              console.log('error', error)
              resolve(false)
            },
          })
      } catch (error) {
        reject(false)
      }
    })
  }

  /**
   * TEXTROOM plugin
   * Join a user in a text room
   * @param room (Optional) Number room to join. By default is 1234.
   */
  joinTextRoom(options: JoinTextOptions, room?: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        this.textOptions = options
        const roomToJoin = room || this.TEXT_ROOM_DEFAULT
        const { display, username } = options
        const message = {
          textroom: 'join',
          transaction: this.randomString(12),
          room: roomToJoin,
          username,
          display,
        }
        this.textRoomPlugin &&
          this.textRoomPlugin.data({
            text: JSON.stringify(message),
            success: () => {
              resolve(true)
            },
            error: (error) => {
              console.log('error', error)
              reject(false)
            },
          })
      } catch (error) {
        reject(false)
      }
    })
  }

  private async switchRoom(user, source, destination) {
    console.log('switchRoom', [user, source, destination])

    // Audiobridge has the changeroom request to easily change rooms
    await this.switchAudioRoom(user, destination)

    // Videoroom will require to make a leave-joinandconfigure-publish round to change rooms
    await this.switchVideoRoom(user, source, destination)

    // Trigger a reload of the chat info
    // await this.getChatInfo()
  }

  /**
   * AUDIOBRIDGE plugin
   * Change to another audioBridge room
   * @param room (Optional) Number room to join. By default is 1234
   */
  private switchAudioRoom(user: any, room: number): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      try {
        const roomToJoin = room || this.AUDIO_ROOM_DEFAULT
        const message = {
          request: 'changeroom',
          room: Number(roomToJoin),
          display: user.display,
          muted: true,
        }
        this.audioBridgePlugin &&
          this.audioBridgePlugin.send({
            message,
            success: () => {
              console.log('Changing to audio room ' + roomToJoin.toString())
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
  private switchVideoRoom(
    user: any,
    sourceRoom: number,
    destinationRoom: number
  ): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        // When the event from Janus is received, join the new room, for that,
        // store the destination room in the 'pendingToSwitch' variable.
        this.pendingToSwitch = {
          destinationId: destinationRoom,
          display: user.display,
        } as SwitchRequest
        // Leave the current video room
        this.leaveVideoRoom(sourceRoom)
        resolve(true)
      } catch (error) {
        reject(false)
      }
    })
  }

  private leaveVideoRoom(room: number): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
      try {
        const message = {
          request: 'leave',
          room,
        }
        this.videoRoomPlugin &&
          this.videoRoomPlugin.send({
            message,
            success: () => {
              console.log('Leaving videoroom', room)
              resolve(true)
            },
          })
        resolve(true)
      } catch (error) {
        reject(false)
      }
    })
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

  sendWhisper(to: string, text): void {
    if (to) {
      const message = {
        textroom: 'message',
        transaction: this.randomString(12),
        room: this.TEXT_ROOM_DEFAULT,
        to,
        text,
      }
      this.textRoomPlugin &&
        this.textRoomPlugin.data({
          text: JSON.stringify(message),
          success: (result) => {
            console.log('text message sent to ' + to + ':', text)
          },
          error: (result) => {
            console.error(result)
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
        this.loadUser(this.user?.display!)
        resolve()
      } catch (error) {
        reject('Could not get the chat status info: ' + error)
      }
    })
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
            message: { request: 'create', room: roomId, description, publishers: 10 },
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
      this.attachTextRoomPlugin(),
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

  private attachTextRoomPlugin(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        this.textRoomPlugin = await this.attachToTextRoom()
        Janus.log(`Plugin attached! (
          ${this.textRoomPlugin.getPlugin()}, id=${this.textRoomPlugin.getId()})`)
        // Setup the DataChannel
        this.textRoomPlugin.send({ message: { request: 'setup' } })
        resolve()
      } catch (error) {
        reject('Could not attach textRoom plugin: ' + error)
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

  private attachToTextRoom(): Promise<PluginHandle> {
    return new Promise<PluginHandle>((resolve, reject) => {
      this.client &&
        this.client.attach({
          plugin: TEXTROOM_PLUGIN_NAME,
          opaqueId,
          success: resolve,
          error: reject,
          iceState: this.onIceState.bind(this),
          mediaState: this.onMediaState.bind(this),
          webrtcState: this.onWebrtcState.bind(this),
          onmessage: this.onMessageText.bind(this),
          ondataopen: this.onDataOpen.bind(this),
          ondata: this.onData.bind(this),
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
        case MessagesType.MESSAGE_CHANGEROOM: {
          this.onAudioChangeRoom(message)
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
    console.log('New video message', message)

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

  private onMessageText(message, jsep) {
    Janus.log(' ::: Got a message :::', message)
    console.log(' ::: Got a message :::', message)
    if (message['error']) {
      console.log('error', message['error'])
    }
    if (jsep) {
      // Answer
      this.textRoomPlugin!.createAnswer({
        jsep: jsep,
        media: { audio: false, video: false, data: true }, // We only use datachannels
        success: (jsep) => {
          Janus.log('Got SDP!', jsep)
          var body = { request: 'ack' }
          this.textRoomPlugin!.send({ message: body, jsep: jsep })
        },
        error: (error) => {
          Janus.error('WebRTC error:', error)
        },
      })
    }
  }

  private async onDataOpen(data) {
    console.log('::: The DataChannel is available! :::')
    console.log('user', this.user)
    await this.joinTextRoom(
      { display: this.user?.display, username: this.user?.display },
      this.TEXT_ROOM_DEFAULT
    )
  }

  private onData(data) {
    console.debug('We got data from the DataChannel!', data)
    var json = JSON.parse(data)
    // var transaction = json['transaction']
    // if (transactions[transaction]) {
    //   // Someone was waiting for this
    //   transactions[transaction](json)
    //   delete transactions[transaction]
    //   return
    // }
    var what = json['textroom']
    var msg = this.escapeXmlTags(json['text'])
    var whisper = json['whisper']
    // var from = json['from']
    // var dateString = this.getDateString(json['date'])
    // var sender = this.escapeXmlTags(json['display'])
    // var display = json['display']
    var username = json['username']

    if (what === 'message') {
      // Incoming message: public or private?
      if (whisper === true) {
        // Private message
        console.log('::: A private message arrived :::', msg)
        var orderParams = msg.split('|')
        if (orderParams.length > 0) {
          var orderWhat = orderParams[0]
          if (orderWhat === 'switchRooms') {
            var originId = orderParams[1]
            var destinationId = orderParams[2]
            // trigger the room switch here
            this.switchRoom(this.user, originId, destinationId)
          }
        }
      } else {
        // Public message
        console.log('::: A public message arrived :::', msg)
      }
    } else if (what === 'announcement') {
      console.log('::: An announcement message arrived :::', msg)
    } else if (what === 'join') {
      // Somebody joined
      console.log('::: Somebody joined the text room :::', username)
    } else if (what === 'leave') {
      // Somebody left
      console.log('::: Somebody left the text room :::', msg)
    } else if (what === 'kicked') {
      // Somebody was kicked
      console.log('::: Somebody was kicked from the text room :::', username)
    } else if (what === 'destroyed') {
      // Room was destroyed, goodbye!
      Janus.warn('The room has been destroyed!')
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
    Janus.log(`Successfully joined audio room ${room} with ID ${id}`)
    console.log(
      `User with ID ${id} successfully joined audio room ${room}`
    )
    if (!this.webrtcUp) {
      // if (this.user) {
      //   this.user.audioId = id
      //   this.onUser.next(this.user)
      // }
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
    Janus.log(`Successfully joined video room ${room} with ID ${id}`)
    console.log(
      `User with ID ${id} successfully joined video room ${room}`
    )
    if (!this.webrtcUp) {
      // if (this.user) {
      //   this.user.audioId = id
      //   this.onUser.next(this.user)
      // }
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
    console.log('Received an audio event', message)

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
   * AUDIOBRIDGE plugin
   * When it receives a message from Janus with an changeroom message from audioBridge
   * @param message // Message received
   */
  private onAudioChangeRoom(message): void {
    const { participants, error, display, room } = message
    Janus.log(`Received an audio changeroom message ${message}`)
    console.log('Received an audio changeroom message', message)
    // Refresh the info from the server
    this.getChatInfo()
  }

  /**
   * VIDEOROOM plugin
   * When it receives a message from Janus with an event from videoRoom
   * @param message // Message received
   */
  private onVideoEvent(message): void {
    const { publishers, error, leaving, room } = message
    Janus.log(`Received a video event ${message}`)
    console.log('Received a video event', message)

    if (message['publishers'] !== undefined && message['publishers'] !== null) {
      Janus.log('new publishers!')
    }

    if (publishers && publishers.length > 0) {
      this.addPublishers(room, publishers as Array<Publisher>)
    }

    if (error) {
      console.error(error)
    }

    if (leaving) {
      // Remove the user from the "rooms" object
      this.removePublisher(room, leaving)
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
    this.onPublishers.next(this.publishers)
  }

  private removeParticipant(leavingId: number): void {
    this.participants = this.participants.filter(
      (participant) => participant.audioId !== leavingId
    )
    this.onParticipants.next(this.participants)
  }

  private removePublisher(roomId: number, leavingId: number): Promise<boolean> {
    return new Promise<boolean>( async (resolve, reject) => {
      try {
        var userId = leavingId
        // The leaving user is him/herself
        if (leavingId.toString() === 'ok') {
          userId = this.user?.videoId!
        }
        console.log('this.rooms', this.rooms)
        console.log(
          'participants in room before',
          this.rooms[0].participants!.length
        )
        let index = this.rooms
          .map((r) => {
            return r.roomId
          })
          .indexOf(roomId)
        console.log('index of room ' + roomId + ' is ' + index)
        console.log('leavingId', leavingId)
        console.log('userId', userId)
        console.log('this.user', this.user)
        this.rooms[index].participants = this.rooms[index].participants!.filter(
          (participant) => {
            return participant.videoId !== userId
          }
        )
        this.rooms[index].videoRoom!.participants = this.rooms[
          index
        ].videoRoom!.participants!.filter((participant) => {
          return participant.id !== userId
        })

        console.log(
          'participants in room after',
          this.rooms[0].participants!.length
        )
        // If the user leaving was caused by a room change, a switchRequest should exist
        if (leavingId.toString() === 'ok' && this.pendingToSwitch) {
          // To join a room after leaving, a detech/attach round is required for the PluginHandle
          await this.videoRoomPlugin?.detach({})
          await this.attachVideoRoomPlugin()
          this.joinVideoRoom({ display: this.pendingToSwitch.display, ptype: 'publisher' }, Number(this.pendingToSwitch.destinationId))
          this.pendingToSwitch = undefined
        }
        this.onPublishers.next(this.publishers)
        resolve(true)
      } catch (error) {
        reject(false)
      }
    })
  }

  private removePublisher2(roomId: number, leavingId: number): void {
    // this.publishers = this.publishers.filter(
    //   (publisher) => publisher.id !== leavingId
    // )
    var userId = leavingId
    // The leaving user is him/herself
    if (leavingId.toString() === 'ok') {
      userId = this.user?.videoId!
    }
    console.log('this.rooms', this.rooms)
    console.log(
      'participants in room before',
      this.rooms[0].participants!.length
    )
    let index = this.rooms
      .map((r) => {
        return r.roomId
      })
      .indexOf(roomId)
    console.log('index of room ' + roomId + ' is ' + index)
    console.log('leavingId', leavingId)
    console.log('userId', userId)
    console.log('this.user', this.user)
    this.rooms[index].participants = this.rooms[index].participants!.filter(
      (participant) => {
        return participant.videoId !== userId
      }
    )
    this.rooms[index].videoRoom!.participants = this.rooms[
      index
    ].videoRoom!.participants!.filter((participant) => {
      return participant.id !== userId
    })

    console.log(
      'participants in room after',
      this.rooms[0].participants!.length
    )
    // If the user leaving was caused by a room change, a switchRequest should exist
    if (leavingId.toString() === 'ok' && this.pendingToSwitch) {
      console.log('this.pendingToSwitch',this.pendingToSwitch)
      this.joinVideoRoom({ display: this.pendingToSwitch.display, ptype: 'publisher' }, Number(this.pendingToSwitch.destinationId))
      // this.joinVideoRoom(
      //   { display: this.pendingToSwitch.display, ptype: 'publisher' },
      //   1000000
      // )
      this.pendingToSwitch = undefined
    }
    // this.onPublishers.next(this.publishers)
  }

  private escapeXmlTags(value) {
    if (value) {
      var escapedValue = value.replace(new RegExp('<', 'g'), '&lt')
      escapedValue = escapedValue.replace(new RegExp('>', 'g'), '&gt')
      return escapedValue
    }
  }

  // Helper to format times
  // private getDateString(jsonDate) {
  //   var when = new Date()
  //   if (jsonDate) {
  //     when = new Date(Date.parse(jsonDate))
  //   }
  //   var dateString =
  //     ('0' + when.getUTCHours()).slice(-2) +
  //     ':' +
  //     ('0' + when.getUTCMinutes()).slice(-2) +
  //     ':' +
  //     ('0' + when.getUTCSeconds()).slice(-2)
  //   return dateString
  // }

  // Helper method to create random identifiers (e.g., transaction)
  private randomString(len) {
    const charSet =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    var randomString = ''
    for (var i = 0; i < len; i++) {
      var randomPoz = Math.floor(Math.random() * charSet.length)
      randomString += charSet.substring(randomPoz, randomPoz + 1)
    }
    return randomString
  }

  private compare = (a, b) => {
    if (a.display < b.display) {
      return -1
    }
    if (a.display > b.display) {
      return 1
    }
    return 0
  }
}

export { JanusClient }
