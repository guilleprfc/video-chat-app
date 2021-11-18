import { BehaviorSubject } from 'rxjs';
import {
  JoinAudioOptions,
  JoinVideoOptions,
  MessageAudioJoin,
  Participant,
  PluginHandle,
  Janus as JanusClass,
  MessagesType,
  MessageTalkEvent
} from './janus.types';

import Janus from '../../janus/janus'; // new import
// const Janus = require('../../janus/janus'); // old import

/* eslint-disable @typescript-eslint/no-var-requires */

const AUDOBRIDGE_PLUGIN_NAME = 'janus.plugin.audiobridge';
const VIDEOROOM_PLUGIN_NAME = 'janus.plugin.videoroom';
const opaqueId = 'audiobridgetest-' + Janus.randomString(12);
class JanusClient {
  url: string; // Janus URL
  audioOptions: JoinAudioOptions = {}; // Audio options
  videoOptions: JoinVideoOptions = {}; // Video options
  initJanus = false; // Specify if the Janus library was initialized or not
  webrtcUp = false; // Specify if the audio stream was sent to Janus or not
  client: JanusClass | undefined; // Instance of Janus
  audioBridgePlugin: PluginHandle | undefined; // Audio Bridge plugin instance
  videoRoomPlugin: PluginHandle | undefined; // Video Room plugin instance
  AUDIO_ROOM_DEFAULT = 1234; // Default audio room
  VIDEO_ROOM_DEFAULT = 1234; // Default video room
  id = 0; // Id that identify the user in Janus
  participants: Participant[] = []; // Users connected in the audio chat
  audioElement: unknown;
  user: Participant | undefined;

  onParticipants = new BehaviorSubject<Participant[]>([]); // Participants Subject
  onUser = new BehaviorSubject<Participant | unknown>({});
  onTalking = new BehaviorSubject<MessageTalkEvent | unknown>({});
  onStopTalking = new BehaviorSubject<MessageTalkEvent | unknown>({});

  constructor(url: string) {
    this.url = url;
  }

