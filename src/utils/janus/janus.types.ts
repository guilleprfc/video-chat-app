export type JoinAudioOptions = {
  id?: number // Unique ID to assign to the participant; optional, assigned by the plugin if missing
  pin?: string // Password required to join the room, if any; optional
  display?: string // User name of the participant to visualize it
  muted?: boolean // Whether user is muted or not
  quality?: number // 0-10, Opus-related complexity to use, the higher the value, the better the quality
  // (but more CPU); optional, default is 4
}

export type JoinVideoOptions = {
  id?: number // Unique ID to assign to the participant; optional, assigned by the plugin if missing
  pin?: string // Password required to join the room, if any; optional
  display?: string // User name of the participant to visualize it
  ptype?: string // <publisher|subscriber> Use this parameter to specify whether the user is a publisher or a subscriber in the room
  feed?: string // Id of the participant a subscriber is suscribed to, mandatory when ptype is 'subscriber'
}

export type Room = {
  roomId?: number
  description?: string
  audioRoom?: AudioRoom
  videoRoom?: VideoRoom
  participants?: Array<Participant>
}

export type VideoRoom = {
  room: number // <unique numeric ID>,
  description: string // "<Name of the room>",
  pin_required: boolean // <true|false, whether a PIN is required to join this room>,
  is_private: boolean // <true|false, whether this room is 'private' (as in hidden) or not>,
  max_publishers: number // <how many publishers can actually publish via WebRTC at the same time>,
  bitrate: number // <bitrate cap that should be forced (via REMB) on all publishers by default>,
  bitrate_cap?: boolean // <true|false, whether the above cap should act as a limit to dynamic bitrate changes by publishers (optional)>,
  fir_freq: number // <how often a keyframe request is sent via PLI/FIR to active publishers>,
  require_pvtid: boolean // <true|false, whether subscriptions in this room require a private_id>,
  require_e2ee: boolean // <true|false, whether end-to-end encrypted publishers are required>,
  notify_joining: boolean // <true|false, whether an event is sent to notify all participants if a new participant joins the room>,
  audiocodec: Array<string> // "<comma separated list of allowed audio codecs>",
  videocodec: Array<string> // "<comma separated list of allowed video codecs>",
  opus_fec?: boolean // <true|false, whether inband FEC must be negotiated (note: only available for Opus) (optional)>,
  video_svc?: boolean // <true|false, whether SVC must be done for video (note: only available for VP9 right now) (optional)>,
  record: boolean // <true|false, whether the room is being recorded>,
  rec_dir: string // "<if recording, the path where the .mjr files are being saved>",
  lock_record: boolean // <true|false, whether the room recording state can only be changed providing the secret>,
  num_participants: number // <count of the participants (publishers, active or not; not subscribers)>
  audiolevel_ext: boolean // <true|false, whether the ssrc-audio-level extension must be negotiated or not for new publishers>,
  audiolevel_event: boolean // <true|false, whether to emit event to other users about audiolevel>,
  audio_active_packets?: number // <amount of packets with audio level for checkup (optional, only if audiolevel_event is true)>,
  audio_level_average?: number // <average audio level (optional, only if audiolevel_event is true)>,
  videoorient_ext: boolean // <true|false, whether the video-orientation extension must be negotiated or not for new publishers>,
  playoutdelay_ext: boolean // <true|false, whether the playout-delay extension must be negotiated or not for new publishers>,
  transport_wide_cc_ext: boolean // <true|false, whether the transport wide cc extension must be negotiated or not for new publishers>
  // Additional props
  participants?: Array<VideoParticipant>
}

export type AudioRoom = {
  room: number // <unique numeric ID>,
  description: string // "<Name of the room>",
  pin_required: boolean // <true|false, whether a PIN is required to join this room>,
  sampling_rate: number // <sampling rate of the mixer>,
  spatial_audio: boolean // <true|false, whether the mix has spatial audio (stereo)>,
  record: boolean // <true|false, whether the room is being recorded>,
  num_participants: number // <count of the participants>
  // Additional props
  participants?: Array<AudioParticipant>
}

export type Participant = {
  audioId?: number
  videoId?: number
  display?: string
  setup?: boolean
  muted?: boolean
  publisher?: boolean
  selected?: boolean
  ref?: any
  room?: number
}

export type AudioParticipant = {
  id: number
  display?: string
  setup?: boolean
  muted?: boolean
  ref?: any
}

export type VideoParticipant = {
  id: number
  display?: string
  publisher?: boolean
  selected?: boolean
  ref?: any
}

export type Publisher = {
  id: number
  display: string
  streams: Array<Stream>
}

export type Stream = {
  type: string // <type of published stream #1 (audio|video|data)>
  mindex: string // <unique mindex of published stream #1>
  mid: string // <unique mid of of published stream #1>
  disabled: boolean // <if true, it means this stream is currently inactive/disabled (and so codec, description, etc. will be missing)>
  codec: string // <codec used for published stream #1>
  description: string // <text description of published stream #1, if any>
  moderated: boolean // <true if this stream audio has been moderated for this participant>
  simulcast: boolean // <true if published stream #1 uses simulcast (VP8 and H.264 only)>
  svc: boolean // <true if published stream #1 uses SVC (VP9 only)>
  talking: boolean // <true|false, whether the publisher stream has audio activity or not (only if audio levels are used)>
}

// AUDIOBRIDGE MESSAGES
export type MessageAudioJoin = {
  audiobridge: 'joined'
  id: number
  participants: Array<AudioParticipant>
  room: number
}

