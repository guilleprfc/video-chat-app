export type JoinAudioOptions = {
  id?: number, // Unique ID to assign to the participant; optional, assigned by the plugin if missing
  pin?: string, // Password required to join the room, if any; optional
  display?: string, // User name of the participant to visualize it
  muted?: boolean, // Whether user is muted or not
  quality?: number // 0-10, Opus-related complexity to use, the higher the value, the better the quality
  // (but more CPU); optional, default is 4
};
export type Participant = {
  id: number,
  display?: string,
  setup?: boolean,
  muted?: boolean,
  ref?: any
}
export type MessageAudioJoin = {
  audiobridge: 'joined',
  id: number,
  participants: Array<Participant>,
  room: number
};

export type MessageAudioLeave = {
  audiobridge: 'event',
  leaving: number,
  room: number
};

export type MessageTalkEvent = {
  audiobridge: string,
  id: number,
  room: number
};

interface JSEP {}

interface PluginMessage {
  message: {
    request: string;
    [otherProps: string]: any;
  };
  jsep?: JSEP;
  success?: Function;
  error?: (error: any) => void;
}

export interface PluginHandle {
  plugin: string;
  id: string;
  token?: string;
  detached : boolean;
  webrtcStuff: {
    started: boolean,
    myStream: MediaStream,
    streamExternal: boolean,
    remoteStream: MediaStream,
    mySdp: any,
    mediaConstraints: any,
    pc: RTCPeerConnection,
    dataChannel: Array<RTCDataChannel>,
    dtmfSender: any,
    trickle: boolean,
    iceDone: boolean,
    volume: {
      value: number,
      timer: number
    }
  };
  getId(): string;
  getPlugin(): string;
  send(message: PluginMessage): void;
  createOffer(params: any): void;
  createAnswer(params: any): void;
  handleRemoteJsep(params: { jsep: JSEP }): void;
  dtmf(params: any): void;
  data(params: any): void;
  isAudioMuted(): boolean;
  muteAudio(): void;
  unmuteAudio(): void;
  isVideoMuted(): boolean;
  muteVideo(): void;
  unmuteVideo(): void;
  getBitrate(): string;
  hangup(sendRequest?: boolean): void;
  detach(params: any): void;
}

interface Dependencies {
  adapter: any;
  WebSocket: (server: string, protocol: string) => WebSocket;
  isArray: (array: any) => array is Array<any>;
  extension: () => boolean;
  httpAPICall: (url: string, options: any) => void;
}

interface DependenciesResult {
  adapter: any;
  newWebSocket: (server: string, protocol: string) => WebSocket;
  isArray: (array: any) => array is Array<any>;
  extension: () => boolean;
  httpAPICall: (url: string, options: any) => void;
}

interface ConstructorOptions {
  server: string | string[];
  iceServers?: RTCIceServer[];
  ipv6?: boolean;
  withCredentials?: boolean;
  // eslint-disable-next-line camelcase
  max_poll_events?: number;
  destroyOnUnload?: boolean;
  token?: string;
  apisecret?: string;
  success?: Function;
  error?: (error: any) => void;
  destroyed?: Function;
}

enum DebugLevel {
  Trace = 'trace',
  Debug = 'debug',
  Log = 'log',
  Warning = 'warn',
  Error = 'error'
}

interface InitOptions {
  debug?: boolean | 'all' | DebugLevel[];
  callback?: Function;
  dependencies?: DependenciesResult;
}

enum MessageType {
  Recording = 'recording',
  Starting = 'starting',
  Started = 'started',
  Stopped = 'stopped',
  SlowLink = 'slow_link',
  Preparing = 'preparing',
  Refreshing = 'refreshing'
}

interface Message {
  result?: {
    status: MessageType;
    id?: string;
    uplink?: number;
  };
  error?: Error;
}

interface PluginOptions {
  plugin: string;
  opaqueId?: string;
  success?: (handle: PluginHandle) => void;
  error?: (error: any) => void;
  consentDialog?: (on: boolean) => void;
  webrtcState?: (isConnected: boolean) => void;
  iceState?: (state: 'connected' | 'failed') => void;
  mediaState?: (medium: 'audio' | 'video', receiving: boolean, mid?: number) => void;
  slowLink?: (state: { uplink: boolean }) => void;
  onmessage?: (message: Message, jsep?: JSEP) => void;
  onlocalstream?: (stream: MediaStream) => void;
  onremotestream?: (stream: MediaStream) => void;
  ondataopen?: Function;
  ondata?: Function;
  oncleanup?: Function;
  detached?: Function;
}

export interface Janus {
  webRTCAdapter: any;
  safariVp8: boolean;
  useDefaultDependencies(deps: Partial<Dependencies>): DependenciesResult;
  useOldDependencies(deps: Partial<Dependencies>): DependenciesResult;
  init(options: InitOptions): void;
  isWebrtcSupported(): boolean;
  debug(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  randomString(length: number): string;
  attachMediaStream(element: HTMLMediaElement, stream: MediaStream): void;
  reattachMediaStream(to: HTMLMediaElement, from: HTMLMediaElement): void;

  constructor(options: ConstructorOptions);

  getServer(): string;
  isConnected(): boolean;
  getSessionId(): string;
  attach(options: PluginOptions): void;
  destroy(): void;
}

export enum MessagesType {
  MESSAGE_JOINED = 'joined',
  MESSAGE_DESTROYED = 'destroyed',
  MESSAGE_EVENT = 'event',
  MESSAGE_TALKING = 'talking',
  MESSAGE_STOP_TALKING = 'stopped-talking'
}
