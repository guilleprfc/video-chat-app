import { BehaviorSubject } from 'rxjs'
import {
  JoinAudioOptions,
  JoinVideoOptions,
  MessageAudioJoin,
  MessageVideoJoin,
  Participant,
  Publisher,
  PluginHandle,
  Janus as JanusClass,
  MessagesType,
  MessageTalkEvent,
} from './janus.types'

import Janus from '../../janus/janus' // new import
import { Console } from 'console'
// const Janus = require('../../janus/janus'); // old import

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
  videoRoomSubscriberPlugin: PluginHandle | undefined // Video Room plugin instance for subscribing to publishers
  AUDIO_ROOM_DEFAULT = 1234 // Default audio room
  VIDEO_ROOM_DEFAULT = 1234 // Default video room
  id = 0 // Id that identify the user in Janus
  participants: Participant[] = [] // Users connected in the audio chat
  publishers: Publisher[] = [] // Users publishing media via videoRoom
  audioElement: unknown
  videoElement: unknown
  userIsGuide: boolean = false
  subscriberPluginattached: boolean = false
  guideIsSubscriber: boolean = false
  guideSubscribedTo: string = ''
  user: Participant | undefined

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
   * Connect to Janus, create the session and attach to AudioBridge and VideoRoom
   */
  connectToJanus(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.initJanus) {
        this.createSession()
          .catch(reject)
          .then(async () => {
            try {
              this.audioBridgePlugin = await this.attachToAudioBridge()
              Janus.log(`Plugin attached! ( 
                ${this.audioBridgePlugin.getPlugin()}, id=${this.audioBridgePlugin.getId()})`)
              resolve()
            } catch (error) {
              reject(error)
            }
            try {
              this.videoRoomPlugin = await this.attachToVideoRoom()
              Janus.log(`Plugin attached! ( 
                ${this.videoRoomPlugin.getPlugin()}, id=${this.videoRoomPlugin.getId()})`)
              resolve()
            } catch (error) {
              reject(error)
            }
          })
      } else {
        reject(new Error())
      }
    })
  }

  /**
   * AUDIOBRIDGE plugin
   * Join a user in a room to allow audio chat
   * @param options User audio options
   * @param room (Optional) Number room to join. By default is 1234
   */
  joinAudioRoom(options: JoinAudioOptions, room?: number): void {
    this.audioOptions = options
    const roomToJoin = room || this.AUDIO_ROOM_DEFAULT
    const { display, muted } = options
    this.user = {
      id: 0,
      display,
      muted,
      setup: true,
    }
    const message = {
      request: 'join',
      room: roomToJoin,
      display,
    }
    this.audioBridgePlugin && this.audioBridgePlugin.send({ message })
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
      this.audioBridgePlugin && this.audioBridgePlugin.send({ message })
    }
  }

  /**
   * VIDEOROOM plugin
   * Join a user in a room to allow audio chat
   * @param options User audio options
   * @param room (Optional) Number room to join. By default is 1234
   */
  joinVideoRoom(options: JoinVideoOptions, room?: number): void {
    this.videoOptions = options
    const roomToJoin = room || this.VIDEO_ROOM_DEFAULT
    const { display, ptype } = options
    this.user = {
      id: 0,
      display,
      setup: true,
    }
    const message = {
      request: 'join',
      display,
      ptype,
      room: roomToJoin,
    }
    this.videoRoomPlugin && this.videoRoomPlugin.send({ message })
  }

  async attachSubscriberPlugin() {
    console.log('- - - - - attaching subscriber plugin - - - - -')
    try {
      this.videoRoomSubscriberPlugin = await this.attachToVideoRoomSubscriber()
    } catch (e) {
      console.log('Error: ' + e)
    }
    console.log('- - - - - attaching subscriber plugin END - - - - -')
  }

  /**
   * Function that requests Janus to send or stop sending the video from videoRoom.
   */
  selectVideo(relatedPublisher: Publisher): void {
    if (!this.subscriberPluginattached) {
      this.attachSubscriberPlugin().then(() => {
        if (this.videoRoomSubscriberPlugin) {
          Janus.log(`Plugin attached! ( 
              ${this.videoRoomSubscriberPlugin.getPlugin()}, id=${this.videoRoomSubscriberPlugin.getId()})`)
          this.subscriberPluginattached = true
        } else {
          console.log(
            'Error, the videoroom plugin for subscriptions could not be attached'
          )
        }
        // this.videoRoomSubscriberPlugin &&
        //   this.videoRoomSubscriberPlugin.createOffer({
        //     media: {
        //       audioRecv: false,
        //       videoRecv: false,
        //       audioSend: false,
        //       videoSend: true,
        //     }, // Publishers are sendonly
        //     success: this.onReceiveSDPVideoRoom.bind(this),
        //     error: function (error) {
        //       Janus.log('WebRTC error:', error)
        //     },
        //   })
        let message = {
          request: 'join',
          ptype: 'subscriber',
          room: this.VIDEO_ROOM_DEFAULT,
          feed: relatedPublisher.id,
        }
        this.videoRoomSubscriberPlugin &&
          this.videoRoomSubscriberPlugin.send({ message })
        console.log('- - - - - message to subscribe sent - - - - -')
      })
    } else {
      let message = {
        request: 'switch',
        feed: relatedPublisher.id,
      }
      console.log('switching subscription:')
      console.log(message)
      this.videoRoomSubscriberPlugin &&
        this.videoRoomSubscriberPlugin.send({ message })
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

  private async createSession(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.client = new Janus({
          server: this.url,
          success: resolve,
          error: reject,
        })
      } catch (error) {
        reject(error)
      }
    })
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
          opaqueId, // TODO new id for video??
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
          opaqueId, // TODO new id for video??
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
    console.log('- - - - - onMessageVideo - - - - -')
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
    console.log('- - - - - onMessageVideo END - - - - -')
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
    console.log('::: Got a local audio stream :::')
    console.log(stream)
  }

  private onLocalVideoStream(stream: MediaStream): void {
    console.log('- - - - - local video received - - - - -')
    Janus.log('::: Got a local video stream :::')
    Janus.log(stream)
    if (!this.userIsGuide) {
      Janus.attachMediaStream(this.videoElement, stream)
    }
  }

  private onRemoteAudioStream(stream: unknown): void {
    Janus.log(' ::: Got a remote audio stream :::')
    Janus.log(stream)
    Janus.attachMediaStream(this.audioElement, stream)
  }

  private onRemoteVideoStream(stream: unknown): void {
    console.log('- - - - - onRemoteVideoStream - - - - -')
    Janus.log(' ::: Got a remote video stream :::')
    Janus.log(stream)
    if (this.userIsGuide) {
      Janus.attachMediaStream(this.videoElement, stream)
    }
    console.log('- - - - - onRemoteVideoStream END - - - - -')
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

    if (!this.webrtcUp) {
      if (this.user) {
        this.user.id = id
        this.onUser.next(this.user)
      }
      this.webrtcUp = true
      console.log('Preparing to send offer via audiobridge')
      this.createOfferAudioBridge()
    }

    if (participants && participants.length > 0) {
      this.addParticipants(participants as Participant[])
    }
  }

  /**
   * VIDEOROOM plugin
   * When it receives a message from Janus with event 'joined'.
   * The message is received when the user is joined and others user are joined.
   * @param message // Message received
   */
  private onJoinVideo(message: MessageVideoJoin): void {
    console.log('- - - - - onJoinVideo - - - - -')
    const { id, publishers, room } = message
    Janus.log(`Successfully joined video room ${room} with ID ${this.id}`)
    console.log(`Successfully joined video room ${room} with ID ${this.id}`)

    if (!this.webrtcUp) {
      if (this.user) {
        this.user.id = id
        this.onUser.next(this.user)
      }
      this.webrtcUp = true
    }

    console.log('Preparing to become a publisher')
    this.publishOwnFeed()

    // Add new publishers to the publisher list
    if (publishers && publishers.length > 0) {
      this.addPublishers(publishers as Publisher[])
    }
    console.log('- - - - - onJoinVideo END - - - - -')
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
   * When it receives a message from Janus with event 'event'
   * The message is received when the room has been destroyed
   * @param message // Message received
   */
  private onAudioEvent(message): void {
    const { participants, error, leaving } = message
    Janus.log(`Received an audio event ${message}`)

    if (participants && participants.length > 0) {
      this.addParticipants(participants as Participant[])
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
   * When it receives a message from Janus with event 'event'
   * The message is received when the room has been destroyed
   * @param message // Message received
   */
  private onVideoEvent(message): void {
    console.log('- - - - - onVideoEvent - - - - -')
    const { publishers, error, leaving } = message
    Janus.log(`Received a video event ${message}`)
    console.log(message)

    if (message['publishers'] !== undefined && message['publishers'] !== null) {
      console.log('new publishers!')
      let list = message['publishers']
      for (let f in list) {
        let id = list[f]['id']
        let display = list[f]['display']
        let audio = list[f]['audio_codec']
        let video = list[f]['video_codec']
        console.log(
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
        // newRemoteFeed(id, display, audio, video);
      }
    }

    if (publishers && publishers.length > 0) {
      this.addPublishers(publishers as Publisher[])
    }

    if (error) {
      console.error(error)
    }

    if (leaving) {
      this.removePublisher(leaving)
    }
    console.log('- - - - - onVideoEvent END - - - - -')
  }

  /**
   * VIDEOROOM plugin
   * When it receives a message from Janus with event 'updated'
   * The message is received when a subscription to a publisher is made.
   * @param message // Message received
   */
  private onVideoAttached(message, jsep): void {
    console.log('- - - - - onVideoAttached - - - - -')
    const { streams } = message
    Janus.log(`Received a media attachment ${message}`)
    console.log(`Received a media attachment ${message}`)
    console.log(message)

    // if (streams && streams.length > 0) {
    //   Janus.attachMediaStream(this.videoElement, streams[0])
    // }

    console.log('- - - - - onVideoAttached END - - - - -')
  }

  /**
   * VIDEOROOM plugin
   * When it receives a message from Janus with event 'updated'
   * The message is received when a subscription to a publisher is updated.
   * @param message // Message received
   */
  private onVideoUpdate(message): void {
    console.log('- - - - - onVideoUpdate - - - - -')
    const { streams } = message
    Janus.log(`Received an update ${message}`)
    console.log(`Received an update ${message}`)

    if (streams && streams.length > 0) {
      Janus.attachMediaStream(this.videoElement, streams[0])
    }
    console.log('- - - - - onVideoUpdate END - - - - -')
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

  private publishOwnFeed(): void {
    console.log('- - - - - publishOwnFeed - - - - -')
    // Publish our stream
    this.videoRoomPlugin &&
      this.videoRoomPlugin.createOffer({
        media: {
          audioRecv: false,
          videoRecv: false,
          audioSend: false,
          videoSend: true,
        }, // Publishers are sendonly
        success: this.onReceiveSDPVideoRoom.bind(this),
        error: function (error) {
          Janus.log('WebRTC error:', error)
        },
      })
    console.log('- - - - - publishOwnFeed END - - - - -')
  }

  private onReceiveSDPVideoRoom(jsep): void {
    console.log('- - - - - onReceiveSDPVideoRoom - - - - -')
    Janus.log('Got publisher SDP!')
    Janus.log(jsep)
    const publish = { request: 'configure', audio: false, video: true }
    this.videoRoomPlugin &&
      this.videoRoomPlugin.send({ message: publish, jsep: jsep })
    console.log('- - - - - onReceiveSDPVideoRoom END - - - - -')
  }

  private onReceiveSDPVideoRoomSubscriber(jsep): void {
    console.log('- - - - - onReceiveSDPVideoRoomSubscriber - - - - -')
    Janus.log('Got publisher SDP!')
    Janus.log(jsep)
    const request = { request: 'start', room: 1234 }
    this.videoRoomSubscriberPlugin &&
      this.videoRoomSubscriberPlugin.send({ message: request, jsep: jsep })
    console.log('- - - - - onReceiveSDPVideoRoomSubscriber END - - - - -')
  }

  private addParticipants(participants: Participant[]): void {
    participants.forEach((participant) => {
      const exist = this.participants.some((user) => user.id === participant.id)

      if (!exist) {
        this.participants.push(participant)
      } else {
        this.participants = this.participants.map<Participant>(
          (user: Participant) => {
            if (user.id === participant.id) {
              return Object.assign(user, participant)
            }
            return user
          }
        )
      }
    })

    this.onParticipants.next(this.participants)
  }

  private addPublishers(publishers: Publisher[]): void {
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
      (participant) => participant.id !== leavingId
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
