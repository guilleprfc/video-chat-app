import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route
} from 'react-router-dom';
import ChatRoom from './components/chat-room/chat-room'
import Login from './components/login/login';
import Home from './pages/Home/Home';
import './scss/app.scss';

const App: React.FC = () => {
  return (
    <Router>
      <main className='App'>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/login' element={<Login />} />
          <Route path='/user' element={<ChatRoom />} />
        </Routes>
      </main>
    </Router>
  );
}

export default App;