  init(debug = true): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        Janus.init({
          debug,
          callback: () => {
            this.initJanus = true;
            resolve(true);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
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
              this.audioBridgePlugin = await this.attachToAudioBridge();              
              Janus.log(`Plugin attached! ( 
                ${this.audioBridgePlugin.getPlugin()}, id=${this.audioBridgePlugin.getId()})`);
              resolve();
            } catch (error) {
              reject(error);
            }
            try {
              this.videoRoomPlugin = await this.attachToVideoRoom();
              Janus.log(`Plugin attached! ( 
                ${this.videoRoomPlugin.getPlugin()}, id=${this.videoRoomPlugin.getId()})`);
              resolve();
            } catch (error) {
              reject(error);
            }
          });
      } else {
        reject(new Error());
      }
    });
  }

  /**
   * Join a user in a room to allow audio chat
   * @param options User audio options
   * @param room (Optional) Number room to join. By default is 1234
   */
  joinAudioChat(options: JoinAudioOptions, room?: number): void {
    this.audioOptions = options;
    const roomToJoin = room || this.AUDIO_ROOM_DEFAULT;
    const { display, muted } = options;
    this.user = {
      id: 0,
      display,
      muted,
      setup: true
    };
    const message = {
      request: 'join',
      room: roomToJoin,
      display
    };
    this.audioBridgePlugin && this.audioBridgePlugin.send({ message });
  }

  /**
   * Function that requests Janus to mute/unmute the audio coming from audioBridge.
   */
  mute(muted: boolean): void {
    if (this.webrtcUp) {
      const message = {
        request: 'configure',
        muted
      };
      this.audioBridgePlugin && this.audioBridgePlugin.send({ message });
    }
  }

 /**
   * Join a user in a room to allow audio chat
   * @param options User audio options
   * @param room (Optional) Number room to join. By default is 1234
   */
  joinVideoRoom(options: JoinVideoOptions, room?: number): void {
    this.videoOptions = options;
    const roomToJoin = room || this.VIDEO_ROOM_DEFAULT;
    const { display, ptype } = options;
    this.user = {
      id: 0,
      display,
      setup: true
    };
    const message = {
      request: 'join',
      display,
      ptype,
      room: roomToJoin
    };
    this.videoRoomPlugin && this.videoRoomPlugin.send({ message });
  }

  /**
   * Function that requests Janus to send or stop sending the video from videoRoom.
   */
  selectVideo(selected: boolean): void {
    if (this.webrtcUp) {
      const message = {
        request: '',
        send: selected
      };
      this.videoRoomPlugin && this.videoRoomPlugin.send({ message });
    }
  }

  setAudio(audioElement: unknown): void {
    this.audioElement = audioElement;
  }

  private async createSession(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.client = new Janus({
          server: this.url,
          success: resolve,
          error: reject
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private attachToAudioBridge(): Promise<PluginHandle> {
    return new Promise<PluginHandle>((resolve, reject) => {
      this.client && this.client.attach({
        plugin: AUDOBRIDGE_PLUGIN_NAME,
        opaqueId,
        success: resolve,
        error: reject,
        iceState: this.onIceState.bind(this),
        mediaState: this.onMediaState.bind(this),
        webrtcState: this.onWebrtcState.bind(this),
        onmessage: this.onMessage.bind(this),
        onlocalstream: this.onLocalStream,
        onremotestream: this.onRemoteStream.bind(this),
        oncleanup: this.onCleanUp.bind(this)
      });
    });
  }

  private attachToVideoRoom(): Promise<PluginHandle> {
    return new Promise<PluginHandle>((resolve, reject) => {
      this.client && this.client.attach({
        plugin: VIDEOROOM_PLUGIN_NAME,
        opaqueId, // TODO new id for video??
        success: resolve,
        error: reject,
        iceState: this.onIceState.bind(this),
        mediaState: this.onMediaState.bind(this),
        webrtcState: this.onWebrtcState.bind(this),
        onmessage: this.onMessage.bind(this),
        onlocalstream: this.onLocalStream,
        onremotestream: this.onRemoteStream.bind(this),
        oncleanup: this.onCleanUp.bind(this)
      });
    });
  }

  private onIceState(state: unknown): void {
    Janus.log(`ICE state changed to ${state}`);
  }

  private onMediaState(medium: 'audio' | 'video', receiving?: boolean): void {
    Janus.log(`Janus ${receiving ? 'started' : 'stopped'} receiving our ${medium}`);
  }

  private onWebrtcState(isConnected: boolean): void {
    Janus.log(`Janus says our WebRTC PeerConnection is ${(isConnected ? 'up' : 'down')} now`);
  }

  private onMessage(message, jsep): void {
    const { audiobridge: event } = message;
    console.log('Janus says: ');
    console.log(message);
    
    if (event) {
      switch (event) {
        case MessagesType.MESSAGE_JOINED: {
          this.onJoin(message as MessageAudioJoin);
          break;
        }
        case MessagesType.MESSAGE_DESTROYED: {
          this.onDestroy(message);
          break;
        }
        case MessagesType.MESSAGE_EVENT: {
          this.onEvent(message);
          break;
        }
        case MessagesType.MESSAGE_STOP_TALKING:
        case MessagesType.MESSAGE_TALKING: {
          this.onTalkingEvent(message as MessageTalkEvent);
          break;
        }
      }
    }

    if (jsep) {
      Janus.log('Handling SDP as well...', jsep);
      this.audioBridgePlugin && this.audioBridgePlugin.handleRemoteJsep({ jsep });
    }
  }

  private onLocalStream (stream: unknown): void {
    Janus.log(' ::: Got a local stream :::');
    Janus.log(stream);
  }

  private onRemoteStream (stream: unknown): void {
    Janus.log(' ::: Got a remote stream :::');
    Janus.log(stream);
    Janus.attachMediaStream(this.audioElement, stream);
  }

  private onCleanUp (): void {
    Janus.log('Cleanup notification');
    this.webrtcUp = false;
  }

  /**
   * When it receives a message from Janus with event 'join'.
   * The message is received when the user is joined and others user are joined.
   * @param message // Message received
   */
  private onJoin(message: MessageAudioJoin): void {
    const { id, participants, room } = message;
    Janus.log(`Successfully joined room ${room} with ID ${this.id}`);

    if (!this.webrtcUp) {
      if (this.user) {
        this.user.id = id;
        this.onUser.next(this.user);
      }
      this.webrtcUp = true;
      this.createOffer();
    }

    if (participants && participants.length > 0) {
      this.addParticipants(participants as Participant[]);
    }
  }

  /**
   * When it receives a message from Janus with event 'destroy'
   * The message is received when the room has been destroyed
   * @param message // Message received
   */
  private onDestroy(message: unknown): void {
    console.error('The room audio has been destroyed', message);
  }

  /**
   * When it receives a message from Janus with event 'event'
   * The message is received when the room has been destroyed
   * @param message // Message received
   */
  private onEvent(message): void {
    const { participants, error, leaving } = message;
    Janus.log(`Received an event ${message}`);

    if (participants && participants.length > 0) {
      this.addParticipants(participants as Participant[]);
    }

    if (error) {
      console.error(error);
    }

    if (leaving) {
      this.removeParticipant(leaving);
    }
  }

  /**
   * When it receives a message from Janus with event 'talking' or 'stopped-talking'
   * The message is received when other user is talking or stop talking.
   * @param message // Message received
   */
  private onTalkingEvent(message: MessageTalkEvent): void {
    const { id, audiobridge: event } = message;
    Janus.log(`User with id ${id} is ${event}`);
    switch (event) {
      case MessagesType.MESSAGE_TALKING: {
        this.onTalking.next(message);
        break;
      }
      case MessagesType.MESSAGE_STOP_TALKING: {
        this.onStopTalking.next(message);
        break;
      }
    }
  }

  private createOffer(): void {
    this.audioBridgePlugin && this.audioBridgePlugin.createOffer({
      media: { video: false },
      success: this.onReceiveSDP.bind(this),
      error: console.error
    });
  }

  private onReceiveSDP(jsep): void {
    const { muted } = this.audioOptions;
    const message = {
      request: 'configure',
      muted
    };
    this.audioBridgePlugin && this.audioBridgePlugin.send({ message, jsep });
  }

  private addParticipants(participants: Participant[]): void {
    participants.forEach((participant) => {
      const exist = this.participants.some((user) => user.id === participant.id);

      if (!exist) {
        this.participants.push(participant);
      } else {
        this.participants = this.participants.map<Participant>((user: Participant) => {
          if (user.id === participant.id) {
            return Object.assign(user, participant);
          }
          return user;
        });
      }
    });

    this.onParticipants.next(this.participants);
  }

  private removeParticipant(leavingId: number): void {
    this.participants = this.participants.filter((participant) => participant.id !== leavingId);
    this.onParticipants.next(this.participants);
  }
}

export { JanusClient };
