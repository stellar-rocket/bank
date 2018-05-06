import Config from '../utils/config'

const config = new Config({sync: true})

module.exports = (app) => {
  app.use((req, res, next) => {
    if (req.query.secret === config.secret) {
      next()
    } else {
      res.status(403)
      res.end('Unauthorized')
    }
  })
}
