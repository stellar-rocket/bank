import Mongoose from 'mongoose'

import Server from './server'
import Rocket from './rocket'
import Config from './utils/config'

const config = new Config({})

config.on('ready', () => {
  const server = new Server()
  const rocket = new Rocket()

  connectDB().then(() => {
    rocket.init().then(() => {
      return server.listen()
    }).catch((err) => {
      console.error(err)
    })
  })
})

function connectDB () {
  return new Promise((resolve, reject) => {
    let username = encodeURIComponent(config.database.username)
    let password = encodeURIComponent(config.database.password)

    let databaseUrl
    if (username && password) {
      databaseUrl = `${config.database.type}://${username}:${password}@${config.database.host}:${config.database.port}/${config.database.database}?authMechanism=DEFAULT`
    } else {
      databaseUrl = `${config.database.type}://${config.database.host}:${config.database.port}/${config.database.database}`
    }

    Mongoose.connect(databaseUrl)
    let db = Mongoose.connection
    db.on('error', (err) => {
      throw err
    })
    db.once('open', resolve)
  })
}
