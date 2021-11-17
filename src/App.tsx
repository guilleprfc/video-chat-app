import React from 'react';
import { Grid, GridItem } from './layout/Grid'
import AudioChat from './components/audio-chat/audio-chat'
import './scss/app.scss';

const muted = true

const App: React.FC = () => {
  return (
    <Grid>
      <GridItem classItem='Graph' title='Camera'>
        <>
          <div id="myvideo" className="container shorter">
            <video id="localvideo" className="rounded centered" width="100%" height="100%" autoPlay playsInline muted={muted}></video>
          </div>
        </>
      </GridItem>
      <GridItem classItem='Chat' title='Chat room'>
        <AudioChat />
      </GridItem>
    </Grid>
  );
}

export default App;
