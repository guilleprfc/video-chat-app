import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Grid, GridItem } from '../../layout/Grid'
import './login.scss'
import '../../scss/button.scss'

const Login: React.FC = () => {
  const [name, setName] = useState<string>('')
  // const [pwd, setPwd] = useState<string>('')
  // const [credError, setCredError] = useState<boolean>(false)
  const navigate = useNavigate()

  // const checkCredentials = (name, pwd) => {
  //   // Check if the info is good against the DB
  //   if (name === 'Guide' && pwd === '1234') {
  //     return true
  //   } else {
  //     return false
  //   }
  // }

  const onSumbitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // setCredError(false)
    // if (checkCredentials(name, pwd)) {
    //   navigate('/user')
    // } else {
    //   setCredError(true)
    //   setName('')
    //   setPwd('')
    // }

    navigate('/user?name=' + name)
  }

  const onChangeNameInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target
    setName(value)
  }

  // const onChangePwdInput = (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const { value } = event.target
  //   setPwd(value)
  // }

  return (
    <div className="login-grid">
      <Grid>
        <GridItem classItem="Login" title="Login">
          <>
            <div id="login" className="item__login">
              {/* <div className="error-container">
                <label
                  className={`form-label text-tertiary mb-2 error-prompt ${
                    credError ? '' : 'hide'
                  }`}
                >
                  Username or password are incorrect, please try again.
                </label>
              </div> */}
              <form className="login__form" onSubmit={onSumbitForm}>
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
                    onChange={onChangeNameInput}
                  />
                  {/* <label
                    htmlFor="inputName"
                    className="form-label text-tertiary mb-2"
                  >
                    Password
                  </label>
                  <input
                    id="inputName"
                    className="form-control"
                    type="password"
                    onChange={onChangePwdInput}
                  /> */}
                </div>
                <button
                  className="btn button-primary w-100 mb-3"
                  disabled={name === ''}
                >
                  Enter
                </button>
              </form>
            </div>
          </>
        </GridItem>
      </Grid>
    </div>
  )
}

export default Login