export type MessageAudioSuccess = {
  audiobridge: 'success',
  list: Array<AudioRoom>,
}

export type MessageAudioParticipants = {
  audiobridge: 'participants'
  room: number
  participants: Array<AudioParticipant>
}

export type MessageAudioLeave = {
  audiobridge: 'event'
  leaving: number
  room: number
}

export type MessageTalkEvent = {
  audiobridge: string
  id: number
  room: number
}

// VIDEOROOM MESSAGES
export type MessageVideoJoin = {
  videoroom: 'joined'
  id: number
  publishers: Array<Publisher>
  room: number
  display: string
}

export type MessageVideoSuccess = {
  videoroom: 'success',
  list: Array<VideoRoom>,
}

export type MessageVideoParticipants = {
  videoroom: 'participants'
  room: number
  participants: Array<VideoParticipant>
}

interface JSEP {}

interface PluginMessage {
  message: {
    request: string
    [otherProps: string]: any
  }
  jsep?: JSEP
  success?: Function
  error?: (error: any) => void
}

export interface PluginHandle {
  plugin: string
  id: string
  token?: string
  detached: boolean
  webrtcStuff: {
    started: boolean
    myStream: MediaStream
    streamExternal: boolean
    remoteStream: MediaStream
    mySdp: any
    mediaConstraints: any
    pc: RTCPeerConnection
    dataChannel: Array<RTCDataChannel>
    dtmfSender: any
    trickle: boolean
    iceDone: boolean
    volume: {
      value: number
      timer: number
    }
  }
  getId(): string
  getPlugin(): string
  send(message: PluginMessage): void
  createOffer(params: any): void
  createAnswer(params: any): void
  handleRemoteJsep(params: { jsep: JSEP }): void
  dtmf(params: any): void
  data(params: any): void
  isAudioMuted(): boolean
  muteAudio(): void
  unmuteAudio(): void
  isVideoMuted(): boolean
  muteVideo(): void
  unmuteVideo(): void
  getBitrate(): string
  hangup(sendRequest?: boolean): void
  detach(params: any): void
}

interface Dependencies {
  adapter: any
  WebSocket: (server: string, protocol: string) => WebSocket
  isArray: (array: any) => array is Array<any>
  extension: () => boolean
  httpAPICall: (url: string, options: any) => void
}

interface DependenciesResult {
  adapter: any
  newWebSocket: (server: string, protocol: string) => WebSocket
  isArray: (array: any) => array is Array<any>
  extension: () => boolean
  httpAPICall: (url: string, options: any) => void
}

interface ConstructorOptions {
  server: string | string[]
  iceServers?: RTCIceServer[]
  ipv6?: boolean
  withCredentials?: boolean
  // eslint-disable-next-line camelcase
  max_poll_events?: number
  destroyOnUnload?: boolean
  token?: string
  apisecret?: string
  success?: Function
  error?: (error: any) => void
  destroyed?: Function
}

enum DebugLevel {
  Trace = 'trace',
  Debug = 'debug',
  Log = 'log',
  Warning = 'warn',
  Error = 'error',
}

interface InitOptions {
  debug?: boolean | 'all' | DebugLevel[]
  callback?: Function
  dependencies?: DependenciesResult
}

enum MessageType {
  Recording = 'recording',
  Starting = 'starting',
  Started = 'started',
  Stopped = 'stopped',
  SlowLink = 'slow_link',
  Preparing = 'preparing',
  Refreshing = 'refreshing',
}

interface Message {
  result?: {
    status: MessageType
    id?: string
    uplink?: number
  }
  error?: Error
}

interface PluginOptions {
  plugin: string
  opaqueId?: string
  success?: (handle: PluginHandle) => void
  error?: (error: any) => void
  consentDialog?: (on: boolean) => void
  webrtcState?: (isConnected: boolean) => void
  iceState?: (state: 'connected' | 'failed') => void
  mediaState?: (
    medium: 'audio' | 'video',
    receiving: boolean,
    mid?: number
  ) => void
  slowLink?: (state: { uplink: boolean }) => void
  onmessage?: (message: Message, jsep?: JSEP) => void
  onlocalstream?: (stream: MediaStream) => void
  onremotestream?: (stream: MediaStream) => void
  ondataopen?: Function
  ondata?: Function
  oncleanup?: Function
  detached?: Function
}

export interface Janus {
  webRTCAdapter: any
  safariVp8: boolean
  useDefaultDependencies(deps: Partial<Dependencies>): DependenciesResult
  useOldDependencies(deps: Partial<Dependencies>): DependenciesResult
  init(options: InitOptions): void
  isWebrtcSupported(): boolean
  debug(...args: any[]): void
  log(...args: any[]): void
  warn(...args: any[]): void
  error(...args: any[]): void
  randomString(length: number): string
  attachMediaStream(element: HTMLMediaElement, stream: MediaStream): void
  reattachMediaStream(to: HTMLMediaElement, from: HTMLMediaElement): void

  constructor(options: ConstructorOptions)

  getServer(): string
  isConnected(): boolean
  getSessionId(): string
  attach(options: PluginOptions): void
  destroy(): void
}

export enum MessagesType {
  MESSAGE_JOINED = 'joined',
  MESSAGE_DESTROYED = 'destroyed',
  MESSAGE_EVENT = 'event',
  MESSAGE_TALKING = 'talking',
  MESSAGE_STOP_TALKING = 'stopped-talking',
  MESSAGE_UPDATE = 'updated',
  MESSAGE_ATTACHED = 'attached',
  MESSAGE_PARTICIPANTS = 'participants'
}
